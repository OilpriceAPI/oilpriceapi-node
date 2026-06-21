/**
 * Bunker Fuels Resource
 *
 * Access bunker fuel prices at major ports worldwide, including VLSFO, MGO,
 * and IFO380. Compare prices across ports and track historical trends.
 */

import type { OilPriceAPI } from "../client.js";
import { ValidationError } from "../errors.js";

/**
 * Bunker fuel price data
 */
export interface BunkerFuelPrice {
  /** Port code */
  port: string;
  /** Port name */
  port_name?: string;
  /** Fuel type (e.g., "VLSFO", "MGO", "IFO380") */
  fuel_type: string;
  /** Price per metric ton */
  price: number;
  /** Currency code (typically "USD") */
  currency: string;
  /** Unit (typically "MT" for metric ton) */
  unit: string;
  /** ISO timestamp when price was recorded */
  timestamp: string;
  /** Price change from previous day */
  change?: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Port-specific bunker fuel prices
 */
export interface PortBunkerPrices {
  /** Port code */
  port: string;
  /** Port name */
  port_name: string;
  /** Geographic region */
  region?: string;
  /** ISO timestamp */
  timestamp: string;
  /** Fuel prices by type */
  prices: {
    /** VLSFO price */
    VLSFO?: number;
    /** MGO price */
    MGO?: number;
    /** IFO380 price */
    IFO380?: number;
    /** Other fuel types */
    [fuelType: string]: number | undefined;
  };
  /** Currency code */
  currency: string;
  /** Unit of measurement */
  unit: string;
}

/**
 * Price comparison between ports
 */
export interface PortPriceComparison {
  /** Fuel type being compared */
  fuel_type: string;
  /** ISO timestamp */
  timestamp: string;
  /** Array of port prices */
  ports: Array<{
    /** Port code */
    port: string;
    /** Port name */
    port_name: string;
    /** Price */
    price: number;
    /** Rank (1 = cheapest) */
    rank?: number;
  }>;
  /** Currency code */
  currency: string;
  /** Unit of measurement */
  unit: string;
}

/**
 * Bunker fuel price spreads
 */
export interface BunkerFuelSpreads {
  /** ISO timestamp */
  timestamp: string;
  /** Spreads between fuel grades */
  spreads: Array<{
    /** High-grade fuel */
    fuel1: string;
    /** Low-grade fuel */
    fuel2: string;
    /** Average spread across ports */
    average_spread: number;
    /** Spread range */
    min_spread: number;
    max_spread: number;
  }>;
  /** Currency code */
  currency: string;
}

/**
 * Historical bunker fuel price data
 */
export interface HistoricalBunkerPrice {
  /** Date in YYYY-MM-DD format */
  date: string;
  /** Price */
  price: number;
  /** Currency code */
  currency: string;
  /** Unit of measurement */
  unit: string;
}

/**
 * Options for historical bunker fuel query.
 *
 * The controller reads `from` / `to` (dates) and `interval` — not `start_date` /
 * `end_date` / `fuel_type`. History is returned per port (all grades).
 */
export interface HistoricalBunkerOptions {
  /** Start date in ISO 8601 format (YYYY-MM-DD) */
  startDate?: string;
  /** End date in ISO 8601 format (YYYY-MM-DD) */
  endDate?: string;
  /** Aggregation interval (e.g. 'daily') */
  interval?: string;
}

/**
 * Options for port-to-port bunker spread query.
 */
export interface BunkerSpreadOptions {
  /** Origin port code */
  from: string;
  /** Destination port code */
  to: string;
  /** Fuel grade (e.g. 'VLSFO') */
  grade?: string;
}

/**
 * Bunker Fuels Resource
 *
 * Access bunker fuel prices at major ports worldwide. Track VLSFO, MGO, and
 * IFO380 prices, compare across ports, and analyze historical trends.
 *
 * @example
 * ```typescript
 * import { OilPriceAPI } from 'oilpriceapi';
 *
 * const client = new OilPriceAPI({ apiKey: 'your_key' });
 *
 * // Get all bunker fuel prices
 * const prices = await client.bunkerFuels.all();
 *
 * // Get prices for specific port
 * const singapore = await client.bunkerFuels.port('SIN');
 * console.log(`Singapore VLSFO: $${singapore.prices.VLSFO}/MT`);
 *
 * // Compare prices across ports
 * const comparison = await client.bunkerFuels.compare(['SIN', 'RTM', 'HOU']);
 * ```
 */
export class BunkerFuelsResource {
  constructor(private client: OilPriceAPI) {}

  /**
   * Get all current bunker fuel prices
   *
   * Returns prices for all tracked ports and fuel types.
   *
   * @returns Array of bunker fuel prices
   *
   * @throws {OilPriceAPIError} If API request fails
   * @throws {AuthenticationError} If API key is invalid
   *
   * @example
   * ```typescript
   * const prices = await client.bunkerFuels.all();
   * prices.forEach(price => {
   *   console.log(`${price.port_name} ${price.fuel_type}: $${price.price}/${price.unit}`);
   * });
   * ```
   */
  async all(): Promise<BunkerFuelPrice[]> {
    // Route is GET /v1/bunker-fuels/all (the bare /v1/bunker-fuels has no route).
    const response = await this.client["request"]<
      BunkerFuelPrice[] | { prices: BunkerFuelPrice[] }
    >("/v1/bunker-fuels/all", {});

    return Array.isArray(response) ? response : response.prices;
  }

