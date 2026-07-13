/**
 * Well Production Resource
 *
 * Access US oil & gas well production data: national/state monthly aggregates
 * (EIA API v2), well-level production from state regulatory agencies, and
 * permit-to-production cycle-time analytics.
 *
 * Coverage note (beta): well-level production is only available for the states
 * collected from regulatory agencies so far (see `summary().coverage`). This is
 * NOT complete US well-level coverage — state aggregates (EIA) are the
 * comprehensive layer.
 */

import type { OilPriceAPI } from "../client.js";
import { ValidationError } from "../errors.js";

/**
 * Monthly production record (national, state, or well granularity)
 */
export interface WellProductionRecord {
  /** Production month (YYYY-MM) */
  period: string;
  /** Oil production in barrels */
  oil_bbl: number | null;
  /** Gas production in thousand cubic feet */
  gas_mcf: number | null;
  /** Water production in barrels (well-level sources only) */
  water_bbl: number | null;
  /** Barrels of oil equivalent */
  boe: number | null;
  /** Days producing in the month (when reported by the source) */
  days_producing: number | null;
  /** Data source (e.g., "eia_api", "tx_rrc", "market_reporting") */
  source: string;
}

/**
 * State-level production summary row
 */
export interface StateProductionSummary {
  /** Two-letter state code (e.g., "TX") */
  state: string;
  /** Production month (YYYY-MM) */
  period: string;
  /** Oil production in barrels */
  oil_bbl: number | null;
  /** Oil production in barrels per day (derived) */
  oil_bpd: number | null;
  /** Gas production in thousand cubic feet */
  gas_mcf: number | null;
  /** Barrels of oil equivalent */
  boe: number | null;
}

/**
 * National production overview (GET /v1/well-production)
 */
export interface WellProductionSummary {
  /** Latest national monthly rollup (null when unavailable) */
  national: WellProductionRecord | null;
  /** Top producing states for the latest month */
  top_states: StateProductionSummary[];
  /** Description of where each data layer comes from */
  data_sources?: {
    state_aggregates?: string;
    well_level?: string;
    well_level_states?: string[];
    national_rollup?: string;
    [key: string]: unknown;
  };
  /** Coverage metadata — which states/periods have data */
  coverage?: {
    states_with_data?: string[];
    well_level_states_with_data?: string[];
    latest_period?: string | null;
    total_records?: number;
    [key: string]: unknown;
  };
}

/**
 * State production listing (GET /v1/well-production/states)
 */
export interface StatesProductionResponse {
  /** Month the listing covers (YYYY-MM) */
  period: string | null;
  /** Number of states returned */
  count: number;
  /** Per-state production rows, ordered by oil production */
  states: StateProductionSummary[];
}

/**
 * State production history (GET /v1/well-production/states/:code)
 */
export interface StateProductionDetail {
  /** Two-letter state code */
  state: string;
  /** Requested date range */
  period: { start: string; end: string };
  /** Number of monthly records */
  count: number;
  /** Monthly production records, oldest first */
  data: WellProductionRecord[];
}

/**
 * Well production history (GET /v1/well-production/wells/:api)
 */
export interface WellProductionDetail {
  /** 14-digit API well number */
  api_number: string;
  /** Operator name */
  operator: string | null;
  /** Well name */
  well_name: string | null;
  /** Two-letter state code */
  state: string | null;
  /** Number of monthly records */
  count: number;
  /** Monthly production records, oldest first */
  data: WellProductionRecord[];
}

/**
 * Top producing well row
 */
export interface TopProducingWell {
  /** 14-digit API well number */
  api_number: string;
  /** Operator name */
  operator: string | null;
  /** Well name */
  well_name: string | null;
  /** Total oil over the period in barrels */
  total_oil_bbl: number | null;
  /** Total gas over the period in thousand cubic feet */
  total_gas_mcf: number | null;
  /** Number of months with production in the period */
  months_producing: number | null;
}

/**
 * Top producers listing (GET /v1/well-production/top-producers)
 */
export interface TopProducersResponse {
  /** Two-letter state code the ranking covers */
  state: string;
  /** Date range used for the ranking */
  period: { start: string; end: string };
  /** Number of wells returned */
  count: number;
  /** Top producing wells */
  producers: TopProducingWell[];
}

/**
 * Options for `states()`
 */
export interface StatesOptions {
  /** Month to query (YYYY-MM). Defaults to the latest available month. */
  period?: string;
}

/**
 * Options for `stateDetail()`
 */
export interface StateDetailOptions {
  /** Start date (YYYY-MM-DD). Defaults to 2 years ago. */
  start_date?: string;
  /** End date (YYYY-MM-DD). Defaults to today. */
  end_date?: string;
}

/**
 * Options for `topProducers()`
 */
