/**
 * Drilling Intelligence Resource
 *
 * Access US onshore drilling activity data including rig counts, well permits,
 * frac spreads, DUC wells, completions, and production trends by basin.
 */

import type { OilPriceAPI } from "../client.js";
import { OilPriceAPIError } from "../errors.js";

/**
 * Drilling intelligence data point
 */
export interface DrillingIntelligenceData {
  /** Record ID */
  id: string;
  /** Basin name */
  basin?: string;
  /** State */
  state?: string;
  /** Operator name */
  operator?: string;
  /** Metric type */
  metric_type: string;
  /** Metric value */
  value: number;
  /** Unit of measurement */
  unit?: string;
  /** Report date */
  date: string;
  /** Week number */
  week?: number;
  /** ISO timestamp when data was recorded */
  timestamp: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Latest drilling intelligence summary
 */
export interface LatestDrillingData {
  /** Total active rigs */
  total_rigs: number;
  /** Total frac spreads */
  total_frac_spreads: number;
  /** Total well permits */
  total_permits: number;
  /** Total DUC wells */
  total_duc_wells: number;
  /** Total completions */
  total_completions: number;
  /** As of date */
  as_of_date: string;
  /** Additional metrics */
  metrics?: Record<string, unknown>;
}

/**
 * Drilling intelligence summary by metric
 */
export interface DrillingSummary {
  /** Metric type */
  metric: string;
  /** Total count/value */
  total: number;
  /** Change from previous period */
  change?: number;
  /** Percentage change */
  change_percent?: number;
  /** Breakdown by basin or state */
  breakdown?: Array<{
    name: string;
    value: number;
    percentage?: number;
  }>;
}

/**
 * Drilling trend data
 */
export interface DrillingTrend {
  /** Date */
  date: string;
  /** Metric type */
  metric: string;
  /** Value */
  value: number;
  /** Moving average (if applicable) */
  moving_average?: number;
  /** Trend direction */
  trend?: "up" | "down" | "flat";
}

/**
 * Frac spread data
 */
export interface FracSpreadData {
  /** Basin name */
  basin: string;
  /** Number of active frac spreads */
  active_spreads: number;
  /** Change from previous week */
  change?: number;
  /** Date */
  date: string;
}

/**
 * Well permit data
 */
export interface WellPermitData {
  /** State */
  state: string;
  /** Basin */
  basin?: string;
  /** Number of permits issued */
  permits: number;
  /** Change from previous period */
  change?: number;
  /** Date */
  date: string;
}

/**
 * DUC (Drilled but Uncompleted) well data
 */
export interface DUCWellData {
  /** Basin name */
  basin: string;
  /** Number of DUC wells */
  duc_count: number;
  /** Change from previous month */
  change?: number;
  /** Date */
  date: string;
}

/**
 * Well completion data
 */
export interface CompletionData {
  /** Basin name */
  basin: string;
  /** Number of completions */
  completions: number;
  /** Change from previous period */
  change?: number;
  /** Date */
  date: string;
}

/**
 * Wells drilled data
 */
export interface WellsDrilledData {
  /** Basin name */
  basin: string;
  /** Number of wells drilled */
  wells_drilled: number;
  /** Change from previous period */
  change?: number;
  /** Date */
  date: string;
}

/**
 * Basin-specific drilling intelligence
 */
export interface BasinDrillingData {
  /** Basin name */
  basin: string;
  /** Active rigs */
  active_rigs?: number;
  /** Frac spreads */
  frac_spreads?: number;
  /** Well permits */
  permits?: number;
  /** DUC wells */
  duc_wells?: number;
  /** Completions */
  completions?: number;
  /** Wells drilled */
  wells_drilled?: number;
  /** As of date */
  as_of_date: string;
  /** Historical trend */
  trend?: DrillingTrend[];
}

/**
 * Drilling Intelligence Resource
 *
 * Access US onshore drilling activity data from EIA and Baker Hughes.
 * Includes rig counts, well permits, frac spreads, DUC wells, completions,
 * and basin-level breakdowns.
 *
 * @example
 * ```typescript
 * import { OilPriceAPI } from 'oilpriceapi';
 *
 * const client = new OilPriceAPI({ apiKey: 'your_key' });
 *
 * // Get latest drilling intelligence
 * const latest = await client.drilling.latest();
 * console.log(`Active rigs: ${latest.total_rigs}`);
 *
 * // Basin-level completions (by_basin keyed by basin code)
 * const completions = await client.drilling.completions();
 * ```
 */
export class DrillingIntelligenceResource {
  constructor(private client: OilPriceAPI) {}

