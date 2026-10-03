/**
 * Futures Resource
 *
 * Access futures contract data including latest prices, historical data,
 * OHLC, intraday, spreads, curves, and continuous contracts.
 */

import type { OilPriceAPI } from "../client.js";
import { OilPriceAPIError, ValidationError } from "../errors.js";

/**
 * A single futures contract month within a {@link FuturesPrice} response.
 *
 * Returned at the top level under `front_month` and for every entry in
 * `contracts[]`. The latest traded price is `last_price`.
 */
export interface FuturesContractMonth {
  /** Contract code (e.g. "BRENT_FUTURES_2026_08"). */
  code?: string;
  /** Contract month in YYYY-MM form (e.g. "2026-08"). */
  contract_month?: string;
  /** Latest traded/settlement price for this contract month. */
  last_price?: number;
  /** Currency code (e.g. "USD"). */
  currency?: string;
  /** Opening price (may be returned as a string by the API). */
  open?: number | string;
  /** Closing price (may be returned as a string by the API). */
  close?: number | string;
  /** Session high. */
  high?: number | string;
  /** Session low. */
  low?: number | string;
  /** Any additional fields the API returns for a contract month. */
  [key: string]: unknown;
}

/**
 * Futures contract price data.
 *
 * `GET /v1/futures/{slug}` returns a TOP-LEVEL object (there is NO
 * `{ status, data }` envelope). The latest price lives at
 * `front_month.last_price`, with the full term structure in `contracts[]`.
 *
 * Legacy flat fields (`contract`, `price`, `currency`, `timestamp`) are kept
 * optional for backward compatibility, but real responses populate
 * `front_month` / `contracts` instead.
 */
export interface FuturesPrice {
  /** Commodity identifier (e.g. "BRENT_FUTURES"). */
  commodity?: string;
  /** Data source label (e.g. "market_reporting", or a government label like "EIA"). */
  source?: string;
  /** ISO timestamp the data was last updated. */
  updated_at?: string;
  /** Settlement date for the prices. */
  settlement_date?: string;
  /** Front-month contract — the latest price is `front_month.last_price`. */
  front_month?: FuturesContractMonth;
  /** Full forward term structure, one entry per contract month. */
  contracts?: FuturesContractMonth[];
  /** Optional warning when the returned data is stale. */
  data_age_warning?: unknown;
  /** Additional metadata returned by the API. */
  metadata?: Record<string, unknown>;

  /** @deprecated Legacy flat contract symbol — use `front_month.code`. */
  contract?: string;
  /** @deprecated Legacy flat price — use `front_month.last_price`. */
  price?: number;
  /** @deprecated Legacy formatted price string. */
  formatted?: string;
  /** @deprecated Legacy currency — use `front_month.currency`. */
  currency?: string;
  /** @deprecated Legacy contract expiration date. */
  expiration?: string;
  /** @deprecated Legacy ISO timestamp — use `updated_at`. */
  timestamp?: string;
}

/**
 * Historical futures price data
 */
export interface HistoricalFuturesPrice {
  /** Contract symbol */
  contract: string;
  /** Price */
  price: number;
  /** ISO timestamp */
  timestamp: string;
  /** Volume */
  volume?: number;
  /** Open interest */
  open_interest?: number;
}

/**
 * Options for historical futures query.
 *
 * The controller reads `from` / `to` (dates) plus optional `interval` and
 * `contracts` — NOT `start_date` / `end_date`.
 */
export interface HistoricalFuturesOptions {
  /** Start date in ISO 8601 format (YYYY-MM-DD) */
  startDate?: string;
  /** End date in ISO 8601 format (YYYY-MM-DD) */
  endDate?: string;
  /** Aggregation interval (e.g. '1d') */
  interval?: string;
  /** Specific contracts to include */
  contracts?: string;
}

/**
 * Options for futures OHLC query.
 *
 * The controller reads `days`, `contract` and `interval` — there is no `date`
 * parameter for OHLC.
 */
