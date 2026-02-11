/**
 * Commodities Resource
 *
 * Get metadata about supported commodities and categories.
 */

import type { OilPriceAPI } from "../client.js";

/**
 * Commodity metadata
 */
export interface Commodity {
  /** Unique commodity identifier */
  code: string;
  /** Human-readable commodity name */
  name: string;
  /** Base currency for pricing */
  currency: string;
  /** Commodity category (e.g., "oil", "gas", "renewable") */
  category: string;
  /** Detailed description */
  description?: string;
  /** Unit of measurement (e.g., "barrel", "gallon") */
  unit: string;
  /** Detailed unit description */
  unit_description?: string;
  /** Storage multiplier for price values */
  multiplier?: number;
  /** Price validation ranges */
  validation?: {
    min: number;
    max: number;
  };
  /** Threshold for significant price change alerts */
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
 */
export interface CategoriesResponse {
  [categoryKey: string]: CommodityCategory;
}

/**
 * Commodities Resource
 *
 * Access metadata about supported commodities and categories.
 *
 * @example
 * ```typescript
 * import { OilPriceAPI } from 'oilpriceapi';
 *
 * const client = new OilPriceAPI({ apiKey: 'your_key' });
 *
 * // List all commodities
 * const response = await client.commodities.list();
 * console.log(`${response.commodities.length} commodities available`);
 *
 * // Get specific commodity
 * const wti = await client.commodities.get('WTI_USD');
 * console.log(`${wti.name}: ${wti.description}`);
 *
 * // Get categories
 * const categories = await client.commodities.categories();
 * console.log(`Oil category has ${categories.oil.commodities.length} commodities`);
 * ```
 */
export class CommoditiesResource {
  constructor(private client: OilPriceAPI) {}

  /**
   * List all supported commodities
   *
   * Returns metadata for all commodities available in the API, including
   * codes, names, units, and validation ranges.
   *
   * @returns Object containing array of commodities
   *
   * @throws {OilPriceAPIError} If API request fails
   * @throws {AuthenticationError} If API key is invalid
   *
   * @example
   * ```typescript
   * const response = await client.commodities.list();
   *
   * response.commodities.forEach(commodity => {
   *   console.log(`${commodity.code}: ${commodity.name} (${commodity.unit})`);
   * });
   * ```
   */
  async list(): Promise<CommoditiesResponse> {
    return this.client["request"]<CommoditiesResponse>("/v1/commodities", {});
  }

  /**
   * Get metadata for a specific commodity by code
   *
   * @param code - Commodity code (e.g., "WTI_USD", "BRENT_CRUDE_USD")
   * @returns Commodity metadata object
   *
   * @throws {NotFoundError} If commodity code is invalid
   * @throws {OilPriceAPIError} If API request fails
   * @throws {AuthenticationError} If API key is invalid
   *
   * @example
   * ```typescript
   * const commodity = await client.commodities.get('WTI_USD');
   * console.log(`Name: ${commodity.name}`);
   * console.log(`Unit: ${commodity.unit}`);
   * console.log(`Currency: ${commodity.currency}`);
   * console.log(`Category: ${commodity.category}`);
   * ```
   */
  async get(code: string): Promise<Commodity> {
    if (!code || typeof code !== "string") {
      throw new Error("Commodity code must be a non-empty string");
    }

    return this.client["request"]<Commodity>(`/v1/commodities/${code}`, {});
  }

  /**
   * Get all commodity categories with their commodities
   *
   * Returns commodities grouped by category (oil, gas, renewable, etc.).
   * Useful for building navigation or filtering UIs.
   *
   * @returns Object with category keys mapped to category objects
   *
   * @throws {OilPriceAPIError} If API request fails
   * @throws {AuthenticationError} If API key is invalid
   *
   * @example
   * ```typescript
   * const categories = await client.commodities.categories();
   *
   * // Access by category key
   * console.log(`Oil: ${categories.oil.name}`);
   * console.log(`Commodities: ${categories.oil.commodities.length}`);
   *
   * // Iterate all categories
   * Object.entries(categories).forEach(([key, category]) => {
   *   console.log(`${category.name}: ${category.commodities.length} commodities`);
   * });
   * ```
   */
  async categories(): Promise<CategoriesResponse> {
    return this.client["request"]<CategoriesResponse>(
      "/v1/commodities/categories",
      {},
    );
  }
}
