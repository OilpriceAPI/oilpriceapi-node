/**
 * Error Handling Example
 *
 * Shows how to handle different error types from the SDK
 */

import {
  OilPriceAPI,
  AuthenticationError,
  RateLimitError,
  NotFoundError,
  ServerError,
  TimeoutError,
  OilPriceAPIError
} from 'oilpriceapi';

const client = new OilPriceAPI({
  apiKey: process.env.OIL_PRICE_API_KEY || 'your_api_key_here',
  retries: 3,
  retryDelay: 1000,
  timeout: 10000,
  debug: false
});

async function handleErrors() {
  try {
    // This will succeed if API key is valid
    const prices = await client.getLatestPrices({ commodity: 'WTI_USD' });
    console.log('Success:', prices[0].formatted);

  } catch (error) {
    // Handle specific error types
    if (error instanceof AuthenticationError) {
      console.error('❌ Authentication failed');
      console.error('Check your API key at https://www.oilpriceapi.com');
      console.error('Status:', error.statusCode); // 401

    } else if (error instanceof RateLimitError) {
      console.error('❌ Rate limit exceeded');
      console.error('Try again later or upgrade your plan');
      console.error('Status:', error.statusCode); // 429
      // SDK automatically retries with exponential backoff

    } else if (error instanceof NotFoundError) {
      console.error('❌ Resource not found');
      console.error('Check commodity code spelling');
      console.error('Status:', error.statusCode); // 404

    } else if (error instanceof TimeoutError) {
      console.error('❌ Request timed out');
      console.error('API might be slow, SDK retries automatically');
      console.error(error.message); // Includes timeout duration

    } else if (error instanceof ServerError) {
      console.error('❌ Server error');
      console.error('API is experiencing issues, SDK retries automatically');
      console.error('Status:', error.statusCode); // 500+

    } else if (error instanceof OilPriceAPIError) {
      // Generic API error (fallback)
      console.error('❌ API Error:', error.message);
      console.error('Status:', error.statusCode);
      console.error('Code:', error.code);

    } else {
      // Network or other errors
      console.error('❌ Unexpected error:', error);
    }
  }
}

// Example: Graceful degradation with fallback
async function getPriceWithFallback(commodity: string) {
  try {
    const prices = await client.getLatestPrices({ commodity });
    return prices[0];
  } catch (error) {
    if (error instanceof RateLimitError) {
      // Use cached data if rate limited
      console.log('Rate limited, using cached data...');
      return getCachedPrice(commodity);
    }
    throw error; // Re-throw other errors
  }
}

// Example: Retry with different strategy
async function getDataWithCustomRetry() {
  const clientWithRetries = new OilPriceAPI({
    apiKey: process.env.OIL_PRICE_API_KEY || 'your_api_key_here',
    retries: 5,
    retryDelay: 2000,
    retryStrategy: 'exponential', // Exponential backoff
    timeout: 15000
  });

  try {
    return await clientWithRetries.getLatestPrices();
  } catch (error) {
    console.error('Failed after 5 retries:', error);
    throw error;
  }
}

// Mock cache function (implement your own caching)
function getCachedPrice(commodity: string) {
  return {
    code: commodity,
    price: 75.00, // Cached value
    formatted: '$75.00',
    currency: 'USD',
    created_at: new Date().toISOString(),
    type: 'spot_price',
    source: 'cache'
  };
}

// Run example
handleErrors();
