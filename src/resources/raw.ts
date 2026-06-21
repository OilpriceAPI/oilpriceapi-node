/**
 * Raw Response Resource
 *
 * Provides opt-in access to the underlying HTTP status code and response
 * headers alongside the parsed data. Mirrors the most commonly used top-level
 * client methods. This is the #1 requested enhancement (issue #7).
 *
 * @example
 * ```typescript
 * import { OilPriceAPI } from 'oilpriceapi';
 *
 * const client = new OilPriceAPI({ apiKey: 'your_key' });
 *
 * const { data, status, headers } = await client.raw.getLatestPrices();
 * console.log(`HTTP ${status}`);
 * console.log(`Rate limit remaining: ${headers.get('x-ratelimit-remaining')}`);
 * console.log(data[0].price);
 * ```
 */

import type { OilPriceAPI, APIResponse } from "../client.js";
import type {
  Price,
  LatestPricesOptions,
  HistoricalPricesOptions,
  Commodity,
  CommoditiesResponse,
  CategoriesResponse,
} from "../types.js";

/**
 * Raw Response Resource
 *
 * Each method returns an {@link APIResponse} with `{ data, status, headers }`
 * instead of just the parsed data, so callers can inspect HTTP metadata such
 * as rate-limit headers, caching headers, and the exact status code.
 */
export class RawResource {
  constructor(private client: OilPriceAPI) {}

  /**
   * Make an arbitrary GET request and return data plus HTTP status and headers.
   *
   * Use this for endpoints without a dedicated raw helper.
   *
   * @typeParam T - Expected parsed response type.
   * @param endpoint - API path beginning with `/` (e.g. `/v1/prices/latest`).
   * @param params - Optional query parameters.
   * @returns The parsed data along with the HTTP status code and headers.
   *
   * @example
   * ```typescript
   * const { data, status, headers } = await client.raw.get('/v1/futures/CL.1');
   * ```
   */
  async get<T = unknown>(
    endpoint: string,
    params?: Record<string, string>,
  ): Promise<APIResponse<T>> {
    return this.client["requestRaw"]<T>(endpoint, params);
  }

  /**
   * Latest prices with raw HTTP status and headers.
   *
   * @param options - Optional commodity filter.
   * @returns Prices array with HTTP status and headers.
   *
   * @example
   * ```typescript
   * const { data, status, headers } = await client.raw.getLatestPrices({ commodity: 'WTI_USD' });
   * ```
   */
  async getLatestPrices(options?: LatestPricesOptions): Promise<APIResponse<Price[]>> {
    const params: Record<string, string> = {};
    if (options?.commodity) {
      params.by_code = options.commodity;
    }
    return this.client["requestRaw"]<Price[]>("/v1/prices/latest", params);
  }

  /**
   * Historical prices with raw HTTP status and headers.
   *
   * @param options - Time period and filter options.
   * @returns Prices array with HTTP status and headers.
   *
   * @example
   * ```typescript
   * const { data, status, headers } = await client.raw.getHistoricalPrices({
   *   period: 'past_week',
   *   commodity: 'BRENT_CRUDE_USD',
   * });
   * ```
   */
  async getHistoricalPrices(options?: HistoricalPricesOptions): Promise<APIResponse<Price[]>> {
    const params: Record<string, string> = {};
    if (options?.period) params.period = options.period;
    if (options?.commodity) params.by_code = options.commodity;
    if (options?.startDate) params.start_date = options.startDate;
    if (options?.endDate) params.end_date = options.endDate;
    if (options?.interval) params.interval = options.interval;
    if (options?.perPage !== undefined) params.per_page = options.perPage.toString();
    if (options?.page !== undefined) params.page = options.page.toString();

    return this.client["requestRaw"]<Price[]>("/v1/prices/past_year", params);
  }

  /**
   * Commodities metadata with raw HTTP status and headers.
   *
   * @returns Commodities response with HTTP status and headers.
   */
  async getCommodities(): Promise<APIResponse<CommoditiesResponse>> {
    return this.client["requestRaw"]<CommoditiesResponse>("/v1/commodities", {});
  }

  /**
   * Commodity categories with raw HTTP status and headers.
   *
   * @returns Categories response with HTTP status and headers.
   */
  async getCommodityCategories(): Promise<APIResponse<CategoriesResponse>> {
    return this.client["requestRaw"]<CategoriesResponse>("/v1/commodities/categories", {});
  }

  /**
   * A single commodity's metadata with raw HTTP status and headers.
   *
   * @param code - Commodity code (e.g., "WTI_USD").
   * @returns Commodity with HTTP status and headers.
   */
  async getCommodity(code: string): Promise<APIResponse<Commodity>> {
    return this.client["requestRaw"]<Commodity>(`/v1/commodities/${code}`, {});
  }
}
