/**
 * Futures Resource
 *
 * Access futures contract data including latest prices, historical data,
 * OHLC, intraday, spreads, curves, and continuous contracts.
 */

import type { OilPriceAPI } from "../client.js";
import { ValidationError } from "../errors.js";

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
  /** Contract family slug (e.g., "ice-brent") */
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
 * const gasoil = await client.futures.family('ice-gasoil').latest();
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
  [FUTURES_CONTRACTS.BRENT]: "ice-brent", // BZ
  [FUTURES_CONTRACTS.WTI]: "ice-wti", // CL
  [FUTURES_CONTRACTS.GASOIL]: "ice-gasoil", // G
  QS: "ice-gasoil", // ICE Gasoil also trades under the QS ticker prefix
  [FUTURES_CONTRACTS.NATURAL_GAS]: "natural-gas", // NG
  [FUTURES_CONTRACTS.TTF_GAS]: "ttf-gas", // TTF
  [FUTURES_CONTRACTS.LNG_JKM]: "lng-jkm", // JKM
  [FUTURES_CONTRACTS.EUA_CARBON]: "eua-carbon", // EUA
  [FUTURES_CONTRACTS.UK_CARBON]: "uk-carbon", // UKA
};

/**
 * Resolve a futures contract code (e.g. `"BZ"`, `"QS"`) or an already-valid
 * family slug (e.g. `"ice-brent"`) to its `/v1/futures/{slug}` path segment.
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
  const isSlug = Object.values(FUTURES_FAMILY_SLUGS).includes(lower as FuturesContractFamilySlug);
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
    return this.client["request"]<FuturesPrice>(`/v1/futures/${this.slug}`, {});
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
    >(`/v1/futures/${this.slug}/historical`, params);

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
    return this.client["request"]<FuturesOHLC>(`/v1/futures/${this.slug}/ohlc`, params);
  }

  /**
   * Get intraday price data for this contract family.
   */
  async intraday(): Promise<IntradayFuturesData> {
    return this.client["request"]<IntradayFuturesData>(`/v1/futures/${this.slug}/intraday`, {});
  }

  /**
   * Get the spreads for this contract family.
   */
  async spreads(): Promise<FuturesSpread[]> {
    const response = await this.client["request"]<FuturesSpread[] | { data: FuturesSpread[] }>(
      `/v1/futures/${this.slug}/spreads`,
      {},
    );

    return Array.isArray(response) ? response : response.data;
  }

  /**
   * Get the forward curve for this contract family.
   */
  async curve(): Promise<FuturesCurveData> {
    return this.client["request"]<FuturesCurveData>(`/v1/futures/${this.slug}/curve`, {});
  }

  /**
   * Get historical spread data for this contract family.
   */
  async spreadHistory(): Promise<FuturesSpreadHistory> {
    return this.client["request"]<FuturesSpreadHistory>(
      `/v1/futures/${this.slug}/spread-history`,
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
 * // Get the latest curve by contract code (resolves to GET /v1/futures/ice-wti)
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
   * family slug (e.g. `"ice-brent"`). The code is resolved to its family slug
   * and the request is sent to `GET /v1/futures/{slug}` — the bare slug path,
   * with NO `/latest` suffix (the suffixed path 404s).
   *
   * Supported codes: BZ (Brent), CL (WTI), G/QS (Gasoil), NG (Natural Gas),
   * TTF, JKM, EUA, UKA. Slugs: ice-brent, ice-wti, ice-gasoil, natural-gas,
   * ttf-gas, lng-jkm, eua-carbon, uk-carbon.
   *
   * @param contract - Contract code (e.g. "BZ") or family slug (e.g. "ice-brent").
   * @returns Latest futures price/curve data
   *
   * @throws {ValidationError} If the code/slug is empty or unrecognized.
   * @throws {OilPriceAPIError} If API request fails
   *
   * @example
   * ```typescript
   * import { FUTURES_CONTRACTS } from 'oilpriceapi';
   * const price = await client.futures.latest(FUTURES_CONTRACTS.BRENT); // "BZ"
   * const wti = await client.futures.latest('ice-wti');
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
          `(ice-brent, ice-wti, ice-gasoil, natural-gas, ttf-gas, lng-jkm, ` +
          `eua-carbon, uk-carbon).`,
      );
    }

    return this.client["request"]<FuturesPrice>(`/v1/futures/${slug}`, {});
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
    >(`/v1/futures/${contract}/historical`, params);

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

    return this.client["request"]<FuturesOHLC>(`/v1/futures/${contract}/ohlc`, params);
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

    return this.client["request"]<IntradayFuturesData>(`/v1/futures/${contract}/intraday`, {});
  }

  /**
   * Get spread between two futures contracts
   *
   * Calculates the price difference between two contracts (contract1 - contract2).
   *
   * @param contract1 - First contract symbol
   * @param contract2 - Second contract symbol
   * @returns Spread data
   *
   * @throws {NotFoundError} If either contract not found
   * @throws {OilPriceAPIError} If API request fails
   *
   * @example
   * ```typescript
   * // Calculate spread between front month and second month
   * const spread = await client.futures.spreads('CL.1', 'CL.2');
   * console.log(`CL.1 - CL.2 spread: $${spread.spread}`);
   * ```
   */
  async spreads(contract1: string, contract2: string): Promise<FuturesSpread> {
    if (!contract1 || typeof contract1 !== "string") {
      throw new ValidationError("First contract symbol must be a non-empty string");
    }
    if (!contract2 || typeof contract2 !== "string") {
      throw new ValidationError("Second contract symbol must be a non-empty string");
    }

    return this.client["request"]<FuturesSpread>("/v1/futures/spreads", {
      contract1,
      contract2,
    });
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

    return this.client["request"]<FuturesCurveData>(`/v1/futures/${contract}/curve`, {});
  }

  /**
   * Get continuous futures contract data
   *
   * Returns a continuous time series by rolling contracts before expiration.
   *
   * @param contract - Base contract symbol (e.g., "CL", "BZ")
   * @param months - Number of months for continuous contract (default: 1 for front month)
   * @returns Continuous contract data
   *
   * @throws {NotFoundError} If contract not found
   * @throws {OilPriceAPIError} If API request fails
   *
   * @example
   * ```typescript
   * // Get continuous front month contract
   * const continuous = await client.futures.continuous('CL', 1);
   * console.log(`${continuous.prices.length} data points`);
   * ```
   */
  async continuous(contract: string, months?: number): Promise<ContinuousFuturesData> {
    if (!contract || typeof contract !== "string") {
      throw new ValidationError("Contract symbol must be a non-empty string");
    }

    const params: Record<string, string> = {};
    if (months !== undefined) params.months = months.toString();

    return this.client["request"]<ContinuousFuturesData>(
      `/v1/futures/${contract}/continuous`,
      params,
    );
  }

  /**
   * Get a typed helper for a specific contract family (issue #1).
   *
   * Provides ergonomic access to the ICE Brent / WTI / Gasoil and gas/carbon
   * family endpoints (`/latest`, `/historical`, `/ohlc`, `/intraday`,
   * `/spreads`, `/curve`, `/spread-history`) without remembering the URL slug.
   *
   * @param slug - Contract family slug (e.g., `"ice-brent"`, `"ice-gasoil"`).
   * @returns A {@link FuturesContractFamily} bound to the slug.
   *
   * @example
   * ```typescript
   * const brent = client.futures.family('ice-brent');
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
    return this.family("ice-brent");
  }

  /** ICE WTI crude futures family helper. */
  wti(): FuturesContractFamily {
    return this.family("ice-wti");
  }

  /** ICE Gasoil futures family helper (issue #1). */
  gasoil(): FuturesContractFamily {
    return this.family("ice-gasoil");
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
    return this.family("eua-carbon");
  }

  /** UK carbon allowance (UKA) futures family helper. */
  ukCarbon(): FuturesContractFamily {
    return this.family("uk-carbon");
  }
}
