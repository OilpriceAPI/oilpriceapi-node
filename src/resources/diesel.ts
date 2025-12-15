import type { OilPriceAPI } from '../client.js';

/**
 * Diesel price data for a specific state or region
 */
export interface DieselPrice {
  /** State code (e.g., "CA", "TX") */
  state: string;
  /** Average diesel price in USD per gallon */
  price: number;
  /** Currency code (always "USD" for diesel) */
  currency: string;
  /** Unit of measurement (always "gallon") */
  unit: string;
  /** Granularity level (e.g., "state", "national") */
  granularity: string;
  /** Data source (e.g., "EIA") */
  source: string;
  /** ISO 8601 timestamp of last update */
  updated_at: string;
  /** Whether the response was served from cache */
  cached?: boolean;
}

/**
 * Diesel station location and pricing data
 */
export interface DieselStation {
  /** Station name */
  name: string;
  /** Full street address */
  address: string;
  /** Geographic coordinates */
  location: {
    /** Latitude */
    lat: number;
    /** Longitude */
    lng: number;
  };
  /** Diesel price at this station (USD per gallon) */
  diesel_price: number;
  /** Formatted price string (e.g., "$3.89") */
  formatted_price: string;
  /** Currency code (always "USD") */
  currency: string;
  /** Unit (always "gallon") */
  unit: string;
  /** Price difference from regional average (negative = cheaper) */
  price_delta?: number;
  /** Human-readable comparison (e.g., "$0.15 cheaper than regional average") */
  price_vs_average?: string;
  /** Available fuel types at this station */
  fuel_types?: string[];
  /** ISO 8601 timestamp of last price update */
  last_updated?: string;
}

/**
 * Response from diesel stations endpoint
 */
export interface DieselStationsResponse {
  /** Regional average for comparison */
  regional_average: {
    price: number;
    currency: string;
    unit: string;
    region: string;
    granularity: string;
    source: string;
  };
  /** List of nearby stations */
  stations: DieselStation[];
  /** Search area details */
  search_area: {
    center: {
      lat: number;
      lng: number;
    };
    radius_meters: number;
    radius_miles: number;
  };
  /** Metadata about the response */
  metadata: {
    total_stations: number;
    source: string;
    cached: boolean;
    api_cost: number;
    timestamp: string;
    cache_age_hours?: number;
  };
}

/**
 * Options for getting diesel stations
 */
export interface GetDieselStationsOptions {
  /** Latitude */
  lat: number;
  /** Longitude */
  lng: number;
  /** Search radius in meters (default: 8047 = 5 miles) */
  radius?: number;
}

/**
 * Diesel Prices resource
 *
 * Provides access to state-level diesel averages and station-level pricing.
 *
 * @example
 * ```typescript
 * // Get state average
 * const caPrice = await client.diesel.getPrice('CA');
 * console.log(`California diesel: $${caPrice.price}/gal`);
 *
 * // Get nearby stations
 * const stations = await client.diesel.getStations({
 *   lat: 37.7749,
 *   lng: -122.4194,
 *   radius: 8047  // 5 miles in meters
 * });
 *
 * console.log(`Found ${stations.stations.length} stations`);
 * stations.stations.forEach(station => {
 *   console.log(`${station.name}: ${station.formatted_price}`);
 * });
 * ```
 */
export class DieselResource {
  constructor(private client: OilPriceAPI) {}

  /**
   * Get average diesel price for a US state
   *
   * Returns EIA state-level average diesel price. This endpoint is free
   * and included in all tiers.
   *
   * @param state - Two-letter US state code (e.g., "CA", "TX", "NY")
   * @returns State average diesel price
   *
   * @throws {NotFoundError} If state code is invalid
   * @throws {AuthenticationError} If API key is invalid
   * @throws {RateLimitError} If rate limit exceeded
   *
   * @example
   * ```typescript
   * // Get California diesel price
   * const caPrice = await client.diesel.getPrice('CA');
   * console.log(`CA diesel: $${caPrice.price}/gal`);
   * console.log(`Source: ${caPrice.source}`);
   * console.log(`Updated: ${caPrice.updated_at}`);
   * ```
   */
  async getPrice(state: string): Promise<DieselPrice> {
    if (!state || state.length !== 2) {
      throw new Error('State must be a 2-letter US state code (e.g., "CA", "TX")');
    }

    const response = await this.client['request']<{ regional_average: DieselPrice }>(
      '/v1/diesel-prices',
      { state: state.toUpperCase() }
    );

    return response.regional_average;
  }

  /**
   * Get nearby diesel stations with current pricing
   *
   * Returns station-level diesel prices within specified radius using Google Maps data.
   *
   * **Pricing:** Included in paid tiers:
   * - Exploration: 100 station queries/month
   * - Starter: 500 station queries/month
   * - Professional: 2,000 station queries/month
   * - Business: 5,000 station queries/month
   *
   * **Caching:** Results are cached for 24 hours to minimize costs.
   *
   * @param options - Search parameters (lat, lng, radius)
   * @returns Nearby stations with prices and regional average
   *
   * @throws {AuthenticationError} If API key is invalid
   * @throws {RateLimitError} If monthly station query limit exceeded
   * @throws {Error} If coordinates are invalid
   *
   * @example
   * ```typescript
   * // Get stations near San Francisco
   * const result = await client.diesel.getStations({
   *   lat: 37.7749,
   *   lng: -122.4194,
   *   radius: 8047  // 5 miles
   * });
   *
   * console.log(`Regional avg: $${result.regional_average.price}/gal`);
   * console.log(`Found ${result.stations.length} stations`);
   *
   * // Find cheapest station
   * const cheapest = result.stations.reduce((min, s) =>
   *   s.diesel_price < min.diesel_price ? s : min
   * );
   * console.log(`Cheapest: ${cheapest.name} at ${cheapest.formatted_price}`);
   * ```
   */
  async getStations(options: GetDieselStationsOptions): Promise<DieselStationsResponse> {
    const { lat, lng, radius = 8047 } = options;

    // Validate coordinates
    if (lat < -90 || lat > 90) {
      throw new Error('Latitude must be between -90 and 90');
    }
    if (lng < -180 || lng > 180) {
      throw new Error('Longitude must be between -180 and 180');
    }
    if (radius < 0 || radius > 50000) {
      throw new Error('Radius must be between 0 and 50000 meters');
    }

    // Use POST request for stations endpoint
    const response = await fetch(
      `${this.client['baseUrl']}/v1/diesel-prices/stations`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.client['apiKey']}`,
          'Content-Type': 'application/json',
          'User-Agent': 'oilpriceapi-node/0.4.0',
          'X-SDK-Language': 'javascript',
          'X-SDK-Version': '0.4.0',
          'X-Client-Type': 'sdk',
        },
        body: JSON.stringify({ lat, lng, radius }),
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

      try {
        const errorJson = JSON.parse(errorBody);
        errorMessage = errorJson.message || errorJson.error || errorMessage;
      } catch {
        // Use default error message
      }

      // Handle specific status codes
      if (response.status === 403) {
        throw new Error(
          `Diesel station queries not available on your plan. ${errorMessage}`
        );
      }
      if (response.status === 429) {
        throw new Error(
          `Diesel station query limit exceeded. ${errorMessage}`
        );
      }

      throw new Error(errorMessage);
    }

    const data = await response.json() as DieselStationsResponse;
    return data;
  }
}
