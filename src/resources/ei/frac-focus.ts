/**
 * Energy Intelligence - FracFocus Resource
 *
 * Access hydraulic fracturing disclosure data including chemicals, operators,
 * and well-level information from the FracFocus registry.
 */

import type { OilPriceAPI } from "../../client.js";

/**
 * FracFocus disclosure record
 */
export interface FracFocusRecord {
  /** Record ID */
  id: string;
  /** API well number */
  api_number: string;
  /** State */
  state: string;
  /** County */
  county?: string;
  /** Operator name */
  operator?: string;
  /** Well name */
  well_name?: string;
  /** Job start date */
  job_start_date?: string;
  /** Job end date */
  job_end_date?: string;
  /** Total base water volume (gallons) */
  total_base_water_volume?: number;
  /** Total base non-water volume (gallons) */
  total_base_non_water_volume?: number;
  /** ISO timestamp */
  timestamp: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * FracFocus summary
 */
export interface FracFocusSummary {
  /** Total disclosures */
  total_disclosures: number;
  /** Disclosures by state */
  by_state?: Record<string, number>;
  /** Disclosures by operator */
  by_operator?: Record<string, number>;
  /** As of date */
  as_of_date: string;
}

/**
 * Disclosures by state
 */
export interface DisclosuresByState {
  /** State name */
  state: string;
  /** Disclosure count */
  disclosure_count: number;
  /** Date */
  date: string;
}

/**
 * Disclosures by operator
 */
export interface DisclosuresByOperator {
  /** Operator name */
  operator: string;
  /** Disclosure count */
  disclosure_count: number;
  /** Percentage of total */
  percentage?: number;
  /** Date */
  date: string;
}

/**
 * Chemical usage data
 */
export interface ChemicalUsage {
  /** Chemical name */
  chemical_name: string;
  /** CAS number */
  cas_number?: string;
  /** Usage count */
  usage_count: number;
  /** Percentage of total */
  percentage?: number;
}

/**
 * Chemical detail for a specific well
 */
export interface WellChemical {
  /** Chemical name */
  chemical_name: string;
  /** CAS number */
  cas_number?: string;
  /** Purpose */
  purpose?: string;
  /** Ingredient concentration (%) */
  concentration_percent?: number;
  /** Mass used (lbs) */
  mass_lbs?: number;
}

/**
 * FracFocus search query
 */
export interface FracFocusSearchQuery {
  /** State filter */
  state?: string;
  /** Operator filter */
  operator?: string;
  /** Chemical filter */
  chemical?: string;
  /** Start date */
  start_date?: string;
  /** End date */
  end_date?: string;
}

/**
 * EI FracFocus Resource
 *
 * Access hydraulic fracturing disclosure data from the FracFocus registry.
 *
 * @example
 * ```typescript
 * const client = new OilPriceAPI({ apiKey: 'your_key' });
 *
 * // Get latest disclosure
 * const latest = await client.ei.fracFocus.latest();
 * console.log(`Well: ${latest.well_name} (API: ${latest.api_number})`);
 *
 * // Get disclosures by state
 * const states = await client.ei.fracFocus.byState();
 * states.forEach(s => console.log(`${s.state}: ${s.disclosure_count} disclosures`));
 *
 * // Get chemicals for a specific well
 * const chemicals = await client.ei.fracFocus.chemicals('42-123-12345');
 * chemicals.forEach(c => console.log(`${c.chemical_name}: ${c.concentration_percent}%`));
 *
 * // Search disclosures
 * const results = await client.ei.fracFocus.search({
 *   state: 'Texas',
 *   operator: 'EOG Resources'
 * });
 * ```
 */
export class EIFracFocusResource {
  constructor(private client: OilPriceAPI) {}

  /**
   * List all FracFocus disclosure records
   *
   * @returns Array of disclosure records
   */
  async list(): Promise<FracFocusRecord[]> {
    const response = await this.client["request"]<
      FracFocusRecord[] | { data: FracFocusRecord[] }
    >("/v1/ei/frac-focus", {});

    return Array.isArray(response) ? response : response.data;
  }

