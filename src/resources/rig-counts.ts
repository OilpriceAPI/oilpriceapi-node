/**
 * Rig Counts Resource
 *
 * Baker Hughes rig counts by region (United States, Canada, International)
 * from `/v1/rig-counts`. For basin, state and oil/gas breakdowns use
 * `client.ei.rigCounts`, which serves the full weekly report.
 *
 * Every type here was taken from live production responses on 2026-09-13
 * (#108), not from documentation. The previous types described fields —
 * `total`, `oil`, `gas`, `timestamp`, `week_change` — that no route sends, and
 * `historical()` returned `undefined`.
 */

import type { OilPriceAPI } from "../client.js";
import { OilPriceAPIError, ValidationError } from "../errors.js";

/** Rig-count series codes the routes accept. */
export type RigCountCode = "US_RIG_COUNT" | "CANADA_RIG_COUNT" | "INTERNATIONAL_RIG_COUNT";

/** Region names used as keys by {@link RigCountsResource.summary}. */
export type RigCountRegionName = "United States" | "Canada" | "International";

const RIG_COUNT_CODES: readonly RigCountCode[] = [
  "US_RIG_COUNT",
  "CANADA_RIG_COUNT",
  "INTERNATIONAL_RIG_COUNT",
];

/** Rows `/v1/rig-counts/historical` serves per page at most. */
export const RIG_COUNT_MAX_PER_PAGE = 100;

/**
 * One rig-count observation, as served by every `/v1/rig-counts` route.
 *
 * `source_date` is the date Baker Hughes published the figure;
 * `collected_at` is when OilPriceAPI stored it. They can be weeks apart for
 * the monthly International series.
 */
export interface RigCountObservation {
  /** Series code, e.g. `US_RIG_COUNT` */
  code: RigCountCode | (string & {});
  /** Region name, e.g. `United States` */
  region: RigCountRegionName | (string & {});
  /** Number of active rigs */
  count: number;
  /** Always `COUNT` in observed responses */
  currency: string;
  /** Always `rigs` */
  unit: string;
  /** Public source label, e.g. `market_reporting` */
  source: string | null;
  /** ISO timestamp the row was created */
  created_at: string;
  /** ISO timestamp the value was last collected */
  collected_at: string;
  /** ISO timestamp of the source observation, or null for legacy rows */
  observed_at: string | null;
  /** Source publication date (YYYY-MM-DD), or null for legacy rows */
  source_date: string | null;
  /** Observation time as `YYYY-MM-DD HH:MM:SS UTC` */
  formatted_date: string;
}

/**
 * @deprecated Described `total`, `oil`, `gas` and `timestamp`, none of which
 * the API sends (#108). Now an alias of {@link RigCountObservation}; the value
 * is `count`.
 */
export type RigCountData = RigCountObservation;

/**
 * @deprecated Described `date` and `total`, which the API never sent, and
 * `historical()` never returned it (#108). Now an alias of
 * {@link RigCountObservation}; `historical()` returns {@link RigCountsPage}.
 */
export type HistoricalRigCountData = RigCountObservation;

/** Response of `GET /v1/rig-counts/current`. */
export interface CurrentRigCounts {
  /** Latest observation for each region that has one */
  rig_counts: RigCountObservation[];
  summary: {
    total_us_rigs: number;
    total_canada_rigs: number;
    total_international_rigs: number;
    /** Latest collection time across regions */
    last_updated: string | null;
    /** Latest source publication date across regions */
    source_date: string | null;
  };
}

/** Pagination block of {@link RigCountsPage}. */
export interface RigCountPagination {
  page: number;
  per_page: number;
  /** Rows matching the query across ALL pages */
  total: number;
  total_pages: number;
}

/**
 * What the historical window asked for versus what is held.
 *
 * `complete` is false when the series starts after `from`, so a short series
 * cannot pass for a full one.
 */