export interface FuturesOHLCOptions {
  /** Number of days of OHLC bars (default 30, clamped 1-365) */
  days?: number;
  /** Specific contract */
  contract?: string;
  /** Aggregation interval */
  interval?: string;
}

/**
 * OHLC (Open, High, Low, Close) data for a futures contract
 */
export interface FuturesOHLC {
  /** Contract symbol */
  contract: string;
  /** Date for this OHLC data */
  date: string;
  /** Opening price */
  open: number;
  /** Highest price */
  high: number;
  /** Lowest price */
  low: number;
  /** Closing price */
  close: number;
  /** Trading volume */
  volume?: number;
  /** Open interest */
  open_interest?: number;
}

/**
 * Intraday price point
 */
export interface IntradayPrice {
  /** Time of day (e.g., "09:30", "14:00") */
  time: string;
  /** Price at this time */
  price: number;
  /** Volume at this time */
  volume?: number;
}

/**
 * Intraday futures data
 */
export interface IntradayFuturesData {
  /** Contract symbol */
  contract: string;
  /** Date for this intraday data */
  date: string;
  /** Array of intraday price points */
  prices: IntradayPrice[];
}

/**
 * Futures spread data
 */
export interface FuturesSpread {
  /** First contract symbol */
  contract1: string;
  /** Second contract symbol */
  contract2: string;
  /** Spread value (contract1 - contract2) */
  spread: number;
  /** Percentage spread */
  spread_percent?: number;
  /** ISO timestamp */
  timestamp: string;
}

/**
 * Futures curve point
 */
export interface FuturesCurvePoint {
  /** Contract expiration date */
  expiration: string;
  /** Months until expiration */
  months_out: number;
  /** Price */
  price: number;
  /** Contract symbol */
  contract?: string;
}

/**
 * Futures curve data.
 *
 * `GET /v1/futures/{slug}/curve` can legitimately return a no-data response of
 * the form `{ error: "No futures data available for curve analysis", date }`
 * when a curve cannot be built. That is a valid state (not an HTTP error), so
 * `curve` is optional and `error` / `date` are surfaced for callers to detect
 * the no-data case.
 */
export interface FuturesCurveData {
  /** Base contract */
  contract?: string;
  /** ISO timestamp when curve was generated */
  timestamp?: string;
  /** Array of curve points (absent in the no-data response) */
  curve?: FuturesCurvePoint[];
  /** Present in the no-data response: "No futures data available for curve analysis". */
  error?: string;
  /** Date associated with the no-data response. */
  date?: string;
}

/**
 * Continuous contract data point
 */
export interface ContinuousContractPrice {
  /** Date */
  date: string;
  /** Price */
  price: number;
  /** Active contract at this date */
  active_contract?: string;
}

/**
 * Continuous futures contract data
 */
export interface ContinuousFuturesData {
  /** Base contract */
  contract: string;
  /** Number of months for continuous contract */
  months: number;
  /** Array of continuous prices */
  prices: ContinuousContractPrice[];
}

/**
 * Auto-rolled continuous front-month futures price, from
 * `GET /v1/futures/continuous/{family}`.
 */
export interface ContinuousFrontMonth {
  /** Commodity code, e.g. `"BRENT_FUTURES_CONTINUOUS"` */
  commodity: string;
  source: string;
  description: string;
  price: number;
  currency: string;
  /** ISO 8601 timestamp of the settlement */
  updated_at: string;
  ohlc: {
    open: number | null;
    high: number | null;
    low: number | null;
    close: number | null;
    volume: number | null;
  };
  changes: {
    change_24h: number | null;
    change_percent_24h: number | null;
  };
  metadata: {
    data_source: string;
    ticker: string;
    is_continuous: boolean;
    roll_method: string;
    history_available_from: string;
    total_historical_records: number;
    unit: string;
  };
}

/** Families served by `GET /v1/futures/continuous/{family}`. */
export type ContinuousFuturesFamily = "brent" | "wti";

/**
 * Spread-history data point for a contract family.
 */
