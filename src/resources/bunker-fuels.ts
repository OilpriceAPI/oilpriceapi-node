/**
 * Bunker Fuels Resource
 *
 * Access bunker fuel prices at major ports worldwide, including VLSFO, MGO,
 * and IFO380. Compare prices across ports and track historical trends.
 *
 * Response shapes below mirror the backend `V1::BunkerFuelsController`
 * exactly (after the client strips the outer `{ data: ... }` envelope).
 */

import type { OilPriceAPI } from "../client.js";
import { ValidationError } from "../errors.js";

/**
 * Port information block returned on every port-scoped response
 */
export interface BunkerPortInfo {
  /** Port code (e.g., "SIN", "RTM") */
  code: string;
  /** Port name (e.g., "Singapore") */
  name: string;
  /** Country */
  country: string;
  /** IANA timezone (e.g., "Asia/Singapore") */
  timezone?: string | null;
  /** Rank by bunkering volume (1 = largest) */
  volume_rank?: number | null;
}

/**
 * A single fuel-grade price entry at a port.
 *
 * NOTE (v1.0.0): the API returns port prices as an ARRAY of these entries —
 * one per fuel grade — not as a `{ VLSFO: number }` keyed object as pre-1.0
 * SDK types claimed. See https://github.com/OilpriceAPI/oilpriceapi-node/issues/29
 */
export interface BunkerFuelPrice {
  /** Fuel grade code (e.g., "VLSFO", "MGO", "HSFO", "IFO380") */
  grade: string;
  /** Human-readable grade name (e.g., "Very Low Sulfur Fuel Oil") */
  grade_name: string;
  /** Price per metric ton */
  price: number;
  /** Currency code (typically "USD") */
  currency: string;
  /** Unit (typically "MT" for metric ton) */
  unit: string;
  /** Absolute price change vs ~24h ago; null when no prior data */
  change_24h: number | null;
  /** Percent price change vs ~24h ago; null when no prior data */
  change_pct_24h: number | null;
  /** Number of suppliers quoting at this port, when known */
  supplier_count?: number | null;
  /** Availability indicator, when known */
  availability?: string | null;
  /** ISO timestamp when the price was recorded */
  last_updated: string;
}

/**
 * A spread figure between two prices (port-to-port or grade-to-grade)
 */
export interface BunkerSpreadValue {
  /** Spread in USD/MT */
  value: number;
  /** Spread as a percentage of the base price */
  percentage: number;
  /** Estimated daily scrubber benefit (VLSFO/HSFO spread only) */
  scrubber_benefit_daily?: number;
}

/**
 * Response metadata block attached to bunker fuel responses
 */
export interface BunkerResponseMetadata {
  request_id: string;
  /** ISO timestamp when the response was generated */
  timestamp: string;
  /** Server cache TTL in seconds */
  cache_ttl: number;
  data_source: string;
  currency: string;
  unit: string;
  /** Additional fields (e.g., `port_count` on the all-ports endpoint) */
  [key: string]: unknown;
}

/**
 * Port entry in the all-ports / comparison responses
 */
export interface PortPricesEntry {
  /** Port information */
  port: BunkerPortInfo;
  /** Price entries, one per fuel grade */
  prices: BunkerFuelPrice[];
}

/**
 * All-ports bunker prices response (`GET /v1/bunker-fuels/all`)
 */
export interface AllBunkerPrices {
  /** Port data keyed by port code (e.g., `ports.SIN.prices`) */
  ports: Record<string, PortPricesEntry>;
  metadata: BunkerResponseMetadata;
}

/**
 * Port-specific bunker fuel prices (`GET /v1/bunker-fuels/ports/:port_code`)
 *
 * BREAKING (v1.0.0): `prices` is an ARRAY of {@link BunkerFuelPrice} entries
 * (one per fuel grade), not a `{ VLSFO: number }` keyed object. `port` is an
 * info object, not a string. (#29)
 */
