/**
 * Indicators Resource
 *
 * Server-calculated market indicators under `/v1/indicators/*`: gas-to-oil
 * fuel-switching parity, enriched price context, storage analytics, market
 * annotations and CFTC Commitments of Traders positioning.
 *
 * Every type here was taken from live production responses on 2026-09-13
 * (#112) and from the serializers in the API's
 * `app/services/calculated_metrics/`. The previous types described fields no
 * route sends, `cftcPositioning()` was typed as an array, and `priceContext()`
 * and `annotations()` could not send the `code` their routes require.
 *
 * `/v1/indicators/` also routes a trades endpoint that has never returned data
 * in production (HTTP 404 `DATA_NOT_AVAILABLE`, api#8478). With no observed
 * response shape to type, it is not exposed.
 *
 * Access requires a paid plan (Developer and above). Other plans receive
 * HTTP 403 with code `PREMIUM_REQUIRED`; detect it with `isEntitlementError`.
 */

import type { OilPriceAPI } from "../client.js";
import { ValidationError } from "../errors.js";
import {
  compactParams,
  dateRangeParams,
  getMetric,
  getMetricList,
  isHistory,
  isRecord,
  matches,
  optionalSelector,
  requireSelector,
  type MetricsDateRangeOptions,
} from "./calculated-metrics.js";
import type { HistoryPeriod, PricedLeg } from "./spreads.js";

/**
 * Codes `/v1/indicators/annotations/batch` annotates per request. The route
 * silently drops the rest while still counting them in `total_codes`
 * (measured 2026-09-14: 21 codes sent, 20 annotated).
 */
export const ANNOTATIONS_BATCH_MAX_CODES = 20;

// ---------------------------------------------------------------------------
// Fuel switching
// ---------------------------------------------------------------------------

export interface OilParity {
  /** Gas price as a percentage of oil's energy-equivalent price */
  ratio_pct: number;
  threshold_pct: number;
  /** e.g. `gas_cheap_vs_oil`, `approaching_parity`, `gas_expensive_vs_oil` */
  signal: string;
  /** Gas price, USD/MMBtu, at which gas reaches oil parity */
  parity_price: number;
  current_gas: number;
  headroom_pct: number;
}

export interface EnergyEquivalent {
  crude_per_mmbtu: number;
  gas_premium_discount: number;
}

/** Trailing-year context. `{}` with fewer than 10 observations. */
export interface FuelSwitchingContext {
  times_above_parity_last_year?: number;
  pct_above_parity?: number;
  avg_ratio_1y?: number;
  max_ratio_1y?: number;
  min_ratio_1y?: number;
  data_points?: number;
}

/** `GET /v1/indicators/fuel-switching`. */
export interface FuelSwitching {
  oil_parity: OilParity;
  components: { gas: PricedLeg; crude: PricedLeg };
  energy_equivalent: EnergyEquivalent;
  historical_context: FuelSwitchingContext;
  timestamp: string;
}

export interface FuelSwitchingPoint {
  date: string;
  ratio_pct: number;
  above_parity: boolean;
  gas_price: number;
  crude_price: number;
}

/** `GET /v1/indicators/fuel-switching/historical`. */
export interface FuelSwitchingHistory {
  gas_benchmark: string;
  crude_benchmark: string;
  period: HistoryPeriod;
  count: number;
  data: FuelSwitchingPoint[];
}

/** Options for {@link IndicatorsResource.fuelSwitching}. */
export interface FuelSwitchingOptions {
  /** `NATURAL_GAS_USD` (server default), `DUTCH_TTF_NATURAL_GAS_USD` or `NATURAL_GAS_WAHA` */
  gas?: string;
  /** `BRENT_CRUDE_USD` (server default), `WTI_USD` or `BRENT_SPOT_USD` */
  crude?: string;
}

/** Options for {@link IndicatorsResource.fuelSwitchingHistorical}. */
export interface FuelSwitchingHistoryOptions extends FuelSwitchingOptions, MetricsDateRangeOptions {}

