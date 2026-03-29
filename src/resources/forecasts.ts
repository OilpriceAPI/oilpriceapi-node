/**
 * Forecasts Resource
 *
 * Access official price forecasts from EIA, IEA, and other agencies including
 * monthly outlooks, accuracy metrics, and historical archives.
 */

import type { OilPriceAPI } from "../client.js";
import { ValidationError } from "../errors.js";

/**
 * Monthly forecast data
 */
export interface MonthlyForecast {
  /** Forecast period (e.g., "2024-03", "2024-Q2") */
  period: string;
  /** Commodity code */
  commodity: string;
  /** Forecasted price */
  forecast_price: number;
  /** Lower bound of forecast range */
  lower_bound?: number;
  /** Upper bound of forecast range */
  upper_bound?: number;
  /** Forecast source (e.g., "EIA", "IEA") */
  source: string;
  /** ISO timestamp when forecast was published */
  published_at: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Forecast accuracy metrics
 */
export interface ForecastAccuracy {
  /** Commodity code */
  commodity?: string;
  /** Forecast source */
  source: string;
  /** Mean Absolute Percentage Error */
  mape: number;
  /** Root Mean Squared Error */
  rmse: number;
  /** Mean Error (bias) */
  mean_error?: number;
  /** Number of forecasts evaluated */
  sample_size: number;
  /** Time period evaluated */
  period_evaluated: string;
  /** ISO timestamp */
  timestamp: string;
}

/**
 * Archived forecast data
 */
export interface ArchivedForecast {
  /** Year of forecast */
  year: number;
  /** Month of forecast (1-12) */
  month?: number;
  /** Quarter of forecast (1-4) */
  quarter?: number;
  /** Commodity code */
  commodity: string;
  /** Forecasted price */
  forecast_price: number;
  /** Actual price (if available) */
  actual_price?: number;
  /** Forecast error */
  error?: number;
  /** Forecast source */
  source: string;
  /** ISO timestamp when forecast was published */
  published_at: string;
}

/**
 * Forecasts Resource
 *
 * Access official price forecasts from government agencies and research
 * organizations including EIA, IEA, and others.
 *
 * @example
 * ```typescript
 * import { OilPriceAPI } from 'oilpriceapi';
 *
 * const client = new OilPriceAPI({ apiKey: 'your_key' });
 *
 * // Get monthly forecasts
 * const forecasts = await client.forecasts.monthly();
 * forecasts.forEach(f => {
 *   console.log(`${f.period}: $${f.forecast_price} (${f.source})`);
 * });
 *
 * // Check forecast accuracy
 * const accuracy = await client.forecasts.accuracy();
 * console.log(`EIA MAPE: ${accuracy.mape}%`);
 * ```
 */
export class ForecastsResource {
  constructor(private client: OilPriceAPI) {}

  /**
   * Get monthly price forecasts
   *
   * Returns official monthly forecasts from EIA, IEA, and other agencies.
   *
   * @param commodity - Optional commodity code filter
   * @returns Array of monthly forecasts
   *
   * @throws {OilPriceAPIError} If API request fails
   * @throws {AuthenticationError} If API key is invalid
   *
   * @example
   * ```typescript
   * // Get all forecasts
   * const allForecasts = await client.forecasts.monthly();
   *
   * // Get WTI forecasts only
   * const wtiForecasts = await client.forecasts.monthly('WTI_USD');
   *
   * wtiForecasts.forEach(forecast => {
   *   console.log(`${forecast.period}: $${forecast.forecast_price}`);
   *   console.log(`  Range: $${forecast.lower_bound} - $${forecast.upper_bound}`);
   *   console.log(`  Source: ${forecast.source}`);
   * });
   * ```
   */
  async monthly(commodity?: string): Promise<MonthlyForecast[]> {
    const params: Record<string, string> = {};
    if (commodity) params.commodity = commodity;

    const response = await this.client["request"]<
      MonthlyForecast[] | { forecasts: MonthlyForecast[] }
    >("/v1/forecasts/monthly", params);

    return Array.isArray(response) ? response : response.forecasts;
  }

  /**
   * Get forecast accuracy metrics
   *
   * Returns historical accuracy measurements for forecast sources.
   *
   * @returns Forecast accuracy data
   *
   * @throws {OilPriceAPIError} If API request fails
   * @throws {AuthenticationError} If API key is invalid
   *
   * @example
   * ```typescript
   * const accuracy = await client.forecasts.accuracy();
   * console.log(`Source: ${accuracy.source}`);
   * console.log(`MAPE: ${accuracy.mape}%`);
   * console.log(`RMSE: ${accuracy.rmse}`);
   * console.log(`Sample size: ${accuracy.sample_size} forecasts`);
   * ```
   */
  async accuracy(): Promise<ForecastAccuracy> {
    return this.client["request"]<ForecastAccuracy>(
      "/v1/forecasts/accuracy",
      {},
    );
  }

  /**
   * Get archived forecasts
   *
   * Returns historical forecasts with actual outcomes for accuracy analysis.
   *
   * @param year - Optional year filter
   * @returns Array of archived forecasts
   *
   * @throws {OilPriceAPIError} If API request fails
   * @throws {AuthenticationError} If API key is invalid
   *
   * @example
   * ```typescript
   * // Get all archived forecasts
   * const archive = await client.forecasts.archive();
   *
   * // Get forecasts from specific year
   * const archive2024 = await client.forecasts.archive(2024);
   *
   * archive2024.forEach(forecast => {
   *   if (forecast.actual_price) {
   *     console.log(`${forecast.year}-${forecast.month}:`);
   *     console.log(`  Forecast: $${forecast.forecast_price}`);
   *     console.log(`  Actual: $${forecast.actual_price}`);
   *     console.log(`  Error: ${forecast.error}%`);
   *   }
   * });
   * ```
   */
  async archive(year?: number): Promise<ArchivedForecast[]> {
    const params: Record<string, string> = {};
    if (year) params.year = year.toString();

    const response = await this.client["request"]<
      ArchivedForecast[] | { forecasts: ArchivedForecast[] }
    >("/v1/forecasts/archive", params);

    return Array.isArray(response) ? response : response.forecasts;
  }

  /**
   * Get forecast for a specific period
   *
   * @param period - Period identifier (e.g., "2024-03", "2024-Q2")
   * @param commodity - Optional commodity code filter
   * @returns Monthly forecast data
   *
   * @throws {NotFoundError} If period not found
   * @throws {OilPriceAPIError} If API request fails
   *
   * @example
   * ```typescript
   * // Get March 2024 forecast
   * const march2024 = await client.forecasts.get('2024-03');
   *
   * // Get Q2 2024 WTI forecast
   * const q2Wti = await client.forecasts.get('2024-Q2', 'WTI_USD');
   *
   * console.log(`Period: ${march2024.period}`);
   * console.log(`Forecast: $${march2024.forecast_price}`);
   * console.log(`Published: ${march2024.published_at}`);
   * ```
   */
  async get(period: string, commodity?: string): Promise<MonthlyForecast> {
    if (!period || typeof period !== "string") {
      throw new ValidationError("Period must be a non-empty string");
    }

    const params: Record<string, string> = {};
    if (commodity) params.commodity = commodity;

    return this.client["request"]<MonthlyForecast>(
      `/v1/forecasts/monthly/${period}`,
      params,
    );
  }
}
