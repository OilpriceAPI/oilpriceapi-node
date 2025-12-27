import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { OilPriceAPI } from '../src/index.js';

/**
 * Historical Prices Tests
 *
 * CRITICAL BUG FIX (December 17, 2025):
 * The getHistoricalPrices() method was using the wrong endpoint (/v1/prices)
 * which does NOT correctly handle start_date/end_date parameters.
 *
 * This was the same bug that affected the Python SDK (fixed in v1.4.4).
 *
 * Root Cause: Backend /v1/prices endpoint ignores date range parameters
 * Solution: Use /v1/prices/past_year endpoint which correctly handles date filters
 *
 * These tests verify:
 * 1. Correct endpoint is used (/v1/prices/past_year)
 * 2. Date parameters are passed correctly
 * 3. Response parsing works for all scenarios
 */
describe('Historical Prices', () => {
  let client: OilPriceAPI;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    client = new OilPriceAPI({ apiKey: 'test_key_12345' });
    // Reset fetch mock
    fetchSpy = vi.spyOn(global, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getHistoricalPrices()', () => {
    // Test the core fix: should use /v1/prices/past_year endpoint
    describe('Endpoint Selection (BUG FIX CRITICAL)', () => {
      it('should use /v1/prices/past_year endpoint for date range queries', async () => {
        const mockResponse = {
          status: 'success',
          data: {
            prices: [
              {
                code: 'BRENT_CRUDE_USD',
                price: 74.50,
                formatted: '$74.50',
                currency: 'USD',
                created_at: '2024-12-10T12:00:00Z',
                type: 'spot_price',
                source: 'internal'
              }
            ]
          }
        };

        fetchSpy.mockResolvedValue({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => mockResponse
        } as Response);

        await client.getHistoricalPrices({
          startDate: '2024-12-05',
          endDate: '2024-12-17',
          commodity: 'BRENT_CRUDE_USD'
        });

        // CRITICAL: Verify correct endpoint is used
        expect(fetchSpy).toHaveBeenCalledWith(
          expect.stringContaining('/v1/prices/past_year'),
          expect.any(Object)
        );

        // Verify date parameters are passed
        const callUrl = fetchSpy.mock.calls[0][0] as string;
        expect(callUrl).toContain('start_date=2024-12-05');
        expect(callUrl).toContain('end_date=2024-12-17');
        expect(callUrl).toContain('by_code=BRENT_CRUDE_USD');
      });

      it('should NOT use /v1/prices endpoint (broken endpoint)', async () => {
        const mockResponse = {
          status: 'success',
          data: { prices: [] }
        };

        fetchSpy.mockResolvedValue({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => mockResponse
        } as Response);

        await client.getHistoricalPrices({
          startDate: '2024-01-01',
          endDate: '2024-12-31'
        });

        const callUrl = fetchSpy.mock.calls[0][0] as string;

        // Should NOT be the broken /v1/prices endpoint
        // It should be /v1/prices/past_year (or similar convenience endpoint)
        expect(callUrl).not.toMatch(/\/v1\/prices\?/);
        expect(callUrl).toContain('/v1/prices/past_year');
      });

      it('should use past_year endpoint even for period queries', async () => {
        const mockResponse = {
          status: 'success',
          data: { prices: [] }
        };

        fetchSpy.mockResolvedValue({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => mockResponse
        } as Response);

        await client.getHistoricalPrices({
          period: 'past_week',
          commodity: 'WTI_USD'
        });

        const callUrl = fetchSpy.mock.calls[0][0] as string;
        expect(callUrl).toContain('/v1/prices/past_year');
      });
    });

    describe('Date Parameter Handling', () => {
      it('should pass start_date parameter correctly', async () => {
        const mockResponse = {
          status: 'success',
          data: { prices: [] }
        };

        fetchSpy.mockResolvedValue({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => mockResponse
        } as Response);

        await client.getHistoricalPrices({
          startDate: '2024-06-15'
        });

        const callUrl = fetchSpy.mock.calls[0][0] as string;
        expect(callUrl).toContain('start_date=2024-06-15');
      });

      it('should pass end_date parameter correctly', async () => {
        const mockResponse = {
          status: 'success',
          data: { prices: [] }
        };

        fetchSpy.mockResolvedValue({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => mockResponse
        } as Response);

        await client.getHistoricalPrices({
          endDate: '2024-12-31'
        });

        const callUrl = fetchSpy.mock.calls[0][0] as string;
        expect(callUrl).toContain('end_date=2024-12-31');
      });

      it('should pass both start_date and end_date for custom ranges', async () => {
        const mockResponse = {
          status: 'success',
          data: { prices: [] }
        };

        fetchSpy.mockResolvedValue({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => mockResponse
        } as Response);

        await client.getHistoricalPrices({
          startDate: '2024-01-01',
          endDate: '2024-03-31',
          commodity: 'NATURAL_GAS_USD'
        });

        const callUrl = fetchSpy.mock.calls[0][0] as string;
        expect(callUrl).toContain('start_date=2024-01-01');
        expect(callUrl).toContain('end_date=2024-03-31');
        expect(callUrl).toContain('by_code=NATURAL_GAS_USD');
      });

      it('should handle year-spanning date ranges', async () => {
        const mockResponse = {
          status: 'success',
          data: { prices: [] }
        };

        fetchSpy.mockResolvedValue({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => mockResponse
        } as Response);

        await client.getHistoricalPrices({
          startDate: '2023-12-01',
          endDate: '2024-02-28'
        });

        const callUrl = fetchSpy.mock.calls[0][0] as string;
        expect(callUrl).toContain('start_date=2023-12-01');
        expect(callUrl).toContain('end_date=2024-02-28');
      });
    });

    describe('Period Parameter Handling', () => {
      it('should pass period parameter for past_week', async () => {
        const mockResponse = {
          status: 'success',
          data: { prices: [] }
        };

        fetchSpy.mockResolvedValue({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => mockResponse
        } as Response);

        await client.getHistoricalPrices({
          period: 'past_week'
        });

        const callUrl = fetchSpy.mock.calls[0][0] as string;
        expect(callUrl).toContain('period=past_week');
      });

      it('should pass period parameter for past_month', async () => {
        const mockResponse = {
          status: 'success',
          data: { prices: [] }
        };

        fetchSpy.mockResolvedValue({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => mockResponse
        } as Response);

        await client.getHistoricalPrices({
          period: 'past_month',
          commodity: 'WTI_USD'
        });

        const callUrl = fetchSpy.mock.calls[0][0] as string;
        expect(callUrl).toContain('period=past_month');
        expect(callUrl).toContain('by_code=WTI_USD');
      });

      it('should pass period parameter for past_year', async () => {
        const mockResponse = {
          status: 'success',
          data: { prices: [] }
        };

        fetchSpy.mockResolvedValue({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => mockResponse
        } as Response);

        await client.getHistoricalPrices({
          period: 'past_year'
        });

        const callUrl = fetchSpy.mock.calls[0][0] as string;
        expect(callUrl).toContain('period=past_year');
      });
    });

    describe('Response Parsing', () => {
      it('should parse nested prices array correctly', async () => {
        const mockPrices = [
          {
            code: 'BRENT_CRUDE_USD',
            price: 74.50,
            formatted: '$74.50',
            currency: 'USD',
            created_at: '2024-12-10T12:00:00Z',
            type: 'spot_price',
            source: 'internal'
          },
          {
            code: 'BRENT_CRUDE_USD',
            price: 75.20,
            formatted: '$75.20',
            currency: 'USD',
            created_at: '2024-12-11T12:00:00Z',
            type: 'spot_price',
            source: 'internal'
          }
        ];

        const mockResponse = {
          status: 'success',
          data: { prices: mockPrices }
        };

        fetchSpy.mockResolvedValue({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => mockResponse
        } as Response);

        const result = await client.getHistoricalPrices({
          startDate: '2024-12-10',
          endDate: '2024-12-11',
          commodity: 'BRENT_CRUDE_USD'
        });

        expect(result).toHaveLength(2);
        expect(result[0].price).toBe(74.50);
        expect(result[1].price).toBe(75.20);
      });

      it('should return empty array for no data', async () => {
        const mockResponse = {
          status: 'success',
          data: { prices: [] }
        };

        fetchSpy.mockResolvedValue({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => mockResponse
        } as Response);

        const result = await client.getHistoricalPrices({
          startDate: '2020-01-01',
          endDate: '2020-01-02'
        });

        expect(result).toEqual([]);
      });

      it('should handle large result sets', async () => {
        const mockPrices = Array.from({ length: 365 }, (_, i) => ({
          code: 'WTI_USD',
          price: 70 + Math.random() * 10,
          formatted: `$${(70 + Math.random() * 10).toFixed(2)}`,
          currency: 'USD',
          created_at: new Date(2024, 0, i + 1).toISOString(),
          type: 'spot_price',
          source: 'internal'
        }));

        const mockResponse = {
          status: 'success',
          data: { prices: mockPrices }
        };

        fetchSpy.mockResolvedValue({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => mockResponse
        } as Response);

        const result = await client.getHistoricalPrices({
          startDate: '2024-01-01',
          endDate: '2024-12-31',
          commodity: 'WTI_USD'
        });

        expect(result).toHaveLength(365);
      });
    });

    describe('Commodity Filtering', () => {
      it('should filter by commodity code', async () => {
        const mockResponse = {
          status: 'success',
          data: { prices: [] }
        };

        fetchSpy.mockResolvedValue({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => mockResponse
        } as Response);

        await client.getHistoricalPrices({
          commodity: 'BRENT_CRUDE_USD'
        });

        const callUrl = fetchSpy.mock.calls[0][0] as string;
        expect(callUrl).toContain('by_code=BRENT_CRUDE_USD');
      });

      it('should work without commodity filter (all commodities)', async () => {
        const mockResponse = {
          status: 'success',
          data: { prices: [] }
        };

        fetchSpy.mockResolvedValue({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => mockResponse
        } as Response);

        await client.getHistoricalPrices({
          period: 'past_week'
        });

        const callUrl = fetchSpy.mock.calls[0][0] as string;
        expect(callUrl).not.toContain('by_code=');
      });
    });

    describe('No Options Provided', () => {
      it('should work with no options (default behavior)', async () => {
        const mockResponse = {
          status: 'success',
          data: { prices: [] }
        };

        fetchSpy.mockResolvedValue({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => mockResponse
        } as Response);

        const result = await client.getHistoricalPrices();

        expect(fetchSpy).toHaveBeenCalled();
        expect(result).toEqual([]);
      });
    });

    /**
     * PERFORMANCE FIX (December 24, 2025):
     * Add interval parameter support to reduce response times from 74s to <1s
     *
     * Problem: /v1/prices/past_year with raw data returns 600k+ records for BRENT
     * Solution: Use aggregated intervals (daily/weekly/monthly) for year-long queries
     *
     * Expected behavior:
     * 1. Allow explicit interval parameter
     * 2. Default to 'daily' when no interval specified and querying year+ of data
     * 3. Pass through to API correctly
     */
    describe('Interval Parameter (PERFORMANCE FIX)', () => {
      it('should pass interval parameter when explicitly provided', async () => {
        const mockResponse = {
          status: 'success',
          data: { prices: [] }
        };

        fetchSpy.mockResolvedValue({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => mockResponse
        } as Response);

        await client.getHistoricalPrices({
          period: 'past_year',
          commodity: 'BRENT_CRUDE_USD',
          interval: 'daily'
        });

        const callUrl = fetchSpy.mock.calls[0][0] as string;
        expect(callUrl).toContain('interval=daily');
      });

      it('should support weekly interval', async () => {
        const mockResponse = {
          status: 'success',
          data: { prices: [] }
        };

        fetchSpy.mockResolvedValue({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => mockResponse
        } as Response);

        await client.getHistoricalPrices({
          period: 'past_year',
          interval: 'weekly'
        });

        const callUrl = fetchSpy.mock.calls[0][0] as string;
        expect(callUrl).toContain('interval=weekly');
      });

      it('should support monthly interval', async () => {
        const mockResponse = {
          status: 'success',
          data: { prices: [] }
        };

        fetchSpy.mockResolvedValue({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => mockResponse
        } as Response);

        await client.getHistoricalPrices({
          period: 'past_year',
          interval: 'monthly'
        });

        const callUrl = fetchSpy.mock.calls[0][0] as string;
        expect(callUrl).toContain('interval=monthly');
      });

      it('should support raw interval (no aggregation)', async () => {
        const mockResponse = {
          status: 'success',
          data: { prices: [] }
        };

        fetchSpy.mockResolvedValue({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => mockResponse
        } as Response);

        await client.getHistoricalPrices({
          period: 'past_week',
          interval: 'raw'
        });

        const callUrl = fetchSpy.mock.calls[0][0] as string;
        expect(callUrl).toContain('interval=raw');
      });

      it('should NOT pass interval when not specified (let API use defaults)', async () => {
        const mockResponse = {
          status: 'success',
          data: { prices: [] }
        };

        fetchSpy.mockResolvedValue({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => mockResponse
        } as Response);

        await client.getHistoricalPrices({
          period: 'past_week',
          commodity: 'WTI_USD'
        });

        const callUrl = fetchSpy.mock.calls[0][0] as string;
        expect(callUrl).not.toContain('interval=');
      });

      it('should support perPage parameter for pagination control', async () => {
        const mockResponse = {
          status: 'success',
          data: { prices: [] }
        };

        fetchSpy.mockResolvedValue({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => mockResponse
        } as Response);

        await client.getHistoricalPrices({
          period: 'past_year',
          perPage: 100
        });

        const callUrl = fetchSpy.mock.calls[0][0] as string;
        expect(callUrl).toContain('per_page=100');
      });

      it('should support page parameter for pagination', async () => {
        const mockResponse = {
          status: 'success',
          data: { prices: [] }
        };

        fetchSpy.mockResolvedValue({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => mockResponse
        } as Response);

        await client.getHistoricalPrices({
          period: 'past_year',
          page: 2,
          perPage: 50
        });

        const callUrl = fetchSpy.mock.calls[0][0] as string;
        expect(callUrl).toContain('page=2');
        expect(callUrl).toContain('per_page=50');
      });
    });
  });
});