// ---------------------------------------------------------------------------
// Price context
// ---------------------------------------------------------------------------

/**
 * Where the latest price sits. `anomaly` is always sent; every other metric
 * only when the server had enough history to compute it.
 */
export interface PriceContextDetail {
  anomaly: boolean;
  /** Present only when `anomaly` is true */
  anomaly_reason?: string;
  change_1d?: number;
  change_1d_pct?: number;
  change_1w?: number;
  change_1w_pct?: number;
  change_1m?: number;
  change_1m_pct?: number;
  high_52w?: number;
  low_52w?: number;
  percentile_1y?: number;
  percentile_5y?: number;
}

/**
 * A spread related to the requested code. `value` is a number for basis,
 * crack and parity entries, and a structure label (`backwardation`) for the
 * curve-structure entry, which carries `slope` and no `unit`.
 */
export interface RelatedSpread {
  name: string;
  value: number | string;
  signal: string | null;
  unit?: string;
  slope?: number;
}

/** `GET /v1/indicators/price-context`. */
export interface PriceContext {
  code: string;
  price: number;
  timestamp: string;
  context: PriceContextDetail;
  /** Present only when requested with `relatedSpreads: true` */
  related_spreads?: RelatedSpread[];
}

/** Options for {@link IndicatorsResource.priceContext}. */
export interface PriceContextOptions {
  /** Also return spreads related to the code (`spreads=related`) */
  relatedSpreads?: boolean;
}

// ---------------------------------------------------------------------------
// Storage analytics
// ---------------------------------------------------------------------------

export interface StorageCurrent {
  volume_mmbbl: number;
  utilization_pct: number | null;
  operational_capacity_mmbbl: number;
  /** Report date as an ISO timestamp */
  data_date: string;
  timestamp: string;
}

/** `{}` when the latest report has no weekly change. */
export interface StorageDrawRate {
  weekly_mmbbl?: number;
  annualized_mmbbl?: number;
  /** `build`, `draw` or `flat` */
  type?: string;
  /** Null unless the location is drawing */
  days_to_depletion?: number | null;
}

/** `{}` with fewer than three same-week observations in five years. */
export interface StorageSeasonal {
  five_year_avg_mmbbl?: number;
  five_year_min_mmbbl?: number;
  five_year_max_mmbbl?: number;
  deviation_from_avg_pct?: number;
  position?: string;
}

/** Flags the server could evaluate; the detail keys appear only when a flag is true. */
export interface StorageAnomalies {
  unusual_change?: boolean;
  unusual_change_detail?: string;
  utilization_extreme?: boolean;
  utilization_detail?: string;
  statistical_outlier?: boolean;
  z_score?: number;
}

/** `{}` when there is no data in the trailing 52 weeks. */
export interface StorageRange {
  high_mmbbl?: number;
  low_mmbbl?: number;
}

/** `GET /v1/indicators/storage-analytics`, and each entry of `/all`. */
export interface StorageAnalytics {
  /** `CUSHING` or `SPR` */
  location: string;
  name: string;
  current: StorageCurrent;
  draw_rate: StorageDrawRate;
  seasonal: StorageSeasonal;
  anomalies: StorageAnomalies;
  range_52w: StorageRange;
  signal: string | null;
  trading_implication: string | null;
}

/** Options for {@link IndicatorsResource.storageAnalytics}. */
export interface StorageAnalyticsOptions {
  /** `CUSHING` (server default) or `SPR` */
  location?: string;
}

// ---------------------------------------------------------------------------
// Market annotations
// ---------------------------------------------------------------------------

/**
 * One notable condition. Extra fields depend on `type`: `anomaly`
 * (`z_score`, `mean_90d`), `velocity` (`pct_change_5d`, `z_score`), `streak`
 * (`direction`, `streak_days`), `record` (`record_type`).
 */
export interface MarketAnnotation {
  type: string;
  severity: string;
  message: string;
  z_score?: number;
  mean_90d?: number;
  pct_change_5d?: number;
  direction?: string;
  streak_days?: number;
  record_type?: string;
}

