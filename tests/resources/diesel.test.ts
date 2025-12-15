import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OilPriceAPI } from '../../src/index.js';
import type { DieselPrice, DieselStationsResponse } from '../../src/resources/diesel.js';

describe('DieselResource', () => {
  let client: OilPriceAPI;

  beforeEach(() => {
    client = new OilPriceAPI({ apiKey: 'test_key_12345' });
  });

  describe('getPrice()', () => {
    it('should reject empty state code', async () => {
      await expect(client.diesel.getPrice('')).rejects.toThrow(
        'State must be a 2-letter US state code'
      );
    });

    it('should reject invalid state code length (1 char)', async () => {
      await expect(client.diesel.getPrice('C')).rejects.toThrow(
        'State must be a 2-letter US state code'
      );
    });

    it('should reject invalid state code length (3 chars)', async () => {
      await expect(client.diesel.getPrice('CAL')).rejects.toThrow(
        'State must be a 2-letter US state code'
      );
    });

    it('should convert lowercase state code to uppercase', async () => {
      // Mock the internal request method
      const mockResponse: { regional_average: DieselPrice } = {
        regional_average: {
          state: 'CA',
          price: 3.89,
          currency: 'USD',
          unit: 'gallon',
          granularity: 'state',
          source: 'EIA',
          updated_at: '2025-12-15T10:00:00Z',
          cached: false
        }
      };

      // Spy on the private request method
      const requestSpy = vi.spyOn(client as any, 'request').mockResolvedValue(mockResponse);

      const result = await client.diesel.getPrice('ca');

      expect(result).toEqual(mockResponse.regional_average);
      expect(requestSpy).toHaveBeenCalledWith('/v1/diesel-prices', { state: 'CA' });
    });

    it('should return diesel price for valid state code', async () => {
      const mockResponse: { regional_average: DieselPrice } = {
        regional_average: {
          state: 'TX',
          price: 3.45,
          currency: 'USD',
          unit: 'gallon',
          granularity: 'state',
          source: 'EIA',
          updated_at: '2025-12-15T10:00:00Z',
          cached: true
        }
      };

      vi.spyOn(client as any, 'request').mockResolvedValue(mockResponse);

      const result = await client.diesel.getPrice('TX');

      expect(result.state).toBe('TX');
      expect(result.price).toBe(3.45);
      expect(result.currency).toBe('USD');
      expect(result.unit).toBe('gallon');
      expect(result.source).toBe('EIA');
    });
  });

  describe('getStations()', () => {
    it('should reject invalid latitude (too low)', async () => {
      await expect(
        client.diesel.getStations({ lat: -91, lng: -122, radius: 5000 })
      ).rejects.toThrow('Latitude must be between -90 and 90');
    });

    it('should reject invalid latitude (too high)', async () => {
      await expect(
        client.diesel.getStations({ lat: 91, lng: -122, radius: 5000 })
      ).rejects.toThrow('Latitude must be between -90 and 90');
    });

    it('should reject invalid longitude (too low)', async () => {
      await expect(
        client.diesel.getStations({ lat: 37, lng: -181, radius: 5000 })
      ).rejects.toThrow('Longitude must be between -180 and 180');
    });

    it('should reject invalid longitude (too high)', async () => {
      await expect(
        client.diesel.getStations({ lat: 37, lng: 181, radius: 5000 })
      ).rejects.toThrow('Longitude must be between -180 and 180');
    });

    it('should reject negative radius', async () => {
      await expect(
        client.diesel.getStations({ lat: 37, lng: -122, radius: -100 })
      ).rejects.toThrow('Radius must be between 0 and 50000 meters');
    });

    it('should reject radius over 50km', async () => {
      await expect(
        client.diesel.getStations({ lat: 37, lng: -122, radius: 50001 })
      ).rejects.toThrow('Radius must be between 0 and 50000 meters');
    });

    it('should use default radius of 8047 meters (5 miles) if not provided', async () => {
      const mockResponse: DieselStationsResponse = {
        regional_average: {
          price: 3.89,
          currency: 'USD',
          unit: 'gallon',
          region: 'California',
          granularity: 'regional',
          source: 'Google Maps'
        },
        stations: [],
        search_area: {
          center: { lat: 37.7749, lng: -122.4194 },
          radius_meters: 8047,
          radius_miles: 5
        },
        metadata: {
          total_stations: 0,
          source: 'Google Maps',
          cached: true,
          api_cost: 0,
          timestamp: '2025-12-15T10:00:00Z'
        }
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      } as Response);

      const result = await client.diesel.getStations({
        lat: 37.7749,
        lng: -122.4194
      });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/diesel-prices/stations'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ lat: 37.7749, lng: -122.4194, radius: 8047 })
        })
      );
      expect(result.search_area.radius_meters).toBe(8047);
    });

    it('should return nearby diesel stations', async () => {
      const mockResponse: DieselStationsResponse = {
        regional_average: {
          price: 3.89,
          currency: 'USD',
          unit: 'gallon',
          region: 'California',
          granularity: 'regional',
          source: 'Google Maps'
        },
        stations: [
          {
            name: 'Chevron Station',
            address: '123 Main St, San Francisco, CA',
            location: { lat: 37.7750, lng: -122.4195 },
            diesel_price: 3.75,
            formatted_price: '$3.75',
            currency: 'USD',
            unit: 'gallon',
            price_delta: -0.14,
            price_vs_average: '$0.14 cheaper than regional average',
            fuel_types: ['diesel', 'regular', 'premium'],
            last_updated: '2025-12-15T09:30:00Z'
          },
          {
            name: 'Shell Gas',
            address: '456 Oak Ave, San Francisco, CA',
            location: { lat: 37.7760, lng: -122.4180 },
            diesel_price: 3.89,
            formatted_price: '$3.89',
            currency: 'USD',
            unit: 'gallon',
            price_delta: 0,
            price_vs_average: 'Same as regional average',
            fuel_types: ['diesel', 'regular'],
            last_updated: '2025-12-15T09:45:00Z'
          }
        ],
        search_area: {
          center: { lat: 37.7749, lng: -122.4194 },
          radius_meters: 5000,
          radius_miles: 3.1
        },
        metadata: {
          total_stations: 2,
          source: 'Google Maps',
          cached: false,
          api_cost: 0.024,
          timestamp: '2025-12-15T10:00:00Z',
          cache_age_hours: 0
        }
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      } as Response);

      const result = await client.diesel.getStations({
        lat: 37.7749,
        lng: -122.4194,
        radius: 5000
      });

      expect(result.stations).toHaveLength(2);
      expect(result.stations[0].name).toBe('Chevron Station');
      expect(result.stations[0].diesel_price).toBe(3.75);
      expect(result.regional_average.price).toBe(3.89);
      expect(result.search_area.radius_meters).toBe(5000);
      expect(result.metadata.total_stations).toBe(2);
    });

    it('should throw error for 403 (tier limit)', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: async () => JSON.stringify({
          message: 'Diesel station queries not available on free tier'
        })
      } as Response);

      await expect(
        client.diesel.getStations({ lat: 37.7749, lng: -122.4194, radius: 5000 })
      ).rejects.toThrow('Diesel station queries not available on your plan');
    });

    it('should throw error for 429 (rate limit)', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => JSON.stringify({
          message: 'Monthly limit of 100 station queries exceeded'
        })
      } as Response);

      await expect(
        client.diesel.getStations({ lat: 37.7749, lng: -122.4194, radius: 5000 })
      ).rejects.toThrow('Diesel station query limit exceeded');
    });

    it('should include correct headers in request', async () => {
      const mockResponse: DieselStationsResponse = {
        regional_average: {
          price: 3.89,
          currency: 'USD',
          unit: 'gallon',
          region: 'California',
          granularity: 'regional',
          source: 'Google Maps'
        },
        stations: [],
        search_area: {
          center: { lat: 37.7749, lng: -122.4194 },
          radius_meters: 8047,
          radius_miles: 5
        },
        metadata: {
          total_stations: 0,
          source: 'Google Maps',
          cached: true,
          api_cost: 0,
          timestamp: '2025-12-15T10:00:00Z'
        }
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      } as Response);

      await client.diesel.getStations({
        lat: 37.7749,
        lng: -122.4194,
        radius: 8047
      });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/diesel-prices/stations'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test_key_12345',
            'Content-Type': 'application/json',
            'User-Agent': 'oilpriceapi-node/0.4.0',
            'X-SDK-Language': 'javascript',
            'X-SDK-Version': '0.4.0',
            'X-Client-Type': 'sdk'
          })
        })
      );
    });
  });
});
