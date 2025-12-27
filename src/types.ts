/**
 * Retry backoff strategy
 */
export type RetryStrategy = 'exponential' | 'linear' | 'fixed';

/**
 * Configuration options for OilPriceAPI client
 */
export interface OilPriceAPIConfig {
  /**
   * Your API key from https://www.oilpriceapi.com
   */
  apiKey: string;

  /**
   * Base URL for the API (optional, for testing)
   * @default "https://api.oilpriceapi.com"
   */
  baseUrl?: string;

  /**
   * Maximum number of retry attempts for failed requests
   * @default 3
   */
  retries?: number;

  /**
   * Initial delay between retries in milliseconds
   * @default 1000
   */
  retryDelay?: number;

  /**
   * Retry backoff strategy
   * @default "exponential"
   */
  retryStrategy?: RetryStrategy;

  /**
   * Request timeout in milliseconds
   * @default 90000 (90 seconds)
   */
  timeout?: number;

  /**
   * Enable debug logging to console
   * @default false
   */
  debug?: boolean;

  /**
   * Your application's URL (optional, for telemetry)
   * Helps us understand how the API is being used and may unlock
   * a 10% bonus to your request limit.
   * @example "https://myapp.com"
   */
  appUrl?: string;

  /**
   * Your application's name (optional, for telemetry)
   * @example "MyFuelPriceTracker"
   */
  appName?: string;
}

/**
 * Represents a single price data point
 */
export interface Price {
  /**
   * Commodity code (e.g., "WTI_USD", "BRENT_CRUDE_USD")
   */
  code: string;

  /**
   * Current price value
   */
  price: number;

  /**
   * Formatted price string (e.g., "$74.25")
   */
  formatted: string;

  /**
   * Currency code (e.g., "USD")
   */
  currency: string;

  /**
   * ISO 8601 timestamp of when this price was recorded
   */
  created_at: string;

  /**
   * Type of price (e.g., "spot_price")
   */
  type: string;

  /**
   * Data source (e.g., "oilprice.ft", "internal")
   */
  source: string;

  /**
   * Price changes over different time periods (24h, 7d, 30d, 90d)
   */
  changes?: {
    '24h'?: {
      amount: number;
      percent: number;
      previous_price: number;
    };
    '7d'?: {
      amount: number;
      percent: number;
      previous_price: number;
    };
    '30d'?: {
      amount: number;
      percent: number;
      previous_price: number;
    };
    '90d'?: {
      amount: number;
      percent: number;
      previous_price: number;
    };
  };

  /**
   * Additional metadata about the source
   */
  metadata?: {
    source: string;
    source_description?: string;
  };
}

/**
 * Options for fetching latest prices
 */
export interface LatestPricesOptions {
  /**
   * Filter by specific commodity code (optional)
   * Example: "WTI_USD", "BRENT_CRUDE_USD"
   */
  commodity?: string;
}

/**
 * Time period options for historical data
 */
export type HistoricalPeriod = 'past_week' | 'past_month' | 'past_year';

/**
 * Aggregation interval for historical data
 *
 * PERFORMANCE TIP: Use 'daily' or 'weekly' for year-long queries to reduce
 * response times from 74s to <1s. The 'raw' option returns individual price
 * points which can be 600k+ records for a year of BRENT data.
 */
export type AggregationInterval = 'raw' | 'hourly' | 'daily' | 'weekly' | 'monthly';

/**
 * Options for fetching historical prices
 */
export interface HistoricalPricesOptions {
  /**
   * Predefined time period (alternative to startDate/endDate)
   */
  period?: HistoricalPeriod;

  /**
   * Filter by specific commodity code (optional)
   */
  commodity?: string;

  /**
   * Start date in ISO 8601 format (YYYY-MM-DD)
   * Example: "2024-01-01"
   */
  startDate?: string;

  /**
   * End date in ISO 8601 format (YYYY-MM-DD)
   * Example: "2024-12-31"
   */
  endDate?: string;

  /**
   * Aggregation interval for the data
   *
   * PERFORMANCE: For year-long queries, use 'daily' (365 points) or 'weekly' (52 points)
   * instead of 'raw' (600k+ points for BRENT) to dramatically improve response times.
   *
   * @default API default (raw for short periods, may be aggregated for long periods)
   */
  interval?: AggregationInterval;

  /**
   * Number of results per page
   *
   * @default 100 (API default)
   * @max 1000
   */
  perPage?: number;

  /**
   * Page number for pagination (1-indexed)
   *
   * @default 1
   */
  page?: number;
}

/**
 * Represents commodity metadata
 */
export interface Commodity {
  /**
   * Unique commodity identifier
   */
  code: string;

  /**
   * Human-readable commodity name
   */
  name: string;

  /**
   * Base currency for pricing
   */
  currency: string;

  /**
   * Commodity category (e.g., "oil", "gas", "renewable")
   */
  category: string;

  /**
   * Detailed description
   */
  description?: string;

  /**
   * Unit of measurement (e.g., "barrel", "gallon")
   */
  unit: string;

  /**
   * Detailed unit description
   */
  unit_description?: string;

  /**
   * Storage multiplier for price values
   */
  multiplier?: number;

  /**
   * Price validation ranges
   */
  validation?: {
    min: number;
    max: number;
  };

  /**
   * Threshold for significant price change alerts
   */
  price_change_threshold?: number;
}

/**
 * Response from /v1/commodities endpoint
 */
export interface CommoditiesResponse {
  commodities: Commodity[];
}

/**
 * Category with its commodities
 */
export interface CommodityCategory {
  name: string;
  commodities: Commodity[];
}

/**
 * Response from /v1/commodities/categories endpoint
 * Returns object with category keys mapped to CommodityCategory objects
 */
export interface CategoriesResponse {
  [categoryKey: string]: CommodityCategory;
}