/** `GET /v1/indicators/annotations`. */
export interface MarketAnnotations {
  code: string;
  price: number;
  timestamp: string;
  annotation_count: number;
  annotations: MarketAnnotation[];
}

/**
 * `GET /v1/indicators/annotations/batch`. `annotated` omits codes with no data
 * and codes with no annotations, so it can be shorter than `total_codes`.
 */
export interface MarketAnnotationsBatch {
  annotated: MarketAnnotations[];
  total_codes: number;
  codes_with_annotations: number;
}

// ---------------------------------------------------------------------------
// CFTC positioning
// ---------------------------------------------------------------------------

/** Components the report does not publish for a market are null. */
export interface CftcSpeculativePosition {
  net: number;
  long: number | null;
  short: number | null;
  net_pct_of_oi: number | null;
}

export interface CftcCommercialPosition {
  net: number | null;
}

export interface CftcPositions {
  speculative: CftcSpeculativePosition;
  commercial: CftcCommercialPosition;
  open_interest: number | null;
}

/** `GET /v1/indicators/cftc-positioning`, and each entry of `/all`. */
export interface CftcPositioning {
  /** `WTI`, `BRENT`, `NATURAL_GAS`, `HEATING_OIL` or `GASOLINE` */
  commodity: string;
  name: string;
  /** `YYYY-MM-DD` */
  report_date: string;
  positioning: CftcPositions;
  /** e.g. `neutral`, `net_long`, `extreme_short`, `insufficient_data` */
  signal: string;
  percentile_1y: number | null;
  /** Change in speculative net since a week earlier, or null */
  week_change: number | null;
  timestamp: string;
}

export interface CftcPositioningPoint {
  date: string;
  spec_net: number;
  open_interest: number | null;
  /**
   * Speculative net as a percentage of open interest, or null when open
   * interest is unknown. Production sends 0 for every row today (api#8476);
   * do not read a 0 as "flat" until that is fixed.
   */
  spec_net_pct_oi: number | null;
}

/** `GET /v1/indicators/cftc-positioning/historical`. */
export interface CftcPositioningHistory {
  commodity: string;
  period: HistoryPeriod;
  count: number;
  data: CftcPositioningPoint[];
}

/** Options for {@link IndicatorsResource.cftcPositioning}. */
export interface CftcPositioningOptions {
  /** `WTI` (server default), `BRENT`, `NATURAL_GAS`, `HEATING_OIL` or `GASOLINE` */
  commodity?: string;
}

/** Options for {@link IndicatorsResource.cftcPositioningHistorical}. */
export interface CftcPositioningHistoryOptions extends CftcPositioningOptions, MetricsDateRangeOptions {}

// ---------------------------------------------------------------------------
// Deprecated names (#112)
// ---------------------------------------------------------------------------

/**
 * @deprecated Parameter of the removed untyped `get()`, which could not send
 * the parameters the routes require. Call the named method instead.
 */
export type IndicatorType =
  | "fuel-switching"
  | "price-context"
  | "storage-analytics"
  | "annotations"
  | "cftc-positioning";

/** @deprecated Described `value`, `economical`, `from_fuel`, which the route never sent. Alias of {@link FuelSwitching}. */
export type FuelSwitchingIndicator = FuelSwitching;

/** @deprecated Described top-level `percentile`, `high_52w`; they are under `context`. Alias of {@link PriceContext}. */
export type PriceContextIndicator = PriceContext;

/** @deprecated Described `level`, `capacity_percent`; the route nests them under `current`. Alias of {@link StorageAnalytics}. */
export type StorageAnalyticsIndicator = StorageAnalytics;

/** @deprecated Described `title`, `date`, `category`, which the route never sent. Alias of {@link MarketAnnotation}. */
export type AnnotationIndicator = MarketAnnotation;

/** @deprecated Described `managed_money_long`, `net_position`; positions are under `positioning`. Alias of {@link CftcPositioning}. */
export type CFTCPositioningIndicator = CftcPositioning;

