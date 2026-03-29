/**
 * Analytics Resource
 *
 * Access advanced analytics including performance metrics, statistical analysis,
 * correlations, trend detection, spreads, and forecasts.
 */

import type { OilPriceAPI } from "../client.js";
import { ValidationError } from "../errors.js";

/**
 * Performance metrics for commodities
 */
export interface PerformanceMetrics {
  /** Commodity code */
  commodity?: string;
  /** Time period analyzed (in days) */
  period_days: number;
  /** Average price over period */
  average_price: number;
  /** Price volatility (standard deviation) */
  volatility: number;
  /** Percentage return over period */
  return_percent: number;
  /** Highest price in period */
  high: number;
  /** Lowest price in period */
  low: number;
  /** ISO timestamp */
  timestamp: string;
}

/**
 * Options for performance query
 */
export interface PerformanceOptions {
  /** Commodity code to analyze */
  commodity?: string;
  /** Number of days to analyze (default: 30) */
  days?: number;
}

/**
 * Statistical analysis results
 */
export interface StatisticalAnalysis {
  /** Commodity code */
  commodity: string;
  /** Time period analyzed (in days) */
  period_days: number;
  /** Mean price */
  mean: number;
  /** Median price */
  median: number;
  /** Standard deviation */
  std_dev: number;
  /** Variance */
  variance: number;
  /** Minimum price */
  min: number;
  /** Maximum price */
  max: number;
  /** 25th percentile */
  percentile_25?: number;
  /** 75th percentile */
  percentile_75?: number;
  /** Skewness */
  skewness?: number;
  /** Kurtosis */
  kurtosis?: number;
  /** ISO timestamp */
  timestamp: string;
}

/**
 * Correlation analysis between two commodities
 */
export interface CorrelationAnalysis {
  /** First commodity code */
  commodity1: string;
  /** Second commodity code */
  commodity2: string;
  /** Time period analyzed (in days) */
  period_days: number;
  /** Pearson correlation coefficient (-1 to 1) */
  correlation: number;
  /** Correlation strength description */
  strength?: "strong" | "moderate" | "weak" | "none";
  /** R-squared value */
  r_squared?: number;
  /** ISO timestamp */
  timestamp: string;
}

/**
 * Trend analysis results
 */
export interface TrendAnalysis {
  /** Commodity code */
  commodity: string;
  /** Time period analyzed (in days) */
  period_days: number;
  /** Overall trend direction */
  trend: "upward" | "downward" | "sideways";
  /** Trend strength (0-100) */
  strength: number;
  /** Slope of trend line */
  slope?: number;
  /** Price momentum */
  momentum?: number;
  /** Support level */
  support?: number;
  /** Resistance level */
  resistance?: number;
  /** ISO timestamp */
  timestamp: string;
}

/**
 * Spread analysis between commodities
 */
export interface SpreadAnalysis {
  /** First commodity code */
  commodity1: string;
  /** Second commodity code */
  commodity2: string;
  /** Current spread (commodity1 - commodity2) */
  spread: number;
  /** Historical average spread */
  average_spread?: number;
  /** Spread standard deviation */
  spread_volatility?: number;
  /** Z-score of current spread */
  z_score?: number;
  /** ISO timestamp */
  timestamp: string;
}

/**
 * Forecast data point
 */
export interface ForecastPoint {
  /** Forecast date */
  date: string;
  /** Forecasted price */
  price: number;
  /** Lower bound of confidence interval */
  lower_bound?: number;
  /** Upper bound of confidence interval */
  upper_bound?: number;
  /** Confidence level (e.g., 0.95 for 95%) */
  confidence?: number;
}

/**
 * Price forecast
 */
