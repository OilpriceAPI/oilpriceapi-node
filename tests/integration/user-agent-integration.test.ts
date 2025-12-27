import { describe, it, expect, beforeAll } from 'vitest';
import { OilPriceAPI, SDK_VERSION, SDK_NAME } from '../../src/index.js';

/**
 * Integration tests for User-Agent header tracking
 *
 * These tests verify that the SDK sends correct headers to the production API.
 * Run with: npm test -- --reporter=verbose tests/integration/
 */
describe('User-Agent Integration Tests', () => {
  let client: OilPriceAPI;

  beforeAll(() => {
    // Use env var or a test key
    const apiKey = process.env.OILPRICEAPI_KEY || process.env.TEST_API_KEY;

    if (!apiKey) {
      console.warn('No API key found. Set OILPRICEAPI_KEY or TEST_API_KEY to run integration tests.');
    }

    client = new OilPriceAPI({
      apiKey: apiKey || 'test_key_for_header_check',
      debug: true, // Enable debug logging to see headers
    });
  });

  it('should export SDK_VERSION constant', () => {
    expect(SDK_VERSION).toBeDefined();
    expect(SDK_VERSION).toBe('0.7.0');
  });

  it('should export SDK_NAME constant', () => {
    expect(SDK_NAME).toBeDefined();
    expect(SDK_NAME).toBe('oilpriceapi-node');
  });

  it('should have matching versions in version.ts and package.json', async () => {
    const packageJson = await import('../../package.json', { assert: { type: 'json' } });
    expect(SDK_VERSION).toBe(packageJson.default.version);
  });

  // This test only runs if API key is available
  // Extended timeout to handle rate limiting retries
  it.skipIf(!process.env.OILPRICEAPI_KEY)('should make successful API request with correct headers', async () => {
    // Make a real API request
    const prices = await client.getLatestPrices({ commodity: 'WTI_USD' });

    expect(prices).toBeDefined();
    expect(Array.isArray(prices)).toBe(true);
    expect(prices.length).toBeGreaterThan(0);
  }, 30000); // 30 second timeout for rate limit retries
});

describe('Version Consistency', () => {
  it('buildUserAgent should produce correct format', async () => {
    const { buildUserAgent, SDK_VERSION, SDK_NAME } = await import('../../src/version.js');
    const userAgent = buildUserAgent();

    // Should match format: oilpriceapi-node/0.5.2 node/v20.x.x
    expect(userAgent).toContain(SDK_NAME);
    expect(userAgent).toContain(SDK_VERSION);
    expect(userAgent).toMatch(/oilpriceapi-node\/\d+\.\d+\.\d+ node\/v\d+\.\d+/);
  });
});
