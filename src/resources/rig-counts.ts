/**
 * Rig Counts Resource
 *
 * Access Baker Hughes rig count data including current counts, historical trends,
 * and breakdowns by basin, state, and rig type.
 */

import type { OilPriceAPI } from "../client.js";

/**
 * Rig count data
 */
export interface RigCountData {
  /** Total rig count */
  total: number;
  /** Oil rigs */
  oil?: number;
  /** Gas rigs */
  gas?: number;
  /** Miscellaneous rigs */
  misc?: number;
  /** Breakdown by region/state */
  breakdown?: Record<string, number>;
  /** ISO timestamp when data was recorded */
  timestamp: string;
  /** Week-over-week change */
  change?: number;
  /** Year-over-year change */
  year_over_year_change?: number;
}

/**
 * Historical rig count data point
 */
export interface HistoricalRigCountData {
  /** Date in YYYY-MM-DD format */
  date: string;
  /** Total rig count */
  total: number;
  /** Oil rigs */
  oil?: number;
  /** Gas rigs */
  gas?: number;
  /** Miscellaneous rigs */
  misc?: number;
}

/**
 * Options for historical rig count query
 */
export interface HistoricalRigCountOptions {
  /** Start date in ISO 8601 format (YYYY-MM-DD) */
  startDate?: string;
  /** End date in ISO 8601 format (YYYY-MM-DD) */
  endDate?: string;
}

/**
 * Rig count trend data
 */
export interface RigCountTrend {
  /** Time period (e.g., "week", "month", "quarter", "year") */
  period: string;
  /** Average rig count */
  average: number;
  /** Minimum rig count */
  min: number;
  /** Maximum rig count */
  max: number;
  /** Overall trend direction */
  trend?: "up" | "down" | "flat";
  /** Percentage change */
  change_percent?: number;
}

/**
 * Rig count summary
 */
export interface RigCountSummary {
  /** Current total */
  current: number;
  /** Week-over-week change */
  week_change: number;
  /** Month-over-month change */
  month_change: number;
  /** Year-over-year change */
  year_change: number;
  /** Breakdown by category */
  breakdown: {
    oil: number;
    gas: number;
    misc?: number;
  };
  /** ISO timestamp */
  timestamp: string;
}

/**
 * Rig Counts Resource
 *
 * Access Baker Hughes rig count data including current counts, historical data,
 * trends, and summaries.
 *
 * @example
 * ```typescript
 * import { OilPriceAPI } from 'oilpriceapi';
 *
 * const client = new OilPriceAPI({ apiKey: 'your_key' });
 *
 * // Get latest rig count
 * const latest = await client.rigCounts.latest();
 * console.log(`Total rigs: ${latest.total}`);
 * console.log(`Oil: ${latest.oil}, Gas: ${latest.gas}`);
 *
 * // Get summary with changes
 * const summary = await client.rigCounts.summary();
 * console.log(`Week-over-week: ${summary.week_change}`);
 * console.log(`Year-over-year: ${summary.year_change}`);
 * ```
 */
export class RigCountsResource {
  constructor(private client: OilPriceAPI) {}

  /**
   * Get latest rig count data
   *
   * Returns the most recent Baker Hughes rig count.
   *
   * @returns Latest rig count data
   *
   * @throws {OilPriceAPIError} If API request fails
   * @throws {AuthenticationError} If API key is invalid
   *
   * @example
   * ```typescript
   * const latest = await client.rigCounts.latest();
   * console.log(`Total rigs: ${latest.total}`);
   * console.log(`Oil rigs: ${latest.oil}`);
   * console.log(`Gas rigs: ${latest.gas}`);
   * console.log(`Change: ${latest.change}`);
   * ```
   */
  async latest(): Promise<RigCountData> {
    return this.client["request"]<RigCountData>("/v1/rig-counts/latest", {});
  }

  /**
   * Get current rig count data
   *
   * Alias for latest(). Returns the most recent Baker Hughes rig count.
   *
   * @returns Current rig count data
   *
   * @throws {OilPriceAPIError} If API request fails
   * @throws {AuthenticationError} If API key is invalid
   *
   * @example
   * ```typescript
   * const current = await client.rigCounts.current();
   * console.log(`Total rigs: ${current.total}`);
   * ```
   */
  async current(): Promise<RigCountData> {
    return this.client["request"]<RigCountData>("/v1/rig-counts/current", {});
  }

  /**
   * Get historical rig count data
   *
   * Returns time series of rig counts.
   *
   * @param options - Date range filters
   * @returns Array of historical rig count data
   *
   * @throws {OilPriceAPIError} If API request fails
   * @throws {AuthenticationError} If API key is invalid
   *
   * @example
   * ```typescript
   * const history = await client.rigCounts.historical({
   *   startDate: '2024-01-01',
   *   endDate: '2024-12-31'
   * });
   *
   * history.forEach(point => {
   *   console.log(`${point.date}: ${point.total} rigs (${point.oil} oil, ${point.gas} gas)`);
   * });
   * ```
   */
  async historical(
    options?: HistoricalRigCountOptions,
  ): Promise<HistoricalRigCountData[]> {
    const params: Record<string, string> = {};
    if (options?.startDate) params.start_date = options.startDate;
    if (options?.endDate) params.end_date = options.endDate;

    const response = await this.client["request"]<
      HistoricalRigCountData[] | { data: HistoricalRigCountData[] }
    >("/v1/rig-counts/historical", params);

    return Array.isArray(response) ? response : response.data;
  }

  /**
   * Get rig count trend analysis
   *
   * Returns trend analysis for a specified time period.
   *
   * @param period - Time period (e.g., "week", "month", "quarter", "year")
   * @returns Trend analysis data
   *
   * @throws {OilPriceAPIError} If API request fails
   * @throws {AuthenticationError} If API key is invalid
   *
   * @example
   * ```typescript
   * const monthlyTrend = await client.rigCounts.trends('month');
   * console.log(`Monthly average: ${monthlyTrend.average}`);
   * console.log(`Trend: ${monthlyTrend.trend}`);
   * console.log(`Change: ${monthlyTrend.change_percent}%`);
   * ```
   */
  async trends(period?: string): Promise<RigCountTrend> {
    const params: Record<string, string> = {};
    if (period) params.period = period;

    return this.client["request"]<RigCountTrend>(
      "/v1/rig-counts/trends",
      params,
    );
  }

  /**
   * Get rig count summary
   *
   * Returns comprehensive summary including current count and changes
   * across multiple time periods.
   *
   * @returns Rig count summary
   *
   * @throws {OilPriceAPIError} If API request fails
   * @throws {AuthenticationError} If API key is invalid
   *
   * @example
   * ```typescript
   * const summary = await client.rigCounts.summary();
   * console.log(`Current: ${summary.current}`);
   * console.log(`Week-over-week: ${summary.week_change}`);
   * console.log(`Month-over-month: ${summary.month_change}`);
   * console.log(`Year-over-year: ${summary.year_change}`);
   * console.log(`Oil rigs: ${summary.breakdown.oil}`);
   * console.log(`Gas rigs: ${summary.breakdown.gas}`);
   * ```
   */
  async summary(): Promise<RigCountSummary> {
    return this.client["request"]<RigCountSummary>(
      "/v1/rig-counts/summary",
      {},
    );
  }
}
