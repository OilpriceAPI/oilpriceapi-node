/**
 * Energy Intelligence - Rig Counts Resource
 *
 * Access Baker Hughes rig count data with basin, state, and historical breakdowns.
 */

import type { OilPriceAPI } from "../../client.js";
import { ValidationError } from "../../errors.js";
import { unwrapCollection } from "./envelope.js";

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
 * Rig count for one basin, as returned under `data.basins` by
 * `GET /v1/ei/rig_counts/by_basin`.
 */
export interface RigCountByBasin {
  /** Basin slug, e.g. `permian`, `haynesville` */
  region: string;
  /** Always `basin` on this endpoint */
  region_type: string;
  /** Rig count */
  count: number;
  /** Change from the previous week */
  week_over_week?: number;
  /** `up`, `down` or `flat` */
  change_direction?: string;
}

/**
 * Rig count for one state, as returned under `data.states` by
 * `GET /v1/ei/rig_counts/by_state`.
 */
export interface RigCountByState {
  /** State slug, e.g. `texas`, `new_mexico` */
  region: string;
  /** Always `state` on this endpoint */
  region_type: string;
  /** Rig count */
  count: number;
  /** Change from the previous week */
  week_over_week?: number;
  /** `up`, `down` or `flat` */
  change_direction?: string;
}

/**
 * Historical rig count data point, as returned under `data.records` by
 * `GET /v1/ei/rig_counts/historical`.
 */
export interface HistoricalRigCount {
  /** Report date */
  date: string;
  /** Total rigs on that date */
  count: number;
  /** Change from the previous week */
  week_over_week?: number;
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
 * basins.forEach(b => console.log(`${b.region}: ${b.count} rigs`));
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
    const response = await this.client["request"]<unknown>("/v1/ei/rig_counts", {});

    return unwrapCollection<RigCountRecord>(response, "rig_counts", "/v1/ei/rig_counts");
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
      throw new ValidationError("Record ID must be a non-empty string");
    }

    return this.client["request"]<RigCountRecord>(`/v1/ei/rig_counts/${id}`, {});
  }

  /**
   * Get latest rig count
   *
   * @returns Latest rig count data
   */
  async latest(): Promise<RigCountRecord> {
    return this.client["request"]<RigCountRecord>("/v1/ei/rig_counts/latest", {});
  }

  /**
   * Get rig counts by basin
   *
   * @returns Array of rig counts by basin
   */
  async byBasin(): Promise<RigCountByBasin[]> {
    const response = await this.client["request"]<unknown>("/v1/ei/rig_counts/by_basin", {});

    return unwrapCollection<RigCountByBasin>(response, "basins", "/v1/ei/rig_counts/by_basin");
  }

  /**
   * Get rig counts by state
   *
   * @returns Array of rig counts by state
   */
  async byState(): Promise<RigCountByState[]> {
    const response = await this.client["request"]<unknown>("/v1/ei/rig_counts/by_state", {});

    return unwrapCollection<RigCountByState>(response, "states", "/v1/ei/rig_counts/by_state");
  }

  /**
   * Get historical rig count data
   *
   * @returns Array of historical rig counts
   */
  async historical(): Promise<HistoricalRigCount[]> {
    const response = await this.client["request"]<unknown>("/v1/ei/rig_counts/historical", {});

    return unwrapCollection<HistoricalRigCount>(
      response,
      "records",
      "/v1/ei/rig_counts/historical",
    );
  }
}
