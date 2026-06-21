/**
 * Analytics Resource
 *
 * Access advanced analytics including performance metrics, statistical analysis,
 * correlations, trend detection, spreads, and forecasts.
 *
 * NOTE ON PARAMETERS: The OilPriceAPI analytics controller reads commodity
 * identifiers as `code` / `code1` / `code2` and the lookback window as `period`
 * (in days). Earlier versions of this SDK sent `commodity` / `commodity1` /
 * `commodity2` / `days`, which the API silently ignored (and `correlation`
 * returned "code1 and code2 parameters are required"). These methods now send
 * the parameter names the controller actually reads.
 */

import type { OilPriceAPI } from "../client.js";
import { ValidationError } from "../errors.js";

/**
 * Performance metrics for the authenticated user's API usage.
 *
 * NOTE: `/v1/analytics/performance` returns the user's API usage analytics
 * (request counts, error rate, endpoint breakdown) for a dashboard, NOT
 * commodity price performance. It accepts a `range` of `7d` | `30d` | `90d`.
 */
export interface PerformanceMetrics {
  overview?: Record<string, unknown>;
  dailyUsage?: Array<Record<string, unknown>>;
  hourlyDistribution?: Array<Record<string, unknown>>;
  endpointBreakdown?: Array<Record<string, unknown>>;
  geographicData?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

/**
 * Options for performance query
 */
export interface PerformanceOptions {
  /** Time range for usage analytics: '7d' | '30d' | '90d' (default: '30d') */
  range?: "7d" | "30d" | "90d";
}

/**
 * Statistical analysis results
 */
export interface StatisticalAnalysis {
  /** Commodity code */
  code: string;
  /** Time period analyzed (in days) */
  period: number;
  /** Statistical metrics computed for the commodity */
  statistics: Record<string, unknown>;
  /** Tier of the requesting user */
  tier?: string;
  [key: string]: unknown;
}

/**
 * Correlation analysis between two commodities
 */
export interface CorrelationAnalysis {
  /** Response type: 'analysis' | 'rolling' | 'matrix' */
  type?: string;
  /** First commodity code */
  code1?: string;
  /** Second commodity code */
  code2?: string;
  /** Time period analyzed (in days) */
  period?: number;
  /** Pearson correlation coefficient (-1 to 1) */
  correlation?: number;
  /** Correlation strength description */
  strength?: string;
  /** Tier of the requesting user */
  tier?: string;
  [key: string]: unknown;
}

/**
 * Options for correlation query
 */
export interface CorrelationOptions {
  /** Lookback window in days (default: 30) */
  period?: number;
  /** Correlation variant: 'analysis' (default), 'rolling', or 'matrix' */
  type?: "analysis" | "rolling" | "matrix";
  /** Rolling window size in days (only used when type === 'rolling') */
  window?: number;
  /** Comma-separated codes for a correlation matrix (only when type === 'matrix') */
  codes?: string[];
}

/**
 * Trend analysis results
 */
export interface TrendAnalysis {
  /** Response type: 'analysis' | 'sma' | 'ema' | 'rsi' | 'levels' */
  type?: string;
  /** Commodity code */
  code?: string;
  /** Time period analyzed (in days) */
  period?: number;
  /** Tier of the requesting user */
  tier?: string;
  [key: string]: unknown;
}

/**
 * Options for trend query
 */
export interface TrendOptions {
  /** Lookback window in days (default: 30) */
  period?: number;
  /** Trend variant: 'analysis' (default), 'sma', 'ema', 'rsi', or 'levels' */
  type?: "analysis" | "sma" | "ema" | "rsi" | "levels";
  /** Moving-average / indicator window (used by sma/ema/rsi) */
  window?: number;
}

/**
 * Spread analysis for a named commodity spread (e.g. 'wti_brent')
 */
export interface SpreadAnalysis {
  /** Response type: 'current' | 'historical' */
  type?: string;
  /** The named spread analyzed */
  spread?: string;
  /** Time period analyzed (in days) */
  period?: number;
  /** Tier of the requesting user */
  tier?: string;
  [key: string]: unknown;
}

/**
 * Options for spread query
 */
export interface SpreadOptions {
  /** Lookback window in days (default: 30) */
  period?: number;
  /** Spread variant: 'current' (default) or 'historical' */
  type?: "current" | "historical";
}

/**
 * Price forecast
 */
export interface PriceForecast {
  /** Commodity code */
  code?: string;
  /** Forecast method used */
  method?: string;
  /** Tier of the requesting user */
  tier?: string;
  [key: string]: unknown;
}

/**
 * Options for forecast query
 */
export interface ForecastOptions {
  /** Forecast method (default: 'ema') */
  method?: string;
  /** Lookback window in days (default: 90) */
  period?: number;
}

/**
 * Analytics Resource
 *
 * Access advanced analytics including performance metrics, statistical analysis,
 * correlations, trends, spreads, and forecasts.
 *
 * @example
 * ```typescript
 * import { OilPriceAPI } from 'oilpriceapi';
 *
 * const client = new OilPriceAPI({ apiKey: 'your_key' });
 *
 * // Analyze correlation between two commodities (90-day window)
 * const corr = await client.analytics.correlation('WTI_USD', 'BRENT_CRUDE_USD', { period: 90 });
 * console.log(`Correlation: ${corr.correlation}`);
 * ```
 */
export class AnalyticsResource {
  constructor(private client: OilPriceAPI) {}

