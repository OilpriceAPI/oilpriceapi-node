/**
 * Energy Intelligence - OPEC Production Resource
 *
 * Access OPEC crude oil production data by country with historical trends.
 */

import type { OilPriceAPI } from "../../client.js";

/**
 * OPEC production record
 */
export interface OPECProductionRecord {
  /** Record ID */
  id: string;
  /** Country name */
  country?: string;
  /** Production volume in barrels per day */
  production_bpd: number;
  /** Unit of measurement */
  unit: string;
  /** Change from previous month */
  change?: number;
  /** Report date */
  date: string;
  /** Month */
  month?: string;
  /** ISO timestamp */
  timestamp: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Total OPEC production
 */
export interface TotalOPECProduction {
  /** Total production in barrels per day */
  total_production_bpd: number;
  /** Change from previous month */
  change?: number;
  /** Unit */
  unit: string;
  /** As of date */
  as_of_date: string;
}

/**
 * Production by country
 */
export interface ProductionByCountry {
  /** Country name */
  country: string;
  /** Production in barrels per day */
  production_bpd: number;
  /** Change from previous month */
  change?: number;
  /** Percentage of total OPEC production */
  percentage?: number;
  /** Date */
  date: string;
}

/**
 * Historical production data point
 */
export interface HistoricalProduction {
  /** Date */
  date: string;
  /** Production in barrels per day */
  production_bpd: number;
  /** Change */
  change?: number;
}

/**
 * Top producer data
 */
export interface TopProducer {
  /** Country name */
  country: string;
  /** Production in barrels per day */
  production_bpd: number;
  /** Percentage of total */
  percentage: number;
  /** Rank */
  rank: number;
}

/**
 * EI OPEC Production Resource
 *
 * Access OPEC crude oil production data and analytics.
 *
 * @example
 * ```typescript
 * const client = new OilPriceAPI({ apiKey: 'your_key' });
 *
 * // Get total OPEC production
 * const total = await client.ei.opecProduction.total();
 * console.log(`Total OPEC: ${total.total_production_bpd} bpd`);
 *
 * // Get top producers
 * const top = await client.ei.opecProduction.topProducers();
 * top.forEach(p => console.log(`${p.rank}. ${p.country}: ${p.production_bpd} bpd`));
 * ```
 */
export class EIOPECProductionResource {
  constructor(private client: OilPriceAPI) {}

  /**
   * List all OPEC production records
   *
   * @returns Array of production records
   */
  async list(): Promise<OPECProductionRecord[]> {
    const response = await this.client["request"]<
      OPECProductionRecord[] | { data: OPECProductionRecord[] }
    >("/v1/ei/opec_productions", {});

    return Array.isArray(response) ? response : response.data;
  }

  /**
   * Get a specific production record
   *
   * @param id - Record ID
   * @returns Production record
   */
  async get(id: string): Promise<OPECProductionRecord> {
    if (!id || typeof id !== "string") {
      throw new Error("Record ID must be a non-empty string");
    }

    return this.client["request"]<OPECProductionRecord>(
      `/v1/ei/opec_productions/${id}`,
      {},
    );
  }

  /**
   * Get latest OPEC production data
   *
   * @returns Latest production record
   */
  async latest(): Promise<OPECProductionRecord> {
    return this.client["request"]<OPECProductionRecord>(
      "/v1/ei/opec_productions/latest",
      {},
    );
  }

  /**
   * Get total OPEC production
   *
   * @returns Total OPEC production summary
   */
  async total(): Promise<TotalOPECProduction> {
    return this.client["request"]<TotalOPECProduction>(
      "/v1/ei/opec_productions/total",
      {},
    );
  }

  /**
   * Get production by country
   *
   * @returns Array of production by country
   */
  async byCountry(): Promise<ProductionByCountry[]> {
    const response = await this.client["request"]<
      ProductionByCountry[] | { data: ProductionByCountry[] }
    >("/v1/ei/opec_productions/by_country", {});

    return Array.isArray(response) ? response : response.data;
  }

  /**
   * Get historical production data
   *
   * @returns Array of historical production levels
   */
  async historical(): Promise<HistoricalProduction[]> {
    const response = await this.client["request"]<
      HistoricalProduction[] | { data: HistoricalProduction[] }
    >("/v1/ei/opec_productions/historical", {});

    return Array.isArray(response) ? response : response.data;
  }

  /**
   * Get top OPEC producers
   *
   * @returns Array of top producing countries
   */
  async topProducers(): Promise<TopProducer[]> {
    const response = await this.client["request"]<
      TopProducer[] | { data: TopProducer[] }
    >("/v1/ei/opec_productions/top_producers", {});

    return Array.isArray(response) ? response : response.data;
  }
}