export interface PortBunkerPrices {
  /** Port information */
  port: BunkerPortInfo;
  /** Price entries, one per fuel grade available at the port */
  prices: BunkerFuelPrice[];
  /**
   * Spreads: keys like `to_rtm` map to per-grade spread objects
   * (`{ vlsfo: { value, percentage } }`); `vlsfo_hsfo_spread` maps directly
   * to a {@link BunkerSpreadValue}.
   */
  spreads: Record<string, BunkerSpreadValue | Record<string, BunkerSpreadValue>>;
  metadata: BunkerResponseMetadata;
}

/**
 * Price comparison between ports (`GET /v1/bunker-fuels/compare`)
 */
export interface PortPriceComparison {
  /** Per-port data keyed by port code */
  comparison: Record<string, PortPricesEntry>;
  /** Cross-port spreads keyed by pair (e.g., `SIN_RTM`) */
  spreads: Record<string, unknown>;
  metadata: BunkerResponseMetadata;
}

/**
 * Port-to-port spread detail when a specific fuel grade was requested
 */
export interface PortToPortSpreadDetail {
  value: number;
  percentage: number;
  from_price?: number;
  to_price?: number;
  arbitrage_opportunity?: string;
}

/**
 * Port-to-port spread response (`GET /v1/bunker-fuels/spreads/ports`)
 */
export interface BunkerFuelSpreads {
  from_port: BunkerPortInfo;
  to_port: BunkerPortInfo;
  /** The requested fuel grade, or null when comparing all grades */
  fuel_grade: string | null;
  /**
   * With a `grade` param: a single {@link PortToPortSpreadDetail}.
   * Without: spread per grade keyed by lowercase grade code
   * (e.g., `{ vlsfo: { value, percentage } }`). Empty object when either
   * port has no price data.
   */
  spreads: PortToPortSpreadDetail | Record<string, BunkerSpreadValue>;
  metadata: BunkerResponseMetadata;
}

/**
 * Aggregated historical price point
 */
export interface HistoricalBunkerPrice {
  /** ISO timestamp of the aggregation bucket */
  timestamp: string;
  /** Commodity code (e.g., "VLSFO_SIN") */
  code: string;
  /** Average price over the interval */
  average_value: number;
  /** Aggregation interval (e.g., "daily") */
  interval_type: string;
  /** Present when served from pre-computed daily summaries */
  min_value?: number;
  max_value?: number;
  open_value?: number;
  close_value?: number;
  sample_count?: number;
}

/**
 * Historical bunker prices response (`GET /v1/bunker-fuels/historical/:port_code`)
 */
export interface HistoricalBunkerData {
  /** Port information */
  port: BunkerPortInfo;
  /** Aggregated price points, most recent first (all grades for the port) */
  historical_data: HistoricalBunkerPrice[];
  /** The resolved query period */
  period: {
    from: string;
    to: string;
    interval: string;
  };
  metadata: BunkerResponseMetadata;
}

/**
 * A row in the JSON export (`GET /v1/bunker-fuels/export?format=json`)
 */
export interface BunkerExportRow {
  timestamp: string;
  port_code: string;
  port_name: string;
  fuel_grade: string;
  price_usd_mt: number;
  supplier_count?: number | null;
  availability?: string | null;
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
 * // Get prices for a specific port — prices is an ARRAY of grade entries
 * const singapore = await client.bunkerFuels.port('SIN');
 * const vlsfo = singapore.prices.find(p => p.grade === 'VLSFO');
 * console.log(`Singapore VLSFO: $${vlsfo?.price}/MT`);
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
   * Returns prices for all tracked ports, keyed by port code. Requires a
   * Professional plan or above.
   *
   * @returns All-ports bunker prices
   *
   * @throws {OilPriceAPIError} If API request fails
   * @throws {AuthenticationError} If API key is invalid
   *
   * @example
   * ```typescript
   * const all = await client.bunkerFuels.all();
   * for (const [code, entry] of Object.entries(all.ports)) {
   *   entry.prices.forEach(p => {
   *     console.log(`${entry.port.name} ${p.grade}: $${p.price}/${p.unit}`);
   *   });
   * }
   * ```
   */
  async all(): Promise<AllBunkerPrices> {
    // Route is GET /v1/bunker-fuels/all (the bare /v1/bunker-fuels has no route).
    return this.client["request"]<AllBunkerPrices>("/v1/bunker-fuels/all", {});
  }