export interface FuturesSpreadHistoryPoint {
  /** ISO date */
  date: string;
  /** Spread value */
  spread: number;
  /** Optional percentage spread */
  spread_percent?: number;
}

/**
 * Spread-history data for a contract family.
 */
export interface FuturesSpreadHistory {
  /** Contract family slug (e.g., "brent") */
  family: string;
  /** Array of historical spread points */
  history: FuturesSpreadHistoryPoint[];
}

/**
 * Slugs for the supported ICE / gas / carbon futures contract families.
 *
 * These map to the `GET /v1/futures/{slug}` (latest) endpoint plus the
 * `GET /v1/futures/{slug}/...` sub-resources. Latest is the bare slug path
 * (there is NO `/latest` suffix). Each family also supports `/historical`,
 * `/ohlc`, `/intraday`, `/spreads`, `/curve`, and `/spread-history`.
 */
export type FuturesContractFamilySlug =
  | "brent"
  | "gasoil"
  | "wti"
  | "eu-carbon"
  | "ice-brent"
  | "ice-gasoil"
  | "ice-wti"
  | "natural-gas"
  | "ttf-gas"
  | "lng-jkm"
  | "eua-carbon"
  | "uk-carbon";

/**
 * Ergonomic contract codes for the most-requested futures families (issue #1).
 *
 * Use with the generic {@link FuturesResource} methods, or use the typed
 * {@link FuturesResource.family} helper for direct access to a family's
 * endpoints.
 *
 * @example
 * ```typescript
 * import { FUTURES_CONTRACTS } from 'oilpriceapi';
 *
 * const brent = await client.futures.latest(FUTURES_CONTRACTS.BRENT); // "BZ"
 * const gasoil = await client.futures.family('gasoil').latest();
 * ```
 */
export const FUTURES_CONTRACTS = {
  /** ICE Brent crude */
  BRENT: "BZ",
  /** NYMEX WTI crude */
  WTI: "CL",
  /** ICE Gasoil */
  GASOIL: "G",
  /** Henry Hub natural gas */
  NATURAL_GAS: "NG",
  /** TTF natural gas (Europe) */
  TTF_GAS: "TTF",
  /** LNG JKM (Asia) */
  LNG_JKM: "JKM",
  /** EU carbon allowance */
  EUA_CARBON: "EUA",
  /** UK carbon allowance */
  UK_CARBON: "UKA",
} as const;

/**
 * Mapping of ergonomic contract codes to their API contract-family slugs.
 *
 * Lets you resolve a contract code (e.g., `"BZ"`) to the `/v1/futures/{slug}`
 * path segment used by the typed family helpers.
 */
export const FUTURES_FAMILY_SLUGS: Record<string, FuturesContractFamilySlug> = {
  [FUTURES_CONTRACTS.BRENT]: "brent", // BZ
  [FUTURES_CONTRACTS.WTI]: "wti", // CL
  [FUTURES_CONTRACTS.GASOIL]: "gasoil", // G
  QS: "gasoil", // ICE Gasoil also trades under the QS ticker prefix
  [FUTURES_CONTRACTS.NATURAL_GAS]: "natural-gas", // NG
  [FUTURES_CONTRACTS.TTF_GAS]: "ttf-gas", // TTF
  [FUTURES_CONTRACTS.LNG_JKM]: "lng-jkm", // JKM
  [FUTURES_CONTRACTS.EUA_CARBON]: "eu-carbon", // EUA
  [FUTURES_CONTRACTS.UK_CARBON]: "uk-carbon", // UKA
};

/**
 * Resolve a futures contract code (e.g. `"BZ"`, `"QS"`) or an already-valid
 * family slug (e.g. `"brent"`) to its `/v1/futures/{slug}` path segment.
 *
 * Matching is case-insensitive for codes. Returns `null` if the input maps to
 * neither a known code nor a known family slug.
 */
