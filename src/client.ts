import type {
  OilPriceAPIConfig,
  RetryStrategy,
  Price,
  LatestPricesOptions,
  HistoricalPricesOptions,
  Commodity,
  CommoditiesResponse,
  CategoriesResponse,
} from './types.js';
import {
  OilPriceAPIError,
  AuthenticationError,
  RateLimitError,
  NotFoundError,
  ServerError,
  TimeoutError,
} from './errors.js';

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

  constructor(config: OilPriceAPIConfig) {
    if (!config.apiKey) {
      throw new OilPriceAPIError('API key is required');
    }

    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.oilpriceapi.com';
    this.retries = config.retries !== undefined ? config.retries : 3;
    this.retryDelay = config.retryDelay || 1000;
    this.retryStrategy = config.retryStrategy || 'exponential';
    this.timeout = config.timeout || 90000; // 90 seconds for slow historical queries
    this.debug = config.debug || false;
  }

  /**
   * Log debug messages if debug mode is enabled
   */
  private log(message: string, data?: any): void {
    if (this.debug) {
      const timestamp = new Date().toISOString();
      console.log(`[OilPriceAPI ${timestamp}] ${message}`, data || '');
    }
  }

  /**
   * Calculate delay for retry based on strategy
   */
  private calculateRetryDelay(attempt: number): number {
    switch (this.retryStrategy) {
      case 'exponential':
        return this.retryDelay * Math.pow(2, attempt);
      case 'linear':
        return this.retryDelay * (attempt + 1);
      case 'fixed':
      default:
        return this.retryDelay;
    }
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Determine if error is retryable
   */
  private isRetryable(error: any): boolean {
    // Retry on network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
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
   * Internal method to make HTTP requests with retry and timeout
   */
  private async request<T>(
    endpoint: string,
    params?: Record<string, string>
  ): Promise<T> {
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
          const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
              'User-Agent': 'oilpriceapi-node/0.3.1',
            },
            signal: controller.signal,
          });

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
                const retryAfter = response.headers.get('Retry-After');
                const rateLimitError = new RateLimitError(
                  errorMessage,
                  retryAfter ? parseInt(retryAfter, 10) : undefined
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
                throw new OilPriceAPIError(
                  errorMessage,
                  response.status,
                  'HTTP_ERROR'
                );
            }
          }

          // Parse successful response
          const responseData: any = await response.json();

          this.log('Response data received', {
            status: responseData.status,
            hasData: !!responseData.data
          });

          // Handle different response structures
          // Latest endpoint: { status, data: { price, ... } }
          // Historical endpoint: { status, data: { prices: [...] } }
          if (responseData.status === 'success' && responseData.data) {
            if (responseData.data.prices) {
              // Historical endpoint - return prices array
              this.log(`Returning ${responseData.data.prices.length} prices`);
              return responseData.data.prices as T;
            } else if (responseData.data.price !== undefined) {
              // Latest endpoint - wrap single price in array
              this.log('Returning single price (wrapped in array)');
              return [responseData.data] as T;
            }
          }

          // Fallback - return data as-is
          this.log('Returning data as-is');
          return responseData.data as T;

        } catch (error) {
          // Handle abort (timeout)
          if (error instanceof Error && error.name === 'AbortError') {
            throw new TimeoutError('Request timeout', this.timeout);
          }
          throw error;
        }

      } catch (error) {
        lastError = error as Error;
        this.log(`Request failed: ${lastError.message}`, {
          attempt,
          retryable: this.isRetryable(lastError)
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
              'NETWORK_ERROR'
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
    throw lastError || new OilPriceAPIError('Unknown error occurred');
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

    return this.request<Price[]>('/v1/prices/latest', params);
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
  async getHistoricalPrices(
    options?: HistoricalPricesOptions
  ): Promise<Price[]> {
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

    return this.request<Price[]>('/v1/prices', params);
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
    return this.request<CommoditiesResponse>('/v1/commodities', {});
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
    return this.request<CategoriesResponse>('/v1/commodities/categories', {});
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
}