describe('getLatestPrices()', () => {
  let client: OilPriceAPI;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    client = new OilPriceAPI({ apiKey: 'test_key_12345' });
    fetchSpy = vi.spyOn(global, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should use /v1/prices/latest endpoint', async () => {
    const mockResponse = {
      status: 'success',
      data: {
        code: 'WTI_USD',
        price: 72.50,
        formatted: '$72.50',
        currency: 'USD',
        created_at: '2024-12-17T10:00:00Z',
        type: 'spot_price',
        source: 'internal'
      }
    };

    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => mockResponse
    } as Response);

    await client.getLatestPrices({ commodity: 'WTI_USD' });

    const callUrl = fetchSpy.mock.calls[0][0] as string;
    expect(callUrl).toContain('/v1/prices/latest');
    expect(callUrl).toContain('by_code=WTI_USD');
  });

  it('should return array of prices', async () => {
    const mockResponse = {
      status: 'success',
      data: {
        code: 'BRENT_CRUDE_USD',
        price: 74.80,
        formatted: '$74.80',
        currency: 'USD',
        created_at: '2024-12-17T10:00:00Z',
        type: 'spot_price',
        source: 'internal'
      }
    };

    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => mockResponse
    } as Response);

    const result = await client.getLatestPrices({ commodity: 'BRENT_CRUDE_USD' });

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
    expect(result[0].price).toBe(74.80);
  });

  it('should work without options (all prices)', async () => {
    const mockResponse = {
      status: 'success',
      data: { prices: [] }
    };

    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => mockResponse
    } as Response);

    await client.getLatestPrices();

    const callUrl = fetchSpy.mock.calls[0][0] as string;
    expect(callUrl).toContain('/v1/prices/latest');
    expect(callUrl).not.toContain('by_code=');
  });
});