export interface RigCountPeriodCoverage {
  /** Requested start (YYYY-MM-DD) */
  from: string;
  /** Requested end (YYYY-MM-DD) */
  to: string;
  /** The relative `period` sent, or null */
  relative: string | null;
  /** First held observation inside the window */
  coverage_from: string | null;
  /** Last held observation inside the window */
  coverage_to: string | null;
  /** Observations inside the window, across all pages */
  observations: number;
  /** Earliest observation held for the series */
  earliest_available: string | null;
  complete: boolean;
}

/** Response of `GET /v1/rig-counts/historical`: one page, newest first. */
export interface RigCountsPage {
  rig_counts: RigCountObservation[];
  pagination: RigCountPagination;
  period: RigCountPeriodCoverage;
}

/** Options for {@link RigCountsResource.latest}. */
export interface LatestRigCountOptions {
  /** Series to read. @default "US_RIG_COUNT" */
  code?: RigCountCode;
}

/**
 * Options for {@link RigCountsResource.historical}.
 *
 * Use either `period` or `startDate`/`endDate`, not both. With neither, the
 * route serves the last six months.
 */
export interface HistoricalRigCountOptions {
  /** Start date (YYYY-MM-DD), sent as `by_period[from]` */
  startDate?: string;
  /** End date (YYYY-MM-DD), sent as `by_period[to]` */
  endDate?: string;
  /** Relative window up to 15 years, e.g. `16w`, `52w`, `5y` */
  period?: string;
  /** 1-based page number */
  page?: number;
  /** Rows per page, clamped to 1-{@link RIG_COUNT_MAX_PER_PAGE} */
  perPage?: number;
  /** Series to read. @default "US_RIG_COUNT" */
  code?: RigCountCode;
}

/** A week-over-week or year-over-year change in {@link RigCountSummary}. */
export interface RigCountChange {
  absolute: number;
  percentage: number;
}

/**
 * Response of `GET /v1/rig-counts/summary`.
 *
 * Keyed by region name. A region with no observation, or with no observation
 * a week or a year earlier, is absent from the corresponding map.
 */
export interface RigCountSummary {
  current_totals: Partial<Record<RigCountRegionName, number>>;
  weekly_changes: Partial<Record<RigCountRegionName, RigCountChange>>;
  yearly_changes: Partial<Record<RigCountRegionName, RigCountChange>>;
  last_updated: string | null;
  source_date: string | null;
}

/** Periods `/v1/rig-counts/trends` honours. Anything else becomes six months server-side. */
export type RigCountTrendPeriod =
  "1month" | "1m" | "3months" | "3m" | "6months" | "6m" | "1year" | "1y" | "2years" | "2y";

const TREND_PERIODS: readonly RigCountTrendPeriod[] = [
  "1month",
  "1m",
  "3months",
  "3m",
  "6months",
  "6m",
  "1year",
  "1y",
  "2years",
  "2y",
];

/** Options for {@link RigCountsResource.trends}. */
export interface RigCountTrendOptions {
  /** @default "6months" */
  period?: RigCountTrendPeriod;
  /** @default "US_RIG_COUNT" */
  region?: RigCountCode;
}

/** Trend metrics computed over the window. */
export interface RigCountTrendMetrics {
  trend_direction: "increasing" | "decreasing" | "stable";
  average_count: number;
  min_count: number;
  max_count: number;
  /** Observations in the window */
  total_data_points: number;
  /** Coefficient of variation, percent */
  volatility: number;
}

