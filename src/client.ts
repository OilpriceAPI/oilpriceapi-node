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
import { MAX_PER_PAGE, DEFAULT_PER_PAGE } from "./types.js";
import type { MarketBrief, MarketBriefOptions } from "./resources/market-brief.js";
import {
  OilPriceAPIError,
  RateLimitError,
  ServerError,
  TimeoutError,
  ValidationError,
  errorFromResponse,
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
import { resolveApiUrl, assertUsableBaseUrl } from "./url.js";
import { SpreadsResource } from "./resources/spreads.js";
import { IndicatorsResource } from "./resources/indicators.js";
import { RawResource } from "./resources/raw.js";
import { StreamingResource } from "./resources/streaming.js";
import { SubscriptionsResource } from "./resources/subscriptions.js";
import { WellProductionResource } from "./resources/well-production.js";
import { FuelSurchargeResource } from "./resources/fuel-surcharge.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Methods where repeating a request has the same effect as doing it once
 * (RFC 9110 idempotency). POST and PATCH are not on this list: a create the
 * server committed just before the response was lost becomes two creates on
 * replay — two subscriptions, two webhooks (#82).
 */
const IDEMPOTENT_METHODS = new Set(["GET", "HEAD", "OPTIONS", "TRACE", "PUT", "DELETE"]);

/**
 * Counter windows whose allowance does not come back within a retry budget.
 *
 * The API sends `X-RateLimit-State: exhausted` with `X-RateLimit-Window` set to
 * the entitlement's usage window on a durable 429, and with
 * `hourly_circuit_breaker` on the recoverable safety limit. State alone cannot
 * tell those apart — the circuit breaker reports `exhausted` too — so both
 * headers are required before a 429 is treated as final.
 */
const PERSISTENT_QUOTA_WINDOWS = new Set(["daily_counter", "monthly_counter", "trial_counter"]);

/**
 * Ceiling on any single wait, whether we computed it or the server sent it.
 * The keyless demo endpoint has been observed returning `Retry-After: 31612`,
 * which unbounded parks the calling process for 8.8 hours.
 */
const MAX_RETRY_WAIT_MS = 60_000;

function validatedRetries(retries: number): number {
  if (!Number.isInteger(retries) || retries < 0) {
    throw new ValidationError(
      `retries must be a non-negative integer (got ${JSON.stringify(retries)}). ` +
        "Use retries: 0 to send each request exactly once.",
    );
  }
  return retries;
}

/** Clamp a wait to [0, MAX_RETRY_WAIT_MS], falling back when unusable. */
function boundedWaitMs(milliseconds: unknown, fallback: number): number {
  const value = typeof milliseconds === "number" && Number.isFinite(milliseconds)
    ? milliseconds
    : fallback;
  return Math.max(0, Math.min(value, MAX_RETRY_WAIT_MS));
}

/**
 * Has the caller run out of allowance, as opposed to merely bursting?
 *
 * Returns false when the headers are absent or unrecognised: an unknown state
 * must behave exactly as it did before this change, so a missing header can
 * never turn a retryable burst into a hard failure.
 */
function isDurableQuotaExhaustion(error: RateLimitError): boolean {
  const headers = error.headers;
  if (!headers) return false;
  const lookup: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    lookup[key.toLowerCase()] = String(value);
  }
  return (
    lookup["x-ratelimit-state"]?.trim().toLowerCase() === "exhausted" &&
    PERSISTENT_QUOTA_WINDOWS.has(lookup["x-ratelimit-window"]?.trim().toLowerCase())
  );
}

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
   * Price streaming resource (WebSocket / ActionCable).
   *
   * Streaming availability depends on account entitlement. Review current
   * access at https://www.oilpriceapi.com/pricing.
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

  /**
   * Carrier fuel surcharges: `ltl` and `parcel` (by service level), each rate
   * with its effective date and source URL.
   */
  public readonly fuelSurcharge: FuelSurchargeResource;

  constructor(config: OilPriceAPIConfig = {}) {
    this.apiKey = config.apiKey || process.env.OILPRICEAPI_KEY || "";
    this.baseUrl = config.baseUrl || "https://api.oilpriceapi.com";
    // Fail loudly, once, on a base URL that cannot be used — rather than
    // silently sending every request to the wrong path for the life of the
    // client (#89).
    assertUsableBaseUrl(this.baseUrl);
    this.retries = config.retries !== undefined ? validatedRetries(config.retries) : 3;
    // `||` discarded an explicit 0, so retryDelay: 0 silently became 1000ms.
    this.retryDelay = config.retryDelay !== undefined ? config.retryDelay : 1000;
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
    this.fuelSurcharge = new FuelSurchargeResource(this);
  }

  private requireApiKey(): string {
    if (!this.apiKey) {
      throw new OilPriceAPIError(
        "API key required. Set OILPRICEAPI_KEY env var or pass apiKey in config.",
        undefined,
        "MISSING_API_KEY",
      );
    }
    return this.apiKey;
  }

  /**
   * Log debug messages if debug mode is enabled
   */
  private log(message: string, data?: unknown): void {
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
   * May this request be sent again after an ambiguous outcome?
   *
   * @param method - HTTP method of the request.
   * @param idempotent - Caller's explicit assertion, which wins over the
   *   method. Pass true for a request whose method is POST but whose effect is
   *   a read (a search), or for a write the caller knows is deduplicated.
   */
  private isReplaySafe(method: string, idempotent?: boolean): boolean {
    if (idempotent !== undefined) return idempotent;
    return IDEMPOTENT_METHODS.has(method.toUpperCase());
  }

  /**
   * Determine if error is retryable.
   *
   * A timeout or transport error is an AMBIGUOUS outcome, not a failure: the
   * server may have committed the write before the response was lost. A 5xx is
   * equally ambiguous, because a gateway can return 502 after the origin
   * committed. Neither is replayed for a non-idempotent method (#82).
   *
   * A 429 is the exception in the other direction — an outright refusal, so
   * the write definitively did not happen and replay is safe for any method —
   * unless it reports a durable counter window, which no retry can clear.
   */
  private isRetryable(error: unknown, method: string, idempotent?: boolean): boolean {
    // A 429 refused the request, so replaying is safe whatever the method.
    if (error instanceof RateLimitError) {
      return !isDurableQuotaExhaustion(error);
    }

    const replaySafe = this.isReplaySafe(method, idempotent);

    // Retry on network errors
    if (error instanceof TypeError && error.message.includes("fetch")) {
      return replaySafe;
    }

    // Retry on timeout errors
    if (error instanceof TimeoutError) {
      return replaySafe;
    }

    // Retry on 5xx server errors
    if (error instanceof ServerError) {
      return replaySafe;
    }

    // Don't retry on client errors (4xx except 429), or on a deterministic
    // failure like an unparseable success body.
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
  private shapeResponseData<T>(responseData: unknown): T {
    // Handle different response structures
    // Latest endpoint: { status, data: { price, ... } }
    // Historical endpoint: { status, data: { prices: [...] } }
    if (isRecord(responseData) && responseData.status === "success" && isRecord(responseData.data)) {
      if (Array.isArray(responseData.data.prices)) {
        // Historical endpoint - return prices array
        this.log(`Returning ${responseData.data.prices.length} prices`);
        return responseData.data.prices as T;
      } else if (responseData.data.price !== undefined) {
        // Latest endpoint - wrap single price in array
        this.log("Returning single price (wrapped in array)");
        return [responseData.data] as unknown as T;
      }
    }

    // Fallback - return data as-is (used by resource mutations, alerts, webhooks, etc.)
    this.log("Returning data as-is");
    return (isRecord(responseData) && responseData.data !== undefined
      ? responseData.data
      : responseData) as T;
  }

  /**
   * Internal method to make HTTP requests with retry and timeout.
   * Supports all HTTP methods (GET, POST, PATCH, DELETE) with consistent
   * retry logic, timeout handling, and typed error responses.
   */
  private async request<T>(
    endpoint: string,
    params?: Record<string, string>,
    options?: {
      method?: string;
      body?: unknown;
      headers?: Record<string, string>;
      idempotent?: boolean;
      /** Return the parsed body untouched. See {@link requestRaw}. */
      unshaped?: boolean;
    },
  ): Promise<T> {
    const { data } = await this.requestRaw<T>(endpoint, params, options);
    return data;
  }

  /**
   * Shape the error a failed request ends with.
   *
   * When a non-idempotent write was NOT replayed after an ambiguous outcome,
   * the caller needs to know the request may still have been applied — the SDK
   * cannot tell, and silently surfacing a plain transport error invites a blind
   * resend (#82). Such errors carry `ambiguousWrite: true`.
   */
  private finalError(error: unknown, method: string, idempotent?: boolean): unknown {
    const ambiguous =
      !this.isReplaySafe(method, idempotent) &&
      (error instanceof TimeoutError ||
        error instanceof ServerError ||
        (error instanceof TypeError && error.message.includes("fetch")));

    if (error instanceof OilPriceAPIError) {
      if (ambiguous) {
        error.ambiguousWrite = true;
        error.message =
          `${error.message} — this ${method} was not retried because it may have been ` +
          "applied by the server. Check whether it took effect before resending.";
      }
      return error;
    }

    if (error instanceof Error) {
      const wrapped = new OilPriceAPIError(
        ambiguous
          ? `Request failed: ${error.message} — this ${method} was not retried because it ` +
            "may have been applied by the server. Check whether it took effect before resending."
          : `Request failed after ${this.retries + 1} attempts: ${error.message}`,
        undefined,
        "NETWORK_ERROR",
      );
      if (ambiguous) wrapped.ambiguousWrite = true;
      return wrapped;
    }

    return error;
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
    options?: {
      method?: string;
      body?: unknown;
      headers?: Record<string, string>;
      /**
       * Assert that repeating this request is safe. Without it, a
       * non-idempotent method (POST, PATCH) is sent exactly once and never
       * replayed after an ambiguous outcome (#82).
       */
      idempotent?: boolean;
      /**
       * Return the parsed JSON body as-is, skipping {@link shapeResponseData}.
       *
       * That shaping wraps any `data` object with a top-level `price` in a
       * one-element array (the `/v1/prices/latest` convention), which turned
       * `/v1/indicators/price-context` and `/annotations` into arrays (#112).
       * Resources that validate their own envelope opt out with this flag.
       */
      unshaped?: boolean;
    },
  ): Promise<APIResponse<T>> {
    const apiKey = this.requireApiKey();
    const method = (options?.method || "GET").toUpperCase();
    const idempotent = options?.idempotent;

    // Build URL with query parameters. resolveApiUrl refuses any path that
    // would change the origin, so the API key below can only ever be sent to
    // the configured host (#80).
    const url = resolveApiUrl(this.baseUrl, endpoint);
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
            Authorization: `Token ${apiKey}`,
            "Content-Type": "application/json",
            "User-Agent": buildUserAgent(),
            "X-SDK-Name": SDK_NAME,
            "X-SDK-Version": SDK_VERSION,
          };

          // Add optional usage-attribution headers.
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
            method,
            headers,
            signal: controller.signal,
          };

          if (options?.body !== undefined) {
            fetchOptions.body = JSON.stringify(options.body);
          }

          const response = await fetch(url.toString(), fetchOptions);

          // The abort timer stays armed until the body has been consumed.
          // Clearing it here — the moment headers arrived — left nothing to
          // interrupt `await response.text()`, so a stalled body hung for as
          // long as the peer held the socket open, whatever `timeout` said
          // (#81). The `finally` below is the single cleanup point.
          this.log(`Response: ${response.status} ${response.statusText}`);

          // Handle error responses
          if (!response.ok) {
            const errorBody = await response.text();
            const apiError = errorFromResponse(response, errorBody, apiKey);
            this.log(`Error response: ${apiError.message}`);

            if (
              apiError instanceof RateLimitError &&
              attempt < this.retries &&
              apiError.retryAfter !== undefined &&
              !isDurableQuotaExhaustion(apiError)
            ) {
              // Bound the server's signal in both directions: a negative
              // retry_after produced a negative sleep, and a large one parked
              // the process for hours (#82).
              const waitMs = boundedWaitMs(
                apiError.retryAfter * 1000,
                this.calculateRetryDelay(attempt),
              );
              this.log(`Rate limited. Waiting ${waitMs}ms`);
              // The error body is fully read by this point, so the deadline
              // for THIS attempt is met; don't let its timer hold the event
              // loop open across the backoff sleep.
              clearTimeout(timeoutId);
              await this.sleep(waitMs);
              continue;
            }
            throw apiError;
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

          // Parse successful response. A body that is not JSON is a
          // deterministic failure — replaying it cannot help, and for a write
          // the replay would duplicate it (#82).
          let responseData: unknown;
          try {
            responseData = JSON.parse(responseText);
          } catch {
            throw new OilPriceAPIError(
              `Invalid JSON in ${response.status} response from ${url.pathname}`,
              response.status,
              "INVALID_RESPONSE",
            );
          }
          const responseObject = isRecord(responseData) ? responseData : undefined;

          this.log("Response data received", {
            status: responseObject?.status,
            hasData: responseObject?.data !== undefined,
          });

          return {
            data: options?.unshaped ? (responseData as T) : this.shapeResponseData<T>(responseData),
            status: response.status,
            headers: response.headers,
          };
        } catch (error) {
          // Handle abort (timeout)
          if (error instanceof Error && error.name === "AbortError") {
            throw new TimeoutError("Request timeout", this.timeout);
          }
          throw error;
        } finally {
          // A failed attempt used to leave its abort timer armed. Now that a
          // write throws on the first ambiguous failure instead of retrying,
          // that timer would keep the event loop alive for the full timeout
          // after the caller already saw the error (#82).
          clearTimeout(timeoutId);
        }
      } catch (error) {
        lastError = error as Error;
        const retryable = this.isRetryable(error, method, idempotent);
        this.log(`Request failed: ${lastError.message}`, { attempt, retryable });

        // Not retryable: throw now, whatever the error's type. The old check
        // only applied to OilPriceAPIError, so a SyntaxError from an
        // unparseable success body fell through and was replayed (#82).
        if (!retryable) {
          throw this.finalError(error, method, idempotent);
        }

        // If this was our last attempt, throw the error
        if (attempt === this.retries) {
          throw this.finalError(error, method, idempotent);
        }

        // Calculate delay and retry
        const delay = boundedWaitMs(this.calculateRetryDelay(attempt), this.retryDelay);
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
    // The loop ends when a page comes back shorter than the one requested.
    // That test is only sound while the server actually honours the requested
    // size: the API caps a page at MAX_PER_PAGE rows however large `per_page`
    // is, so asking for more made page one look short and ended iteration
    // after a single page — 500 rows out of 5,500, with no error and no flag
    // (#90). The SDK's own docs advertised a maximum of 1000, so the
    // documented value was the one that truncated.
    //
    // Clamping to what the server will serve restores the short-page test
    // and returns the full history. It changes nothing for a caller already
    // inside the cap.
    const requested = options?.perPage ?? DEFAULT_PER_PAGE;
    const perPage = Number.isFinite(requested)
      ? Math.min(Math.max(1, Math.floor(requested)), MAX_PER_PAGE)
      : DEFAULT_PER_PAGE;
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
   * console.log(categories.categories.oil.name); // "Oil"
   * console.log(categories.categories.oil.commodities.length); // 11
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
   * credentials. Current limits are returned by the endpoint.
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
   * codes currently advertised by the demo endpoint.
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
    // Same origin guard as the authenticated path (#80). The demo endpoints
    // send no credential, but an SDK that can be pointed at an arbitrary host
    // is still an SSRF primitive for whatever process embeds it.
    const url = resolveApiUrl(this.baseUrl, endpoint).toString();
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
        throw errorFromResponse(response, body);
      }

      const parsed: unknown = JSON.parse(await response.text());
      // Demo envelope is { status: "success", data: { ... } }.
      return (isRecord(parsed) && parsed.data !== undefined ? parsed.data : parsed) as T;
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