describe('getCommodities()', () => {
  let client: OilPriceAPI;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    client = new OilPriceAPI({ apiKey: 'test_key_12345' });
    fetchSpy = vi.spyOn(global, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should use /v1/commodities endpoint', async () => {
    const mockResponse = {
      status: 'success',
      data: {
        commodities: [
          { code: 'WTI_USD', name: 'WTI Crude Oil', currency: 'USD', category: 'oil', unit: 'barrel' }
        ]
      }
    };

    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => mockResponse
    } as Response);

    await client.getCommodities();

    const callUrl = fetchSpy.mock.calls[0][0] as string;
    expect(callUrl).toContain('/v1/commodities');
  });
});

describe('getCommodityCategories()', () => {
  let client: OilPriceAPI;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    client = new OilPriceAPI({ apiKey: 'test_key_12345' });
    fetchSpy = vi.spyOn(global, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should use /v1/commodities/categories endpoint', async () => {
    const mockResponse = {
      status: 'success',
      data: {
        oil: { name: 'Oil', commodities: [] },
        gas: { name: 'Natural Gas', commodities: [] }
      }
    };

    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => mockResponse
    } as Response);

    await client.getCommodityCategories();

    const callUrl = fetchSpy.mock.calls[0][0] as string;
    expect(callUrl).toContain('/v1/commodities/categories');
  });
});

describe('getCommodity()', () => {
  let client: OilPriceAPI;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    client = new OilPriceAPI({ apiKey: 'test_key_12345' });
    fetchSpy = vi.spyOn(global, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should use /v1/commodities/:code endpoint', async () => {
    const mockResponse = {
      status: 'success',
      data: {
        code: 'BRENT_CRUDE_USD',
        name: 'Brent Crude Oil',
        currency: 'USD',
        category: 'oil',
        unit: 'barrel'
      }
    };

    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => mockResponse
    } as Response);

    await client.getCommodity('BRENT_CRUDE_USD');

    const callUrl = fetchSpy.mock.calls[0][0] as string;
    expect(callUrl).toContain('/v1/commodities/BRENT_CRUDE_USD');
  });
});