// ---------------------------------------------------------------------------
// Shape checks
// ---------------------------------------------------------------------------

const isStorage = (v: unknown) =>
  matches(v, {
    location: "string",
    name: "string",
    current: "record",
    draw_rate: "record",
    seasonal: "record",
    anomalies: "record",
    range_52w: "record",
  }) && matches(v.current, { volume_mmbbl: "number" });

const isAnnotations = (v: unknown) =>
  matches(v, {
    code: "string",
    price: "number",
    timestamp: "string",
    annotation_count: "number",
    annotations: "array",
  }) && (v.annotations as unknown[]).every((a) => matches(a, { type: "string", message: "string" }));

const isCftc = (v: unknown) =>
  matches(v, {
    commodity: "string",
    name: "string",
    report_date: "string",
    positioning: "record",
    signal: "string",
    timestamp: "string",
  }) &&
  isRecord(v.positioning) &&
  matches(v.positioning.speculative, { net: "number" });

/**
 * Indicators Resource
 *
 * @example
 * ```typescript
 * import { OilPriceAPI } from 'oilpriceapi';
 *
 * const client = new OilPriceAPI({ apiKey: 'your_key' });
 *
 * const parity = await client.indicators.fuelSwitching();
 * console.log(`${parity.oil_parity.ratio_pct}% of oil parity: ${parity.oil_parity.signal}`);
 *
 * const ctx = await client.indicators.priceContext('BRENT_CRUDE_USD');
 * console.log(`1y percentile: ${ctx.context.percentile_1y}`);
 *
 * const cftc = await client.indicators.cftcPositioning({ commodity: 'WTI' });
 * console.log(`Speculative net: ${cftc.positioning.speculative.net}`);
 * ```
 */
export class IndicatorsResource {
  constructor(private client: OilPriceAPI) {}

  /**
   * Gas-to-oil parity (fuel-switching economics).
   *
   * @throws {ValidationError} If an option is present but blank
   * @throws {NotFoundError} Invalid gas or crude code
   */
  async fuelSwitching(options?: FuelSwitchingOptions): Promise<FuelSwitching> {
    const params = compactParams({
      gas: optionalSelector(options?.gas, "gas"),
      crude: optionalSelector(options?.crude, "crude"),
    });
    return getMetric(this.client, "/v1/indicators/fuel-switching", params, "a fuel-switching indicator", (d) =>
      matches(d, {
        oil_parity: "record",
        components: "record",
        energy_equivalent: "record",
        historical_context: "record",
        timestamp: "string",
      }) && matches(d.oil_parity, { ratio_pct: "number", signal: "string" }),
    );
  }

  /** Daily gas-to-oil parity history (server default: last 90 days). */
  async fuelSwitchingHistorical(options?: FuelSwitchingHistoryOptions): Promise<FuelSwitchingHistory> {
    const params = {
      ...compactParams({
        gas: optionalSelector(options?.gas, "gas"),
        crude: optionalSelector(options?.crude, "crude"),
      }),
      ...dateRangeParams(options),
    };
    return getMetric(
      this.client,
      "/v1/indicators/fuel-switching/historical",
      params,
      "a fuel-switching history",
      (d) => isHistory(d, { gas_benchmark: "string", crude_benchmark: "string" }, { ratio_pct: "number" }),
    );
  }

  /**
   * Latest price for a commodity code with historical context.
   *
   * @param code - Commodity code, e.g. `BRENT_CRUDE_USD`
   * @param options - `relatedSpreads: true` also returns related spreads
   * @throws {ValidationError} If `code` is missing or blank (the route answers 400)
   * @throws {NotFoundError} No data for `code`
   */
  async priceContext(code: string, options?: PriceContextOptions): Promise<PriceContext> {
    const params: Record<string, string> = { code: requireSelector(code, "code") };
    if (options?.relatedSpreads) params.spreads = "related";
    return getMetric(this.client, "/v1/indicators/price-context", params, "a price context", (d) =>
      matches(d, { code: "string", price: "number", timestamp: "string", context: "record" }) &&
      matches(d.context, { anomaly: "boolean" }),
    );
  }

