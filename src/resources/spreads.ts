/**
 * Spreads Resource
 *
 * Server-calculated spreads under `/v1/spreads/*`: crack spreads, the European
 * gasoil crack, basis differentials, futures curve structure, refinery margins
 * and physical-vs-futures premiums.
 *
 * Every type here was taken from live production responses on 2026-09-13
 * (#112) and from the serializers in the API's
 * `app/services/calculated_metrics/`. The previous types described `type`,
 * `components: string[]` and a bare `value` on every route; no route sends
 * that shape, and `basis()` / `curveStructure()` could not send the parameter
 * their routes require.
 *
 * Access requires a paid plan (Developer and above). Other plans receive
 * HTTP 403 with code `PREMIUM_REQUIRED`; detect it with `isEntitlementError`.
 */

import type { OilPriceAPI } from "../client.js";
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

export type { MetricsDateRangeOptions } from "./calculated-metrics.js";

// ---------------------------------------------------------------------------
// Shared building blocks
// ---------------------------------------------------------------------------

/**
 * 1-day / 1-week / 1-month deltas. The server only sends a pair when a prior
 * value exists for that horizon, so an absent horizon is `undefined`, not 0.
 */
export interface MetricChanges {
  change_1d?: number;
  change_1d_pct?: number;
  change_1w?: number;
  change_1w_pct?: number;
  change_1m?: number;
  change_1m_pct?: number;
}

/** The window the server applied (it echoes its defaults), as `YYYY-MM-DD`. */
export interface HistoryPeriod {
  start: string;
  end: string;
}

/** What a crack history actually contains, as opposed to what was asked. */
export interface HistoryCoverage {
  /** First date returned, or null when nothing was */
  from: string | null;
  /** Last date returned, or null when nothing was */
  to: string | null;
  observations: number;
  /** False when the data starts after the requested start */
  complete: boolean;
}

/** One priced input to a spread. */
export interface PricedLeg {
  code: string;
  price: number;
  unit: string;
}

// ---------------------------------------------------------------------------
// Crack spreads
// ---------------------------------------------------------------------------

/**
 * Legs of a crack spread: `crude` + `product` for a single-product crack,
 * `crude` + `gasoline` + `diesel` for the 3-2-1 composite.
 */
export interface CrackSpreadComponents {
  crude: PricedLeg;
  product?: PricedLeg;
  gasoline?: PricedLeg;
  diesel?: PricedLeg;
}

/** `GET /v1/spreads/crack`, and each entry of `/crack/all`. */
export interface CrackSpread {
  /** `3-2-1`, `jet`, `diesel` or `gasoline` */
  spread_type: string;
  crude_benchmark: string;
  value: number;
  /** `USD/bbl` */
  unit: string;
  components: CrackSpreadComponents;
  /** Oldest input's timestamp */
  timestamp: string;
  changes: MetricChanges;
  /**
   * `true` when an input is older than 24 hours. Absent means "not flagged",
   * not "fresh": the 3-2-1 composite never sends it today (api#8477).
   */
  data_stale?: true;
  stale_warning?: string;
}

/** `GET /v1/spreads/crack/all`. Types without data are omitted by the server. */
export interface CrackSpreadList {
  crude_benchmark: string;
  spreads: CrackSpread[];
}

/** One day of crack history. */
export interface CrackSpreadPoint {
  date: string;
  value: number;
  crude: number;
  /** Single-product cracks */
  product?: number;
  /** 3-2-1 composite */
  gasoline?: number;
  /** 3-2-1 composite */
  diesel?: number;
}

/** `GET /v1/spreads/crack/historical`. */
export interface CrackSpreadHistory {
  spread_type: string;
  crude_benchmark: string;
  period: HistoryPeriod;
  /** Compare with `period` before assuming the whole window is present */
  coverage: HistoryCoverage;
  /** When the underlying inputs were last restated, or null */
  data_revised_at: string | null;
  count: number;
  data: CrackSpreadPoint[];
}

/** Options for {@link SpreadsResource.crack}. */
export interface CrackSpreadOptions {
  /** `3-2-1` (server default), `jet`, `diesel` or `gasoline` */
  type?: string;
  /**
   * `BRENT_CRUDE_USD` (server default), `WTI_USD`, `BRENT_SPOT_USD` or
   * `WTI_SPOT_USD`
   */
  crude?: string;
}

