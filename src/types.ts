/**
 * Retry backoff strategy
 */
export type RetryStrategy = "exponential" | "linear" | "fixed";

/**
 * Configuration options for OilPriceAPI client
 */
export interface OilPriceAPIConfig {
  /**
   * Your API key from https://www.oilpriceapi.com
   * If not provided, reads from OILPRICEAPI_KEY. Keyless clients may call the
   * public demo methods; authenticated methods fail before making a request.
   */
  apiKey?: string;

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
   * Your application's URL (optional, for usage attribution)
   * @example "https://myapp.com"
   */
  appUrl?: string;

  /**
   * Your application's name (optional, for usage attribution)
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
   * Unit of measurement returned by the API (e.g., "barrel")
   */
  unit: string;

  /**
   * ISO 8601 timestamp of when this price was recorded
   */
  created_at: string;

  /** Exact source timestamp when returned by the selected dataset. */
  source_timestamp?: string;

  /** Source as-of timestamp when returned by the selected dataset. */
  as_of?: string;

  /** Collection timestamp when returned by the selected dataset. */
  collected_at?: string;

  /** Update timestamp used by some endpoint families. */
  updated_at?: string;

  /** Freshness status when returned by the API. */
  data_status?: string;

  /**
   * Type of price (e.g., "spot_price")
   */
  type: string;

  /**
   * Data source (e.g., "oilprice.ft", "internal")
   */
  source: string;

  /**
   * Source-freshness block returned with every price.
   *
   * This is the data the product is differentiated on, and the published type
   * used to omit it entirely — callers had to `as any` their way to it (#94).
   * Captured from live production 2026-09-13.
   *
   * `reason` appears only when the status explains itself; the others are
   * present on every payload observed.
   */
  freshness?: {
    status: string;
    reason?: string;
    age_seconds: number;
    expected_max_age_seconds: number;
    circuit_breaker_open: boolean;
  };

  /** Whether the API considers this price stale. */
  stale?: boolean;

  /** Long-form staleness flag used by some endpoint families. */
  is_stale?: boolean;

  /** Why the price is stale, when the API explains it. */
  stale_reason?: string;

  /** Whether this price was synthesised rather than observed. */
  synthetic?: boolean;

  /** Age of the price in days. */
  age_days?: number;

