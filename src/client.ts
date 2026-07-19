import type {
  OilPriceAPIConfig,
  RetryStrategy,
  Price,
  LatestPricesOptions,
  HistoricalPricesOptions,
  Commodity,
  CommoditiesResponse,
  CategoriesResponse,
  DataConnectorPrice,
  DataConnectorOptions,
  DemoPricesResponse,
  DemoCommoditiesResponse,
} from "./types.js";
import type { MarketBrief, MarketBriefOptions } from "./resources/market-brief.js";
import {
  OilPriceAPIError,
  AuthenticationError,
  RateLimitError,
  NotFoundError,
  ServerError,
  TimeoutError,
  ValidationError,
} from "./errors.js";
import { DieselResource } from "./resources/diesel.js";
import { AlertsResource } from "./resources/alerts.js";
import { CommoditiesResource } from "./resources/commodities.js";
import { FuturesResource } from "./resources/futures.js";
import { StorageResource } from "./resources/storage.js";
import { RigCountsResource } from "./resources/rig-counts.js";
import { BunkerFuelsResource } from "./resources/bunker-fuels.js";
import { AnalyticsResource } from "./resources/analytics.js";
import { ForecastsResource } from "./resources/forecasts.js";
import { DataQualityResource } from "./resources/data-quality.js";
import { DrillingIntelligenceResource } from "./resources/drilling.js";
import { EnergyIntelligenceResource } from "./resources/ei/index.js";
import { WebhooksResource } from "./resources/webhooks.js";
import { DataSourcesResource } from "./resources/data-sources.js";
import { SDK_VERSION, SDK_NAME, buildUserAgent } from "./version.js";
import { SpreadsResource } from "./resources/spreads.js";
import { IndicatorsResource } from "./resources/indicators.js";
import { RawResource } from "./resources/raw.js";
import { StreamingResource } from "./resources/streaming.js";
import { SubscriptionsResource } from "./resources/subscriptions.js";
import { WellProductionResource } from "./resources/well-production.js";

/**
 * Raw HTTP response wrapper.
 *
 * Returned by {@link OilPriceAPI.raw} accessors to expose the underlying
 * HTTP status code and response headers alongside the parsed data.
 *
 * @typeParam T - The parsed response body type.
 */
export interface APIResponse<T> {
  /** Parsed response data (same shape the non-raw method would return). */
  data: T;
  /** HTTP status code (e.g., 200, 201). */
  status: number;
  /** Response headers. */
  headers: Headers;
}

/**
 * Official Node.js client for Oil Price API
 *
 * @example
 * ```typescript
 * import { OilPriceAPI } from 'oilpriceapi';
 *
 * const client = new OilPriceAPI({
 *   apiKey: 'your_api_key_here',
 *   retries: 3,
 *   timeout: 30000
 * });
 *
 * // Get latest prices
 * const prices = await client.getLatestPrices();
 *
 * // Get WTI price only
 * const wti = await client.getLatestPrices({ commodity: 'WTI_USD' });
 *
 * // Get historical data
 * const historical = await client.getHistoricalPrices({
 *   period: 'past_week',
 *   commodity: 'BRENT_CRUDE_USD'
 * });
 * ```
 */
export class OilPriceAPI {
  private apiKey: string;
  private baseUrl: string;
  private retries: number;
  private retryDelay: number;
  private retryStrategy: RetryStrategy;
  private timeout: number;
  private debug: boolean;
  private appUrl?: string;
  private appName?: string;

  /**
   * Diesel prices resource (state averages + station-level pricing)
   */
  public readonly diesel: DieselResource;

  /**
   * Price alerts resource (create, manage, and monitor alerts)
   */
  public readonly alerts: AlertsResource;

  /**
   * Commodities resource (metadata and categories)
   */
  public readonly commodities: CommoditiesResource;

  /**
   * Futures resource (contracts, OHLC, curves, spreads)
   */
  public readonly futures: FuturesResource;

  /**
   * Storage resource (inventory levels, Cushing, SPR)
   */
  public readonly storage: StorageResource;

  /**
   * Rig counts resource (Baker Hughes rig count data)
   */
  public readonly rigCounts: RigCountsResource;

  /**
   * Bunker fuels resource (marine fuel prices at ports)
   */
  public readonly bunkerFuels: BunkerFuelsResource;

  /**
   * Analytics resource (performance, statistics, correlations)
   */
  public readonly analytics: AnalyticsResource;