/** Response of `GET /v1/rig-counts/trends`. */
export interface RigCountTrend {
  /** Series code the trend was computed for */
  region: string;
  /** Period as sent */
  period: string;
  /**
   * Metrics over the window, or `{}` when it holds fewer than two
   * observations. Narrow with `"trend_direction" in trend.trend_data`.
   */
  trend_data: RigCountTrendMetrics | Record<string, never>;
  /** Up to the 50 most recent observations in the window */
  rig_counts: RigCountObservation[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function describeShape(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "an array";
  if (isRecord(value)) {
    const keys = Object.keys(value);
    return keys.length === 0 ? "an empty object" : `an object with keys [${keys.join(", ")}]`;
  }
  return typeof value;
}

/**
 * Return `response` as `T` only if `valid` holds; otherwise raise
 * `unexpected_response_shape` rather than hand back a value whose declared
 * fields are absent.
 */
function expectShape<T>(response: unknown, endpoint: string, expected: string, valid: boolean): T {
  if (valid) return response as T;
  throw new OilPriceAPIError(
    `Unexpected response shape from ${endpoint}: expected ${expected}, received ` +
      `${describeShape(response)}. The SDK will not guess at a response it cannot map. ` +
      `Please report this at https://github.com/OilpriceAPI/oilpriceapi-node/issues`,
    undefined,
    "unexpected_response_shape",
    { rawBody: response },
  );
}

const isObservation = (value: unknown): boolean =>
  isRecord(value) && typeof value.count === "number" && typeof value.code === "string";

const isObservationList = (value: unknown): boolean =>
  Array.isArray(value) && value.every(isObservation);

function requireCode(code: unknown, label: string): RigCountCode {
  if (!RIG_COUNT_CODES.includes(code as RigCountCode)) {
    throw new ValidationError(`${label} must be one of ${RIG_COUNT_CODES.join(", ")}`);
  }
  return code as RigCountCode;
}

/**
 * Rig Counts Resource
 *
 * @example
 * ```typescript
 * import { OilPriceAPI } from 'oilpriceapi';
 *
 * const client = new OilPriceAPI({ apiKey: 'your_key' });
 *
 * const latest = await client.rigCounts.latest();
 * console.log(`${latest.region}: ${latest.count} ${latest.unit} (${latest.source_date})`);
 *
 * const summary = await client.rigCounts.summary();
 * console.log(`US week-over-week: ${summary.weekly_changes['United States']?.absolute}`);
 * ```
 */
export class RigCountsResource {
  constructor(private client: OilPriceAPI) {}

  /**
   * Get the latest observation for one series
   *
   * @param options - Series to read (defaults to US)
   * @returns The latest observation; the rig count is `count`
   *
   * @throws {NotFoundError} If the series has no data
   * @throws {OilPriceAPIError} `unexpected_response_shape` if the response cannot be mapped
   *
   * @example
   * ```typescript
   * const latest = await client.rigCounts.latest();
   * console.log(`Total rigs: ${latest.count} as of ${latest.source_date}`);
   *
   * const canada = await client.rigCounts.latest({ code: 'CANADA_RIG_COUNT' });
   * ```
   */
  async latest(options?: LatestRigCountOptions): Promise<RigCountObservation> {
    const params: Record<string, string> = {};
    if (options?.code !== undefined) params.by_code = requireCode(options.code, "code");

    const endpoint = "/v1/rig-counts/latest";
    const response = await this.client["request"]<unknown>(endpoint, params);
    return expectShape(
      response,
      endpoint,
      "a rig-count observation with a numeric count",
      isObservation(response),
    );
  }

  /**
   * Get the latest observation for every region
   *
   * @returns The per-region observations and a totals summary
   *
   * @example
   * ```typescript
   * const current = await client.rigCounts.current();
   * console.log(`US: ${current.summary.total_us_rigs}, Canada: ${current.summary.total_canada_rigs}`);
   * ```
   */
  async current(): Promise<CurrentRigCounts> {
    const endpoint = "/v1/rig-counts/current";
    const response = await this.client["request"]<unknown>(endpoint, {});
    return expectShape(
      response,
      endpoint,
      'an object with "rig_counts" and "summary"',
      isRecord(response) && isObservationList(response.rig_counts) && isRecord(response.summary),
    );
  }

  /**
   * Get one page of historical observations, newest first
   *
   * Returns the page envelope, not a bare array: `pagination.total` says how
   * many rows exist beyond this page, and `period.complete` says whether the
   * held series covers the whole window.
   *
   * @param options - Window, paging and series
   * @returns One page of observations
   *
   * @throws {ValidationError} If `period` is combined with a date range
   * @throws {OilPriceAPIError} HTTP 422 for an unsupported period or range
   *
   * @example
   * ```typescript
   * const page = await client.rigCounts.historical({ startDate: '2025-01-01', endDate: '2025-12-31' });
   * page.rig_counts.forEach(point => console.log(`${point.source_date}: ${point.count} rigs`));
   * console.log(`page ${page.pagination.page} of ${page.pagination.total_pages}`);
   * ```
   */
  async historical(options?: HistoricalRigCountOptions): Promise<RigCountsPage> {
    const params: Record<string, string> = {};
    if (
      options?.period !== undefined &&
      (options.startDate !== undefined || options.endDate !== undefined)
    ) {
      throw new ValidationError("Use either period or startDate/endDate, not both");
    }
    // The controller reads nested by_period[from] / by_period[to], not flat
    // start_date / end_date (which were silently ignored by earlier SDKs).
    if (options?.startDate) params["by_period[from]"] = options.startDate;
    if (options?.endDate) params["by_period[to]"] = options.endDate;
    if (options?.period) params.period = options.period;
    if (options?.page !== undefined && Number.isFinite(options.page)) {
      params.page = String(Math.max(1, Math.floor(options.page)));
    }
    if (options?.perPage !== undefined && Number.isFinite(options.perPage)) {
      params.per_page = String(
        Math.min(Math.max(1, Math.floor(options.perPage)), RIG_COUNT_MAX_PER_PAGE),
      );
    }
    if (options?.code !== undefined) params.by_code = requireCode(options.code, "code");

    const endpoint = "/v1/rig-counts/historical";
    const response = await this.client["request"]<unknown>(endpoint, params);
    return expectShape(
      response,
      endpoint,
      'a page with "rig_counts", "pagination" and "period"',
      isRecord(response) &&
        isObservationList(response.rig_counts) &&
        isRecord(response.pagination) &&
        typeof response.pagination.total === "number" &&
        isRecord(response.period),
    );
  }

  /**
   * Get trend metrics for one series over a period
   *
   * @param options - A period, or `{ period, region }`
   * @returns Trend metrics and up to 50 recent observations
   *
   * @throws {ValidationError} For a period or region the route does not honour.
   *   The route answers an unrecognised period with HTTP 200 and six months of
   *   data labelled with the requested period, so the SDK refuses it locally.
   *
   * @example
   * ```typescript
   * const trend = await client.rigCounts.trends({ period: '3m', region: 'CANADA_RIG_COUNT' });
   * if ('trend_direction' in trend.trend_data) {
   *   console.log(`${trend.trend_data.trend_direction}, avg ${trend.trend_data.average_count}`);
   * }
   * ```
   */
  async trends(options?: RigCountTrendPeriod | RigCountTrendOptions): Promise<RigCountTrend> {
    const { period, region } =
      typeof options === "string" ? { period: options, region: undefined } : (options ?? {});
    const params: Record<string, string> = {};
    if (period !== undefined) {
      if (!TREND_PERIODS.includes(period)) {
        throw new ValidationError(
          `Unsupported trends period ${JSON.stringify(period)}. Use one of ${TREND_PERIODS.join(", ")}`,
        );
      }
      params.period = period;
    }
    if (region !== undefined) params.region = requireCode(region, "region");

    const endpoint = "/v1/rig-counts/trends";
    const response = await this.client["request"]<unknown>(endpoint, params);
    return expectShape(
      response,
      endpoint,
      'an object with "trend_data" and "rig_counts"',
      isRecord(response) && isRecord(response.trend_data) && isObservationList(response.rig_counts),
    );
  }

  /**
   * Get current totals with week-over-week and year-over-year changes
   *
   * @returns Totals and changes keyed by region name
   *
   * @example
   * ```typescript
   * const summary = await client.rigCounts.summary();
   * const us = summary.weekly_changes['United States'];
   * if (us) console.log(`US: ${us.absolute} rigs (${us.percentage}%) week over week`);
   * ```
   */
  async summary(): Promise<RigCountSummary> {
    const endpoint = "/v1/rig-counts/summary";
    const response = await this.client["request"]<unknown>(endpoint, {});
    return expectShape(
      response,
      endpoint,
      'an object with "current_totals", "weekly_changes" and "yearly_changes"',
      isRecord(response) &&
        isRecord(response.current_totals) &&
        isRecord(response.weekly_changes) &&
        isRecord(response.yearly_changes),
    );
  }
}
