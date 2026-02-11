/**
 * Energy Intelligence - Drilling Productivity Resource
 *
 * Access EIA Drilling Productivity Report data including new well production,
 * legacy decline rates, and DUC well inventories by basin.
 */

import type { OilPriceAPI } from "../../client.js";

/**
 * Drilling productivity record
 */
export interface DrillingProductivityRecord {
  /** Record ID */
  id: string;
  /** Basin name */
  basin?: string;
  /** New well oil production per rig (barrels/day) */
  new_well_oil_production?: number;
  /** New well gas production per rig (mcf/day) */
  new_well_gas_production?: number;
  /** Legacy production change (oil) */
  legacy_oil_change?: number;
  /** Legacy production change (gas) */
  legacy_gas_change?: number;
  /** DUC well count */
  duc_count?: number;
  /** Report date */
  date: string;
  /** Month */
  month?: string;
  /** ISO timestamp */
  timestamp: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Drilling productivity summary
 */
export interface DrillingProductivitySummary {
  /** Total new well oil production */
  total_new_well_oil?: number;
  /** Total new well gas production */
  total_new_well_gas?: number;
  /** Total DUC wells */
  total_duc_wells?: number;
  /** As of date */
  as_of_date: string;
}

/**
 * DUC well data
 */
export interface DUCWellInventory {
  /** Basin name */
  basin: string;
  /** DUC well count */
  duc_count: number;
  /** Change from previous month */
  change?: number;
  /** Date */
  date: string;
}

/**
 * Productivity by basin
 */
export interface ProductivityByBasin {
  /** Basin name */
  basin: string;
  /** New well oil production */
  new_well_oil_production?: number;
  /** New well gas production */
  new_well_gas_production?: number;
  /** DUC count */
  duc_count?: number;
  /** Date */
  date: string;
}

/**
 * Historical productivity data point
 */
export interface HistoricalProductivity {
  /** Date */
  date: string;
  /** New well oil production */
  new_well_oil_production?: number;
  /** New well gas production */
  new_well_gas_production?: number;
  /** DUC count */
  duc_count?: number;
}

/**
 * Productivity trend data
 */
export interface ProductivityTrend {
  /** Basin name */
  basin: string;
  /** Trend direction */
  trend: "up" | "down" | "flat";
  /** Change percentage */
  change_percent?: number;
  /** Metric type */
  metric: string;
}

/**
 * EI Drilling Productivity Resource
 *
 * Access EIA Drilling Productivity Report data for major US basins.
 *
 * @example
 * ```typescript
 * const client = new OilPriceAPI({ apiKey: 'your_key' });
 *
 * // Get latest productivity data
 * const latest = await client.ei.drillingProductivity.latest();
 * console.log(`Basin: ${latest.basin}`);
 * console.log(`New well oil: ${latest.new_well_oil_production} bpd/rig`);
 *
 * // Get DUC wells
 * const duc = await client.ei.drillingProductivity.ducWells();
 * duc.forEach(d => console.log(`${d.basin}: ${d.duc_count} DUC wells`));
 * ```
 */
export class EIDrillingProductivityResource {
  constructor(private client: OilPriceAPI) {}

  /**
   * List all drilling productivity records
   *
   * @returns Array of productivity records
   */
  async list(): Promise<DrillingProductivityRecord[]> {
    const response = await this.client["request"]<
      DrillingProductivityRecord[] | { data: DrillingProductivityRecord[] }
    >("/v1/ei/drilling_productivities", {});

    return Array.isArray(response) ? response : response.data;
  }

  /**
   * Get a specific productivity record
   *
   * @param id - Record ID
   * @returns Productivity record
   */
  async get(id: string): Promise<DrillingProductivityRecord> {
    if (!id || typeof id !== "string") {
      throw new Error("Record ID must be a non-empty string");
    }

    return this.client["request"]<DrillingProductivityRecord>(
      `/v1/ei/drilling_productivities/${id}`,
      {},
    );
  }

  /**
   * Get latest drilling productivity data
   *
   * @returns Latest productivity record
   */
  async latest(): Promise<DrillingProductivityRecord> {
    return this.client["request"]<DrillingProductivityRecord>(
      "/v1/ei/drilling_productivities/latest",
      {},
    );
  }

  /**
   * Get drilling productivity summary
   *
   * @returns Productivity summary across all basins
   */
  async summary(): Promise<DrillingProductivitySummary> {
    return this.client["request"]<DrillingProductivitySummary>(
      "/v1/ei/drilling_productivities/summary",
      {},
    );
  }

  /**
   * Get DUC well inventories
   *
   * @returns Array of DUC well counts by basin
   */
  async ducWells(): Promise<DUCWellInventory[]> {
    const response = await this.client["request"]<
      DUCWellInventory[] | { data: DUCWellInventory[] }
    >("/v1/ei/drilling_productivities/duc_wells", {});

    return Array.isArray(response) ? response : response.data;
  }

  /**
   * Get productivity by basin
   *
   * @returns Array of productivity data by basin
   */
  async byBasin(): Promise<ProductivityByBasin[]> {
    const response = await this.client["request"]<
      ProductivityByBasin[] | { data: ProductivityByBasin[] }
    >("/v1/ei/drilling_productivities/by_basin", {});

    return Array.isArray(response) ? response : response.data;
  }

  /**
   * Get historical productivity data
   *
   * @returns Array of historical productivity metrics
   */
  async historical(): Promise<HistoricalProductivity[]> {
    const response = await this.client["request"]<
      HistoricalProductivity[] | { data: HistoricalProductivity[] }
    >("/v1/ei/drilling_productivities/historical", {});

    return Array.isArray(response) ? response : response.data;
  }

  /**
   * Get productivity trends
   *
   * @returns Array of productivity trends by basin
   */
  async trends(): Promise<ProductivityTrend[]> {
    const response = await this.client["request"]<
      ProductivityTrend[] | { data: ProductivityTrend[] }
    >("/v1/ei/drilling_productivities/trends", {});

    return Array.isArray(response) ? response : response.data;
  }
}
