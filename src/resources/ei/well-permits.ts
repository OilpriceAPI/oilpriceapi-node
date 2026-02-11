/**
 * Energy Intelligence - Well Permits Resource
 *
 * Access oil and gas well permit data by state, operator, and formation.
 */

import type { OilPriceAPI } from "../../client.js";

/**
 * Well permit record
 */
export interface WellPermitRecord {
  /** Record ID */
  id: string;
  /** Permit number */
  permit_number?: string;
  /** State */
  state: string;
  /** County */
  county?: string;
  /** Operator name */
  operator?: string;
  /** Well name */
  well_name?: string;
  /** Formation/target */
  formation?: string;
  /** Well type (e.g., "oil", "gas", "injection") */
  well_type?: string;
  /** Permit issue date */
  issue_date: string;
  /** ISO timestamp */
  timestamp: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Well permit summary
 */
export interface WellPermitSummary {
  /** Total permits */
  total_permits: number;
  /** Permits by state */
  by_state?: Record<string, number>;
  /** Permits by operator */
  by_operator?: Record<string, number>;
  /** As of date */
  as_of_date: string;
}

/**
 * Permits by state
 */
export interface PermitsByState {
  /** State name */
  state: string;
  /** Permit count */
  permit_count: number;
  /** Change from previous period */
  change?: number;
  /** Date */
  date: string;
}

/**
 * Permits by operator
 */
export interface PermitsByOperator {
  /** Operator name */
  operator: string;
  /** Permit count */
  permit_count: number;
  /** Percentage of total */
  percentage?: number;
  /** Date */
  date: string;
}

/**
 * Permits by formation
 */
export interface PermitsByFormation {
  /** Formation name */
  formation: string;
  /** Permit count */
  permit_count: number;
  /** Percentage of total */
  percentage?: number;
  /** Date */
  date: string;
}

/**
 * Well permit search query
 */
export interface WellPermitSearchQuery {
  /** State filter */
  state?: string;
  /** Operator filter */
  operator?: string;
  /** Formation filter */
  formation?: string;
  /** Start date */
  start_date?: string;
  /** End date */
  end_date?: string;
}

/**
 * EI Well Permits Resource
 *
 * Access oil and gas well permit data with detailed breakdowns.
 *
 * @example
 * ```typescript
 * const client = new OilPriceAPI({ apiKey: 'your_key' });
 *
 * // Get latest permits
 * const latest = await client.ei.wellPermits.latest();
 * console.log(`Permit: ${latest.permit_number} - ${latest.operator}`);
 *
 * // Get permits by state
 * const states = await client.ei.wellPermits.byState();
 * states.forEach(s => console.log(`${s.state}: ${s.permit_count} permits`));
 *
 * // Search permits
 * const results = await client.ei.wellPermits.search({
 *   state: 'Texas',
 *   operator: 'ConocoPhillips'
 * });
 * ```
 */
export class EIWellPermitsResource {
  constructor(private client: OilPriceAPI) {}

  /**
   * List all well permit records
   *
   * @returns Array of well permit records
   */
  async list(): Promise<WellPermitRecord[]> {
    const response = await this.client["request"]<
      WellPermitRecord[] | { data: WellPermitRecord[] }
    >("/v1/ei/well-permits", {});

    return Array.isArray(response) ? response : response.data;
  }

  /**
   * Get a specific well permit record
   *
   * @param id - Record ID
   * @returns Well permit record
   */
  async get(id: string): Promise<WellPermitRecord> {
    if (!id || typeof id !== "string") {
      throw new Error("Record ID must be a non-empty string");
    }

    return this.client["request"]<WellPermitRecord>(
      `/v1/ei/well-permits/${id}`,
      {},
    );
  }

  /**
   * Get latest well permit
   *
   * @returns Latest well permit record
   */
  async latest(): Promise<WellPermitRecord> {
    return this.client["request"]<WellPermitRecord>(
      "/v1/ei/well-permits/latest",
      {},
    );
  }

  /**
   * Get well permit summary
   *
   * @returns Well permit summary statistics
   */
  async summary(): Promise<WellPermitSummary> {
    return this.client["request"]<WellPermitSummary>(
      "/v1/ei/well-permits/summary",
      {},
    );
  }

  /**
   * Get permits by state
   *
   * @returns Array of permits grouped by state
   */
  async byState(): Promise<PermitsByState[]> {
    const response = await this.client["request"]<
      PermitsByState[] | { data: PermitsByState[] }
    >("/v1/ei/well-permits/by-state", {});

    return Array.isArray(response) ? response : response.data;
  }

  /**
   * Get permits by operator
   *
   * @returns Array of permits grouped by operator
   */
  async byOperator(): Promise<PermitsByOperator[]> {
    const response = await this.client["request"]<
      PermitsByOperator[] | { data: PermitsByOperator[] }
    >("/v1/ei/well-permits/by-operator", {});

    return Array.isArray(response) ? response : response.data;
  }

  /**
   * Get permits by formation
   *
   * @returns Array of permits grouped by formation
   */
  async byFormation(): Promise<PermitsByFormation[]> {
    const response = await this.client["request"]<
      PermitsByFormation[] | { data: PermitsByFormation[] }
    >("/v1/ei/well-permits/by-formation", {});

    return Array.isArray(response) ? response : response.data;
  }

  /**
   * Search well permits
   *
   * @param query - Search query parameters
   * @returns Array of matching well permit records
   */
  async search(query: WellPermitSearchQuery): Promise<WellPermitRecord[]> {
    const params: Record<string, string> = {};

    if (query.state) params.state = query.state;
    if (query.operator) params.operator = query.operator;
    if (query.formation) params.formation = query.formation;
    if (query.start_date) params.start_date = query.start_date;
    if (query.end_date) params.end_date = query.end_date;

    const response = await this.client["request"]<
      WellPermitRecord[] | { data: WellPermitRecord[] }
    >("/v1/ei/well-permits/search", params);

    return Array.isArray(response) ? response : response.data;
  }
}
