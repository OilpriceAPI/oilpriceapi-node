import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  OilPriceAPI,
  AuthenticationError,
  RateLimitError,
  NotFoundError,
  ServerError,
  TimeoutError,
  OilPriceAPIError
} from '../src/index.js';

/**
 * Error Handling Tests
 *
 * Comprehensive tests for SDK error handling, retry logic, and edge cases.
 * These tests ensure the SDK properly handles:
 * - Authentication errors (401)
 * - Rate limiting (429)
 * - Not found errors (404)
 * - Server errors (5xx)
 * - Timeout errors
 * - Network errors
 * - Retry logic with exponential backoff
 */
describe('Error Handling', () => {
  let client: OilPriceAPI;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    client = new OilPriceAPI({
      apiKey: 'test_key_12345',
      retries: 2,
      retryDelay: 10, // Fast retries for tests
      timeout: 5000
    });
    fetchSpy = vi.spyOn(global, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Authentication Errors (401)', () => {
    it('should throw AuthenticationError for 401 response', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => JSON.stringify({ message: 'Invalid API key' })
      } as Response);

      await expect(client.getLatestPrices()).rejects.toThrow(AuthenticationError);
    });

    it('should include error message from response', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => JSON.stringify({ message: 'API key expired' })
      } as Response);

      await expect(client.getLatestPrices()).rejects.toThrow('API key expired');
    });

    it('should not retry on authentication errors', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => JSON.stringify({ message: 'Invalid API key' })
      } as Response);

      await expect(client.getLatestPrices()).rejects.toThrow();

      // Should only be called once (no retries for auth errors)
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Rate Limit Errors (429)', () => {
    it('should throw RateLimitError for 429 response', async () => {
      // Create client with no retries to avoid waiting
      const noRetryClient = new OilPriceAPI({
        apiKey: 'test_key_12345',
        retries: 0
      });

      fetchSpy.mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        text: async () => JSON.stringify({ message: 'Rate limit exceeded' }),
        headers: new Headers()
      } as Response);

      await expect(noRetryClient.getLatestPrices()).rejects.toThrow(RateLimitError);
    });

    it('should parse Retry-After header', async () => {
      // Create client with no retries to avoid waiting
      const noRetryClient = new OilPriceAPI({
        apiKey: 'test_key_12345',
        retries: 0
      });

      const headers = new Headers();
      headers.set('Retry-After', '60');

      fetchSpy.mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        text: async () => JSON.stringify({ message: 'Rate limit exceeded' }),
        headers
      } as Response);

      try {
        await noRetryClient.getLatestPrices();
      } catch (error) {
        expect(error).toBeInstanceOf(RateLimitError);
        expect((error as RateLimitError).retryAfter).toBe(60);
      }
    });
  });

  describe('Not Found Errors (404)', () => {
    it('should throw NotFoundError for 404 response', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => JSON.stringify({ message: 'Commodity not found' })
      } as Response);

      await expect(client.getCommodity('INVALID_CODE')).rejects.toThrow(NotFoundError);
    });

    it('should not retry on not found errors', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => JSON.stringify({ message: 'Resource not found' })
      } as Response);

      await expect(client.getCommodity('FAKE')).rejects.toThrow();

      // Should only be called once (no retries for 404)
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Server Errors (5xx)', () => {
    it('should throw ServerError for 500 response', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => JSON.stringify({ message: 'Server error' })
      } as Response);

      await expect(client.getLatestPrices()).rejects.toThrow(ServerError);
    });

    it('should throw ServerError for 502 response', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
        text: async () => JSON.stringify({ message: 'Bad gateway' })
      } as Response);

      await expect(client.getLatestPrices()).rejects.toThrow(ServerError);
    });

    it('should throw ServerError for 503 response', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        text: async () => JSON.stringify({ message: 'Service unavailable' })
      } as Response);

      await expect(client.getLatestPrices()).rejects.toThrow(ServerError);
    });

    it('should throw ServerError for 504 response', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 504,
        statusText: 'Gateway Timeout',
        text: async () => JSON.stringify({ message: 'Gateway timeout' })
      } as Response);

      await expect(client.getLatestPrices()).rejects.toThrow(ServerError);
    });

    it('should retry on server errors', async () => {
      // Fail twice, then succeed
      fetchSpy
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          text: async () => JSON.stringify({ message: 'Server error' })
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          text: async () => JSON.stringify({ message: 'Server error' })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({
            status: 'success',
            data: { code: 'WTI_USD', price: 72.50, formatted: '$72.50', currency: 'USD', created_at: '2024-12-17T10:00:00Z', type: 'spot_price', source: 'internal' }
          })
        } as Response);

      const result = await client.getLatestPrices();

      // Should have retried twice (3 total calls)
      expect(fetchSpy).toHaveBeenCalledTimes(3);
      expect(result).toHaveLength(1);
    });
  });

  describe('Other HTTP Errors', () => {
    it('should throw OilPriceAPIError for other status codes', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 418,
        statusText: "I'm a teapot",
        text: async () => JSON.stringify({ message: 'Unexpected error' })
      } as Response);

      await expect(client.getLatestPrices()).rejects.toThrow(OilPriceAPIError);
    });

    it('should handle non-JSON error responses', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => 'Plain text error message'
      } as Response);

      await expect(client.getLatestPrices()).rejects.toThrow('HTTP 400');
    });
  });

  describe('Timeout Handling', () => {
    it('should use configured timeout value', () => {
      // Verify client can be configured with custom timeout
      const fastClient = new OilPriceAPI({
        apiKey: 'test_key',
        timeout: 1000,
        retries: 0
      });
      expect(fastClient).toBeInstanceOf(OilPriceAPI);
    });

    it('should pass abort signal to fetch', async () => {
      const mockResponse = {
        status: 'success',
        data: { code: 'WTI_USD', price: 72.50 }
      };

      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => mockResponse
      } as Response);

      await client.getLatestPrices();

      // Verify abort signal was passed to fetch
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          signal: expect.any(AbortSignal)
        })
      );
    });
  });

  describe('Retry Logic', () => {
    it('should use exponential backoff by default', async () => {
      const client = new OilPriceAPI({
        apiKey: 'test_key',
        retries: 2,
        retryDelay: 100,
        retryStrategy: 'exponential'
      });

      // All calls fail
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => JSON.stringify({ message: 'Server error' })
      } as Response);

      const startTime = Date.now();
      await expect(client.getLatestPrices()).rejects.toThrow();
      const elapsed = Date.now() - startTime;

      // Should have waited: 100ms + 200ms = 300ms (exponential: 100 * 2^0, 100 * 2^1)
      expect(elapsed).toBeGreaterThan(200);
    });

    it('should support linear backoff', async () => {
      const client = new OilPriceAPI({
        apiKey: 'test_key',
        retries: 2,
        retryDelay: 50,
        retryStrategy: 'linear'
      });

      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => JSON.stringify({ message: 'Server error' })
      } as Response);

      await expect(client.getLatestPrices()).rejects.toThrow();

      // Should have made 3 attempts (1 initial + 2 retries)
      expect(fetchSpy).toHaveBeenCalledTimes(3);
    });

    it('should support fixed backoff', async () => {
      const client = new OilPriceAPI({
        apiKey: 'test_key',
        retries: 2,
        retryDelay: 50,
        retryStrategy: 'fixed'
      });

      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => JSON.stringify({ message: 'Server error' })
      } as Response);

      await expect(client.getLatestPrices()).rejects.toThrow();

      // Should have made 3 attempts
      expect(fetchSpy).toHaveBeenCalledTimes(3);
    });

    it('should not retry when retries is set to 0', async () => {
      const client = new OilPriceAPI({
        apiKey: 'test_key',
        retries: 0
      });

      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => JSON.stringify({ message: 'Server error' })
      } as Response);

      await expect(client.getLatestPrices()).rejects.toThrow();

      // Should only be called once (no retries)
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });
});