export function resolveFuturesFamilySlug(codeOrSlug: string): FuturesContractFamilySlug | null {
  const trimmed = codeOrSlug.trim();
  // Direct code match (case-insensitive — codes are upper-case).
  const byCode = FUTURES_FAMILY_SLUGS[trimmed.toUpperCase()];
  if (byCode) return byCode;
  // Already a valid family slug?
  const lower = trimmed.toLowerCase();
  const isSlug = new Set<FuturesContractFamilySlug>([
    ...Object.values(FUTURES_FAMILY_SLUGS),
    "ice-brent",
    "ice-wti",
    "ice-gasoil",
    "eua-carbon",
  ]).has(lower as FuturesContractFamilySlug);
  return isSlug ? (lower as FuturesContractFamilySlug) : null;
}

/**
 * Typed helper for a single futures contract family (e.g., ICE Brent, Gasoil).
 *
 * Provides ergonomic access to the family's endpoints without having to
 * remember the URL slug. Obtain an instance via {@link FuturesResource.family},
 * {@link FuturesResource.brent}, {@link FuturesResource.gasoil}, etc.
 *
 * @example
 * ```typescript
 * const gasoil = client.futures.gasoil();
 * const latest = await gasoil.latest();
 * const curve = await gasoil.curve();
 * ```
 */
export class FuturesContractFamily {
  constructor(
    private client: OilPriceAPI,
    /** The contract-family slug used in the API path. */
    public readonly slug: FuturesContractFamilySlug,
  ) {}

  /**
   * Get the latest price for this contract family.
   *
   * Latest is served from the bare slug path `GET /v1/futures/{slug}` —
   * there is NO `/latest` suffix (that path 404s).
   */
  async latest(): Promise<FuturesPrice> {
    return this.client["request"]<FuturesPrice>(`/v1/futures/${encodeURIComponent(this.slug)}`, {});
  }

  /**
   * Get historical prices for this contract family.
   *
   * @param options - Optional date range filters.
   */
  async historical(options?: HistoricalFuturesOptions): Promise<HistoricalFuturesPrice[]> {
    const params: Record<string, string> = {};
    if (options?.startDate) params.from = options.startDate;
    if (options?.endDate) params.to = options.endDate;
    if (options?.interval) params.interval = options.interval;
    if (options?.contracts) params.contracts = options.contracts;

    const response = await this.client["request"]<
      HistoricalFuturesPrice[] | { prices: HistoricalFuturesPrice[] }
    >(`/v1/futures/${encodeURIComponent(this.slug)}/historical`, params);

    return Array.isArray(response) ? response : response.prices;
  }

  /**
   * Get OHLC data for this contract family.
   *
   * @param options - `{ days, contract, interval }` (the API has no `date` param here).
   */
  async ohlc(options?: FuturesOHLCOptions): Promise<FuturesOHLC> {
    const params: Record<string, string> = {};
    if (options?.days !== undefined) params.days = options.days.toString();
    if (options?.contract) params.contract = options.contract;
    if (options?.interval) params.interval = options.interval;
    return this.client["request"]<FuturesOHLC>(`/v1/futures/${encodeURIComponent(this.slug)}/ohlc`, params);
  }

  /**
   * Get intraday price data for this contract family.
   */
  async intraday(): Promise<IntradayFuturesData> {
    return this.client["request"]<IntradayFuturesData>(`/v1/futures/${encodeURIComponent(this.slug)}/intraday`, {});
  }

  /**
   * Get the spreads for this contract family.
   */
  async spreads(): Promise<FuturesSpread[]> {
    const response = await this.client["request"]<FuturesSpread[] | { data: FuturesSpread[] }>(
      `/v1/futures/${encodeURIComponent(this.slug)}/spreads`,
      {},
    );

    return Array.isArray(response) ? response : response.data;
  }

  /**
   * Get the forward curve for this contract family.
   */
  async curve(): Promise<FuturesCurveData> {
    return this.client["request"]<FuturesCurveData>(`/v1/futures/${encodeURIComponent(this.slug)}/curve`, {});
  }

