/**
 * Spreads Resource
 *
 * Access oil & product spread analytics: crack spreads, basis spreads,
 * curve-structure (contango/backwardation), refining margins, and physical
 * premiums. Each spread type supports the latest value, full history, and an
 * `all` listing.
 */

import type { OilPriceAPI } from "../client.js";
import { ValidationError } from "../errors.js";

/**
 * Supported spread types.
 *
 * - `crack` — refining crack spread (e.g., 3:2:1)
 * - `basis` — regional basis differential vs benchmark
 * - `curve-structure` — contango / backwardation structure
 * - `margin` — refining margin
 * - `physical-premium` — physical-vs-paper premium
 */
export type SpreadType = "crack" | "basis" | "curve-structure" | "margin" | "physical-premium";

/**
 * A single spread data point.
 */
export interface SpreadValue {
  /** Spread type slug */
  type: string;
  /** Spread name / label */
  name?: string;
  /** Spread value */
  value: number;
  /** Unit (e.g., "USD/bbl") */
  unit?: string;
  /** Region or market */
  region?: string;
  /** Benchmark or components */
  components?: string[];
  /** ISO timestamp */
  timestamp: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Historical spread data point.
 */
export interface HistoricalSpreadValue {
  /** ISO date */
  date: string;
  /** Spread value */
  value: number;
  /** Unit */
  unit?: string;
}

/**
 * Options for a historical spread query.
 */
export interface HistoricalSpreadOptions {
  /** Start date (YYYY-MM-DD) */
  startDate?: string;
  /** End date (YYYY-MM-DD) */
  endDate?: string;
}

/**
 * Spreads Resource
 *
 * @example
 * ```typescript
 * import { OilPriceAPI } from 'oilpriceapi';
 *
 * const client = new OilPriceAPI({ apiKey: 'your_key' });
 *
 * // Latest crack spread
 * const crack = await client.spreads.crack();
 * console.log(`Crack spread: ${crack.value} ${crack.unit}`);
 *
 * // Historical basis spreads
 * const history = await client.spreads.historical('basis', {
 *   startDate: '2024-01-01',
 *   endDate: '2024-12-31',
 * });
 *
 * // All margin spreads
 * const all = await client.spreads.all('margin');
 * ```
 */
export class SpreadsResource {
  constructor(private client: OilPriceAPI) {}

  /**
   * Get the latest value for a spread type.
   *
   * @param type - Spread type slug.
   * @returns Latest spread value.
   * @throws {ValidationError} If the type is invalid.
   */
  async get(type: SpreadType): Promise<SpreadValue> {
    this.validateType(type);
    return this.client["request"]<SpreadValue>(`/v1/spreads/${type}`, {});
  }

  /**
   * Get historical data for a spread type.
   *
   * @param type - Spread type slug.
   * @param options - Optional date range filters.
   * @returns Array of historical spread values.
   */
  async historical(
    type: SpreadType,
    options?: HistoricalSpreadOptions,
  ): Promise<HistoricalSpreadValue[]> {
    this.validateType(type);

    const params: Record<string, string> = {};
    if (options?.startDate) params.start_date = options.startDate;
    if (options?.endDate) params.end_date = options.endDate;

    const response = await this.client["request"]<
      HistoricalSpreadValue[] | { data: HistoricalSpreadValue[] }
    >(`/v1/spreads/${type}/historical`, params);

    return Array.isArray(response) ? response : response.data;
  }

  /**
   * Get all spread values for a spread type.
   *
   * @param type - Spread type slug.
   * @returns Array of spread values.
   */
  async all(type: SpreadType): Promise<SpreadValue[]> {
    this.validateType(type);

    const response = await this.client["request"]<SpreadValue[] | { data: SpreadValue[] }>(
      `/v1/spreads/${type}/all`,
      {},
    );

    return Array.isArray(response) ? response : response.data;
  }

  /** Latest crack spread. */
  async crack(): Promise<SpreadValue> {
    return this.get("crack");
  }

  /** Latest basis spread. */
  async basis(): Promise<SpreadValue> {
    return this.get("basis");
  }

  /** Latest curve-structure (contango / backwardation). */
  async curveStructure(): Promise<SpreadValue> {
    return this.get("curve-structure");
  }

  /** Latest refining margin. */
  async margin(): Promise<SpreadValue> {
    return this.get("margin");
  }

  /** Latest physical premium. */
  async physicalPremium(): Promise<SpreadValue> {
    return this.get("physical-premium");
  }

  private validateType(type: SpreadType): void {
    if (!type || typeof type !== "string") {
      throw new ValidationError("Spread type must be a non-empty string");
    }
  }
}
