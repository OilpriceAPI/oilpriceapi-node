/**
 * Energy Intelligence - Oil Inventories Resource
 *
 * Access EIA crude oil inventory data including total US stocks, Cushing levels,
 * and regional breakdowns.
 */

import type { OilPriceAPI } from "../../client.js";

/**
 * Oil inventory record
 */
export interface OilInventoryRecord {
  /** Record ID */
  id: string;
  /** Inventory level in thousand barrels */
  level: number;
  /** Unit of measurement */
  unit: string;
  /** Product type (e.g., "crude_oil", "gasoline", "distillate") */
  product?: string;
  /** Location (e.g., "US_TOTAL", "CUSHING", "PADD1") */
  location?: string;
  /** Change from previous week */
  change?: number;
  /** Report date */
  date: string;
  /** ISO timestamp */
  timestamp: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Oil inventory summary
 */
export interface OilInventorySummary {
  /** Total US crude oil stocks */
  total_crude: number;
  /** Cushing stocks */
  cushing?: number;
  /** SPR stocks */
  spr?: number;
  /** Total products */
  total_products?: number;
  /** Unit */
  unit: string;
  /** As of date */
  as_of_date: string;
}

/**
 * Inventory by product type
 */
export interface InventoryByProduct {
  /** Product type */
  product: string;
  /** Inventory level */
  level: number;
  /** Change from previous week */
  change?: number;
  /** Unit */
  unit: string;
  /** Date */
  date: string;
}

/**
 * Historical inventory data point
 */
export interface HistoricalInventory {
  /** Date */
  date: string;
  /** Inventory level */
  level: number;
  /** Change */
  change?: number;
  /** Unit */
  unit: string;
}

/**
 * Cushing inventory data
 */
export interface CushingInventory {
  /** Inventory level */
  level: number;
  /** Change from previous week */
  change?: number;
  /** Percentage of capacity */
  capacity_percent?: number;
  /** Unit */
  unit: string;
  /** Date */
  date: string;
}

/**
 * EI Oil Inventories Resource
 *
 * Access EIA crude oil and petroleum product inventory data.
 *
 * @example
 * ```typescript
 * const client = new OilPriceAPI({ apiKey: 'your_key' });
 *
 * // Get latest inventories
 * const latest = await client.ei.oilInventories.latest();
 * console.log(`Total crude: ${latest.level} ${latest.unit}`);
 *
 * // Get Cushing stocks
 * const cushing = await client.ei.oilInventories.cushing();
 * console.log(`Cushing: ${cushing.level} ${cushing.unit}`);
 * ```
 */
export class EIOilInventoriesResource {
  constructor(private client: OilPriceAPI) {}

  /**
   * List all oil inventory records
   *
   * @returns Array of inventory records
   */
  async list(): Promise<OilInventoryRecord[]> {
    const response = await this.client["request"]<
      OilInventoryRecord[] | { data: OilInventoryRecord[] }
    >("/v1/ei/oil_inventories", {});

    return Array.isArray(response) ? response : response.data;
  }

  /**
   * Get a specific inventory record
   *
   * @param id - Record ID
   * @returns Inventory record
   */
  async get(id: string): Promise<OilInventoryRecord> {
    if (!id || typeof id !== "string") {
      throw new Error("Record ID must be a non-empty string");
    }

    return this.client["request"]<OilInventoryRecord>(
      `/v1/ei/oil_inventories/${id}`,
      {},
    );
  }

  /**
   * Get latest oil inventory data
   *
   * @returns Latest inventory record
   */
  async latest(): Promise<OilInventoryRecord> {
    return this.client["request"]<OilInventoryRecord>(
      "/v1/ei/oil_inventories/latest",
      {},
    );
  }

  /**
   * Get inventory summary
   *
   * @returns Inventory summary across all products
   */
  async summary(): Promise<OilInventorySummary> {
    return this.client["request"]<OilInventorySummary>(
      "/v1/ei/oil_inventories/summary",
      {},
    );
  }

  /**
   * Get inventories by product type
   *
   * @returns Array of inventories by product
   */
  async byProduct(): Promise<InventoryByProduct[]> {
    const response = await this.client["request"]<
      InventoryByProduct[] | { data: InventoryByProduct[] }
    >("/v1/ei/oil_inventories/by_product", {});

    return Array.isArray(response) ? response : response.data;
  }

  /**
   * Get historical inventory data
   *
   * @returns Array of historical inventory levels
   */
  async historical(): Promise<HistoricalInventory[]> {
    const response = await this.client["request"]<
      HistoricalInventory[] | { data: HistoricalInventory[] }
    >("/v1/ei/oil_inventories/historical", {});

    return Array.isArray(response) ? response : response.data;
  }

  /**
   * Get Cushing, OK inventory data
   *
   * @returns Cushing inventory data
   */
  async cushing(): Promise<CushingInventory> {
    return this.client["request"]<CushingInventory>(
      "/v1/ei/oil_inventories/cushing",
      {},
    );
  }
}