  /**
   * Forecasts resource (EIA/IEA forecasts and accuracy)
   */
  public readonly forecasts: ForecastsResource;

  /**
   * Data quality resource (quality metrics and reports)
   */
  public readonly dataQuality: DataQualityResource;

  /**
   * Drilling intelligence resource (US onshore drilling activity)
   */
  public readonly drilling: DrillingIntelligenceResource;

  /**
   * Energy intelligence resource (comprehensive market intelligence)
   */
  public readonly ei: EnergyIntelligenceResource;

  /**
   * Webhooks resource (webhook endpoint management)
   */
  public readonly webhooks: WebhooksResource;

  /**
   * Data sources resource (BYOS - Bring Your Own Source)
   */
  public readonly dataSources: DataSourcesResource;

  /**
   * Spreads resource (crack, basis, curve structure, margin, physical premium)
   */
  public readonly spreads: SpreadsResource;

  /**
   * Indicators resource (fuel switching, price context, storage analytics,
   * annotations, CFTC positioning, congressional trades)
   */
  public readonly indicators: IndicatorsResource;

  /**
   * Raw-response accessor.
   *
   * Mirrors the top-level price/commodity methods but returns the underlying
   * HTTP status and headers alongside the parsed data via {@link APIResponse}.
   */
  public readonly raw: RawResource;

  /**
   * Real-time price streaming resource (WebSocket / ActionCable).
   *
   * Streaming requires a Professional plan ($99/mo) or higher.
   */
  public readonly stream: StreamingResource;

  /**
   * Agent subscriptions ("watches") resource — persistent recurring watches
   * over commodity codes plus an event poll endpoint (#3245 Phase 2).
   */
  public readonly subscriptions: SubscriptionsResource;

  /**
   * Well production resource (US national/state/well-level oil & gas
   * production plus permit-to-production cycle-time analytics).
   *
   * Requires the drilling-intelligence tier. Well-level coverage is beta —
   * limited to states collected from regulatory agencies so far.
   */
  public readonly wellProduction: WellProductionResource;

  constructor(config: OilPriceAPIConfig = {}) {
    this.apiKey = config.apiKey || process.env.OILPRICEAPI_KEY || "";
    if (!this.apiKey) {
      throw new OilPriceAPIError(
        "API key required. Set OILPRICEAPI_KEY env var or pass apiKey in config.",
      );
    }
    this.baseUrl = config.baseUrl || "https://api.oilpriceapi.com";
    this.retries = config.retries !== undefined ? config.retries : 3;
    this.retryDelay = config.retryDelay || 1000;
    this.retryStrategy = config.retryStrategy || "exponential";
    this.timeout = config.timeout || 90000; // 90 seconds for slow historical queries
    this.debug = config.debug || false;
    this.appUrl = config.appUrl;
    this.appName = config.appName;

    // Initialize resources
    this.diesel = new DieselResource(this);
    this.alerts = new AlertsResource(this);
    this.commodities = new CommoditiesResource(this);
    this.futures = new FuturesResource(this);
    this.storage = new StorageResource(this);
    this.rigCounts = new RigCountsResource(this);
    this.bunkerFuels = new BunkerFuelsResource(this);
    this.analytics = new AnalyticsResource(this);
    this.forecasts = new ForecastsResource(this);
    this.dataQuality = new DataQualityResource(this);
    this.drilling = new DrillingIntelligenceResource(this);
    this.ei = new EnergyIntelligenceResource(this);
    this.webhooks = new WebhooksResource(this);
    this.dataSources = new DataSourcesResource(this);
    this.spreads = new SpreadsResource(this);
    this.indicators = new IndicatorsResource(this);
    this.raw = new RawResource(this);
    this.stream = new StreamingResource(this);
    this.subscriptions = new SubscriptionsResource(this);
    this.wellProduction = new WellProductionResource(this);
  }

  /**
   * Log debug messages if debug mode is enabled
   */
  private log(message: string, data?: any): void {
    if (this.debug) {
      const timestamp = new Date().toISOString();
      console.log(`[OilPriceAPI ${timestamp}] ${message}`, data || "");
    }
  }