  /**
   * List all drilling intelligence records
   *
   * Returns all available drilling intelligence data points.
   *
   * @returns Array of drilling intelligence data
   *
   * @throws {OilPriceAPIError} If API request fails
   * @throws {AuthenticationError} If API key is invalid
   *
   * @example
   * ```typescript
   * const data = await client.drilling.list();
   * console.log(`${data.length} records found`);
   * ```
   */
  async list(): Promise<DrillingIntelligenceData[]> {
    const response = await this.client["request"]<
      DrillingIntelligenceData[] | { data: DrillingIntelligenceData[] }
    >("/v1/drilling-intelligence", {});

    return Array.isArray(response) ? response : response.data;
  }

  /**
   * Get latest drilling intelligence summary
   *
   * Returns the most recent snapshot of drilling activity metrics.
   *
   * @returns Latest drilling intelligence data
   *
   * @throws {OilPriceAPIError} If API request fails
   * @throws {AuthenticationError} If API key is invalid
   *
   * @example
   * ```typescript
   * const latest = await client.drilling.latest();
   * console.log(`Total active rigs: ${latest.total_rigs}`);
   * console.log(`Frac spreads: ${latest.total_frac_spreads}`);
   * console.log(`As of: ${latest.as_of_date}`);
   * ```
   */
  async latest(): Promise<LatestDrillingData> {
    return this.client["request"]<LatestDrillingData>(
      "/v1/drilling-intelligence/latest",
      {},
    );
  }

  /**
   * Get drilling intelligence summary
   *
   * Returns aggregated summary of drilling metrics by type.
   *
   * @returns Array of drilling summaries by metric
   *
   * @throws {OilPriceAPIError} If API request fails
   * @throws {AuthenticationError} If API key is invalid
   *
   * @example
   * ```typescript
   * const summary = await client.drilling.summary();
   * summary.forEach(metric => {
   *   console.log(`${metric.metric}: ${metric.total}`);
   *   if (metric.change_percent) {
   *     console.log(`  Change: ${metric.change_percent}%`);
   *   }
   * });
   * ```
   */
  async summary(): Promise<DrillingSummary[]> {
    const response = await this.client["request"]<
      DrillingSummary[] | { summary: DrillingSummary[] }
    >("/v1/drilling-intelligence/summary", {});

    return Array.isArray(response) ? response : response.summary;
  }

  /**
   * Drilling activity trends.
   *
   * @deprecated The API has no `/v1/drilling-intelligence/trends` route; every
   * call returned HTTP 404 (#125). Use {@link summary} for the current
   * aggregate, or {@link completions} / {@link wellsDrilled} /
   * {@link ducWells} for basin-level series. Removed in the next major.
   *
   * @throws {OilPriceAPIError} Always, with code `ENDPOINT_NOT_AVAILABLE`.
   */
  async trends(): Promise<DrillingTrend[]> {
    throw new OilPriceAPIError(
      "client.drilling.trends() is not supported: the API has no drilling trends endpoint. " +
        "Use client.drilling.summary(), or completions() / wellsDrilled() / ducWells() for basin-level data.",
      undefined,
      "ENDPOINT_NOT_AVAILABLE",
    );
  }

  /**
   * Get frac spread data
   *
   * Returns active frac spread counts by basin.
   *
   * @returns Array of frac spread data by basin
   *
   * @throws {OilPriceAPIError} If API request fails
   * @throws {AuthenticationError} If API key is invalid
   *
   * @example
   * ```typescript
   * const fracSpreads = await client.drilling.fracSpreads();
   * fracSpreads.forEach(spread => {
   *   console.log(`${spread.basin}: ${spread.active_spreads} spreads`);
   * });
   * ```
   */
  async fracSpreads(): Promise<FracSpreadData[]> {
    const response = await this.client["request"]<
      FracSpreadData[] | { data: FracSpreadData[] }
    >("/v1/drilling-intelligence/frac-spreads", {});

    return Array.isArray(response) ? response : response.data;
  }

