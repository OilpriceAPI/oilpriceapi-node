# Oil Price API - Node.js SDK

[![npm version](https://badge.fury.io/js/oilpriceapi.svg)](https://www.npmjs.com/package/oilpriceapi)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Official Node.js SDK for [Oil Price API](https://www.oilpriceapi.com) - Get real-time and historical oil & commodity prices.

## Features

- ✅ **Simple** - Get started in 5 lines of code
- 🔒 **Type-Safe** - Full TypeScript support with detailed type definitions
- ⚡ **Fast** - Zero dependencies, uses native fetch (Node 18+)
- 🎯 **Comprehensive** - Covers all API endpoints
- 🚀 **Modern** - ES Modules, async/await, Promise-based
- 🛡️ **Robust** - Custom error classes for better error handling
- 🔄 **Resilient** - Automatic retries with exponential backoff
- ⏱️ **Reliable** - Request timeouts and smart error handling
- 🐛 **Debuggable** - Built-in debug logging mode

## Installation

```bash
npm install oilpriceapi
```

## Quick Start

```typescript
import { OilPriceAPI } from 'oilpriceapi';

// Initialize the client
const client = new OilPriceAPI({
  apiKey: 'your_api_key_here',  // Get your free key at https://www.oilpriceapi.com
  retries: 3,                    // Automatic retries (default: 3)
  timeout: 30000                 // Request timeout in ms (default: 30000)
});

// Get latest prices
const prices = await client.getLatestPrices();
console.log(prices);
```

## Usage Examples

### Get Latest Prices (All Commodities)

```typescript
const prices = await client.getLatestPrices();

// Example output:
// [
//   {
//     code: 'WTI_USD',
//     name: 'WTI Crude Oil',
//     value: 74.25,
//     currency: 'USD',
//     unit: 'barrel',
//     timestamp: '2024-11-24T12:00:00Z',
//     created_at: '2024-11-24T12:01:00Z',
//     updated_at: '2024-11-24T12:01:00Z'
//   },
//   // ... more prices
// ]
```

### Get Latest Price for Specific Commodity

```typescript
// Get only WTI crude oil price
const wti = await client.getLatestPrices({ commodity: 'WTI_USD' });
console.log(`WTI: $${wti[0].value} per barrel`);

// Get only Brent crude price
const brent = await client.getLatestPrices({ commodity: 'BRENT_CRUDE_USD' });
console.log(`Brent: $${brent[0].value} per barrel`);
```

### Get Historical Prices (Past Week)

```typescript
const weekPrices = await client.getHistoricalPrices({
  period: 'past_week',
  commodity: 'WTI_USD'
});

console.log(`Got ${weekPrices.length} data points from the past week`);
```

### Get Historical Prices (Custom Date Range)

```typescript
const prices = await client.getHistoricalPrices({
  startDate: '2024-01-01',
  endDate: '2024-12-31',
  commodity: 'BRENT_CRUDE_USD'
});

console.log(`Got ${prices.length} data points for 2024`);
```

### Advanced Configuration

```typescript
import { OilPriceAPI } from 'oilpriceapi';

const client = new OilPriceAPI({
  apiKey: 'your_key',

  // Retry configuration
  retries: 3,                    // Max retry attempts (default: 3)
  retryDelay: 1000,              // Initial delay in ms (default: 1000)
  retryStrategy: 'exponential',  // 'exponential', 'linear', or 'fixed'

  // Timeout configuration
  timeout: 30000,                // Request timeout in ms (default: 30000)

  // Debug mode
  debug: true                    // Enable debug logging (default: false)
});
```

### Error Handling

```typescript
import {
  OilPriceAPI,
  AuthenticationError,
  RateLimitError,
  NotFoundError,
  TimeoutError,
  ServerError
} from 'oilpriceapi';

const client = new OilPriceAPI({ apiKey: 'your_key' });

try {
  const prices = await client.getLatestPrices();
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error('Invalid API key:', error.message);
  } else if (error instanceof RateLimitError) {
    console.error('Rate limit exceeded. Retry after:', error.retryAfter, 'seconds');
  } else if (error instanceof TimeoutError) {
    console.error('Request timed out:', error.message);
  } else if (error instanceof ServerError) {
    console.error('Server error:', error.statusCode, error.message);
  } else if (error instanceof NotFoundError) {
    console.error('Commodity not found:', error.message);
  } else {
    console.error('Unknown error:', error);
  }
}
```

### Debug Mode

Enable debug logging to see detailed request/response information:

```typescript
const client = new OilPriceAPI({
  apiKey: 'your_key',
  debug: true
});

// This will log all requests, responses, retries, and errors
const prices = await client.getLatestPrices();

// Example output:
// [OilPriceAPI 2024-11-24T20:28:23.145Z] Request: https://api.oilpriceapi.com/v1/prices/latest
// [OilPriceAPI 2024-11-24T20:28:23.393Z] Response: 200 OK
// [OilPriceAPI 2024-11-24T20:28:23.394Z] Response data received { status: 'success', hasData: true }
```

## Examples

See the [`examples/`](./examples) directory for complete, runnable code examples:

- **[basic.ts](./examples/basic.ts)** - Simple usage patterns
- **[express.ts](./examples/express.ts)** - Express.js API server integration
- **[nextjs-api-route.ts](./examples/nextjs-api-route.ts)** - Next.js API route handler
- **[error-handling.ts](./examples/error-handling.ts)** - Comprehensive error handling
- **[commodities.ts](./examples/commodities.ts)** - Working with commodity metadata

### Quick Examples

**Get Latest Price:**
```typescript
const prices = await client.getLatestPrices({ commodity: 'WTI_USD' });
console.log(prices[0].formatted); // "$74.25"
```

**Historical Data:**
```typescript
const history = await client.getHistoricalPrices({
  commodity: 'BRENT_CRUDE_USD',
  period: 'past_week'
});
```

**Commodity Metadata:**
```typescript
const { commodities } = await client.getCommodities();
console.log(`Found ${commodities.length} commodities`);
```

**Error Handling:**
```typescript
try {
  const prices = await client.getLatestPrices();
} catch (error) {
  if (error instanceof RateLimitError) {
    console.log('Rate limited, retry after:', error.retryAfter);
  }
}
```

## API Reference

### `OilPriceAPI`

Main client class for interacting with the Oil Price API.

#### Constructor

```typescript
new OilPriceAPI(config: OilPriceAPIConfig)
```

**Parameters:**
- `config.apiKey` (string, required) - Your API key from https://www.oilpriceapi.com
- `config.baseUrl` (string, optional) - Custom API base URL (for testing)

#### Methods

##### `getLatestPrices(options?)`

Get the latest prices for all commodities or a specific commodity.

**Parameters:**
- `options.commodity` (string, optional) - Filter by commodity code (e.g., "WTI_USD")

**Returns:** `Promise<Price[]>`

##### `getHistoricalPrices(options?)`

Get historical prices for a time period.

**Parameters:**
- `options.period` (string, optional) - One of: "past_week", "past_month", "past_year"
- `options.commodity` (string, optional) - Filter by commodity code
- `options.startDate` (string, optional) - Start date in ISO 8601 format (YYYY-MM-DD)
- `options.endDate` (string, optional) - End date in ISO 8601 format (YYYY-MM-DD)

**Returns:** `Promise<Price[]>`

##### `getCommodities()`

Get metadata for all supported commodities.

**Returns:** `Promise<CommoditiesResponse>` - Object with `commodities` array

##### `getCommodityCategories()`

Get all commodity categories with their commodities.

**Returns:** `Promise<CategoriesResponse>` - Object with category keys mapped to category objects

##### `getCommodity(code)`

Get metadata for a specific commodity by code.

**Parameters:**
- `code` (string, required) - Commodity code (e.g., "WTI_USD")

**Returns:** `Promise<Commodity>` - Commodity metadata object

### Types

#### `Price`

```typescript
interface Price {
  code: string;          // Commodity code (e.g., "WTI_USD")
  name: string;          // Human-readable name
  value: number;         // Price value
  currency: string;      // Currency code (e.g., "USD")
  unit: string;          // Unit of measurement (e.g., "barrel")
  timestamp: string;     // ISO 8601 timestamp
  created_at: string;    // ISO 8601 timestamp
  updated_at: string;    // ISO 8601 timestamp
}
```

### Error Classes

All errors extend `OilPriceAPIError`:

- `AuthenticationError` (401) - Invalid API key
- `RateLimitError` (429) - Rate limit exceeded
- `NotFoundError` (404) - Resource not found
- `ServerError` (5xx) - Server-side error

## Available Commodities

The API provides prices for the following commodities:

- **Crude Oil**: WTI, Brent Crude
- **Refined Products**: Gasoline, Diesel, Heating Oil, Jet Fuel
- **Natural Gas**: US Natural Gas, EU Natural Gas, UK Natural Gas
- **And more...**

See the [full list of commodities](https://www.oilpriceapi.com/commodities) in the documentation.

## Pricing & Rate Limits

- **Free Tier**: 1,000 requests/month
- **Starter**: 50,000 requests/month - $49/mo
- **Professional**: 100,000 requests/month - $99/mo
- **Business**: 200,000 requests/month - $199/mo
- **Enterprise**: Custom limits - Contact us

Get started with a free API key at [oilpriceapi.com](https://www.oilpriceapi.com).

## Requirements

- Node.js 18.0.0 or higher (for native fetch support)
- TypeScript 5.0+ (if using TypeScript)

## TypeScript Support

This package is written in TypeScript and includes full type definitions. You get:

- ✅ Full autocomplete in your IDE
- ✅ Type checking for method parameters
- ✅ Detailed JSDoc comments
- ✅ Type-safe error handling

## Contributing

We welcome contributions! Please see our [Contributing Guide](https://github.com/OilpriceAPI/oilpriceapi-node/blob/main/CONTRIBUTING.md) for details.

## Support

- 📧 Email: support@oilpriceapi.com
- 🐛 Issues: [GitHub Issues](https://github.com/OilpriceAPI/oilpriceapi-node/issues)
- 📚 Documentation: [oilpriceapi.com/docs](https://www.oilpriceapi.com/docs)
- 💬 Discord: [Join our community](https://discord.gg/oilpriceapi)

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Links

- [Website](https://www.oilpriceapi.com)
- [API Documentation](https://www.oilpriceapi.com/docs)
- [GitHub Repository](https://github.com/OilpriceAPI/oilpriceapi-node)
- [npm Package](https://www.npmjs.com/package/oilpriceapi)

---

Made with ❤️ by the Oil Price API team