export interface PriceForecast {
  /** Commodity code */
  commodity: string;
  /** Forecast model used */
  model?: string;
  /** Forecast horizon (days ahead) */
  horizon_days: number;
  /** Array of forecast points */
  forecast: ForecastPoint[];
  /** Model accuracy metrics */
  accuracy?: {
    /** Mean Absolute Percentage Error */
    mape?: number;
    /** Root Mean Squared Error */
    rmse?: number;
  };
  /** ISO timestamp when forecast was generated */
  timestamp: string;
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
 * // Get performance metrics
 * const perf = await client.analytics.performance({ commodity: 'WTI_USD', days: 30 });
 * console.log(`30-day return: ${perf.return_percent}%`);
 * console.log(`Volatility: ${perf.volatility}`);
 *
 * // Analyze correlation
 * const corr = await client.analytics.correlation('WTI_USD', 'BRENT_CRUDE_USD', 90);
 * console.log(`Correlation: ${corr.correlation}`);
 * ```
 */
export class AnalyticsResource {
  constructor(private client: OilPriceAPI) {}

  /**
   * Get performance metrics for a commodity
   *
   * Returns key performance indicators including returns, volatility,
   * and price range over a specified period.
   *
   * @param options - Analysis parameters
   * @returns Performance metrics
   *
   * @throws {OilPriceAPIError} If API request fails
   *
   * @example
   * ```typescript
   * const metrics = await client.analytics.performance({
   *   commodity: 'WTI_USD',
   *   days: 30
   * });
   * console.log(`Return: ${metrics.return_percent}%`);
   * console.log(`Volatility: ${metrics.volatility}`);
   * console.log(`High: $${metrics.high}, Low: $${metrics.low}`);
   * ```
   */
  async performance(options?: PerformanceOptions): Promise<PerformanceMetrics> {
    const params: Record<string, string> = {};
    if (options?.commodity) params.commodity = options.commodity;
    if (options?.days) params.days = options.days.toString();

    return this.client["request"]<PerformanceMetrics>(
      "/v1/analytics/performance",
      params,
    );
  }

  /**
   * Get statistical analysis for a commodity
   *
   * Returns comprehensive statistical metrics including mean, median,
   * standard deviation, and distribution characteristics.
   *
   * @param commodity - Commodity code to analyze
   * @param days - Number of days to analyze (default: 30)
   * @returns Statistical analysis
   *
   * @throws {NotFoundError} If commodity not found
   * @throws {OilPriceAPIError} If API request fails
   *
   * @example
   * ```typescript
   * const stats = await client.analytics.statistics('BRENT_CRUDE_USD', 90);
   * console.log(`Mean: $${stats.mean}`);
   * console.log(`Std Dev: ${stats.std_dev}`);
   * console.log(`Range: $${stats.min} - $${stats.max}`);
   * ```
   */
  async statistics(
    commodity: string,
    days?: number,
  ): Promise<StatisticalAnalysis> {
    if (!commodity || typeof commodity !== "string") {
      throw new ValidationError("Commodity code must be a non-empty string");
    }

    const params: Record<string, string> = { commodity };
    if (days) params.days = days.toString();

    return this.client["request"]<StatisticalAnalysis>(
      "/v1/analytics/statistics",
      params,
    );
  }

  /**
   * Analyze correlation between two commodities
   *
   * Calculates the Pearson correlation coefficient to measure how closely
   * two commodities move together.
   *
   * @param commodity1 - First commodity code
   * @param commodity2 - Second commodity code
   * @param days - Number of days to analyze (default: 30)
   * @returns Correlation analysis
   *
   * @throws {NotFoundError} If either commodity not found
   * @throws {OilPriceAPIError} If API request fails
   *
   * @example
   * ```typescript
   * const corr = await client.analytics.correlation('WTI_USD', 'BRENT_CRUDE_USD', 90);
   * console.log(`Correlation: ${corr.correlation}`);
   * console.log(`Strength: ${corr.strength}`);
   * console.log(`R-squared: ${corr.r_squared}`);
   * ```
   */
  async correlation(
    commodity1: string,
    commodity2: string,
    days?: number,
  ): Promise<CorrelationAnalysis> {
    if (!commodity1 || typeof commodity1 !== "string") {
      throw new ValidationError("First commodity code must be a non-empty string");
    }
    if (!commodity2 || typeof commodity2 !== "string") {
      throw new ValidationError("Second commodity code must be a non-empty string");
    }

    const params: Record<string, string> = {
      commodity1,
      commodity2,
    };
    if (days) params.days = days.toString();

    return this.client["request"]<CorrelationAnalysis>(
      "/v1/analytics/correlation",
      params,
    );
  }

  /**
   * Analyze price trend for a commodity
   *
   * Detects trend direction, strength, and key levels (support/resistance).
   *
   * @param commodity - Commodity code to analyze
   * @param days - Number of days to analyze (default: 30)
   * @returns Trend analysis
   *
   * @throws {NotFoundError} If commodity not found
   * @throws {OilPriceAPIError} If API request fails
   *
   * @example
   * ```typescript
   * const trend = await client.analytics.trend('WTI_USD', 60);
   * console.log(`Trend: ${trend.trend} (strength: ${trend.strength})`);
   * console.log(`Support: $${trend.support}`);
   * console.log(`Resistance: $${trend.resistance}`);
   * ```
   */
  async trend(commodity: string, days?: number): Promise<TrendAnalysis> {
    if (!commodity || typeof commodity !== "string") {
      throw new ValidationError("Commodity code must be a non-empty string");
    }

    const params: Record<string, string> = { commodity };
    if (days) params.days = days.toString();

    return this.client["request"]<TrendAnalysis>("/v1/analytics/trend", params);
  }

  /**
   * Analyze spread between two commodities
   *
   * Calculates current spread and compares to historical patterns.
   *
   * @param commodity1 - First commodity code
   * @param commodity2 - Second commodity code
   * @returns Spread analysis
   *
   * @throws {NotFoundError} If either commodity not found
   * @throws {OilPriceAPIError} If API request fails
   *
   * @example
   * ```typescript
   * const spread = await client.analytics.spread('BRENT_CRUDE_USD', 'WTI_USD');
   * console.log(`Current spread: $${spread.spread}`);
   * console.log(`Average spread: $${spread.average_spread}`);
   * console.log(`Z-score: ${spread.z_score}`);
   * ```
   */
  async spread(
    commodity1: string,
    commodity2: string,
  ): Promise<SpreadAnalysis> {
    if (!commodity1 || typeof commodity1 !== "string") {
      throw new ValidationError("First commodity code must be a non-empty string");
    }
    if (!commodity2 || typeof commodity2 !== "string") {
      throw new ValidationError("Second commodity code must be a non-empty string");
    }

    return this.client["request"]<SpreadAnalysis>("/v1/analytics/spread", {
      commodity1,
      commodity2,
    });
  }

  /**
   * Get price forecast for a commodity
   *
   * Returns forecasted prices with confidence intervals.
   *
   * @param commodity - Commodity code to forecast
   * @returns Price forecast
   *
   * @throws {NotFoundError} If commodity not found
   * @throws {OilPriceAPIError} If API request fails
   *
   * @example
   * ```typescript
   * const forecast = await client.analytics.forecast('WTI_USD');
   * console.log(`Forecast model: ${forecast.model}`);
   * console.log(`Horizon: ${forecast.horizon_days} days`);
   *
   * forecast.forecast.forEach(point => {
   *   console.log(`${point.date}: $${point.price} (${point.lower_bound}-${point.upper_bound})`);
   * });
   * ```
   */
  async forecast(commodity: string): Promise<PriceForecast> {
    if (!commodity || typeof commodity !== "string") {
      throw new ValidationError("Commodity code must be a non-empty string");
    }

    return this.client["request"]<PriceForecast>("/v1/analytics/forecast", {
      commodity,
    });
  }
}
