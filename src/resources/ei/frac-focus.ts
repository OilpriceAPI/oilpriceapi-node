/**
 * Energy Intelligence - FracFocus Resource
 *
 * Access hydraulic fracturing disclosure data including chemicals, operators,
 * and well-level information from the FracFocus registry.
 */

import type { OilPriceAPI } from "../../client.js";
import { ValidationError } from "../../errors.js";
import {
  unwrapCollection,
  unwrapPage,
  pageParams,
  requireFilter,
  type EIPageOptions,
  type EIPageMeta,
} from "./envelope.js";

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
 *
 * @deprecated No endpoint returns this aggregate. `byState` / `byOperator` /
 * `byChemical` return a page of individual disclosure records — see
 * {@link FracFocusPage} (#105).
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
 *
 * @deprecated No endpoint returns this aggregate. `byState` / `byOperator` /
 * `byChemical` return a page of individual disclosure records — see
 * {@link FracFocusPage} (#105).
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
 *
 * @deprecated No endpoint returns this aggregate. `byState` / `byOperator` /
 * `byChemical` return a page of individual disclosure records — see
 * {@link FracFocusPage} (#105).
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
 * An individual FracFocus disclosure, as returned by the paginated by-* routes.
 *
 * Verified against live production 2026-09-13 (#105).
 */
export interface FracFocusDisclosure {
  /** FracFocus upload key */
  upload_key: string;
  /** 14-digit API well number */
  api_number: string;
  /** API number with separators, e.g. `42-317-42899-00-00` */
  api_number_formatted: string | null;
  /** Two-letter state code */
  state_code: string;
  county: string | null;
  operator: { name: string | null; name_normalized: string | null };
  well_name: string | null;
  location: { latitude: number | null; longitude: number | null };
  job: {
    start_date: string | null;
    end_date: string | null;
    total_vertical_depth: number | null;
  };
  water: {
    total_gallons: number | null;
    total_barrels: number | null;
    non_water_gallons: number | null;
  };
  /** Chemical summary; fetch the list with `chemicals(id)` */
  chemicals: { count: number };
  provenance: {
    source: string | null;
    fetched_at: string | null;
    confidence_score?: number | null;
    validation_status?: string | null;
  };
}

/** A page of disclosure records from a paginated by-* route (#105). */
export interface FracFocusPage {
  /** Disclosure records on this page */
  frac_focus_disclosures: FracFocusDisclosure[];
  /** Pagination; `total_count` covers all pages */
  meta: EIPageMeta;
}

/** Response of `byState()`. */
export interface FracFocusByStatePage extends FracFocusPage {
  /** The state filter the server applied, upper-cased */
  state: string;
}

/** Response of `byOperator()`. */
export interface FracFocusByOperatorPage extends FracFocusPage {
  /** The operator filter the server applied */
  operator_query: string;
}

/**
 * Filter for `byChemical()`. At least one of `cas` or `name` is required;
 * these are the parameter names the route reads.
 */
export interface FracFocusChemicalQuery {
  /** CAS registry number, e.g. `7732-18-5` */
  cas?: string;
  /** Chemical name (partial match), e.g. `Water` */
  name?: string;
}

/** Response of `byChemical()`. */
export interface FracFocusByChemicalPage extends FracFocusPage {
  /** The chemical filter the server applied */
  chemical_query: FracFocusChemicalQuery;
}

/**
 * FracFocus search query.
 *
 * Maps to the parameters the `search` action actually reads. Note: `operator`
 * and `chemical` are NOT search params (use the dedicated by-operator /
 * by-chemical endpoints); state filtering uses `states` (comma-separated, plural).
 */
export interface FracFocusSearchQuery {
  /** Comma-separated state codes (e.g. 'TX,NM') */
  states?: string;
  /** County name (partial match) */
  county?: string;
  /** Well name (partial match) */
  well_name?: string;
  /** API well number (partial match) */
  api_number?: string;
  /** Minimum total base water volume (gallons) */
  min_water_gallons?: number;
  /** Latitude for radius search */
  latitude?: number;
  /** Longitude for radius search */
  longitude?: number;
  /** Radius in miles (1-100, default 10) for lat/lng search */
  radius_miles?: number;
  /** Start date (job_start_date >=) */
  start_date?: string;
  /** End date (job_start_date <=) */
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
 * // Get disclosures for one state — a page of records plus the overall total
 * const tx = await client.ei.fracFocus.byState('TX', { perPage: 50 });
 * console.log(`${tx.meta.total_count} TX disclosures; page 1 of ${tx.meta.total_pages}`);
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
    const response = await this.client["request"]<unknown>("/v1/ei/frac-focus", {});

    return unwrapCollection<FracFocusRecord>(
      response,
      "frac_focus_disclosures",
      "/v1/ei/frac-focus",
    );
  }

  /**
   * Get a specific FracFocus disclosure record
   *
   * @param id - Record ID
   * @returns Disclosure record
   */
  async get(id: string): Promise<FracFocusRecord> {
    if (!id || typeof id !== "string") {
      throw new ValidationError("Record ID must be a non-empty string");
    }

    return this.client["request"]<FracFocusRecord>(`/v1/ei/frac-focus/${encodeURIComponent(id)}`, {});
  }

  /**
   * Get latest FracFocus disclosure
   *
   * @returns Latest disclosure record
   */
  async latest(): Promise<FracFocusRecord> {
    return this.client["request"]<FracFocusRecord>("/v1/ei/frac-focus/latest", {});
  }

  /**
   * Get FracFocus summary
   *
   * @returns Disclosure summary statistics
   */
  async summary(): Promise<FracFocusSummary> {
    return this.client["request"]<FracFocusSummary>("/v1/ei/frac-focus/summary", {});
  }

  /**
   * Get disclosure records for one state
   *
   * @param state - Two-letter state code, e.g. `TX`
   * @param options - Paging; `per_page` defaults to 100, the route's maximum
   * @returns One page of disclosures; `meta.total_count` covers all pages
   *
   * @throws {ValidationError} If `state` is missing or empty
   */
  async byState(state: string, options?: EIPageOptions): Promise<FracFocusByStatePage> {
    const value = requireFilter(state, "State");
    const endpoint = "/v1/ei/frac-focus/by-state";
    const response = await this.client["request"]<unknown>(endpoint, {
      state: value,
      ...pageParams(options),
    });

    return unwrapPage<FracFocusByStatePage>(response, "frac_focus_disclosures", endpoint);
  }

  /**
   * Get disclosure records for an operator (partial name match)
   *
   * @param operator - Operator name, e.g. `EOG`
   * @param options - Paging; `per_page` defaults to 100, the route's maximum
   * @returns One page of disclosures; `meta.total_count` covers all pages
   *
   * @throws {ValidationError} If `operator` is missing or empty
   */
  async byOperator(operator: string, options?: EIPageOptions): Promise<FracFocusByOperatorPage> {
    const value = requireFilter(operator, "Operator name");
    const endpoint = "/v1/ei/frac-focus/by-operator";
    const response = await this.client["request"]<unknown>(endpoint, {
      operator: value,
      ...pageParams(options),
    });

    return unwrapPage<FracFocusByOperatorPage>(response, "frac_focus_disclosures", endpoint);
  }

  /**
   * Get disclosure records that used a chemical
   *
   * @param query - `cas` (CAS number) and/or `name` (partial chemical name);
   *   at least one is required
   * @param options - Paging; `per_page` defaults to 100, the route's maximum
   * @returns One page of disclosures; `meta.total_count` covers all pages
   *
   * @throws {ValidationError} If neither `cas` nor `name` is a non-empty string
   */
  async byChemical(
    query: FracFocusChemicalQuery,
    options?: EIPageOptions,
  ): Promise<FracFocusByChemicalPage> {
    const params: Record<string, string> = {};
    const cas = query?.cas;
    const name = query?.name;
    if (typeof cas === "string" && cas.trim() !== "") params.cas = cas.trim();
    if (typeof name === "string" && name.trim() !== "") params.name = name.trim();
    if (!params.cas && !params.name) {
      throw new ValidationError("A CAS number or chemical name must be a non-empty string");
    }

    const endpoint = "/v1/ei/frac-focus/by-chemical";
    const response = await this.client["request"]<unknown>(endpoint, {
      ...params,
      ...pageParams(options),
    });

    return unwrapPage<FracFocusByChemicalPage>(response, "frac_focus_disclosures", endpoint);
  }

  /**
   * Search FracFocus disclosures
   *
   * @param query - Search query parameters
   * @returns Array of matching disclosure records
   */
  async search(query: FracFocusSearchQuery): Promise<FracFocusRecord[]> {
    const params: Record<string, string> = {};

    if (query.states) params.states = query.states;
    if (query.county) params.county = query.county;
    if (query.well_name) params.well_name = query.well_name;
    if (query.api_number) params.api_number = query.api_number;
    if (query.min_water_gallons !== undefined)
      params.min_water_gallons = query.min_water_gallons.toString();
    if (query.latitude !== undefined) params.latitude = query.latitude.toString();
    if (query.longitude !== undefined) params.longitude = query.longitude.toString();
    if (query.radius_miles !== undefined) params.radius_miles = query.radius_miles.toString();
    if (query.start_date) params.start_date = query.start_date;
    if (query.end_date) params.end_date = query.end_date;

    const response = await this.client["request"]<unknown>("/v1/ei/frac-focus/search", params);

    return unwrapCollection<FracFocusRecord>(
      response,
      "frac_focus_disclosures",
      "/v1/ei/frac-focus/search",
    );
  }

  /**
   * Get chemicals used in a specific well
   *
   * @param id - Disclosure record ID
   * @returns Array of chemicals used in the well
   */
  async chemicals(id: string): Promise<WellChemical[]> {
    if (!id || typeof id !== "string") {
      throw new ValidationError("Disclosure ID must be a non-empty string");
    }

    const endpoint = `/v1/ei/frac-focus/${encodeURIComponent(id)}/chemicals`;
    const response = await this.client["request"]<unknown>(endpoint, {});

    return unwrapCollection<WellChemical>(response, "chemicals", endpoint);
  }

  /**
   * Get FracFocus disclosures for a specific well by API number
   *
   * @param apiNumber - API well number (e.g., "42-123-12345")
   * @returns Array of disclosure records for the well
   */
  async forWell(apiNumber: string): Promise<FracFocusRecord[]> {
    if (!apiNumber || typeof apiNumber !== "string") {
      throw new ValidationError("API number must be a non-empty string");
    }

    const endpoint = `/v1/ei/frac-focus/for-well/${encodeURIComponent(apiNumber)}`;
    const response = await this.client["request"]<unknown>(endpoint, {});

    return unwrapCollection<FracFocusRecord>(response, "frac_focus_disclosures", endpoint);
  }
}