export interface TopProducersOptions {
  /** Two-letter state code (default "TX") */
  state_code?: string;
  /** Max wells to return (default 20, capped at 100 server-side) */
  limit?: number;
  /** Lookback window in months (default 12) */
  months?: number;
}

/**
 * Cycle-time distribution statistics (days)
 */
export interface CycleTimeStats {
  count: number;
  median_days: number | null;
  p25_days: number | null;
  p75_days: number | null;
  p90_days: number | null;
  min_days: number | null;
  max_days: number | null;
  avg_days: number | null;
}

/**
 * A notably fast/slow well in the cycle-time analysis
 */
export interface CycleTimeWell {
  /** 14-digit API well number */
  api_number: string;
  /** Operator name */
  operator: string | null;
  /** Permit-to-production days */
  total_days: number;
  /** Permit date (YYYY-MM-DD) */
  permit_date: string | null;
  /** First production month (YYYY-MM-DD) */
  first_production: string | null;
}

/**
 * Permit-to-production cycle-time analysis
 * (GET /v1/well-production/cycle-time)
 */
export interface CycleTimeAnalysis {
  /** Echo of the applied filters */
  filters: Record<string, unknown>;
  /** Wells matching the filters */
  well_count: number;
  /** Wells with both permit and production dates */
  wells_with_cycle_data: number;
  /** Overall distribution statistics */
  cycle_time_stats: CycleTimeStats;
  /** Per-stage breakdown (permit→spud, spud→completion, ...) when available */
  stage_breakdown: Record<string, unknown>;
  /** Stats grouped by permit quarter (e.g., "2025-Q2") */
  quarterly_cohorts: Record<
    string,
    { well_count: number; median_days: number | null; avg_days: number | null }
  >;
  /** Fastest wells in the sample */
  top_fastest: CycleTimeWell[];
  /** Slowest wells in the sample */
  top_slowest: CycleTimeWell[];
}

/**
 * Single cohort entry in a cycle-time cohort comparison
 */
export interface CycleTimeCohort {
  well_count: number;
  wells_with_data: number;
  stats: CycleTimeStats;
}

/**
 * Cycle-time cohort comparison
 * (GET /v1/well-production/cycle-time/cohorts)
 */
export interface CycleTimeCohortsResponse {
  /** Cohort grouping field (default "quarter") */
  group_by: string;
  /** Cohort label (e.g., "2025-Q2") → cohort stats */
  cohorts: Record<string, CycleTimeCohort>;
}

/**
 * Filters for `cycleTime()`
 */
export interface CycleTimeQuery {
  /** Two-letter state code */
  state?: string;
  /** Permit date >= (YYYY-MM-DD). Defaults to 24 months ago when no dates given. */
  start_date?: string;
  /** Permit date <= (YYYY-MM-DD) */
  end_date?: string;
  /** Operator name (partial match) */
  operator?: string;
  /** Target formation (partial match) */
  formation?: string;
  /** Latitude for radius search */
  lat?: number;
  /** Longitude for radius search */
  lng?: number;
  /** Radius in miles for lat/lng search */
  radius_miles?: number;
}

/**
 * Filters for `cycleTimeCohorts()`
 */
export interface CycleTimeCohortsQuery {
  /** Two-letter state code */
  state?: string;
  /** Permit date >= (YYYY-MM-DD) */
  start_date?: string;
  /** Permit date <= (YYYY-MM-DD) */
  end_date?: string;
  /** Latitude for radius search */
  lat?: number;
  /** Longitude for radius search */
  lng?: number;
  /** Radius in miles for lat/lng search */
  radius_miles?: number;
  /** Cohort grouping field (default "quarter") */
  group_by?: string;
}

/**
 * Well Production Resource
 *
 * US oil & gas production data (requires the drilling-intelligence tier).
 *
 * Beta coverage caveat: well-level records exist only for the states collected
 * from regulatory agencies so far — check `summary().coverage` before assuming
 * a state or well is covered.
 *
 * @example
 * ```typescript
 * const client = new OilPriceAPI({ apiKey: 'your_key' });
 *
 * // National overview + top states
 * const summary = await client.wellProduction.summary();
 * console.log(summary.top_states[0]); // { state: 'TX', oil_bbl: ..., ... }
 *
 * // Texas production history
 * const tx = await client.wellProduction.stateDetail('TX', { start_date: '2026-01-01' });
 * tx.data.forEach(r => console.log(`${r.period}: ${r.oil_bbl} bbl`));
 *
 * // Permit-to-production cycle times
 * const cycle = await client.wellProduction.cycleTime({ state: 'TX' });
 * console.log(`Median: ${cycle.cycle_time_stats.median_days} days`);
 * ```
 */
export class WellProductionResource {
  constructor(private client: OilPriceAPI) {}

  /**
   * Get the national production overview: latest national rollup, top
   * producing states, data sources, and coverage metadata.
   *
   * `GET /v1/well-production`
   */
  async summary(): Promise<WellProductionSummary> {
    return this.client["request"]<WellProductionSummary>("/v1/well-production", {});
  }

