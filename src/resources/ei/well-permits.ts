/**
 * Energy Intelligence - Well Permits Resource
 *
 * Access oil and gas well permit data by state, operator, and formation.
 */

import type { OilPriceAPI } from "../../client.js";
import { ValidationError } from "../../errors.js";

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
 * Well permit record returned by the `latest` endpoint.
 *
 * The live `/v1/ei/well-permits/latest` endpoint returns richer, nested
 * records than the flat {@link WellPermitRecord} shape used elsewhere.
 */
export interface LatestWellPermit {
  /** 14-digit API well number */
  api_number: string | null;
  /** Two-letter state code */
  state_code: string;
  /** County name */
  county: string | null;
  /** Permit number */
  permit_number: string | null;
  /** Permit type (e.g., "new_drill") */
  permit_type: string | null;
  /** Permit status (e.g., "approved") */
  permit_status: string | null;
  /** Permit date (YYYY-MM-DD) */
  permit_date: string | null;
  /** Operator details */
  operator: {
    name: string | null;
    name_normalized: string | null;
    number: string | null;
  };
  /** Well details */
  well: {
    name: string | null;
    number: string | null;
    type: string | null;
  };
  /** Surface location */
  location: {
    latitude: string | null;
    longitude: string | null;
  };
  /** Target formation/depth */
  target: {
    formation: string | null;
    formation_normalized: string | null;
    total_depth_proposed: number | null;
  };
  /** Source provenance */
  provenance: {
    source: string | null;
    fetched_at: string | null;
  };
}

/**
 * Envelope returned by `GET /v1/ei/well-permits/latest`.
 *
 * The live API returns a collection plus a `meta` block (lookback window,
 * covered states, per-state data-quality notes) — not a single record.
 */
export interface WellPermitLatestResponse {
  /** Most recent permits across covered states */
  well_permits: LatestWellPermit[];
  /** Collection metadata */
  meta?: {
    /** Lookback window in days */
    days?: number;
    /** States included in the response */
    states?: string[];
    /** Max records returned */
    limit?: number;
    /** Records returned */
    count?: number;
    /** Snapshot timestamp */
    as_of?: string;
    /** Per-state data-quality notes */
    data_quality?: Record<string, { date_coverage?: string; source?: string; note?: string }>;
    [key: string]: unknown;
  };
}

/**
 * Well permit search query.
 *
 * Maps to the parameters the `search` action actually reads. Note: `operator`
 * and `formation` are NOT search params (use the dedicated by-operator /
 * by-formation endpoints); state filtering uses `states` (comma-separated, plural).
 */
export interface WellPermitSearchQuery {
  /** Comma-separated state codes (e.g. 'TX,NM') */
  states?: string;
  /** County name (partial match) */
  county?: string;
  /** Well name (partial match) */
  well_name?: string;
  /** Permit type */
  permit_type?: string;
  /** Well type */
  well_type?: string;
  /** Free-form address (geocoded to lat/lng) */
  address?: string;
  /** Latitude for radius search */
  latitude?: number;
  /** Longitude for radius search */
  longitude?: number;
  /** Radius in miles (1-100, default 10) for lat/lng search */
  radius_miles?: number;
  /** Start date (permit_date >=) */
  start_date?: string;
  /** End date (permit_date <=) */
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
 * // Get latest permits (collection + meta envelope)
 * const latest = await client.ei.wellPermits.latest();
 * latest.well_permits.forEach(p =>
 *   console.log(`${p.permit_number}: ${p.operator.name} (${p.state_code})`)
 * );
 *
 * // Get permits by state
 * const states = await client.ei.wellPermits.byState();
 * states.forEach(s => console.log(`${s.state}: ${s.permit_count} permits`));
 *
 * // Search permits
 * const results = await client.ei.wellPermits.search({
 *   states: 'TX,NM',
 *   well_name: 'Eagle'
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
      throw new ValidationError("Record ID must be a non-empty string");
    }

    return this.client["request"]<WellPermitRecord>(`/v1/ei/well-permits/${id}`, {});
  }

  /**
   * Get the latest well permits across covered states.
   *
   * Returns the API's collection envelope (`{ well_permits, meta }`), not a
   * single record — the previous `WellPermitRecord` return type did not match
   * the live API response (see OilpriceAPI/oilpriceapi-node#32).
   *
   * @returns Latest well permits with collection metadata
   */
  async latest(): Promise<WellPermitLatestResponse> {
    return this.client["request"]<WellPermitLatestResponse>("/v1/ei/well-permits/latest", {});
  }

  /**
   * Get well permit summary
   *
   * @returns Well permit summary statistics
   */
  async summary(): Promise<WellPermitSummary> {
    return this.client["request"]<WellPermitSummary>("/v1/ei/well-permits/summary", {});
  }

  /**
   * Get permits by state
   *
   * @returns Array of permits grouped by state
   */
  async byState(): Promise<PermitsByState[]> {
    const response = await this.client["request"]<PermitsByState[] | { data: PermitsByState[] }>(
      "/v1/ei/well-permits/by-state",
      {},
    );

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

    if (query.states) params.states = query.states;
    if (query.county) params.county = query.county;
    if (query.well_name) params.well_name = query.well_name;
    if (query.permit_type) params.permit_type = query.permit_type;
    if (query.well_type) params.well_type = query.well_type;
    if (query.address) params.address = query.address;
    if (query.latitude !== undefined) params.latitude = query.latitude.toString();
    if (query.longitude !== undefined) params.longitude = query.longitude.toString();
    if (query.radius_miles !== undefined) params.radius_miles = query.radius_miles.toString();
    if (query.start_date) params.start_date = query.start_date;
    if (query.end_date) params.end_date = query.end_date;

    const response = await this.client["request"]<
      WellPermitRecord[] | { data: WellPermitRecord[] }
    >("/v1/ei/well-permits/search", params);

    return Array.isArray(response) ? response : response.data;
  }
}