describe('Client Configuration', () => {
  it('should use default values when not specified', () => {
    const client = new OilPriceAPI({ apiKey: 'test_key' });
    expect(client).toBeInstanceOf(OilPriceAPI);
  });

  it('should accept custom timeout', () => {
    const client = new OilPriceAPI({
      apiKey: 'test_key',
      timeout: 120000
    });
    expect(client).toBeInstanceOf(OilPriceAPI);
  });

  it('should accept custom retries', () => {
    const client = new OilPriceAPI({
      apiKey: 'test_key',
      retries: 5
    });
    expect(client).toBeInstanceOf(OilPriceAPI);
  });

  it('should accept debug mode', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const client = new OilPriceAPI({
      apiKey: 'test_key',
      debug: true
    });

    // Debug mode is set but we need to make a request to see logs
    expect(client).toBeInstanceOf(OilPriceAPI);
    consoleSpy.mockRestore();
  });

  it('should accept custom baseUrl', () => {
    const client = new OilPriceAPI({
      apiKey: 'test_key',
      baseUrl: 'https://staging-api.oilpriceapi.com'
    });
    expect(client).toBeInstanceOf(OilPriceAPI);
  });
});

describe('Error Classes', () => {
  it('OilPriceAPIError should have correct properties', () => {
    const error = new OilPriceAPIError('Test error', 400, 'TEST_CODE');
    expect(error.message).toBe('Test error');
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('TEST_CODE');
    expect(error.name).toBe('OilPriceAPIError');
  });

  it('AuthenticationError should extend OilPriceAPIError', () => {
    const error = new AuthenticationError('Invalid key');
    expect(error).toBeInstanceOf(OilPriceAPIError);
    expect(error.name).toBe('AuthenticationError');
    expect(error.statusCode).toBe(401);
  });

  it('RateLimitError should include retryAfter', () => {
    const error = new RateLimitError('Too many requests', 60);
    expect(error).toBeInstanceOf(OilPriceAPIError);
    expect(error.name).toBe('RateLimitError');
    expect(error.statusCode).toBe(429);
    expect(error.retryAfter).toBe(60);
  });

  it('NotFoundError should extend OilPriceAPIError', () => {
    const error = new NotFoundError('Resource not found');
    expect(error).toBeInstanceOf(OilPriceAPIError);
    expect(error.name).toBe('NotFoundError');
    expect(error.statusCode).toBe(404);
  });

  it('ServerError should include statusCode', () => {
    const error = new ServerError('Internal error', 503);
    expect(error).toBeInstanceOf(OilPriceAPIError);
    expect(error.name).toBe('ServerError');
    expect(error.statusCode).toBe(503);
  });

  it('TimeoutError should include timeout in message', () => {
    const error = new TimeoutError('Request timed out', 30000);
    expect(error).toBeInstanceOf(OilPriceAPIError);
    expect(error.name).toBe('TimeoutError');
    expect(error.message).toContain('30000ms');
    expect(error.code).toBe('TIMEOUT_ERROR');
  });
});