  /**
   * Get historical spread data for this contract family.
   */
  async spreadHistory(): Promise<FuturesSpreadHistory> {
    return this.client["request"]<FuturesSpreadHistory>(
      `/v1/futures/${encodeURIComponent(this.slug)}/spread-history`,
      {},
    );
  }
}

/**
 * Futures Resource
 *
 * Access futures contract data including latest, historical, OHLC, intraday,
 * spreads, curves, and continuous contracts.
 *
 * @example
 * ```typescript
 * import { OilPriceAPI } from 'oilpriceapi';
 *
 * const client = new OilPriceAPI({ apiKey: 'your_key' });
 *
 * // Get the latest curve by contract code (resolves to GET /v1/futures/wti)
 * const latest = await client.futures.latest('CL');
 * console.log(`${latest.contract}: $${latest.price}`);
 *
 * // Typed family helpers are the most ergonomic option:
 * const brent = await client.futures.brent().latest();
 * const curve = await client.futures.brent().curve();
 * curve.curve.forEach(point => {
 *   console.log(`${point.months_out}mo: $${point.price}`);
 * });
 * ```
 */
export class FuturesResource {
  constructor(private client: OilPriceAPI) {}

  /**
   * Get the latest curve/quote for a futures contract family.
   *
   * Accepts an ergonomic contract code (e.g. `"BZ"`, `"CL"`, `"QS"`) or a
   * family slug (e.g. `"brent"`). The code is resolved to its family slug
   * and the request is sent to `GET /v1/futures/{slug}` — the bare slug path,
   * with NO `/latest` suffix (the suffixed path 404s).
   *
   * Supported codes: BZ (Brent), CL (WTI), G/QS (Gasoil), NG (Natural Gas),
   * TTF, JKM, EUA, UKA. Canonical slugs: brent, wti, gasoil, natural-gas,
   * ttf-gas, lng-jkm, eu-carbon, uk-carbon.
   *
   * @param contract - Contract code (e.g. "BZ") or family slug (e.g. "brent").
   * @returns Latest futures price/curve data
   *
   * @throws {ValidationError} If the code/slug is empty or unrecognized.
   * @throws {OilPriceAPIError} If API request fails
   *
   * @example
   * ```typescript
   * import { FUTURES_CONTRACTS } from 'oilpriceapi';
   * const price = await client.futures.latest(FUTURES_CONTRACTS.BRENT); // "BZ"
   * const wti = await client.futures.latest('wti');
   * ```
   */
  async latest(contract: string): Promise<FuturesPrice> {
    if (!contract || typeof contract !== "string") {
      throw new ValidationError("Contract symbol must be a non-empty string");
    }

    const slug = resolveFuturesFamilySlug(contract);
    if (!slug) {
      throw new ValidationError(
        `Unknown futures contract "${contract}". Use a contract code ` +
          `(BZ, CL, G, QS, NG, TTF, JKM, EUA, UKA) or a family slug ` +
          `(brent, wti, gasoil, natural-gas, ttf-gas, lng-jkm, eu-carbon, uk-carbon).`,
      );
    }

    return this.client["request"]<FuturesPrice>(`/v1/futures/${encodeURIComponent(slug)}`, {});
  }

  /**
   * Get historical prices for a futures contract
   *
   * @param contract - Contract symbol (e.g., "CL.1", "BZ.2")
   * @param options - Date range filters
   * @returns Array of historical prices
   *
   * @throws {NotFoundError} If contract not found
   * @throws {OilPriceAPIError} If API request fails
   *
   * @example
   * ```typescript
   * const history = await client.futures.historical('CL.1', {
   *   startDate: '2024-01-01',
   *   endDate: '2024-01-31'
   * });
   * console.log(`${history.length} historical prices`);
   * ```
   */
  async historical(
    contract: string,
    options?: HistoricalFuturesOptions,
  ): Promise<HistoricalFuturesPrice[]> {
    if (!contract || typeof contract !== "string") {
      throw new ValidationError("Contract symbol must be a non-empty string");
    }

    const params: Record<string, string> = {};
    if (options?.startDate) params.start_date = options.startDate;
    if (options?.endDate) params.end_date = options.endDate;

    const response = await this.client["request"]<
      HistoricalFuturesPrice[] | { prices: HistoricalFuturesPrice[] }
    >(`/v1/futures/${encodeURIComponent(contract)}/historical`, params);

    return Array.isArray(response) ? response : response.prices;
  }