  /**
   * Price changes over different time periods (24h, 7d, 30d, 90d)
   */
  changes?: {
    "24h"?: {
      amount: number;
      percent: number;
      previous_price: number;
      /** Timestamp of the price this change was measured against. */
      previous_timestamp?: string;
      /** When the comparison was made. */
      measured_at?: string;
      /** Actual hours between the two points — rarely exactly 24. */
      span_hours?: number;
    };
    "7d"?: {
      amount: number;
      percent: number;
      previous_price: number;
    };
    "30d"?: {
      amount: number;
      percent: number;
      previous_price: number;
    };
    "90d"?: {
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
export type HistoricalPeriod = "past_week" | "past_month" | "past_year";

/**
 * Aggregation interval for historical data
 *
 * PERFORMANCE TIP: Use 'daily' or 'weekly' for year-long queries to reduce
 * response times from 74s to <1s. The 'raw' option returns individual price
 * points which can be 600k+ records for a year of BRENT data.
 */
export type AggregationInterval = "raw" | "hourly" | "daily" | "weekly" | "monthly";

/**
 * Options for fetching historical prices
 */
/**
 * Rows the API will return for a single page, whatever `per_page` asks for.
 *
 * Verified against live production on 2026-09-13: `per_page` of 500, 600 and
 * 1000 each returned exactly 500 rows for the same query. Pagination that
 * requests more than this reads the cap as end-of-data (#90).
 */
export const MAX_PER_PAGE = 500;

/** The API's own default page size, used when the caller names none. */
export const DEFAULT_PER_PAGE = 100;

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
   * The API serves at most {@link MAX_PER_PAGE} rows per page however large
   * this is — asking for more does not return more. The docs previously said
   * 1000, which was the value that made `paginateHistoricalPrices` stop after
   * one page (#90). Verified against production 2026-09-13: `per_page` of
   * 500, 600 and 1000 all return 500 rows.
   *
   * @default 100 (API default)
   * @max 500
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
   *
   * Optional because this type describes two payloads with different required
   * sets: `/v1/commodities` includes it, while the commodities nested inside
   * `/v1/commodities/categories` carry only code, name, currency,
   * description, unit, unit_description, status and has_data. Declaring it
   * required typed it `string` while it was `undefined` at runtime (#94).
   */
  category?: string;

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

  /** Lifecycle status of the commodity (e.g. "active"). */
  status?: string;

  /** Whether the API currently holds price data for this commodity. */
  has_data?: boolean;

  /** Upstream data source identifier. */
  data_source?: string;

  /** How often the commodity is refreshed. */
  update_frequency?: string;

  /** Named upstream sources contributing to this commodity. */
  sources?: unknown;
}

/**
 * Response from /v1/commodities endpoint
 */
export interface CommoditiesResponse {
  commodities: Commodity[];
}

/**
 * A single price entry from the no-auth demo prices endpoint.
 */
export interface DemoPrice {
  code: string;
  name: string;
  price: number;
  currency: string;
  updated_at: string;
  change_24h?: number;
  source?: string;
}

/**
 * Parsed response from the no-auth `GET /v1/demo/prices` endpoint.
 */
export interface DemoPricesResponse {
  prices: DemoPrice[];
  meta: {
    demo_mode?: boolean;
    rate_limit?: string;
    available_commodities?: number;
    [key: string]: unknown;
  };
  examples?: unknown;
}

/**
 * Parsed response from the no-auth `GET /v1/demo/commodities` endpoint.
 */
export interface DemoCommoditiesResponse {
  /** Commodities grouped by category key. */
  commodities: Record<string, Commodity[]>;
  meta: {
    /** Total number of demo-listed commodities. */
    total: number;
    /** Category keys present in the listing. */
    categories: string[];
    /** Commodity codes available on the free demo tier. */
    free_commodities: string[];
    [key: string]: unknown;
  };
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
 * Production returns `{ status, data: { categories: {...} } }` and the
 * transport unwraps exactly one level, so the caller receives
 * `{ categories: {...} }`.
 *
 * This was previously an index signature over the response itself, which
 * claimed every string key yielded a CommodityCategory. That is what hid the
 * missing unwrap from the compiler: `cats.oil.commodities.length` compiled
 * and threw at runtime, and so did `cats.this_does_not_exist.name` (#94).
 */
export interface CategoriesResponse {
  categories: Record<string, CommodityCategory>;
}

/**
 * BYOS (Bring Your Own Subscription) price from Data Connector
 */
export interface DataConnectorPrice {
  /**
   * Price value in specified currency
   */
  price: number;

  /**
   * Currency code (e.g., "USD")
   */
  currency: string;

  /**
   * Fuel type (e.g., "VLSFO", "MGO", "IFO380")
   */
  fuel_type: string;

  /**
   * Port name (e.g., "SINGAPORE", "ROTTERDAM")
   */
  port: string;

  /**
   * Geographic region (AMERICAS, EMEA, APAC)
   */
  region: string | null;

  /**
   * Unit of measurement (typically "MT" for metric ton)
   */
  unit: string;

  /**
   * Data source provider (e.g., "shipandbunker")
   */
  source: string;

  /**
   * ISO 8601 timestamp when price was recorded
   */
  timestamp: string;
}

/**
 * Options for fetching Data Connector prices
 */
export interface DataConnectorOptions {
  /**
   * Filter by fuel type (VLSFO, MGO, IFO380)
   */
  fuelType?: string;

  /**
   * Filter by port name
   */
  port?: string;

  /**
   * Filter by region (AMERICAS, EMEA, APAC)
   */
  region?: string;

  /**
   * ISO 8601 timestamp to fetch prices after
   */
  since?: string;
}