/** Options for {@link SpreadsResource.crackHistorical}. */
export interface CrackSpreadHistoryOptions extends CrackSpreadOptions, MetricsDateRangeOptions {}

/** Options for {@link SpreadsResource.crackAll}. */
export interface CrackSpreadAllOptions {
  /** Crude benchmark code; server default `BRENT_CRUDE_USD` */
  crude?: string;
}

/** A futures leg of the gasoil crack, with its contract month. */
export interface GasoilCrackLeg {
  code: string;
  /** `YYYY-MM`, or null when the code carries no month */
  contract_month: string | null;
  updated_at: string;
  price: number;
  /** `USD/tonne` for gasoil, `USD/bbl` for Brent */
  unit: string;
  /** Present only when the contract has a settlement date */
  settlement_date?: string;
}

/** The tonne-to-barrel conversion the server applied. */
export interface GasoilCrackConversion {
  barrels_per_tonne: number;
  basis: string;
  gasoil_usd_per_bbl: number;
}

/** `GET /v1/spreads/gasoil-crack` (ICE Low Sulphur Gasoil vs ICE Brent). */
export interface GasoilCrackSpread {
  spread_type: string;
  name: string;
  value: number;
  unit: string;
  components: { product: GasoilCrackLeg; crude: GasoilCrackLeg };
  conversion: GasoilCrackConversion;
  timestamp: string;
  updated_at: string;
  /** `true` when a leg is older than 24 hours; absent means "not flagged" */
  data_stale?: true;
  stale_warning?: string;
}

// ---------------------------------------------------------------------------
// Basis spreads
// ---------------------------------------------------------------------------

/** `GET /v1/spreads/basis`, and each entry of `/basis/all`. */
export interface BasisSpread {
  /** e.g. `BRENT_WTI` */
  pair: string;
  spread_name: string;
  /** First leg minus second leg */
  value: number;
  unit: string;
  /** Each leg's commodity code mapped to its price */
  components: Record<string, number>;
  /** e.g. `normal`, `widening`, `severe_bottleneck`, `insufficient_data` */
  signal: string;
  timestamp: string;
  /** Null with fewer than 10 days of trailing history */
  percentile_1y: number | null;
  changes: MetricChanges;
  /** Only for pairs that track it (`WAHA_HH`) */
  negative_streak_days?: number;
  data_stale?: true;
  stale_warning?: string;
}

/** One day of basis history: `value = code_a - code_b`. */
export interface BasisSpreadPoint {
  date: string;
  value: number;
  code_a: number;
  code_b: number;
}

/** `GET /v1/spreads/basis/historical`. */
export interface BasisSpreadHistory {
  pair: string;
  period: HistoryPeriod;
  count: number;
  data: BasisSpreadPoint[];
}

// ---------------------------------------------------------------------------
// Curve structure
// ---------------------------------------------------------------------------

export interface CurveMonth {
  price: number;
  /** e.g. `Nov 2026` */
  contract: string;
}

/** Front month minus later months. The server omits a horizon it cannot compute. */
export interface CurveStructureSpreads {
  m1_m3?: number;
  m1_m6: number;
  m1_m12?: number;
}