  /**
   * Get OHLC (Open, High, Low, Close) data for a futures contract
   *
   * @param contract - Contract symbol (e.g., "CL.1", "BZ.2")
   * @param date - Optional date in YYYY-MM-DD format (defaults to latest)
   * @returns OHLC data
   *
   * @throws {NotFoundError} If contract not found
   * @throws {OilPriceAPIError} If API request fails
   *
   * @example
   * ```typescript
   * const ohlc = await client.futures.ohlc('CL.1', '2024-01-15');
   * console.log(`Open: $${ohlc.open}`);
   * console.log(`High: $${ohlc.high}`);
   * console.log(`Low: $${ohlc.low}`);
   * console.log(`Close: $${ohlc.close}`);
   * ```
   */
  async ohlc(contract: string, date?: string): Promise<FuturesOHLC> {
    if (!contract || typeof contract !== "string") {
      throw new ValidationError("Contract symbol must be a non-empty string");
    }

    const params: Record<string, string> = {};
    if (date) params.date = date;

    return this.client["request"]<FuturesOHLC>(`/v1/futures/${encodeURIComponent(contract)}/ohlc`, params);
  }

  /**
   * Get intraday price data for a futures contract
   *
   * Returns price points throughout the trading day.
   *
   * @param contract - Contract symbol (e.g., "CL.1", "BZ.2")
   * @returns Intraday price data
   *
   * @throws {NotFoundError} If contract not found
   * @throws {OilPriceAPIError} If API request fails
   *
   * @example
   * ```typescript
   * const intraday = await client.futures.intraday('CL.1');
   * intraday.prices.forEach(point => {
   *   console.log(`${point.time}: $${point.price}`);
   * });
   * ```
   */
  async intraday(contract: string): Promise<IntradayFuturesData> {
    if (!contract || typeof contract !== "string") {
      throw new ValidationError("Contract symbol must be a non-empty string");
    }

    return this.client["request"]<IntradayFuturesData>(`/v1/futures/${encodeURIComponent(contract)}/intraday`, {});
  }

  /**
   * Spread between two arbitrary futures contracts.
   *
   * @deprecated The API has no `/v1/futures/spreads` route; every call returned
   * HTTP 404 (#125). Calendar spreads for a contract family are served by
   * `client.futures.family(slug).spreads()` (e.g. `client.futures.brent().spreads()`,
   * `GET /v1/futures/{slug}/spreads`). Removed in the next major.
   *
   * @throws {OilPriceAPIError} Always, with code `ENDPOINT_NOT_AVAILABLE`.
   */
  async spreads(_contract1: string, _contract2: string): Promise<FuturesSpread> {
    throw new OilPriceAPIError(
      "client.futures.spreads(contract1, contract2) is not supported: the API has no arbitrary two-contract spread endpoint. " +
        "Use client.futures.family(slug).spreads(), e.g. client.futures.brent().spreads().",
      undefined,
      "ENDPOINT_NOT_AVAILABLE",
    );
  }


  /**
   * Get futures curve for a contract
   *
   * Returns the forward curve showing prices across different expiration dates.
   *
   * @param contract - Base contract symbol (e.g., "CL", "BZ")
   * @returns Futures curve data
   *
   * @throws {NotFoundError} If contract not found
   * @throws {OilPriceAPIError} If API request fails
   *
   * @example
   * ```typescript
   * const curve = await client.futures.curve('CL');
   * console.log('WTI Futures Curve:');
   * curve.curve.forEach(point => {
   *   console.log(`${point.months_out} months: $${point.price}`);
   * });
   * ```
   */
  async curve(contract: string): Promise<FuturesCurveData> {
    if (!contract || typeof contract !== "string") {
      throw new ValidationError("Contract symbol must be a non-empty string");
    }

    return this.client["request"]<FuturesCurveData>(`/v1/futures/${encodeURIComponent(contract)}/curve`, {});
  }

