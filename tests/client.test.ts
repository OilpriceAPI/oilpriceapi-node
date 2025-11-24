import { describe, it, expect } from 'vitest';
import { OilPriceAPI, AuthenticationError } from '../src/index.js';

describe('OilPriceAPI', () => {
  it('should throw error if API key is missing', () => {
    expect(() => {
      new OilPriceAPI({ apiKey: '' });
    }).toThrow('API key is required');
  });

  it('should initialize with valid API key', () => {
    const client = new OilPriceAPI({ apiKey: 'test_key' });
    expect(client).toBeInstanceOf(OilPriceAPI);
  });

  it('should use custom baseUrl if provided', () => {
    const client = new OilPriceAPI({
      apiKey: 'test_key',
      baseUrl: 'https://custom.api.com'
    });
    expect(client).toBeInstanceOf(OilPriceAPI);
  });

  // Note: Integration tests with real API would go here
  // For now, keeping tests minimal for crawl version
});
