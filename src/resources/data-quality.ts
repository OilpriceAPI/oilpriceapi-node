/**
 * Data Quality Resource
 *
 * Access data quality metrics, reports, and monitoring for commodity price data.
 */

import type { OilPriceAPI } from "../client.js";

/**
 * Data quality summary
 */
export interface DataQualitySummary {
  /** Overall quality score (0-100) */
  overall_score: number;
  /** Total number of data sources monitored */
  sources_monitored: number;
  /** Number of sources with issues */
  sources_with_issues: number;
  /** Last update timestamp */
  last_updated: string;
  /** Quality breakdown by category */
  breakdown: {
    /** Completeness score (0-100) */
    completeness: number;
    /** Timeliness score (0-100) */
    timeliness: number;
    /** Accuracy score (0-100) */
    accuracy: number;
    /** Consistency score (0-100) */
    consistency: number;
  };
  /** Recent alerts */
  recent_alerts?: Array<{
    /** Alert severity */
    severity: "critical" | "warning" | "info";
    /** Alert message */
    message: string;
    /** ISO timestamp */
    timestamp: string;
  }>;
}

/**
 * Data quality report metadata
 */
export interface DataQualityReportMeta {
  /** Report code */
  code: string;
  /** Report name */
  name: string;
  /** Report type */
  type: string;
  /** Data source or commodity covered */
  scope: string;
  /** Last generated timestamp */
  last_generated: string;
  /** Report status */
  status: "healthy" | "warning" | "critical";
}

/**
 * Detailed data quality report
 */
export interface DataQualityReport {
  /** Report code */
  code: string;
  /** Report name */
  name: string;
  /** Data source or commodity */
  scope: string;
  /** Report period */
  period: {
    /** Start date */
    start: string;
    /** End date */
    end: string;
  };
  /** Quality metrics */
  metrics: {
    /** Completeness (0-100) */
    completeness: number;
    /** Timeliness (0-100) */
    timeliness: number;
    /** Accuracy (0-100) */
    accuracy: number;
    /** Consistency (0-100) */
    consistency: number;
    /** Missing data points */
    missing_points?: number;
    /** Late updates */
    late_updates?: number;
    /** Anomalies detected */
    anomalies?: number;
  };
  /** Issues found */
  issues?: Array<{
    /** Issue severity */
    severity: "critical" | "warning" | "info";
    /** Issue description */
    description: string;
    /** Affected data points */
    affected_points?: number;
    /** Detection timestamp */
    detected_at: string;
  }>;
  /** Recommendations */
  recommendations?: string[];
  /** Generated timestamp */
  generated_at: string;
}

/**
 * Data Quality Resource
 *
 * Monitor data quality metrics and access detailed quality reports for
 * commodity price data sources.
 *
 * @example
 * ```typescript
 * import { OilPriceAPI } from 'oilpriceapi';
 *
 * const client = new OilPriceAPI({ apiKey: 'your_key' });
 *
 * // Get quality summary
 * const summary = await client.dataQuality.summary();
 * console.log(`Overall quality: ${summary.overall_score}/100`);
 * console.log(`Sources monitored: ${summary.sources_monitored}`);
 *
 * // Get all reports
 * const reports = await client.dataQuality.reports();
 * reports.forEach(report => {
 *   console.log(`${report.name}: ${report.status}`);
 * });
 * ```
 */
export class DataQualityResource {
  constructor(private client: OilPriceAPI) {}

  /**
   * Get data quality summary
   *
   * Returns overall data quality metrics and recent alerts.
   *
   * @returns Data quality summary
   *
   * @throws {OilPriceAPIError} If API request fails
   * @throws {AuthenticationError} If API key is invalid
   *
   * @example
   * ```typescript
   * const summary = await client.dataQuality.summary();
   *
   * console.log(`Overall score: ${summary.overall_score}/100`);
   * console.log(`Completeness: ${summary.breakdown.completeness}%`);
   * console.log(`Timeliness: ${summary.breakdown.timeliness}%`);
   * console.log(`Accuracy: ${summary.breakdown.accuracy}%`);
   * console.log(`Consistency: ${summary.breakdown.consistency}%`);
   *
   * if (summary.recent_alerts && summary.recent_alerts.length > 0) {
   *   console.log('\nRecent Alerts:');
   *   summary.recent_alerts.forEach(alert => {
   *     console.log(`[${alert.severity.toUpperCase()}] ${alert.message}`);
   *   });
   * }
   * ```
   */
  async summary(): Promise<DataQualitySummary> {
    return this.client["request"]<DataQualitySummary>(
      "/v1/data-quality/summary",
      {},
    );
  }

  /**
   * Get all data quality reports
   *
   * Returns metadata for all available quality reports.
   *
   * @returns Array of report metadata
   *
   * @throws {OilPriceAPIError} If API request fails
   * @throws {AuthenticationError} If API key is invalid
   *
   * @example
   * ```typescript
   * const reports = await client.dataQuality.reports();
   *
   * console.log(`${reports.length} quality reports available:\n`);
   * reports.forEach(report => {
   *   console.log(`${report.name}`);
   *   console.log(`  Code: ${report.code}`);
   *   console.log(`  Scope: ${report.scope}`);
   *   console.log(`  Status: ${report.status}`);
   *   console.log(`  Last generated: ${report.last_generated}\n`);
   * });
   * ```
   */
  async reports(): Promise<DataQualityReportMeta[]> {
    const response = await this.client["request"]<
      DataQualityReportMeta[] | { reports: DataQualityReportMeta[] }
    >("/v1/data-quality/reports", {});

    return Array.isArray(response) ? response : response.reports;
  }

  /**
   * Get detailed data quality report
   *
   * Returns comprehensive quality analysis for a specific source or commodity.
   *
   * @param code - Report code (e.g., "WTI_USD", "BRENT_CRUDE_USD", "EIA")
   * @returns Detailed quality report
   *
   * @throws {NotFoundError} If report code not found
   * @throws {OilPriceAPIError} If API request fails
   *
   * @example
   * ```typescript
   * const report = await client.dataQuality.report('WTI_USD');
   *
   * console.log(`Report: ${report.name}`);
   * console.log(`Scope: ${report.scope}`);
   * console.log(`Period: ${report.period.start} to ${report.period.end}\n`);
   *
   * console.log('Metrics:');
   * console.log(`  Completeness: ${report.metrics.completeness}%`);
   * console.log(`  Timeliness: ${report.metrics.timeliness}%`);
   * console.log(`  Accuracy: ${report.metrics.accuracy}%`);
   * console.log(`  Consistency: ${report.metrics.consistency}%`);
   *
   * if (report.issues && report.issues.length > 0) {
   *   console.log('\nIssues:');
   *   report.issues.forEach(issue => {
   *     console.log(`  [${issue.severity.toUpperCase()}] ${issue.description}`);
   *   });
   * }
   *
   * if (report.recommendations && report.recommendations.length > 0) {
   *   console.log('\nRecommendations:');
   *   report.recommendations.forEach(rec => {
   *     console.log(`  - ${rec}`);
   *   });
   * }
   * ```
   */
  async report(code: string): Promise<DataQualityReport> {
    if (!code || typeof code !== "string") {
      throw new Error("Report code must be a non-empty string");
    }

    return this.client["request"]<DataQualityReport>(
      `/v1/data-quality/reports/${code}`,
      {},
    );
  }
}