  /**
   * Get well permit data
   *
   * Returns well permits issued by state and basin.
   *
   * @returns Array of well permit data
   *
   * @throws {OilPriceAPIError} If API request fails
   * @throws {AuthenticationError} If API key is invalid
   *
   * @example
   * ```typescript
   * const permits = await client.drilling.wellPermits();
   * permits.forEach(permit => {
   *   console.log(`${permit.state}: ${permit.permits} permits`);
   * });
   * ```
   */
  async wellPermits(): Promise<WellPermitData[]> {
    const response = await this.client["request"]<
      WellPermitData[] | { data: WellPermitData[] }
    >("/v1/drilling-intelligence/well-permits", {});

    return Array.isArray(response) ? response : response.data;
  }

  /**
   * Get DUC well data
   *
   * Returns drilled but uncompleted (DUC) well counts by basin.
   *
   * @returns Array of DUC well data
   *
   * @throws {OilPriceAPIError} If API request fails
   * @throws {AuthenticationError} If API key is invalid
   *
   * @example
   * ```typescript
   * const ducWells = await client.drilling.ducWells();
   * ducWells.forEach(duc => {
   *   console.log(`${duc.basin}: ${duc.duc_count} DUC wells`);
   * });
   * ```
   */
  async ducWells(): Promise<DUCWellData[]> {
    const response = await this.client["request"]<
      DUCWellData[] | { data: DUCWellData[] }
    >("/v1/drilling-intelligence/duc-wells", {});

    return Array.isArray(response) ? response : response.data;
  }

  /**
   * Get well completion data
   *
   * Returns well completion counts by basin.
   *
   * @returns Array of completion data
   *
   * @throws {OilPriceAPIError} If API request fails
   * @throws {AuthenticationError} If API key is invalid
   *
   * @example
   * ```typescript
   * const completions = await client.drilling.completions();
   * completions.forEach(comp => {
   *   console.log(`${comp.basin}: ${comp.completions} completions`);
   * });
   * ```
   */
  async completions(): Promise<CompletionData[]> {
    const response = await this.client["request"]<
      CompletionData[] | { data: CompletionData[] }
    >("/v1/drilling-intelligence/completions", {});

    return Array.isArray(response) ? response : response.data;
  }

  /**
   * Get wells drilled data
   *
   * Returns wells drilled counts by basin.
   *
   * @returns Array of wells drilled data
   *
   * @throws {OilPriceAPIError} If API request fails
   * @throws {AuthenticationError} If API key is invalid
   *
   * @example
   * ```typescript
   * const drilled = await client.drilling.wellsDrilled();
   * drilled.forEach(data => {
   *   console.log(`${data.basin}: ${data.wells_drilled} wells drilled`);
   * });
   * ```
   */
  async wellsDrilled(): Promise<WellsDrilledData[]> {
    const response = await this.client["request"]<
      WellsDrilledData[] | { data: WellsDrilledData[] }
    >("/v1/drilling-intelligence/wells-drilled", {});

    return Array.isArray(response) ? response : response.data;
  }

  /**
   * Basin-specific drilling intelligence.
   *
   * @deprecated The API has no `/v1/drilling-intelligence/basin/{name}` route;
   * every call returned HTTP 404 (#125). Basin-level values are returned in the
   * `by_basin` maps of {@link completions}, {@link wellsDrilled},
   * {@link ducWells} and {@link fracSpreads}. Removed in the next major.
   *
   * @throws {OilPriceAPIError} Always, with code `ENDPOINT_NOT_AVAILABLE`.
   */
  async basin(_name: string): Promise<BasinDrillingData> {
    throw new OilPriceAPIError(
      "client.drilling.basin() is not supported: the API has no per-basin endpoint. " +
        "Read the by_basin maps from completions(), wellsDrilled(), ducWells() or fracSpreads().",
      undefined,
      "ENDPOINT_NOT_AVAILABLE",
    );
  }

}