/** `GET /v1/spreads/curve-structure`, and each entry of `/all`. */
export interface CurveStructure {
  /** e.g. `ICE_BRENT` */
  commodity: string;
  display_name: string;
  /** `backwardation`, `contango` or `flat` */
  structure: string;
  /** `flat`, `mild`, `moderate`, `steep` or `extreme` */
  severity: string;
  term_slope_pct: number;
  spreads: CurveStructureSpreads;
  front_month: CurveMonth;
  back_month_6: CurveMonth;
  curve_points: number;
  signal: string;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Refinery margins
// ---------------------------------------------------------------------------

export interface MarginCrudeInput {
  code: string;
  price: number;
}

export interface MarginProduct {
  yield_pct: number;
  price: number;
  code: string;
}

/** `GET /v1/spreads/margin`, and each entry of `/margin/all`. */
export interface RefineryMargin {
  /** `usgc`, `singapore` or `nwe` */
  index: string;
  name: string;
  margin_usd_bbl: number;
  crude_input: MarginCrudeInput;
  /** Keyed by product; only products the server had a price for */
  product_basket: Record<string, MarginProduct>;
  /** `depressed`, `normal`, `elevated` or `extreme` */
  signal: string;
  percentile_1y: number | null;
  changes: MetricChanges;
  timestamp: string;
}

export interface RefineryMarginPoint {
  date: string;
  margin: number;
  crude: number;
  revenue: number;
}

/** `GET /v1/spreads/margin/historical`. */
export interface RefineryMarginHistory {
  index: string;
  period: HistoryPeriod;
  count: number;
  data: RefineryMarginPoint[];
}

/** Options for {@link SpreadsResource.margin}. */
export interface RefineryMarginOptions {
  /** `usgc` (server default), `singapore` or `nwe` */
  index?: string;
}

/** Options for {@link SpreadsResource.marginHistorical}. */
export interface RefineryMarginHistoryOptions extends RefineryMarginOptions, MetricsDateRangeOptions {}

// ---------------------------------------------------------------------------
// Physical premium
// ---------------------------------------------------------------------------

export interface PhysicalPremiumLeg {
  code: string;
  price: number;
  /** Futures leg only, e.g. `Continuous` or `Nov 2026` */
  contract?: string;
}

/** `GET /v1/spreads/physical-premium`, and each entry of `/all`. */
export interface PhysicalPremium {
  /** `BRENT` or `WTI` */
  commodity: string;
  name: string;
  /** Spot minus futures */
  premium: number;
  premium_pct: number;
  unit: string;
  components: { spot: PhysicalPremiumLeg; futures: PhysicalPremiumLeg };
  signal: string;
  elevated_streak_days: number;
  percentile_1y: number | null;
  timestamp: string;
  data_stale?: true;
  stale_warning?: string;
}

export interface PhysicalPremiumPoint {
  date: string;
  premium: number;
  premium_pct: number;
  spot: number;
  futures: number;
}

/** `GET /v1/spreads/physical-premium/historical`. An empty `data` is a valid result. */
export interface PhysicalPremiumHistory {
  commodity: string;
  period: HistoryPeriod;
  count: number;
  data: PhysicalPremiumPoint[];
}

/** Options for {@link SpreadsResource.physicalPremium}. */
export interface PhysicalPremiumOptions {
  /** `BRENT` (server default) or `WTI` */
  commodity?: string;
}

/** Options for {@link SpreadsResource.physicalPremiumHistorical}. */
export interface PhysicalPremiumHistoryOptions extends PhysicalPremiumOptions, MetricsDateRangeOptions {}

// ---------------------------------------------------------------------------
// Deprecated names (#112)
// ---------------------------------------------------------------------------

/**
 * @deprecated Parameter of the removed `get()`, `historical()` and `all()`,
 * which could not send the parameters their routes require. Call the named
 * method for the route instead, e.g. `basis("BRENT_WTI")`.
 */
export type SpreadType = "crack" | "basis" | "curve-structure" | "margin" | "physical-premium";

/**
 * @deprecated Described `type`, `value` and `components: string[]` on every
 * route, which no route sends (#112). Now the union of the real payloads; use
 * the specific type the method returns.
 */
export type SpreadValue = CrackSpread | BasisSpread | CurveStructure | RefineryMargin | PhysicalPremium;

/**
 * @deprecated Described `{ date, value, unit }`; margin rows carry `margin`
 * and premium rows `premium` (#112). Now the union of the real row types.
 */
export type HistoricalSpreadValue =
  | CrackSpreadPoint
  | BasisSpreadPoint
  | RefineryMarginPoint
  | PhysicalPremiumPoint;

/** @deprecated Alias of {@link MetricsDateRangeOptions}. */
export type HistoricalSpreadOptions = MetricsDateRangeOptions;

// ---------------------------------------------------------------------------
// Shape checks
// ---------------------------------------------------------------------------

const isCrack = (v: unknown) =>
  matches(v, {
    spread_type: "string",
    crude_benchmark: "string",
    value: "number",
    unit: "string",
    components: "record",
    timestamp: "string",
    changes: "record",
  }) && isRecord(v.components) && isRecord(v.components.crude);

const isBasis = (v: unknown) =>
  matches(v, {
    pair: "string",
    spread_name: "string",
    value: "number",
    unit: "string",
    components: "record",
    signal: "string",
    timestamp: "string",
    changes: "record",
  });

const isCurve = (v: unknown) =>
  matches(v, {
    commodity: "string",
    structure: "string",
    severity: "string",
    term_slope_pct: "number",
    spreads: "record",
    front_month: "record",
    back_month_6: "record",
    timestamp: "string",
  });

const isMargin = (v: unknown) =>
  matches(v, {
    index: "string",
    name: "string",
    margin_usd_bbl: "number",
    crude_input: "record",
    product_basket: "record",
    signal: "string",
    changes: "record",
    timestamp: "string",
  });

const isPremium = (v: unknown) =>
  matches(v, {
    commodity: "string",
    name: "string",
    premium: "number",
    premium_pct: "number",
    unit: "string",
    components: "record",
    signal: "string",
    timestamp: "string",
  });

/**
 * Spreads Resource
 *
 * @example
 * ```typescript
 * import { OilPriceAPI } from 'oilpriceapi';
 *
 * const client = new OilPriceAPI({ apiKey: 'your_key' });
 *
 * const crack = await client.spreads.crack({ type: 'diesel', crude: 'WTI_USD' });
 * console.log(`${crack.spread_type} crack: ${crack.value} ${crack.unit}`);
 *
 * const basis = await client.spreads.basis('BRENT_WTI');
 * console.log(basis.components); // { BRENT_CRUDE_USD: 104.32, WTI_USD: 99.99 }
 *
 * const margins = await client.spreads.marginAll();
 * margins.forEach(m => console.log(`${m.index}: ${m.margin_usd_bbl} USD/bbl`));
 * ```
 */
export class SpreadsResource {
  constructor(private client: OilPriceAPI) {}

