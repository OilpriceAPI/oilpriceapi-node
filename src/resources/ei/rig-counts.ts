/**
 * Energy Intelligence - Rig Counts Resource
 *
 * Access Baker Hughes rig count data with basin, state, and historical breakdowns.
 */

import type { OilPriceAPI } from "../../client.js";

/**
 * Rig count record
 */
export interface RigCountRecord {
  /** Record ID */
  id: string;
  /** Total rig count */
  total_rigs: number;
  /** Oil rigs */
  oil_rigs?: number;
  /** Gas rigs */
  gas_rigs?: number;
  /** Miscellaneous rigs */
  misc_rigs?: number;
  /** Report date */
  date: string;
  /** Week number */
  week?: number;
  /** ISO timestamp */
  timestamp: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Rig count by basin
 */
export interface RigCountByBasin {
  /** Basin name */
  basin: string;
  /** Rig count */
  rig_count: number;
  /** Change from previous week */
  change?: number;
  /** Date */
  date: string;
}

/**
 * Rig count by state
 */
export interface RigCountByState {
  /** State name */
  state: string;
  /** Rig count */
  rig_count: number;
  /** Change from previous week */
  change?: number;
  /** Date */
  date: string;
}

/**
 * Historical rig count data point
 */
export interface HistoricalRigCount {
  /** Date */
  date: string;
  /** Total rigs */
  total_rigs: number;
  /** Oil rigs */
  oil_rigs?: number;
  /** Gas rigs */
  gas_rigs?: number;
}

/**
 * EI Rig Counts Resource
 *
 * Access Baker Hughes rig count data with comprehensive breakdowns.
 *
 * @example
 * ```typescript
 * const client = new OilPriceAPI({ apiKey: 'your_key' });
 *
 * // Get latest rig count
 * const latest = await client.ei.rigCounts.latest();
 * console.log(`Total rigs: ${latest.total_rigs}`);
 *
 * // Get by basin
 * const basins = await client.ei.rigCounts.byBasin();
 * basins.forEach(b => console.log(`${b.basin}: ${b.rig_count} rigs`));
 * ```
 */
export class EIRigCountsResource {
  constructor(private client: OilPriceAPI) {}

  /**
   * List all rig count records
   *
   * @returns Array of rig count records
   *
   * @throws {OilPriceAPIError} If API request fails
   */
  async list(): Promise<RigCountRecord[]> {
    const response = await this.client["request"]<
      RigCountRecord[] | { data: RigCountRecord[] }
    >("/v1/ei/rig_counts", {});

    return Array.isArray(response) ? response : response.data;
  }

  /**
   * Get a specific rig count record
   *
   * @param id - Record ID
   * @returns Rig count record
   *
   * @throws {NotFoundError} If record not found
   */
  async get(id: string): Promise<RigCountRecord> {
    if (!id || typeof id !== "string") {
      throw new Error("Record ID must be a non-empty string");
    }

    return this.client["request"]<RigCountRecord>(
      `/v1/ei/rig_counts/${id}`,
      {},
    );
  }

  /**
   * Get latest rig count
   *
   * @returns Latest rig count data
   */
  async latest(): Promise<RigCountRecord> {
    return this.client["request"]<RigCountRecord>(
      "/v1/ei/rig_counts/latest",
      {},
    );
  }

  /**
   * Get rig counts by basin
   *
   * @returns Array of rig counts by basin
   */
  async byBasin(): Promise<RigCountByBasin[]> {
    const response = await this.client["request"]<
      RigCountByBasin[] | { data: RigCountByBasin[] }
    >("/v1/ei/rig_counts/by_basin", {});

    return Array.isArray(response) ? response : response.data;
  }

  /**
   * Get rig counts by state
   *
   * @returns Array of rig counts by state
   */
  async byState(): Promise<RigCountByState[]> {
    const response = await this.client["request"]<
      RigCountByState[] | { data: RigCountByState[] }
    >("/v1/ei/rig_counts/by_state", {});

    return Array.isArray(response) ? response : response.data;
  }

  /**
   * Get historical rig count data
   *
   * @returns Array of historical rig counts
   */
  async historical(): Promise<HistoricalRigCount[]> {
    const response = await this.client["request"]<
      HistoricalRigCount[] | { data: HistoricalRigCount[] }
    >("/v1/ei/rig_counts/historical", {});

    return Array.isArray(response) ? response : response.data;
  }
}