  /**
   * Get the authenticated user's API usage analytics for the dashboard.
   *
   * Maps to `GET /v1/analytics/performance`, which reads a `range`
   * parameter (`7d` | `30d` | `90d`).
   *
   * @param options - `{ range }` (default range '30d')
   * @returns Usage analytics (overview, daily usage, endpoint breakdown, ...)
   */
  async performance(options?: PerformanceOptions): Promise<PerformanceMetrics> {
    const params: Record<string, string> = {};
    if (options?.range) params.range = options.range;

    return this.client["request"]<PerformanceMetrics>("/v1/analytics/performance", params);
  }

  /**
   * Get statistical analysis for a commodity.
   *
   * Maps to `GET /v1/analytics/statistics`, which reads `code` and `period`.
   *
   * @param code - Commodity code to analyze (e.g. 'WTI_USD')
   * @param period - Lookback window in days (default: 30)
   * @returns Statistical analysis
   *
   * @throws {ValidationError} If code is empty
   */
  async statistics(code: string, period?: number): Promise<StatisticalAnalysis> {
    if (!code || typeof code !== "string") {
      throw new ValidationError("Commodity code must be a non-empty string");
    }

    const params: Record<string, string> = { code };
    if (period !== undefined) params.period = period.toString();

    return this.client["request"]<StatisticalAnalysis>("/v1/analytics/statistics", params);
  }

  /**
   * Analyze correlation between two commodities.
   *
   * Maps to `GET /v1/analytics/correlation`, which reads `code1`, `code2`,
   * `period` and optional `type`, `window`, `codes`.
   *
   * @param code1 - First commodity code
   * @param code2 - Second commodity code
   * @param options - Lookback window in days, or `{ period, type, window, codes }`
   * @returns Correlation analysis
   *
   * @throws {ValidationError} If either code is empty
   *
   * @example
   * ```typescript
   * const corr = await client.analytics.correlation('WTI_USD', 'BRENT_CRUDE_USD', { period: 90 });
   * console.log(corr.correlation);
   * ```
   */
  async correlation(
    code1: string,
    code2: string,
    options?: number | CorrelationOptions,
  ): Promise<CorrelationAnalysis> {
    if (!code1 || typeof code1 !== "string") {
      throw new ValidationError("First commodity code must be a non-empty string");
    }
    if (!code2 || typeof code2 !== "string") {
      throw new ValidationError("Second commodity code must be a non-empty string");
    }

    const opts: CorrelationOptions =
      typeof options === "number" ? { period: options } : options || {};

    const params: Record<string, string> = { code1, code2 };
    if (opts.period !== undefined) params.period = opts.period.toString();
    if (opts.type) params.type = opts.type;
    if (opts.window !== undefined) params.window = opts.window.toString();
    if (opts.codes && opts.codes.length > 0) params.codes = opts.codes.join(",");

    return this.client["request"]<CorrelationAnalysis>("/v1/analytics/correlation", params);
  }

  /**
   * Analyze price trend for a commodity.
   *
   * Maps to `GET /v1/analytics/trend`, which reads `code`, `period` and
   * optional `type` ('analysis' | 'sma' | 'ema' | 'rsi' | 'levels') and `window`.
   *
   * @param code - Commodity code to analyze
   * @param options - Lookback window in days, or `{ period, type, window }`
   * @returns Trend analysis
   *
   * @throws {ValidationError} If code is empty
   */
  async trend(code: string, options?: number | TrendOptions): Promise<TrendAnalysis> {
    if (!code || typeof code !== "string") {
      throw new ValidationError("Commodity code must be a non-empty string");
    }

    const opts: TrendOptions = typeof options === "number" ? { period: options } : options || {};

    const params: Record<string, string> = { code };
    if (opts.period !== undefined) params.period = opts.period.toString();
    if (opts.type) params.type = opts.type;
    if (opts.window !== undefined) params.window = opts.window.toString();

    return this.client["request"]<TrendAnalysis>("/v1/analytics/trend", params);
  }

  /**
   * Analyze a named commodity spread (basis / crack / ratio).
   *
   * Maps to `GET /v1/analytics/spread`, which reads `spread` (the named spread,
   * e.g. 'wti_brent'), `period` and optional `type` ('current' | 'historical').
   * Call with no `spread` to list the available named spreads.
   *
   * @param spread - Named spread (e.g. 'wti_brent'); omit to list available spreads
   * @param options - Lookback window in days, or `{ period, type }`
   * @returns Spread analysis (or the list of available spreads)
   *
   * @example
   * ```typescript
   * const spread = await client.analytics.spread('wti_brent', { period: 30 });
   * console.log(spread.current_spread);
   * ```
   */
  async spread(spread?: string, options?: number | SpreadOptions): Promise<SpreadAnalysis> {
    const opts: SpreadOptions = typeof options === "number" ? { period: options } : options || {};

    const params: Record<string, string> = {};
    if (spread) params.spread = spread;
    if (opts.period !== undefined) params.period = opts.period.toString();
    if (opts.type) params.type = opts.type;

    return this.client["request"]<SpreadAnalysis>("/v1/analytics/spread", params);
  }

  /**
   * Get a statistical price forecast for a commodity.
   *
   * Maps to `GET /v1/analytics/forecast`, which reads `code`, `method`
   * (default 'ema') and `period` (default 90). Call with no `code` to list
   * the available forecast methods.
   *
   * @param code - Commodity code to forecast; omit to list available methods
   * @param options - `{ method, period }`
   * @returns Price forecast (or the list of available methods)
   */
  async forecast(code?: string, options?: ForecastOptions): Promise<PriceForecast> {
    const params: Record<string, string> = {};
    if (code) params.code = code;
    if (options?.method) params.method = options.method;
    if (options?.period !== undefined) params.period = options.period.toString();

    return this.client["request"]<PriceForecast>("/v1/analytics/forecast", params);
  }
}