  /**
   * Get bunker fuel prices for a specific port
   *
   * @param code - Port code (e.g., "SIN" for Singapore, "RTM" for Rotterdam)
   * @returns Port-specific prices — `prices` is an array of per-grade entries
   *
   * @throws {NotFoundError} If port code not found
   * @throws {OilPriceAPIError} If API request fails
   *
   * @example
   * ```typescript
   * const singapore = await client.bunkerFuels.port('SIN');
   * console.log(`${singapore.port.name} bunker prices:`);
   * singapore.prices.forEach(p => {
   *   console.log(`${p.grade}: $${p.price}/${p.unit} (${p.change_24h ?? 'n/a'} 24h)`);
   * });
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
   * @param ports - Array of port codes to compare (2-10 ports)
   * @returns Per-port price data keyed by port code, plus cross-port spreads
   *
   * @throws {OilPriceAPIError} If API request fails
   *
   * @example
   * ```typescript
   * const comparison = await client.bunkerFuels.compare(['SIN', 'RTM', 'HOU']);
   *
   * for (const [code, entry] of Object.entries(comparison.comparison)) {
   *   const vlsfo = entry.prices.find(p => p.grade === 'VLSFO');
   *   console.log(`${entry.port.name}: $${vlsfo?.price}/MT`);
   * }
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
   * The history endpoint is keyed by port in the PATH (`/historical/:port_code`)
   * and returns all grades for that port; it does not filter by a single fuel
   * type. It reads `from` / `to` / `interval` query params.
   *
   * @param port - Port code (e.g., "SIN", "RTM") — used as a path segment
   * @param options - `{ startDate, endDate, interval }`
   * @returns Historical price data with port info and the resolved period
   *
   * @throws {NotFoundError} If port not found
   * @throws {OilPriceAPIError} If API request fails
   *
   * @example
   * ```typescript
   * const history = await client.bunkerFuels.historical('SIN', {
   *   startDate: '2024-01-01',
   *   endDate: '2024-12-31'
   * });
   *
   * history.historical_data.forEach(point => {
   *   console.log(`${point.timestamp} ${point.code}: ${point.average_value}`);
   * });
   * ```
   */
  async historical(port: string, options?: HistoricalBunkerOptions): Promise<HistoricalBunkerData> {
    if (!port || typeof port !== "string") {
      throw new ValidationError("Port code must be a non-empty string");
    }

    const params: Record<string, string> = {};
    if (options?.startDate) params.from = options.startDate;
    if (options?.endDate) params.to = options.endDate;
    if (options?.interval) params.interval = options.interval;

    // Port code is a PATH segment: GET /v1/bunker-fuels/historical/:port_code
    return this.client["request"]<HistoricalBunkerData>(
      `/v1/bunker-fuels/historical/${port}`,
      params,
    );
  }

  /**
   * Export bunker fuel data
   *
   * Export bunker fuel prices in the specified format. JSON (the default)
   * returns an array of {@link BunkerExportRow}; CSV is served as a file
   * download and is better fetched directly over HTTP.
   *
   * @param format - Export format (default: "json")
   * @returns Export rows (JSON format)
   *
   * @throws {OilPriceAPIError} If API request fails
   *
   * @example
   * ```typescript
   * const rows = await client.bunkerFuels.export('json');
   * console.log(`${rows.length} price rows exported`);
   * ```
   */
  async export(format?: string): Promise<BunkerExportRow[]> {
    const params: Record<string, string> = {};
    if (format) params.format = format;

    return this.client["request"]<BunkerExportRow[]>("/v1/bunker-fuels/export", params);
  }
}