  /**
   * Latest crack spread.
   *
   * @param options - Spread type and crude benchmark; server defaults `3-2-1` and `BRENT_CRUDE_USD`
   * @throws {ValidationError} If an option is present but blank (no request is sent)
   * @throws {NotFoundError} Unknown spread type or crude, or no data for an input
   */
  async crack(options?: CrackSpreadOptions): Promise<CrackSpread> {
    const params = compactParams({
      type: optionalSelector(options?.type, "type"),
      crude: optionalSelector(options?.crude, "crude"),
    });
    return getMetric(this.client, "/v1/spreads/crack", params, "a crack spread", isCrack);
  }

  /**
   * Daily crack spread history.
   *
   * `period` is the window the server applied; `coverage` says what came back.
   * An unknown `type` returns an empty history rather than an error.
   *
   * @throws {ValidationError} Blank option, unparseable date, or start after end
   */
  async crackHistorical(options?: CrackSpreadHistoryOptions): Promise<CrackSpreadHistory> {
    const params = {
      ...compactParams({
        type: optionalSelector(options?.type, "type"),
        crude: optionalSelector(options?.crude, "crude"),
      }),
      ...dateRangeParams(options),
    };
    return getMetric(
      this.client,
      "/v1/spreads/crack/historical",
      params,
      "a crack spread history",
      (d) =>
        matches(d, { spread_type: "string", crude_benchmark: "string", coverage: "record" }) &&
        isHistory(d, {}, { value: "number" }),
    );
  }

  /** Every crack spread type with data for one crude benchmark. */
  async crackAll(options?: CrackSpreadAllOptions): Promise<CrackSpreadList> {
    const params = compactParams({ crude: optionalSelector(options?.crude, "crude") });
    return getMetric(
      this.client,
      "/v1/spreads/crack/all",
      params,
      'an object with "crude_benchmark" and "spreads"',
      (d) => matches(d, { crude_benchmark: "string", spreads: "array" }) && (d.spreads as unknown[]).every(isCrack),
    );
  }

  /**
   * European gasoil crack (ICE Low Sulphur Gasoil vs ICE Brent). The gasoil leg
   * is in USD/tonne; `conversion` states the barrels-per-tonne factor used.
   */
  async gasoilCrack(): Promise<GasoilCrackSpread> {
    return getMetric(this.client, "/v1/spreads/gasoil-crack", {}, "a gasoil crack", (d) =>
      matches(d, {
        spread_type: "string",
        value: "number",
        unit: "string",
        components: "record",
        conversion: "record",
        timestamp: "string",
      }),
    );
  }

  /**
   * Latest basis spread for a pair.
   *
   * @param pair - `WAHA_HH`, `BRENT_WTI`, `BRENT_DUBAI`, `TTF_HH` or `BRENT_OMAN`
   * @throws {ValidationError} If `pair` is missing or blank (the route answers 400)
   * @throws {NotFoundError} Unknown pair; the message lists the valid ones
   */
  async basis(pair: string): Promise<BasisSpread> {
    const params = { pair: requireSelector(pair, "pair") };
    return getMetric(this.client, "/v1/spreads/basis", params, "a basis spread", isBasis);
  }

