/**
 * Energy Intelligence - Forecasts Resource
 *
 * Access EIA and IEA price and production forecasts with historical accuracy metrics.
 */

import type { OilPriceAPI } from "../../client.js";
import { ValidationError } from "../../errors.js";

/**
 * Forecast record
 */
export interface ForecastRecord {
  /** Record ID */
  id: string;
  /** Forecast source (e.g., "EIA", "IEA") */
  source?: string;
  /** Commodity or metric being forecasted */
  commodity?: string;
  /** Forecast value */
  forecast_value: number;
  /** Unit of measurement */
  unit?: string;
  /** Forecast period (e.g., "Q1 2025", "2025") */
  period?: string;
  /** Publication date */
  published_date: string;
  /** Target date */
  target_date?: string;
  /** ISO timestamp */
  timestamp: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Forecast summary
 */
export interface ForecastSummary {
  /** Number of forecasts */
  total_forecasts: number;
  /** Latest forecast value */
  latest_forecast?: number;
  /** Average forecast */
  average_forecast?: number;
  /** As of date */
  as_of_date: string;
}

/**
 * Price forecast data
 */
export interface PriceForecast {
  /** Commodity */
  commodity: string;
  /** Forecast source */
  source: string;
  /** Forecast price */
  forecast_price: number;
  /** Unit */
  unit: string;
  /** Target period */
  period: string;
  /** Published date */
  published_date: string;
}

/**
 * Production forecast data
 */
export interface ProductionForecast {
  /** Region or country */
  region: string;
  /** Forecast source */
  source: string;
  /** Forecast production */
  forecast_production: number;
  /** Unit */
  unit: string;
  /** Target period */
  period: string;
  /** Published date */
  published_date: string;
}

/**
 * Historical forecast data point
 */
export interface HistoricalForecast {
  /** Date */
  date: string;
  /** Forecast value */
  forecast_value: number;
  /** Actual value (if available) */
  actual_value?: number;
  /** Accuracy percentage */
  accuracy_percent?: number;
}

/**
 * Forecast comparison data
 */
export interface ForecastComparison {
  /** Period */
  period: string;
  /** EIA forecast */
  eia_forecast?: number;
  /** IEA forecast */
  iea_forecast?: number;
  /** Actual value (if available) */
  actual_value?: number;
  /** Difference between forecasts */
  difference?: number;
}

/**
 * EI Forecasts Resource
 *
 * Access EIA and IEA price and production forecasts.
 *
 * @example
 * ```typescript
 * const client = new OilPriceAPI({ apiKey: 'your_key' });
 *
 * // Get latest forecasts
 * const latest = await client.ei.forecasts.latest();
 * console.log(`Latest forecast: ${latest.forecast_value} ${latest.unit}`);
 *
 * // Get price forecasts
 * const prices = await client.ei.forecasts.prices();
 * prices.forEach(p => console.log(`${p.commodity}: $${p.forecast_price} (${p.source})`));
 * ```
 */
export class EIForecastsResource {
  constructor(private client: OilPriceAPI) {}

  /**
   * List all forecast records
   *
   * @returns Array of forecast records
   */
  async list(): Promise<ForecastRecord[]> {
    const response = await this.client["request"]<
      ForecastRecord[] | { data: ForecastRecord[] }
    >("/v1/ei/forecasts", {});

    return Array.isArray(response) ? response : response.data;
  }

  /**
   * Get a specific forecast record
   *
   * @param id - Record ID
   * @returns Forecast record
   */
  async get(id: string): Promise<ForecastRecord> {
    if (!id || typeof id !== "string") {
      throw new ValidationError("Record ID must be a non-empty string");
    }

    return this.client["request"]<ForecastRecord>(`/v1/ei/forecasts/${id}`, {});
  }

  /**
   * Get latest forecast data
   *
   * @returns Latest forecast record
   */
  async latest(): Promise<ForecastRecord> {
    return this.client["request"]<ForecastRecord>(
      "/v1/ei/forecasts/latest",
      {},
    );
  }

  /**
   * Get forecast summary
   *
   * @returns Forecast summary statistics
   */
  async summary(): Promise<ForecastSummary> {
    return this.client["request"]<ForecastSummary>(
      "/v1/ei/forecasts/summary",
      {},
    );
  }

  /**
   * Get price forecasts
   *
   * @returns Array of price forecasts
   */
  async prices(): Promise<PriceForecast[]> {
    const response = await this.client["request"]<
      PriceForecast[] | { data: PriceForecast[] }
    >("/v1/ei/forecasts/prices", {});

    return Array.isArray(response) ? response : response.data;
  }

  /**
   * Get production forecasts
   *
   * @returns Array of production forecasts
   */
  async production(): Promise<ProductionForecast[]> {
    const response = await this.client["request"]<
      ProductionForecast[] | { data: ProductionForecast[] }
    >("/v1/ei/forecasts/production", {});

    return Array.isArray(response) ? response : response.data;
  }

  /**
   * Get historical forecast data
   *
   * @returns Array of historical forecasts with accuracy
   */
  async historical(): Promise<HistoricalForecast[]> {
    const response = await this.client["request"]<
      HistoricalForecast[] | { data: HistoricalForecast[] }
    >("/v1/ei/forecasts/historical", {});

    return Array.isArray(response) ? response : response.data;
  }

  /**
   * Compare forecasts from different sources
   *
   * @returns Array of forecast comparisons
   */
  async compare(): Promise<ForecastComparison[]> {
    const response = await this.client["request"]<
      ForecastComparison[] | { data: ForecastComparison[] }
    >("/v1/ei/forecasts/compare", {});

    return Array.isArray(response) ? response : response.data;
  }
}