  /** Storage analytics for `CUSHING` (server default) or `SPR`. */
  async storageAnalytics(options?: StorageAnalyticsOptions): Promise<StorageAnalytics> {
    const params = compactParams({ location: optionalSelector(options?.location, "location") });
    return getMetric(this.client, "/v1/indicators/storage-analytics", params, "storage analytics", isStorage);
  }

  /** Storage analytics for every location with data. */
  async storageAnalyticsAll(): Promise<StorageAnalytics[]> {
    return getMetricList(this.client, "/v1/indicators/storage-analytics/all", "locations", "storage analytics", isStorage);
  }

  /**
   * Notable-condition annotations (anomaly, velocity, streak, 52-week record)
   * for a commodity code.
   *
   * @throws {ValidationError} If `code` is missing or blank (the route answers 400)
   */
  async annotations(code: string): Promise<MarketAnnotations> {
    const params = { code: requireSelector(code, "code") };
    return getMetric(this.client, "/v1/indicators/annotations", params, "market annotations", isAnnotations);
  }

  /**
   * Annotations for up to {@link ANNOTATIONS_BATCH_MAX_CODES} codes in one request.
   *
   * @throws {ValidationError} Empty list, a blank code, a code containing a
   *   comma, or more than 20 codes (the route silently annotates only the first 20)
   */
  async annotationsBatch(codes: readonly string[]): Promise<MarketAnnotationsBatch> {
    if (!Array.isArray(codes)) {
      throw new ValidationError("codes must be an array of commodity codes");
    }
    if (codes.length === 0) {
      throw new ValidationError("codes must contain at least one commodity code");
    }
    if (codes.length > ANNOTATIONS_BATCH_MAX_CODES) {
      throw new ValidationError(
        `codes accepts at most ${ANNOTATIONS_BATCH_MAX_CODES} commodity codes per call (got ${codes.length}); ` +
          "the API silently ignores the rest",
      );
    }
    const cleaned = codes.map((code) => {
      const text = requireSelector(code, "each code");
      if (text.includes(",")) throw new ValidationError(`commodity codes may not contain "," (got "${text}")`);
      return text;
    });
    return getMetric(
      this.client,
      "/v1/indicators/annotations/batch",
      { codes: cleaned.join(",") },
      "a market annotations batch",
      (d) =>
        matches(d, { annotated: "array", total_codes: "number", codes_with_annotations: "number" }) &&
        (d.annotated as unknown[]).every(isAnnotations),
    );
  }

  /**
   * Latest CFTC Commitments of Traders positioning for one market.
   *
   * @param options - `commodity`; server default `WTI`
   */
  async cftcPositioning(options?: CftcPositioningOptions): Promise<CftcPositioning> {
    const params = compactParams({ commodity: optionalSelector(options?.commodity, "commodity") });
    return getMetric(this.client, "/v1/indicators/cftc-positioning", params, "a CFTC positioning report", isCftc);
  }

  /** Weekly CFTC speculative net positioning history (server default: last 90 days). */
  async cftcPositioningHistorical(options?: CftcPositioningHistoryOptions): Promise<CftcPositioningHistory> {
    const params = {
      ...compactParams({ commodity: optionalSelector(options?.commodity, "commodity") }),
      ...dateRangeParams(options),
    };
    return getMetric(
      this.client,
      "/v1/indicators/cftc-positioning/historical",
      params,
      "a CFTC positioning history",
      (d) => isHistory(d, { commodity: "string" }, { spec_net: "number" }),
    );
  }

  /** Latest positioning for every market with data. */
  async cftcPositioningAll(): Promise<CftcPositioning[]> {
    return getMetricList(
      this.client,
      "/v1/indicators/cftc-positioning/all",
      "commodities",
      "CFTC positioning reports",
      isCftc,
    );
  }
}