  /**
   * Get a specific FracFocus disclosure record
   *
   * @param id - Record ID
   * @returns Disclosure record
   */
  async get(id: string): Promise<FracFocusRecord> {
    if (!id || typeof id !== "string") {
      throw new Error("Record ID must be a non-empty string");
    }

    return this.client["request"]<FracFocusRecord>(
      `/v1/ei/frac-focus/${id}`,
      {},
    );
  }

  /**
   * Get latest FracFocus disclosure
   *
   * @returns Latest disclosure record
   */
  async latest(): Promise<FracFocusRecord> {
    return this.client["request"]<FracFocusRecord>(
      "/v1/ei/frac-focus/latest",
      {},
    );
  }

  /**
   * Get FracFocus summary
   *
   * @returns Disclosure summary statistics
   */
  async summary(): Promise<FracFocusSummary> {
    return this.client["request"]<FracFocusSummary>(
      "/v1/ei/frac-focus/summary",
      {},
    );
  }

  /**
   * Get disclosures by state
   *
   * @returns Array of disclosures grouped by state
   */
  async byState(): Promise<DisclosuresByState[]> {
    const response = await this.client["request"]<
      DisclosuresByState[] | { data: DisclosuresByState[] }
    >("/v1/ei/frac-focus/by-state", {});

    return Array.isArray(response) ? response : response.data;
  }

  /**
   * Get disclosures by operator
   *
   * @returns Array of disclosures grouped by operator
   */
  async byOperator(): Promise<DisclosuresByOperator[]> {
    const response = await this.client["request"]<
      DisclosuresByOperator[] | { data: DisclosuresByOperator[] }
    >("/v1/ei/frac-focus/by-operator", {});

    return Array.isArray(response) ? response : response.data;
  }

  /**
   * Get chemical usage statistics
   *
   * @returns Array of chemicals used in fracturing
   */
  async byChemical(): Promise<ChemicalUsage[]> {
    const response = await this.client["request"]<
      ChemicalUsage[] | { data: ChemicalUsage[] }
    >("/v1/ei/frac-focus/by-chemical", {});

    return Array.isArray(response) ? response : response.data;
  }

  /**
   * Search FracFocus disclosures
   *
   * @param query - Search query parameters
   * @returns Array of matching disclosure records
   */
  async search(query: FracFocusSearchQuery): Promise<FracFocusRecord[]> {
    const params: Record<string, string> = {};

    if (query.state) params.state = query.state;
    if (query.operator) params.operator = query.operator;
    if (query.chemical) params.chemical = query.chemical;
    if (query.start_date) params.start_date = query.start_date;
    if (query.end_date) params.end_date = query.end_date;

    const response = await this.client["request"]<
      FracFocusRecord[] | { data: FracFocusRecord[] }
    >("/v1/ei/frac-focus/search", params);

    return Array.isArray(response) ? response : response.data;
  }

  /**
   * Get chemicals used in a specific well
   *
   * @param id - Disclosure record ID
   * @returns Array of chemicals used in the well
   */
  async chemicals(id: string): Promise<WellChemical[]> {
    if (!id || typeof id !== "string") {
      throw new Error("Disclosure ID must be a non-empty string");
    }

    const response = await this.client["request"]<
      WellChemical[] | { chemicals: WellChemical[] }
    >(`/v1/ei/frac-focus/${id}/chemicals`, {});

    return Array.isArray(response) ? response : response.chemicals;
  }

  /**
   * Get FracFocus disclosures for a specific well by API number
   *
   * @param apiNumber - API well number (e.g., "42-123-12345")
   * @returns Array of disclosure records for the well
   */
  async forWell(apiNumber: string): Promise<FracFocusRecord[]> {
    if (!apiNumber || typeof apiNumber !== "string") {
      throw new Error("API number must be a non-empty string");
    }

    const response = await this.client["request"]<
      FracFocusRecord[] | { data: FracFocusRecord[] }
    >(`/v1/ei/frac-focus/for-well/${apiNumber}`, {});

    return Array.isArray(response) ? response : response.data;
  }
}
