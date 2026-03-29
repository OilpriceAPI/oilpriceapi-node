/**
 * Storage Resource
 *
 * Access crude oil storage data including total US inventory, Cushing hub levels,
 * Strategic Petroleum Reserve (SPR), and regional breakdowns.
 */

import type { OilPriceAPI } from "../client.js";
import { ValidationError } from "../errors.js";

/**
 * Storage level data
 */
export interface StorageData {
  /** Storage location code */
  code: string;
  /** Location name */
  name?: string;
  /** Current storage level */
  level: number;
  /** Unit of measurement (typically "thousand_barrels" or "million_barrels") */
  unit: string;
  /** ISO timestamp when data was recorded */
  timestamp: string;
  /** Change from previous period */
  change?: number;
  /** Percentage change */
  change_percent?: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Historical storage data point
 */
export interface HistoricalStorageData {
  /** Date in YYYY-MM-DD format */
  date: string;
  /** Storage level */
  level: number;
  /** Unit of measurement */
  unit: string;
  /** Week-over-week change */
  change?: number;
}

/**
 * Options for historical storage query
 */
export interface HistoricalStorageOptions {
  /** Start date in ISO 8601 format (YYYY-MM-DD) */
  startDate?: string;
  /** End date in ISO 8601 format (YYYY-MM-DD) */
  endDate?: string;
}

/**
 * Storage Resource
 *
 * Access crude oil storage data for US inventory levels, Cushing hub,
 * Strategic Petroleum Reserve, and regional breakdowns.
 *
 * @example
 * ```typescript
 * import { OilPriceAPI } from 'oilpriceapi';
 *
 * const client = new OilPriceAPI({ apiKey: 'your_key' });
 *
 * // Get all storage data
 * const storage = await client.storage.all();
 * console.log(`Total US inventory: ${storage.level} ${storage.unit}`);
 *
 * // Get Cushing levels
 * const cushing = await client.storage.cushing();
 * console.log(`Cushing: ${cushing.level} ${cushing.unit}`);
 *
 * // Get SPR levels
 * const spr = await client.storage.spr();
 * console.log(`SPR: ${spr.level} ${spr.unit}`);
 * ```
 */
export class StorageResource {
  constructor(private client: OilPriceAPI) {}

  /**
   * Get all current storage levels
   *
   * Returns total US commercial crude oil inventory.
   *
   * @returns Current storage data
   *
   * @throws {OilPriceAPIError} If API request fails
   * @throws {AuthenticationError} If API key is invalid
   *
   * @example
   * ```typescript
   * const storage = await client.storage.all();
   * console.log(`Total inventory: ${storage.level} ${storage.unit}`);
   * if (storage.change) {
   *   console.log(`Change: ${storage.change > 0 ? '+' : ''}${storage.change}`);
   * }
   * ```
   */
  async all(): Promise<StorageData> {
    return this.client["request"]<StorageData>("/v1/storage", {});
  }

  /**
   * Get Cushing, OK storage levels
   *
   * Returns current inventory at Cushing, Oklahoma - the key delivery point
   * for WTI crude oil futures.
   *
   * @returns Cushing storage data
   *
   * @throws {OilPriceAPIError} If API request fails
   * @throws {AuthenticationError} If API key is invalid
   *
   * @example
   * ```typescript
   * const cushing = await client.storage.cushing();
   * console.log(`Cushing inventory: ${cushing.level} ${cushing.unit}`);
   * console.log(`Week-over-week change: ${cushing.change_percent}%`);
   * ```
   */
  async cushing(): Promise<StorageData> {
    return this.client["request"]<StorageData>("/v1/storage/cushing", {});
  }

  /**
   * Get Strategic Petroleum Reserve (SPR) levels
   *
   * Returns current US Strategic Petroleum Reserve inventory.
   *
   * @returns SPR storage data
   *
   * @throws {OilPriceAPIError} If API request fails
   * @throws {AuthenticationError} If API key is invalid
   *
   * @example
   * ```typescript
   * const spr = await client.storage.spr();
   * console.log(`SPR inventory: ${spr.level} ${spr.unit}`);
   * ```
   */
  async spr(): Promise<StorageData> {
    return this.client["request"]<StorageData>("/v1/storage/spr", {});
  }

  /**
   * Get regional storage breakdown
   *
   * Returns storage levels by region (PADD districts) or a specific region.
   *
   * @param region - Optional region code (e.g., "PADD1", "PADD2", "PADD3")
   * @returns Regional storage data
   *
   * @throws {OilPriceAPIError} If API request fails
   * @throws {AuthenticationError} If API key is invalid
   *
   * @example
   * ```typescript
   * // Get all regions
   * const regions = await client.storage.regional();
   *
   * // Get specific region (Gulf Coast)
   * const gulfCoast = await client.storage.regional('PADD3');
   * console.log(`PADD 3 (Gulf Coast): ${gulfCoast.level} ${gulfCoast.unit}`);
   * ```
   */
  async regional(region?: string): Promise<StorageData | StorageData[]> {
    const params: Record<string, string> = {};
    if (region) params.region = region;

    return this.client["request"]<StorageData | StorageData[]>(
      "/v1/storage/regional",
      params,
    );
  }

  /**
   * Get historical storage data
   *
   * Returns time series of storage levels for a specific location.
   *
   * @param code - Storage location code (e.g., "US", "CUSHING", "SPR")
   * @param options - Date range filters
   * @returns Array of historical storage data
   *
   * @throws {NotFoundError} If location code not found
   * @throws {OilPriceAPIError} If API request fails
   *
   * @example
   * ```typescript
   * const history = await client.storage.history('CUSHING', {
   *   startDate: '2024-01-01',
   *   endDate: '2024-12-31'
   * });
   *
   * history.forEach(point => {
   *   console.log(`${point.date}: ${point.level} ${point.unit}`);
   * });
   * ```
   */
  async history(
    code: string,
    options?: HistoricalStorageOptions,
  ): Promise<HistoricalStorageData[]> {
    if (!code || typeof code !== "string") {
      throw new ValidationError("Storage location code must be a non-empty string");
    }

    const params: Record<string, string> = {};
    if (options?.startDate) params.start_date = options.startDate;
    if (options?.endDate) params.end_date = options.endDate;

    const response = await this.client["request"]<
      HistoricalStorageData[] | { data: HistoricalStorageData[] }
    >(`/v1/storage/${code}/history`, params);

    return Array.isArray(response) ? response : response.data;
  }
}
