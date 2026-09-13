/**
 * Energy Intelligence - Rig Counts Resource
 *
 * Access Baker Hughes rig count data with basin, state, and historical breakdowns.
 */

import type { OilPriceAPI } from "../../client.js";
import { ValidationError } from "../../errors.js";
import { unwrapCollection } from "./envelope.js";

/**
 * One row of `GET /v1/ei/rig_counts`: a published weekly report's summary.
 *
 * Carries no rig totals — fetch the full report with `get(id)` for those.
 * Verified against live production 2026-09-13 (#104).
 */
export interface RigCountReportSummary {
  /** Report ID, accepted by `get(id)` */
  id: string;
  /** Report date (YYYY-MM-DD) */
  report_date: string;
  /** Publication status, e.g. `published` */
  status: string;
  /** Human-readable headline, e.g. `US Rig Count: 588 (0 WoW)` */
  summary: string;
}

/** US rig totals inside a {@link RigCountReport}. */
export interface RigCountTotals {
  total_rigs: number;
  oil_rigs: number;
  gas_rigs: number;
  misc_rigs: number;
  /** Change in total rigs from the previous week */
  week_over_week: number;
}

/** Rig count and weekly change for one region inside a {@link RigCountReport}. */
export interface RigCountRegionChange {
  count: number;
  /** Change from the previous week */
  wow: number;
}

/** A state entry in {@link RigCountReport.top_states}. */
export interface RigCountTopState {
  /** State slug, e.g. `texas`, `new_mexico` */
  state: string;
  count: number;
  /** Change from the previous week */
  wow: number;
}

/** Rigs by drilling trajectory inside a {@link RigCountReport}. */
export interface RigCountDrillingType {
  vertical: number;
  horizontal: number;
  directional: number;
}

/**
 * A full weekly Baker Hughes report, as returned by
 * `GET /v1/ei/rig_counts/latest` and `GET /v1/ei/rig_counts/:id`.
 *
 * The totals are nested under `us_total`; there is no top-level `total_rigs`.
 * Verified against live production 2026-09-13 (#104).
 */
export interface RigCountReport {
  /** Report ID */
  id: string;
  /** Report date (YYYY-MM-DD) */
  report_date: string;
  /** Upstream source, e.g. `baker_hughes` */
  source: string;
  /** ISO timestamp the report was last updated */
  last_updated: string;
  /** US totals */
  us_total: RigCountTotals;
  /** Rig counts keyed by basin slug, e.g. `permian`, `haynesville` */
  basins: Record<string, RigCountRegionChange>;
  /** Highest-count states */
  top_states: RigCountTopState[];
  /** Rigs by drilling trajectory */
  drilling_type: RigCountDrillingType;
}

/**
 * @deprecated Described fields (`total_rigs`, `date`, `timestamp`, `week`)
 * that no EI rig-count endpoint returns, and was used for two different
 * payloads (#104). Now an alias of {@link RigCountReport}, the shape
 * `latest()` and `get(id)` actually return; `list()` returns
 * {@link RigCountReportSummary}.
 */
export type RigCountRecord = RigCountReport;

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
 * // Get the latest weekly report — totals are nested under us_total
 * const latest = await client.ei.rigCounts.latest();
 * console.log(`Total rigs: ${latest.us_total.total_rigs} (${latest.report_date})`);
 *
 * // Get by basin
 * const basins = await client.ei.rigCounts.byBasin();
 * basins.forEach(b => console.log(`${b.region}: ${b.count} rigs`));
 * ```
 */
export class EIRigCountsResource {
  constructor(private client: OilPriceAPI) {}

  /**
   * List published weekly reports
   *
   * Each row is a summary without rig totals; pass its `id` to {@link get}
   * for the full report.
   *
   * @returns Array of report summaries
   *
   * @throws {OilPriceAPIError} If API request fails
   */
  async list(): Promise<RigCountReportSummary[]> {
    const response = await this.client["request"]<unknown>("/v1/ei/rig_counts", {});

    return unwrapCollection<RigCountReportSummary>(response, "rig_counts", "/v1/ei/rig_counts");
  }

  /**
   * Get a specific weekly report
   *
   * @param id - Report ID, as returned by {@link list}
   * @returns The full report — the same shape as {@link latest}
   *
   * @throws {NotFoundError} If record not found
   */
  async get(id: string): Promise<RigCountReport> {
    if (!id || typeof id !== "string") {
      throw new ValidationError("Record ID must be a non-empty string");
    }

    return this.client["request"]<RigCountReport>(`/v1/ei/rig_counts/${encodeURIComponent(id)}`, {});
  }

  /**
   * Get the latest weekly report
   *
   * @returns The full report; US totals are under `us_total`
   */
  async latest(): Promise<RigCountReport> {
    return this.client["request"]<RigCountReport>("/v1/ei/rig_counts/latest", {});
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
