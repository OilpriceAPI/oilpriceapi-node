/**
 * Indicators Resource
 *
 * Access derived market indicators and signals: fuel-switching economics,
 * price context, storage analytics, market annotations, CFTC positioning, and
 * congressional energy-sector trades.
 */

import type { OilPriceAPI } from "../client.js";
import { ValidationError } from "../errors.js";

/**
 * Supported indicator types.
 */
export type IndicatorType =
  | "fuel-switching"
  | "price-context"
  | "storage-analytics"
  | "annotations"
  | "cftc-positioning"
  | "congressional-trades";

/**
 * Fuel-switching economics indicator.
 */
export interface FuelSwitchingIndicator {
  /** Switching ratio or breakeven value */
  value: number;
  /** Whether switching is economical */
  economical?: boolean;
  /** From fuel (e.g., "gas") */
  from_fuel?: string;
  /** To fuel (e.g., "oil") */
  to_fuel?: string;
  /** Unit */
  unit?: string;
  /** ISO timestamp */
  timestamp: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Price-context indicator (where the current price sits historically).
 */
export interface PriceContextIndicator {
  /** Commodity code */
  commodity?: string;
  /** Current price */
  price: number;
  /** Percentile vs trailing window */
  percentile?: number;
  /** 52-week high */
  high_52w?: number;
  /** 52-week low */
  low_52w?: number;
  /** ISO timestamp */
  timestamp: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Storage-analytics indicator.
 */
export interface StorageAnalyticsIndicator {
  /** Storage level */
  level: number;
  /** Capacity utilization percentage */
  capacity_percent?: number;
  /** Days of cover */
  days_of_cover?: number;
  /** Z-score vs 5-year average */
  zscore?: number;
  /** Unit */
  unit?: string;
  /** ISO timestamp */
  timestamp: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Market annotation (notable event marker).
 */
export interface AnnotationIndicator {
  /** Annotation ID */
  id?: string;
  /** Title */
  title: string;
  /** Description */
  description?: string;
  /** Category (e.g., "geopolitical", "supply", "demand") */
  category?: string;
  /** Event date */
  date: string;
  /** Related commodity */
  commodity?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * CFTC positioning indicator (Commitment of Traders).
 */
export interface CFTCPositioningIndicator {
  /** Market / commodity */
  market?: string;
  /** Managed-money long contracts */
  managed_money_long?: number;
  /** Managed-money short contracts */
  managed_money_short?: number;
  /** Net positioning */
  net_position?: number;
  /** Report date */
  report_date: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Congressional trade indicator (energy-sector disclosures).
 */
export interface CongressionalTradeIndicator {
  /** Representative or senator name */
  member?: string;
  /** Ticker traded */
  ticker?: string;
  /** Transaction type ("buy" / "sell") */
  transaction_type?: string;
  /** Amount range */
  amount_range?: string;
  /** Transaction date */
  transaction_date: string;
  /** Disclosure date */
  disclosure_date?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Indicators Resource
 *
 * @example
 * ```typescript
 * import { OilPriceAPI } from 'oilpriceapi';
 *
 * const client = new OilPriceAPI({ apiKey: 'your_key' });
 *
 * // Fuel-switching economics
 * const fs = await client.indicators.fuelSwitching();
 * console.log(`Switching economical: ${fs.economical}`);
 *
 * // CFTC positioning
 * const cftc = await client.indicators.cftcPositioning();
 * cftc.forEach(p => console.log(`${p.market}: net ${p.net_position}`));
 *
 * // Congressional trades
 * const trades = await client.indicators.congressionalTrades();
 * ```
 */
export class IndicatorsResource {
  constructor(private client: OilPriceAPI) {}

  /**
   * Get an arbitrary indicator by type.
   *
   * @typeParam T - Expected response type.
   * @param type - Indicator type slug.
   * @returns The indicator data.
   * @throws {ValidationError} If the type is invalid.
   */
  async get<T = unknown>(type: IndicatorType): Promise<T> {
    if (!type || typeof type !== "string") {
      throw new ValidationError("Indicator type must be a non-empty string");
    }
    return this.client["request"]<T>(`/v1/indicators/${type}`, {});
  }

  /** Fuel-switching economics indicator. */
  async fuelSwitching(): Promise<FuelSwitchingIndicator> {
    return this.get<FuelSwitchingIndicator>("fuel-switching");
  }

  /** Price-context indicator. */
  async priceContext(): Promise<PriceContextIndicator> {
    return this.get<PriceContextIndicator>("price-context");
  }

  /** Storage-analytics indicator. */
  async storageAnalytics(): Promise<StorageAnalyticsIndicator> {
    return this.get<StorageAnalyticsIndicator>("storage-analytics");
  }

  /** Market annotations. */
  async annotations(): Promise<AnnotationIndicator[]> {
    const response = await this.client["request"]<
      AnnotationIndicator[] | { data: AnnotationIndicator[] }
    >("/v1/indicators/annotations", {});

    return Array.isArray(response) ? response : response.data;
  }

  /** CFTC positioning (Commitment of Traders) indicators. */
  async cftcPositioning(): Promise<CFTCPositioningIndicator[]> {
    const response = await this.client["request"]<
      CFTCPositioningIndicator[] | { data: CFTCPositioningIndicator[] }
    >("/v1/indicators/cftc-positioning", {});

    return Array.isArray(response) ? response : response.data;
  }

  /** Congressional energy-sector trade indicators. */
  async congressionalTrades(): Promise<CongressionalTradeIndicator[]> {
    const response = await this.client["request"]<
      CongressionalTradeIndicator[] | { data: CongressionalTradeIndicator[] }
    >("/v1/indicators/congressional-trades", {});

    return Array.isArray(response) ? response : response.data;
  }
}