  /**
   * Daily basis spread history for a pair.
   *
   * An unknown pair returns an empty 200 on this route, not a 404, so
   * `count === 0` can mean a misspelled pair. `basisAll()` lists valid pairs.
   *
   * @throws {ValidationError} Missing pair, unparseable date, or start after end
   */
  async basisHistorical(pair: string, options?: MetricsDateRangeOptions): Promise<BasisSpreadHistory> {
    const params = { pair: requireSelector(pair, "pair"), ...dateRangeParams(options) };
    return getMetric(this.client, "/v1/spreads/basis/historical", params, "a basis spread history", (d) =>
      isHistory(d, { pair: "string" }, { value: "number" }),
    );
  }

  /** Latest value for every basis pair with data. */
  async basisAll(): Promise<BasisSpread[]> {
    return getMetricList(this.client, "/v1/spreads/basis/all", "spreads", "basis spreads", isBasis);
  }

  /**
   * Futures curve structure (backwardation / contango) for one market.
   *
   * @param commodity - `ICE_BRENT`, `ICE_WTI`, `ICE_GASOIL`, `NYMEX_NG` or `ICE_TTF`
   * @throws {ValidationError} If `commodity` is missing or blank (the route answers 400)
   */
  async curveStructure(commodity: string): Promise<CurveStructure> {
    const params = { commodity: requireSelector(commodity, "commodity") };
    return getMetric(this.client, "/v1/spreads/curve-structure", params, "a curve structure", isCurve);
  }

  /** Curve structure for every market with a usable curve. */
  async curveStructureAll(): Promise<CurveStructure[]> {
    return getMetricList(this.client, "/v1/spreads/curve-structure/all", "commodities", "curve structures", isCurve);
  }

  /**
   * Latest refinery margin.
   *
   * @param options - `index`: `usgc` (server default), `singapore` or `nwe`
   * @throws {NotFoundError} Unknown index
   */
  async margin(options?: RefineryMarginOptions): Promise<RefineryMargin> {
    const params = compactParams({ index: optionalSelector(options?.index, "index") });
    return getMetric(this.client, "/v1/spreads/margin", params, "a refinery margin", isMargin);
  }

  /** Daily refinery margin history. An unknown index returns an empty history. */
  async marginHistorical(options?: RefineryMarginHistoryOptions): Promise<RefineryMarginHistory> {
    const params = {
      ...compactParams({ index: optionalSelector(options?.index, "index") }),
      ...dateRangeParams(options),
    };
    return getMetric(this.client, "/v1/spreads/margin/historical", params, "a refinery margin history", (d) =>
      isHistory(d, { index: "string" }, { margin: "number" }),
    );
  }

  /** Latest margin for every index with data. */
  async marginAll(): Promise<RefineryMargin[]> {
    return getMetricList(this.client, "/v1/spreads/margin/all", "margins", "refinery margins", isMargin);
  }

  /**
   * Latest physical (spot) vs futures premium.
   *
   * @param options - `commodity`: `BRENT` (server default) or `WTI`
   */
  async physicalPremium(options?: PhysicalPremiumOptions): Promise<PhysicalPremium> {
    const params = compactParams({ commodity: optionalSelector(options?.commodity, "commodity") });
    return getMetric(this.client, "/v1/spreads/physical-premium", params, "a physical premium", isPremium);
  }

  /**
   * Daily physical premium history. An empty `data` is a valid result when the
   * server has no overlapping spot and futures days.
   */
  async physicalPremiumHistorical(options?: PhysicalPremiumHistoryOptions): Promise<PhysicalPremiumHistory> {
    const params = {
      ...compactParams({ commodity: optionalSelector(options?.commodity, "commodity") }),
      ...dateRangeParams(options),
    };
    return getMetric(
      this.client,
      "/v1/spreads/physical-premium/historical",
      params,
      "a physical premium history",
      (d) => isHistory(d, { commodity: "string" }, { premium: "number" }),
    );
  }

  /** Latest premium for every commodity with data. */
  async physicalPremiumAll(): Promise<PhysicalPremium[]> {
    return getMetricList(this.client, "/v1/spreads/physical-premium/all", "premiums", "physical premiums", isPremium);
  }
}
