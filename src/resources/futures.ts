/**
 * Futures Resource
 *
 * Access futures contract data including latest prices, historical data,
 * OHLC, intraday, spreads, curves, and continuous contracts.
 */

import type { OilPriceAPI } from "../client.js";
import { ValidationError } from "../errors.js";

/**
 * Futures contract price data
 */
export interface FuturesPrice {
  /** Contract symbol */
  contract: string;
  /** Current price */
  price: number;
  /** Formatted price string */
  formatted?: string;
  /** Currency code */
  currency: string;
  /** Contract expiration date */
  expiration?: string;
  /** ISO timestamp when price was recorded */
  timestamp: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
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
 * Options for historical futures query
 */
export interface HistoricalFuturesOptions {
  /** Start date in ISO 8601 format (YYYY-MM-DD) */
  startDate?: string;
  /** End date in ISO 8601 format (YYYY-MM-DD) */
  endDate?: string;
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
 * Futures curve data
 */
export interface FuturesCurveData {
  /** Base contract */
  contract: string;
  /** ISO timestamp when curve was generated */
  timestamp: string;
  /** Array of curve points */
  curve: FuturesCurvePoint[];
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
 * // Get latest price
 * const latest = await client.futures.latest('CL.1');
 * console.log(`${latest.contract}: $${latest.price}`);
 *
 * // Get OHLC data
 * const ohlc = await client.futures.ohlc('CL.1', '2024-01-15');
 * console.log(`High: $${ohlc.high}, Low: $${ohlc.low}`);
 *
 * // Get futures curve
 * const curve = await client.futures.curve('CL');
 * curve.curve.forEach(point => {
 *   console.log(`${point.months_out}mo: $${point.price}`);
 * });
 * ```
 */
export class FuturesResource {
  constructor(private client: OilPriceAPI) {}

  /**
   * Get latest price for a futures contract
   *
   * @param contract - Contract symbol (e.g., "CL.1", "BZ.2")
   * @returns Latest futures price data
   *
   * @throws {NotFoundError} If contract not found
   * @throws {OilPriceAPIError} If API request fails
   *
   * @example
   * ```typescript
   * const price = await client.futures.latest('CL.1');
   * console.log(`WTI Front Month: $${price.price}`);
   * ```
   */
  async latest(contract: string): Promise<FuturesPrice> {
    if (!contract || typeof contract !== "string") {
      throw new ValidationError("Contract symbol must be a non-empty string");
    }

    return this.client["request"]<FuturesPrice>(`/v1/futures/${contract}`, {});
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

    return this.client["request"]<FuturesOHLC>(
      `/v1/futures/${contract}/ohlc`,
      params,
    );
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

    return this.client["request"]<IntradayFuturesData>(
      `/v1/futures/${contract}/intraday`,
      {},
    );
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

    return this.client["request"]<FuturesCurveData>(
      `/v1/futures/${contract}/curve`,
      {},
    );
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
  async continuous(
    contract: string,
    months?: number,
  ): Promise<ContinuousFuturesData> {
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
}
