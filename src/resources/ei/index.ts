/**
 * Energy Intelligence Resource
 *
 * Comprehensive energy market intelligence including rig counts, inventories,
 * OPEC production, drilling productivity, forecasts, well permits, and FracFocus data.
 */

import type { OilPriceAPI } from "../../client.js";
import { EIRigCountsResource } from "./rig-counts.js";
import { EIOilInventoriesResource } from "./oil-inventories.js";
import { EIOPECProductionResource } from "./opec-production.js";
import { EIDrillingProductivityResource } from "./drilling-productivity.js";
import { EIForecastsResource } from "./forecasts.js";
import { EIWellPermitsResource } from "./well-permits.js";
import { EIFracFocusResource } from "./frac-focus.js";
import { ValidationError } from "../../errors.js";

/**
 * Well timeline event
 */
export interface WellTimelineEvent {
  /** Event type */
  event_type: string;
  /** Event date */
  date: string;
  /** Event description */
  description?: string;
  /** Source of data */
  source?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Well timeline data
 */
export interface WellTimeline {
  /** API well number */
  api_number: string;
  /** Well name */
  well_name?: string;
  /** Operator */
  operator?: string;
  /** State */
  state?: string;
  /** Timeline events */
  events: WellTimelineEvent[];
}

/**
 * Energy Intelligence Resource
 *
 * Access comprehensive energy market intelligence from EIA, Baker Hughes,
 * FracFocus, and other authoritative sources.
 *
 * @example
 * ```typescript
 * import { OilPriceAPI } from 'oilpriceapi';
 *
 * const client = new OilPriceAPI({ apiKey: 'your_key' });
 *
 * // Rig counts
 * const rigCounts = await client.ei.rigCounts.latest();
 * console.log(`Total rigs: ${rigCounts.total_rigs}`);
 *
 * // Oil inventories
 * const inventories = await client.ei.oilInventories.latest();
 * console.log(`Crude stocks: ${inventories.level} ${inventories.unit}`);
 *
 * // OPEC production
 * const opec = await client.ei.opecProduction.total();
 * console.log(`OPEC production: ${opec.total_production_bpd} bpd`);
 *
 * // Well timeline
 * const timeline = await client.ei.wellTimeline('42-123-12345');
 * timeline.events.forEach(e => {
 *   console.log(`${e.date}: ${e.event_type}`);
 * });
 * ```
 */
export class EnergyIntelligenceResource {
  /**
   * Baker Hughes rig count data
   */
  public readonly rigCounts: EIRigCountsResource;

  /**
   * EIA crude oil inventory data
   */
  public readonly oilInventories: EIOilInventoriesResource;

  /**
   * OPEC production data
   */
  public readonly opecProduction: EIOPECProductionResource;

  /**
   * EIA drilling productivity report data
   */
  public readonly drillingProductivity: EIDrillingProductivityResource;

  /**
   * EIA and IEA forecast data
   */
  public readonly forecasts: EIForecastsResource;

  /**
   * Well permit data
   */
  public readonly wellPermits: EIWellPermitsResource;

  /**
   * FracFocus disclosure data
   */
  public readonly fracFocus: EIFracFocusResource;

  constructor(private client: OilPriceAPI) {
    this.rigCounts = new EIRigCountsResource(client);
    this.oilInventories = new EIOilInventoriesResource(client);
    this.opecProduction = new EIOPECProductionResource(client);
    this.drillingProductivity = new EIDrillingProductivityResource(client);
    this.forecasts = new EIForecastsResource(client);
    this.wellPermits = new EIWellPermitsResource(client);
    this.fracFocus = new EIFracFocusResource(client);
  }

  /**
   * Get well timeline by API number
   *
   * Returns chronological timeline of events for a specific well including
   * permits, drilling, completion, production, and FracFocus disclosures.
   *
   * @param apiNumber - API well number (e.g., "42-123-12345")
   * @returns Well timeline with events
   *
   * @throws {NotFoundError} If well not found
   * @throws {OilPriceAPIError} If API request fails
   *
   * @example
   * ```typescript
   * const timeline = await client.ei.wellTimeline('42-123-12345');
   * console.log(`Well: ${timeline.well_name}`);
   * console.log(`Operator: ${timeline.operator}`);
   * console.log(`Events: ${timeline.events.length}`);
   *
   * timeline.events.forEach(event => {
   *   console.log(`${event.date}: ${event.event_type} - ${event.description}`);
   * });
   * ```
   */
  async wellTimeline(apiNumber: string): Promise<WellTimeline> {
    if (!apiNumber || typeof apiNumber !== "string") {
      throw new ValidationError("API number must be a non-empty string");
    }

    return this.client["request"]<WellTimeline>(
      `/v1/ei/wells/${apiNumber}/timeline`,
      {},
    );
  }
}

// Re-export all types from sub-resources
export type {
  RigCountRecord,
  RigCountByBasin,
  RigCountByState,
  HistoricalRigCount,
} from "./rig-counts.js";
export type {
  OilInventoryRecord,
  OilInventorySummary,
  InventoryByProduct,
  HistoricalInventory,
  CushingInventory,
} from "./oil-inventories.js";
export type {
  OPECProductionRecord,
  TotalOPECProduction,
  ProductionByCountry,
  HistoricalProduction,
  TopProducer,
} from "./opec-production.js";
export type {
  DrillingProductivityRecord,
  DrillingProductivitySummary,
  DUCWellInventory,
  ProductivityByBasin,
  HistoricalProductivity,
  ProductivityTrend,
} from "./drilling-productivity.js";
export type {
  ForecastRecord,
  ForecastSummary,
  PriceForecast,
  ProductionForecast,
  HistoricalForecast,
  ForecastComparison,
} from "./forecasts.js";
export type {
  WellPermitRecord,
  WellPermitSummary,
  PermitsByState,
  PermitsByOperator,
  PermitsByFormation,
  WellPermitSearchQuery,
} from "./well-permits.js";
export type {
  FracFocusRecord,
  FracFocusSummary,
  DisclosuresByState,
  DisclosuresByOperator,
  ChemicalUsage,
  WellChemical,
  FracFocusSearchQuery,
} from "./frac-focus.js";

export {
  EIRigCountsResource,
  EIOilInventoriesResource,
  EIOPECProductionResource,
  EIDrillingProductivityResource,
  EIForecastsResource,
  EIWellPermitsResource,
  EIFracFocusResource,
};