  /**
   * Get the latest (or a specific month's) state-level production summary.
   *
   * `GET /v1/well-production/states`
   *
   * @param options - Optional `{ period: 'YYYY-MM' }`
   */
  async states(options?: StatesOptions): Promise<StatesProductionResponse> {
    const params: Record<string, string> = {};
    if (options?.period) params.period = options.period;

    return this.client["request"]<StatesProductionResponse>("/v1/well-production/states", params);
  }

  /**
   * Get monthly production history for a specific state.
   *
   * `GET /v1/well-production/states/:state_code`
   *
   * @param stateCode - Two-letter state code (e.g., "TX")
   * @param options - Optional date range
   * @throws {NotFoundError} When the state has no production data
   */
  async stateDetail(
    stateCode: string,
    options?: StateDetailOptions,
  ): Promise<StateProductionDetail> {
    if (!stateCode || typeof stateCode !== "string") {
      throw new ValidationError("State code must be a non-empty string");
    }

    const params: Record<string, string> = {};
    if (options?.start_date) params.start_date = options.start_date;
    if (options?.end_date) params.end_date = options.end_date;

    return this.client["request"]<StateProductionDetail>(
      `/v1/well-production/states/${encodeURIComponent(stateCode)}`,
      params,
    );
  }

  /**
   * Get monthly production history for a specific well.
   *
   * `GET /v1/well-production/wells/:api_number`
   *
   * @param apiNumber - 14-digit API well number (separators like "42-477-31122-00-00" are accepted)
   * @throws {ValidationError} When the API number doesn't contain 14 digits
   * @throws {NotFoundError} When the well has no production data
   */
  async wellDetail(apiNumber: string): Promise<WellProductionDetail> {
    if (!apiNumber || typeof apiNumber !== "string") {
      throw new ValidationError("API number must be a non-empty string");
    }

    const digits = apiNumber.replace(/[^0-9]/g, "");
    if (digits.length !== 14) {
      throw new ValidationError("API number must be 14 digits");
    }

    return this.client["request"]<WellProductionDetail>(`/v1/well-production/wells/${digits}`, {});
  }

  /**
   * Get top producing wells for a state over a lookback window.
   *
   * `GET /v1/well-production/top-producers`
   *
   * @param options - Optional state_code (default "TX"), limit, months
   */
  async topProducers(options?: TopProducersOptions): Promise<TopProducersResponse> {
    const params: Record<string, string> = {};
    if (options?.state_code) params.state_code = options.state_code;
    if (options?.limit !== undefined) params.limit = options.limit.toString();
    if (options?.months !== undefined) params.months = options.months.toString();

    return this.client["request"]<TopProducersResponse>(
      "/v1/well-production/top-producers",
      params,
    );
  }

  /**
   * Analyze permit-to-production cycle times with optional geographic,
   * operator, and formation filters.
   *
   * `GET /v1/well-production/cycle-time`
   *
   * @param query - Optional filters
   * @throws {NotFoundError} When no wells match the filters
   */
  async cycleTime(query?: CycleTimeQuery): Promise<CycleTimeAnalysis> {
    const params: Record<string, string> = {};
    if (query?.state) params.state = query.state;
    if (query?.start_date) params.start_date = query.start_date;
    if (query?.end_date) params.end_date = query.end_date;
    if (query?.operator) params.operator = query.operator;
    if (query?.formation) params.formation = query.formation;
    if (query?.lat !== undefined) params.lat = query.lat.toString();
    if (query?.lng !== undefined) params.lng = query.lng.toString();
    if (query?.radius_miles !== undefined) params.radius_miles = query.radius_miles.toString();

    return this.client["request"]<CycleTimeAnalysis>("/v1/well-production/cycle-time", params);
  }

  /**
   * Compare cycle times across cohorts (quarterly by default).
   *
   * `GET /v1/well-production/cycle-time/cohorts`
   *
   * @param query - Optional filters plus `group_by`
   * @throws {NotFoundError} When no wells match the filters
   */
  async cycleTimeCohorts(query?: CycleTimeCohortsQuery): Promise<CycleTimeCohortsResponse> {
    const params: Record<string, string> = {};
    if (query?.state) params.state = query.state;
    if (query?.start_date) params.start_date = query.start_date;
    if (query?.end_date) params.end_date = query.end_date;
    if (query?.lat !== undefined) params.lat = query.lat.toString();
    if (query?.lng !== undefined) params.lng = query.lng.toString();
    if (query?.radius_miles !== undefined) params.radius_miles = query.radius_miles.toString();
    if (query?.group_by) params.group_by = query.group_by;

    return this.client["request"]<CycleTimeCohortsResponse>(
      "/v1/well-production/cycle-time/cohorts",
      params,
    );
  }
}