  /**
   * Continuous futures series by contract symbol.
   *
   * @deprecated The API has no `/v1/futures/{contract}/continuous` route; every
   * call returned HTTP 404. Use {@link continuousFrontMonth} (`"brent"` or
   * `"wti"`). Removed in the next major.
   *
   * @throws {OilPriceAPIError} Always, with code `ENDPOINT_NOT_AVAILABLE`.
   */
  async continuous(_contract: string, _months?: number): Promise<ContinuousFuturesData> {
    throw new OilPriceAPIError(
      "client.futures.continuous(contract, months) is not supported: the API has no per-contract continuous endpoint. " +
        "Use client.futures.continuousFrontMonth('brent') or continuousFrontMonth('wti').",
      undefined,
      "ENDPOINT_NOT_AVAILABLE",
    );
  }

  /**
   * Auto-rolled continuous front-month price for a futures family.
   *
   * @param family - `"brent"` or `"wti"`
   * @returns The latest continuous front-month settlement with OHLC
   *
   * @throws {ValidationError} If the family is not supported
   * @throws {OilPriceAPIError} If API request fails
   *
   * @example
   * ```typescript
   * const brent = await client.futures.continuousFrontMonth('brent');
   * console.log(`${brent.metadata.ticker}: $${brent.price}`);
   * ```
   */
  async continuousFrontMonth(family: ContinuousFuturesFamily): Promise<ContinuousFrontMonth> {
    if (family !== "brent" && family !== "wti") {
      throw new ValidationError('Continuous futures family must be "brent" or "wti"');
    }
    return this.client["request"]<ContinuousFrontMonth>(
      `/v1/futures/continuous/${encodeURIComponent(family)}`,
      {},
    );
  }


  /**
   * Get a typed helper for a specific contract family (issue #1).
   *
   * Provides ergonomic access to the ICE Brent / WTI / Gasoil and gas/carbon
   * family endpoints (`/latest`, `/historical`, `/ohlc`, `/intraday`,
   * `/spreads`, `/curve`, `/spread-history`) without remembering the URL slug.
   *
   * @param slug - Contract family slug (e.g., `"brent"`, `"gasoil"`).
   * @returns A {@link FuturesContractFamily} bound to the slug.
   *
   * @example
   * ```typescript
   * const brent = client.futures.family('brent');
   * const latest = await brent.latest();
   * const curve = await brent.curve();
   * ```
   */
  family(slug: FuturesContractFamilySlug): FuturesContractFamily {
    if (!slug || typeof slug !== "string") {
      throw new ValidationError("Contract family slug must be a non-empty string");
    }
    return new FuturesContractFamily(this.client, slug);
  }

  /** ICE Brent crude futures family helper (issue #1). */
  brent(): FuturesContractFamily {
    return this.family("brent");
  }

  /** ICE WTI crude futures family helper. */
  wti(): FuturesContractFamily {
    return this.family("wti");
  }

  /** ICE Gasoil futures family helper (issue #1). */
  gasoil(): FuturesContractFamily {
    return this.family("gasoil");
  }

  /** Henry Hub natural gas futures family helper. */
  naturalGas(): FuturesContractFamily {
    return this.family("natural-gas");
  }

  /** TTF natural gas (Europe) futures family helper. */
  ttfGas(): FuturesContractFamily {
    return this.family("ttf-gas");
  }

  /** LNG JKM (Asia) futures family helper. */
  lngJkm(): FuturesContractFamily {
    return this.family("lng-jkm");
  }

  /** EU carbon allowance (EUA) futures family helper. */
  euaCarbon(): FuturesContractFamily {
    return this.family("eu-carbon");
  }

  /** UK carbon allowance (UKA) futures family helper. */
  ukCarbon(): FuturesContractFamily {
    return this.family("uk-carbon");
  }
}
