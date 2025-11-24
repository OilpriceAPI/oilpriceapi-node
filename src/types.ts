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
   * @default 30000 (30 seconds)
   */
  timeout?: number;

  /**
   * Enable debug logging to console
   * @default false
   */
  debug?: boolean;
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
}