  /**
   * Get bunker fuel prices for a specific port
   *
   * @param code - Port code (e.g., "SIN" for Singapore, "RTM" for Rotterdam)
   * @returns Port-specific prices across fuel types
   *
   * @throws {NotFoundError} If port code not found
   * @throws {OilPriceAPIError} If API request fails
   *
   * @example
   * ```typescript
   * const singapore = await client.bunkerFuels.port('SIN');
   * console.log(`Singapore Bunker Prices (${singapore.timestamp}):`);
   * console.log(`VLSFO: $${singapore.prices.VLSFO}/${singapore.unit}`);
   * console.log(`MGO: $${singapore.prices.MGO}/${singapore.unit}`);
   * ```
   */
  async port(code: string): Promise<PortBunkerPrices> {
    if (!code || typeof code !== "string") {
      throw new ValidationError("Port code must be a non-empty string");
    }

    return this.client["request"]<PortBunkerPrices>(`/v1/bunker-fuels/ports/${code}`, {});
  }

  /**
   * Compare prices across multiple ports
   *
   * @param ports - Array of port codes to compare
   * @returns Price comparison data
   *
   * @throws {OilPriceAPIError} If API request fails
   *
   * @example
   * ```typescript
   * const comparison = await client.bunkerFuels.compare(['SIN', 'RTM', 'HOU', 'FUJ']);
   *
   * console.log(`Comparing ${comparison.fuel_type} prices:`);
   * comparison.ports.forEach((port, index) => {
   *   console.log(`${index + 1}. ${port.port_name}: $${port.price}`);
   * });
   * ```
   */
  async compare(ports: string[]): Promise<PortPriceComparison> {
    if (!Array.isArray(ports) || ports.length === 0) {
      throw new ValidationError("Ports must be a non-empty array of port codes");
    }

    return this.client["request"]<PortPriceComparison>("/v1/bunker-fuels/compare", {
      ports: ports.join(","),
    });
  }

  /**
   * Get the bunker fuel price spread between two ports.
   *
   * Maps to `GET /v1/bunker-fuels/spreads/ports`, which reads `from`, `to`
   * and `grade`. (Earlier SDKs called `/v1/bunker-fuels/spreads` with no params,
   * which 404'd.)
   *
   * @param options - `{ from, to, grade? }`
   * @returns Port-to-port fuel price spread
   *
   * @throws {ValidationError} If from/to are missing
   *
   * @example
   * ```typescript
   * const spread = await client.bunkerFuels.spreads({ from: 'SIN', to: 'RTM', grade: 'VLSFO' });
   * ```
   */
  async spreads(options: BunkerSpreadOptions): Promise<BunkerFuelSpreads> {
    if (!options?.from || !options?.to) {
      throw new ValidationError("Both 'from' and 'to' port codes are required");
    }

    const params: Record<string, string> = {
      from: options.from,
      to: options.to,
    };
    if (options.grade) params.grade = options.grade;

    return this.client["request"]<BunkerFuelSpreads>("/v1/bunker-fuels/spreads/ports", params);
  }

  /**
   * Get historical bunker fuel prices
   *
   * @param port - Port code (e.g., "SIN", "RTM")
   * @param fuelType - Fuel type (e.g., "VLSFO", "MGO", "IFO380")
   * @param options - Date range filters
   * @returns Array of historical prices
   *
   * @throws {NotFoundError} If port or fuel type not found
   * @throws {OilPriceAPIError} If API request fails
   *
   * The history endpoint is keyed by port in the PATH (`/historical/:port_code`)
   * and returns all grades for that port; it does not filter by a single fuel
   * type. It reads `from` / `to` / `interval` query params.
   *
   * @param port - Port code (e.g., "SIN", "RTM") — used as a path segment
   * @param options - `{ startDate, endDate, interval }`
   *
   * @example
   * ```typescript
   * const history = await client.bunkerFuels.historical('SIN', {
   *   startDate: '2024-01-01',
   *   endDate: '2024-12-31'
   * });
   *
   * history.forEach(point => {
   *   console.log(`${point.date}: $${point.price}/${point.unit}`);
   * });
   * ```
   */
  async historical(
    port: string,
    options?: HistoricalBunkerOptions,
  ): Promise<HistoricalBunkerPrice[]> {
    if (!port || typeof port !== "string") {
      throw new ValidationError("Port code must be a non-empty string");
    }

    const params: Record<string, string> = {};
    if (options?.startDate) params.from = options.startDate;
    if (options?.endDate) params.to = options.endDate;
    if (options?.interval) params.interval = options.interval;

    // Port code is a PATH segment: GET /v1/bunker-fuels/historical/:port_code
    const response = await this.client["request"]<
      HistoricalBunkerPrice[] | { data: HistoricalBunkerPrice[] }
    >(`/v1/bunker-fuels/historical/${port}`, params);

    return Array.isArray(response) ? response : response.data;
  }

  /**
   * Export bunker fuel data
   *
   * Export bunker fuel prices in specified format (CSV, JSON, Excel).
   *
   * @param format - Export format (default: "csv")
   * @returns Export data or download URL
   *
   * @throws {OilPriceAPIError} If API request fails
   *
   * @example
   * ```typescript
   * // Export as CSV
   * const csvData = await client.bunkerFuels.export('csv');
   *
   * // Export as JSON
   * const jsonData = await client.bunkerFuels.export('json');
   * ```
   */
  async export(format?: string): Promise<any> {
    const params: Record<string, string> = {};
    if (format) params.format = format;

    return this.client["request"]<any>("/v1/bunker-fuels/export", params);
  }
}
