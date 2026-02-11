/**
 * Drilling Intelligence Resource
 *
 * Access US onshore drilling activity data including rig counts, well permits,
 * frac spreads, DUC wells, completions, and production trends by basin.
 */

import type { OilPriceAPI } from "../client.js";

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
 * // Get drilling trends
 * const trends = await client.drilling.trends();
 * trends.forEach(trend => {
 *   console.log(`${trend.date}: ${trend.metric} = ${trend.value}`);
 * });
 *
 * // Get basin-specific data
 * const permian = await client.drilling.basin('Permian');
 * console.log(`Permian rigs: ${permian.active_rigs}`);
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
   * Get drilling activity trends
   *
   * Returns time series data showing trends in drilling metrics.
   *
   * @returns Array of drilling trend data points
   *
   * @throws {OilPriceAPIError} If API request fails
   * @throws {AuthenticationError} If API key is invalid
   *
   * @example
   * ```typescript
   * const trends = await client.drilling.trends();
   * trends.forEach(point => {
   *   console.log(`${point.date}: ${point.metric} = ${point.value} (${point.trend})`);
   * });
   * ```
   */
  async trends(): Promise<DrillingTrend[]> {
    const response = await this.client["request"]<
      DrillingTrend[] | { trends: DrillingTrend[] }
    >("/v1/drilling-intelligence/trends", {});

    return Array.isArray(response) ? response : response.trends;
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
   * Get basin-specific drilling intelligence
   *
   * Returns comprehensive drilling data for a specific basin.
   *
   * @param name - Basin name (e.g., "Permian", "Eagle Ford", "Bakken")
   * @returns Basin drilling intelligence data
   *
   * @throws {NotFoundError} If basin not found
   * @throws {OilPriceAPIError} If API request fails
   * @throws {AuthenticationError} If API key is invalid
   *
   * @example
   * ```typescript
   * const permian = await client.drilling.basin('Permian');
   * console.log(`Permian Basin as of ${permian.as_of_date}:`);
   * console.log(`  Active rigs: ${permian.active_rigs}`);
   * console.log(`  Frac spreads: ${permian.frac_spreads}`);
   * console.log(`  DUC wells: ${permian.duc_wells}`);
   * ```
   */
  async basin(name: string): Promise<BasinDrillingData> {
    if (!name || typeof name !== "string") {
      throw new Error("Basin name must be a non-empty string");
    }

    return this.client["request"]<BasinDrillingData>(
      `/v1/drilling-intelligence/basin/${name}`,
      {},
    );
  }
}