  /**
   * Calculate delay for retry based on strategy
   */
  private calculateRetryDelay(attempt: number): number {
    switch (this.retryStrategy) {
      case "exponential":
        return this.retryDelay * Math.pow(2, attempt);
      case "linear":
        return this.retryDelay * (attempt + 1);
      case "fixed":
      default:
        return this.retryDelay;
    }
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Determine if error is retryable
   */
  private isRetryable(error: any): boolean {
    // Retry on network errors
    if (error instanceof TypeError && error.message.includes("fetch")) {
      return true;
    }

    // Retry on timeout errors
    if (error instanceof TimeoutError) {
      return true;
    }

    // Retry on 5xx server errors
    if (error instanceof ServerError) {
      return true;
    }

    // Retry on rate limit errors (with delay)
    if (error instanceof RateLimitError) {
      return true;
    }

    // Don't retry on client errors (4xx except 429)
    return false;
  }

  /**
   * Shape a parsed JSON response body into the value returned to callers.
   *
   * Centralizes the response-structure handling so that both {@link request}
   * and {@link requestRaw} return identical data. Handles the latest/historical
   * envelope shapes as well as the generic `{ data }` fallback used by resource
   * mutations, alerts, webhooks, etc.
   */
  private shapeResponseData<T>(responseData: any): T {
    // Handle different response structures
    // Latest endpoint: { status, data: { price, ... } }
    // Historical endpoint: { status, data: { prices: [...] } }
    if (responseData.status === "success" && responseData.data) {
      if (responseData.data.prices) {
        // Historical endpoint - return prices array
        this.log(`Returning ${responseData.data.prices.length} prices`);
        return responseData.data.prices as T;
      } else if (responseData.data.price !== undefined) {
        // Latest endpoint - wrap single price in array
        this.log("Returning single price (wrapped in array)");
        return [responseData.data] as T;
      }
    }

    // Fallback - return data as-is (used by resource mutations, alerts, webhooks, etc.)
    this.log("Returning data as-is");
    return (responseData.data !== undefined ? responseData.data : responseData) as T;
  }

  /**
   * Internal method to make HTTP requests with retry and timeout.
   * Supports all HTTP methods (GET, POST, PATCH, DELETE) with consistent
   * retry logic, timeout handling, and typed error responses.
   */
  private async request<T>(
    endpoint: string,
    params?: Record<string, string>,
    options?: { method?: string; body?: unknown; headers?: Record<string, string> },
  ): Promise<T> {
    const { data } = await this.requestRaw<T>(endpoint, params, options);
    return data;
  }

  /**
   * Internal method identical to {@link request} but returns the underlying
   * HTTP status and headers alongside the parsed data.
   *
   * Used by the public {@link raw} accessor to expose response metadata
   * (issue #7) without changing the return shape of existing methods.
   */
  private async requestRaw<T>(
    endpoint: string,
    params?: Record<string, string>,
    options?: { method?: string; body?: unknown; headers?: Record<string, string> },
  ): Promise<APIResponse<T>> {
    // Build URL with query parameters
    const url = new URL(`${this.baseUrl}${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, value);
        }
      });
    }

    this.log(`Request: ${url.toString()}`);

    let lastError: Error | null = null;

    // Retry loop
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        // Add retry info to logs
        if (attempt > 0) {
          this.log(`Retry attempt ${attempt}/${this.retries}`);
        }

        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
          // Build headers with optional telemetry
          const headers: Record<string, string> = {
            Authorization: `Token ${this.apiKey}`,
            "Content-Type": "application/json",
            "User-Agent": buildUserAgent(),
            "X-SDK-Name": SDK_NAME,
            "X-SDK-Version": SDK_VERSION,
          };

          // Add optional telemetry headers (10% bonus for appUrl!)
          if (this.appUrl) {
            headers["X-App-URL"] = this.appUrl;
          }
          if (this.appName) {
            headers["X-App-Name"] = this.appName;
          }

          // Per-request headers (e.g. MCP attribution X-OPA-Source / X-OPA-Tool).
          if (options?.headers) {
            Object.entries(options.headers).forEach(([key, value]) => {
              if (value !== undefined && value !== null) {
                headers[key] = value;
              }
            });
          }

          const fetchOptions: RequestInit = {
            method: options?.method || "GET",
            headers,
            signal: controller.signal,
          };

          if (options?.body !== undefined) {
            fetchOptions.body = JSON.stringify(options.body);
          }

          const response = await fetch(url.toString(), fetchOptions);

          clearTimeout(timeoutId);

          this.log(`Response: ${response.status} ${response.statusText}`);

          // Handle error responses
          if (!response.ok) {
            const errorBody = await response.text();
            let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

            // Try to parse JSON error response
            try {
              const errorJson = JSON.parse(errorBody);
              errorMessage = errorJson.message || errorJson.error || errorMessage;
            } catch {
              // Use default error message if response isn't JSON
            }

            this.log(`Error response: ${errorMessage}`);

            // Throw specific error types based on status code
            switch (response.status) {
              case 401:
                throw new AuthenticationError(errorMessage);
              case 404:
                throw new NotFoundError(errorMessage);
              case 429:
                const retryAfter = response.headers.get("Retry-After");
                const rateLimitError = new RateLimitError(
                  errorMessage,
                  retryAfter ? parseInt(retryAfter, 10) : undefined,
                );

                // If rate limited and we have retries left, wait and retry
                if (attempt < this.retries && rateLimitError.retryAfter) {
                  this.log(`Rate limited. Waiting ${rateLimitError.retryAfter}s`);
                  await this.sleep(rateLimitError.retryAfter * 1000);
                  continue;
                }

                throw rateLimitError;
              case 500:
              case 502:
              case 503:
              case 504:
                throw new ServerError(errorMessage, response.status);
              default:
                throw new OilPriceAPIError(errorMessage, response.status, "HTTP_ERROR");
            }
          }

          // Handle empty responses (e.g., 204 No Content from DELETE)
          const responseText = await response.text();
          if (!responseText) {
            this.log("Empty response body");
            return {
              data: {} as T,
              status: response.status,
              headers: response.headers,
            };
          }

          // Parse successful response
          const responseData: any = JSON.parse(responseText);

          this.log("Response data received", {
            status: responseData.status,
            hasData: !!responseData.data,
          });

          return {
            data: this.shapeResponseData<T>(responseData),
            status: response.status,
            headers: response.headers,
          };
        } catch (error) {
          // Handle abort (timeout)
          if (error instanceof Error && error.name === "AbortError") {
            throw new TimeoutError("Request timeout", this.timeout);
          }
          throw error;
        }
      } catch (error) {
        lastError = error as Error;
        this.log(`Request failed: ${lastError.message}`, {
          attempt,
          retryable: this.isRetryable(lastError),
        });

        // Re-throw our custom errors if not retryable
        if (error instanceof OilPriceAPIError && !this.isRetryable(error)) {
          throw error;
        }

        // If this was our last attempt, throw the error
        if (attempt === this.retries) {
          if (error instanceof OilPriceAPIError) {
            throw error;
          }

          // Wrap fetch errors (network issues, etc.)
          if (error instanceof Error) {
            throw new OilPriceAPIError(
              `Request failed after ${this.retries + 1} attempts: ${error.message}`,
              undefined,
              "NETWORK_ERROR",
            );
          }

          throw error;
        }

        // Calculate delay and retry
        const delay = this.calculateRetryDelay(attempt);
        this.log(`Waiting ${delay}ms before retry...`);
        await this.sleep(delay);
      }
    }

    // This should never be reached, but TypeScript wants it
    throw lastError || new OilPriceAPIError("Unknown error occurred");
  }

  /**
   * Get the latest prices for all commodities or a specific commodity
   *
   * @param options - Optional filters
   * @returns Array of price objects
   *
   * @example
   * ```typescript
   * // Get all latest prices
   * const allPrices = await client.getLatestPrices();
   *
   * // Get WTI price only
   * const wti = await client.getLatestPrices({ commodity: 'WTI_USD' });
   * ```
   */
  async getLatestPrices(options?: LatestPricesOptions): Promise<Price[]> {
    const params: Record<string, string> = {};

    if (options?.commodity) {
      params.by_code = options.commodity;
    }

    return this.request<Price[]>("/v1/prices/latest", params);
  }

  /**
   * Get historical prices for a time period
   *
   * @param options - Time period and filter options
   * @returns Array of historical price objects
   *
   * @example
   * ```typescript
   * // Get past week of WTI prices
   * const weekPrices = await client.getHistoricalPrices({
   *   period: 'past_week',
   *   commodity: 'WTI_USD'
   * });
   *
   * // Get custom date range
   * const customPrices = await client.getHistoricalPrices({
   *   startDate: '2024-01-01',
   *   endDate: '2024-12-31',
   *   commodity: 'BRENT_CRUDE_USD'
   * });
   * ```
   */
  async getHistoricalPrices(options?: HistoricalPricesOptions): Promise<Price[]> {
    const params: Record<string, string> = {};

    if (options?.period) {
      params.period = options.period;
    }

    if (options?.commodity) {
      params.by_code = options.commodity;
    }

    if (options?.startDate) {
      params.start_date = options.startDate;
    }

    if (options?.endDate) {
      params.end_date = options.endDate;
    }

    // PERFORMANCE FIX (December 24, 2025):
    // Pass interval parameter to enable aggregated queries
    // This reduces response times from 74s to <1s for year-long queries
    // by returning 365 daily points instead of 600k+ raw points
    if (options?.interval) {
      params.interval = options.interval;
    }

    // Pagination parameters
    if (options?.perPage !== undefined) {
      params.per_page = options.perPage.toString();
    }

    if (options?.page !== undefined) {
      params.page = options.page.toString();
    }

    // CRITICAL FIX (December 17, 2025):
    // Use /v1/prices/past_year endpoint instead of /v1/prices
    // The /v1/prices endpoint does NOT correctly handle start_date/end_date parameters
    // This was the same bug that affected the Python SDK (fixed in v1.4.4)
    // Issue: SDK was returning wrong dates for historical queries
    // Root Cause: Backend has_scope :by_period not working on /v1/prices
    // Solution: Use /v1/prices/past_year which uses direct WHERE clauses
    return this.request<Price[]>("/v1/prices/past_year", params);
  }

  /**
   * Paginate through historical prices automatically.
   *
   * Returns an async generator that yields pages of prices, fetching
   * the next page only when needed. Avoids loading all data into memory.
   *
   * @param options - Same options as getHistoricalPrices, plus perPage (default: 100)
   *
   * @example
   * ```typescript
   * // Iterate through all pages
   * for await (const page of client.paginateHistoricalPrices({
   *   commodity: 'BRENT_CRUDE_USD',
   *   startDate: '2024-01-01',
   *   endDate: '2024-12-31',
   *   perPage: 100,
   * })) {
   *   console.log(`Got ${page.length} prices`);
   *   // Process each page...
   * }
   *
   * // Or collect all prices
   * const allPrices: Price[] = [];
   * for await (const page of client.paginateHistoricalPrices({ commodity: 'WTI_USD' })) {
   *   allPrices.push(...page);
   * }
   * ```
   */
  async *paginateHistoricalPrices(options?: HistoricalPricesOptions): AsyncGenerator<Price[]> {
    const perPage = options?.perPage || 100;
    let page = 1;

    while (true) {
      const results = await this.getHistoricalPrices({
        ...options,
        page,
        perPage,
      });

      if (results.length === 0) break;

      yield results;

      if (results.length < perPage) break;
      page++;
    }
  }

  /**
   * Get prices from your connected data sources (BYOS)
   *
   * Requires Data Connector feature enabled on your organization.
   *
   * @example
   * ```typescript
   * // Get all connected prices
   * const prices = await client.getDataConnectorPrices();
   *
   * // Filter by fuel type
   * const vlsfo = await client.getDataConnectorPrices({ fuelType: 'VLSFO' });
   *
   * // Filter by port
   * const singapore = await client.getDataConnectorPrices({ port: 'SINGAPORE' });
   * ```
   */
  async getDataConnectorPrices(options: DataConnectorOptions = {}): Promise<DataConnectorPrice[]> {
    const params: Record<string, string> = {};

    if (options.fuelType) params.fuel_type = options.fuelType;
    if (options.port) params.port = options.port;
    if (options.region) params.region = options.region;
    if (options.since) params.since = options.since;

    const response = await this.request<{
      prices: DataConnectorPrice[];
    }>("/v1/prices/data-connector", params);

    return response.prices;
  }

  /**
   * Get metadata for all supported commodities
   *
   * @returns Object containing array of commodities
   *
   * @example
   * ```typescript
   * const response = await client.getCommodities();
   * console.log(response.commodities); // Array of commodity objects
   * ```
   */
  async getCommodities(): Promise<CommoditiesResponse> {
    return this.request<CommoditiesResponse>("/v1/commodities", {});
  }

  /**
   * Get all commodity categories with their commodities
   *
   * @returns Object with category keys mapped to category objects
   *
   * @example
   * ```typescript
   * const categories = await client.getCommodityCategories();
   * console.log(categories.oil.name); // "Oil"
   * console.log(categories.oil.commodities.length); // 11
   * ```
   */
  async getCommodityCategories(): Promise<CategoriesResponse> {
    return this.request<CategoriesResponse>("/v1/commodities/categories", {});
  }

  /**
   * Get metadata for a specific commodity by code
   *
   * @param code - Commodity code (e.g., "WTI_USD", "BRENT_CRUDE_USD")
   * @returns Commodity metadata object
   *
   * @example
   * ```typescript
   * const commodity = await client.getCommodity('WTI_USD');
   * console.log(commodity.name); // "WTI Crude Oil"
   * ```
   */
  async getCommodity(code: string): Promise<Commodity> {
    return this.request<Commodity>(`/v1/commodities/${code}`, {});
  }

  /**
   * Get a multi-commodity market brief (OilPriceAPI #3245 Phase 1a).
   *
   * Returns a structured summary (latest price, 24h change, freshness, and a
   * 1-month forecast band) for each requested commodity, optionally with a
   * natural-language narrative. Counts as a single request against your quota,
   * like `/v1/prices/batch`. The per-tier cap on `codes` is enforced server-side.
   *
   * @param codes - Commodity codes (e.g. ["BRENT_CRUDE_USD", "WTI_USD"]). Shorthand
   *   codes like "WTI"/"BRENT" are accepted and resolved server-side.
   * @param options - `{ narrative }` to request the natural-language summary.
   * @returns The structured (and optional narrative) market brief.
   *
   * @throws {ValidationError} If `codes` is empty.
   *
   * @example
   * ```typescript
   * const brief = await client.getMarketBrief(['BRENT_CRUDE_USD', 'WTI_USD']);
   * for (const c of brief.commodities) {
   *   console.log(`${c.name}: $${c.price} (${c.change_24h_pct}%)`);
   * }
   *
   * // With narrative
   * const withText = await client.getMarketBrief(['BRENT_CRUDE_USD'], { narrative: true });
   * console.log(withText.narrative);
   * ```
   */
  async getMarketBrief(codes: string[], options?: MarketBriefOptions): Promise<MarketBrief> {
    if (!Array.isArray(codes) || codes.length === 0) {
      throw new ValidationError(
        "codes is required and must be a non-empty array of commodity codes",
      );
    }

    const params: Record<string, string> = {
      codes: codes.join(","),
    };
    if (options?.narrative) {
      params.narrative = "true";
    }

    return this.request<MarketBrief>("/v1/market-brief", params);
  }

  /**
   * Fetch live sample prices from the public, no-auth demo endpoint.
   *
   * Hits `GET /v1/demo/prices` (no API key required) and returns the parsed
   * `{ prices, meta }` envelope. Useful for trying the client without
   * credentials. Subject to the demo rate limit (~20 requests/hour).
   *
   * @example
   * ```typescript
   * const demo = await client.getDemoPrices();
   * const brent = demo.prices.find(p => p.code === 'BRENT_CRUDE_USD');
   * console.log(brent?.price);
   * ```
   */
  async getDemoPrices(): Promise<DemoPricesResponse> {
    return this.requestDemo<DemoPricesResponse>("/v1/demo/prices");
  }

  /**
   * Fetch the catalogue of commodities from the public, no-auth demo endpoint.
   *
   * Hits `GET /v1/demo/commodities` (no API key required) and returns the parsed
   * `{ commodities, meta }` envelope, where `meta.free_commodities` lists the
   * codes available on the free demo tier.
   *
   * @example
   * ```typescript
   * const demo = await client.getDemoCommodities();
   * console.log(demo.meta.total, demo.meta.free_commodities);
   * ```
   */
  async getDemoCommodities(): Promise<DemoCommoditiesResponse> {
    return this.requestDemo<DemoCommoditiesResponse>("/v1/demo/commodities");
  }

  /**
   * Minimal fetch for the no-auth demo endpoints.
   *
   * Unlike {@link request}, this does NOT run the latest/historical response
   * shaping (which would strip the `meta` block) and does NOT require an API
   * key — it returns the raw `data` envelope from `{ status, data }`.
   */
  private async requestDemo<T>(endpoint: string): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    this.log(`Demo request: ${url}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": buildUserAgent(),
          "X-SDK-Name": SDK_NAME,
          "X-SDK-Version": SDK_VERSION,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text();
        let message = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const json = JSON.parse(body);
          message = json.message || json.error || message;
        } catch {
          // non-JSON error body
        }
        throw new OilPriceAPIError(message, response.status, "HTTP_ERROR");
      }

      const parsed: any = JSON.parse(await response.text());
      // Demo envelope is { status: "success", data: { ... } }.
      return (parsed.data !== undefined ? parsed.data : parsed) as T;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new TimeoutError("Request timeout", this.timeout);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
