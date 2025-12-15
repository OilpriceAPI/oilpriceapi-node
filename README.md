# Oil Price API - Node.js SDK

[![npm version](https://badge.fury.io/js/oilpriceapi.svg)](https://www.npmjs.com/package/oilpriceapi)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Official Node.js SDK for [Oil Price API](https://www.oilpriceapi.com) - Get real-time and historical oil & commodity prices.

## Features

- ✅ **Simple** - Get started in 5 lines of code
- 🔒 **Type-Safe** - Full TypeScript support with detailed type definitions
- ⚡ **Fast** - Zero dependencies, uses native fetch (Node 18+)
- 🎯 **Comprehensive** - Covers all API endpoints including diesel prices & alerts
- 🚀 **Modern** - ES Modules, async/await, Promise-based
- 🛡️ **Robust** - Custom error classes for better error handling
- 🔄 **Resilient** - Automatic retries with exponential backoff
- ⏱️ **Reliable** - Request timeouts and smart error handling
- 🐛 **Debuggable** - Built-in debug logging mode
- ⛽ **NEW v0.4.0** - Diesel prices (state averages + station-level pricing)
- 🔔 **NEW v0.5.0** - Price alerts with webhook notifications

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
//     price: 74.25,
//     formatted: '$74.25',
//     currency: 'USD',
//     type: 'spot_price',
//     created_at: '2024-11-24T12:01:00Z',
//     source: 'oilprice.investing_com'
//   },
//   // ... more prices
// ]
```

### Get Latest Price for Specific Commodity

```typescript
// Get only WTI crude oil price
const wti = await client.getLatestPrices({ commodity: 'WTI_USD' });
console.log(`WTI: ${wti[0].formatted} per barrel`);

// Get only Brent crude price
const brent = await client.getLatestPrices({ commodity: 'BRENT_CRUDE_USD' });
console.log(`Brent: ${brent[0].formatted} per barrel`);
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

### Get Diesel Prices (New in v0.4.0)

#### Get State Average Diesel Price

```typescript
// Get California diesel price
const caPrice = await client.diesel.getPrice('CA');
console.log(`California diesel: $${caPrice.price}/gallon`);
console.log(`Source: ${caPrice.source}`);
console.log(`Last updated: ${caPrice.updated_at}`);

// Example output:
// California diesel: $3.89/gallon
// Source: EIA
// Last updated: 2025-12-15T10:00:00Z
```

#### Get Nearby Diesel Stations

```typescript
// Find diesel stations near San Francisco
const result = await client.diesel.getStations({
  lat: 37.7749,   // San Francisco latitude
  lng: -122.4194, // San Francisco longitude
  radius: 8047    // 5 miles in meters (default if not specified)
});

console.log(`Regional average: $${result.regional_average.price}/gallon`);
console.log(`Found ${result.stations.length} stations within ${result.search_area.radius_miles} miles`);

// Print each station
result.stations.forEach(station => {
  console.log(`\n${station.name}`);
  console.log(`  Address: ${station.address}`);
  console.log(`  Price: ${station.formatted_price}`);
  console.log(`  ${station.price_vs_average}`);
});

// Example output:
// Regional average: $3.89/gallon
// Found 12 stations within 5 miles
//
// Chevron Station
//   Address: 123 Main St, San Francisco, CA
//   Price: $3.75
//   $0.14 cheaper than regional average
//
// Shell Gas
//   Address: 456 Oak Ave, San Francisco, CA
//   Price: $3.89
//   Same as regional average
```

#### Find Cheapest Diesel Station

```typescript
const result = await client.diesel.getStations({
  lat: 34.0522,   // Los Angeles
  lng: -118.2437,
  radius: 5000    // ~3 miles
});

// Find the cheapest station
const cheapest = result.stations.reduce((min, station) =>
  station.diesel_price < min.diesel_price ? station : min
);

console.log(`Cheapest diesel: ${cheapest.name} at ${cheapest.formatted_price}`);
console.log(`Savings: ${Math.abs(cheapest.price_delta!).toFixed(2)} per gallon vs regional average`);
```

**Note:** Station-level diesel prices are available on paid tiers (Exploration and above). State averages are free.

### Price Alerts (New in v0.5.0)

#### Create a Price Alert

```typescript
// Create an alert when Brent crude exceeds $85
const alert = await client.alerts.create({
  name: 'Brent High Alert',
  commodity_code: 'BRENT_CRUDE_USD',
  condition_operator: 'greater_than',
  condition_value: 85.00,
  webhook_url: 'https://your-app.com/webhooks/price-alert',
  enabled: true,
  cooldown_minutes: 60  // Wait 60 minutes between triggers
});

console.log(`Alert created: ${alert.name} (ID: ${alert.id})`);
```

#### List All Alerts

```typescript
const alerts = await client.alerts.list();

alerts.forEach(alert => {
  console.log(`${alert.name}: ${alert.commodity_code} ${alert.condition_operator} ${alert.condition_value}`);
  console.log(`  Status: ${alert.enabled ? 'Active' : 'Disabled'}`);
  console.log(`  Triggers: ${alert.trigger_count}`);
  console.log(`  Last triggered: ${alert.last_triggered_at || 'Never'}`);
});
```

#### Update an Alert

```typescript
// Disable an alert
await client.alerts.update(alertId, { enabled: false });

// Change threshold and cooldown
await client.alerts.update(alertId, {
  condition_value: 90.00,
  cooldown_minutes: 120
});

// Update webhook URL
await client.alerts.update(alertId, {
  webhook_url: 'https://new-app.com/webhook'
});
```

#### Delete an Alert

```typescript
await client.alerts.delete(alertId);
console.log('Alert deleted successfully');
```

#### Test Webhook Endpoint

```typescript
const result = await client.alerts.testWebhook('https://your-app.com/webhook');

if (result.success) {
  console.log(`Webhook OK (${result.status_code}) - ${result.response_time_ms}ms`);
} else {
  console.error(`Webhook failed: ${result.error}`);
}
```

**Alert Operators:**
- `greater_than` - Trigger when price exceeds threshold
- `less_than` - Trigger when price falls below threshold
- `equals` - Trigger when price matches threshold exactly
- `greater_than_or_equal` - Trigger when price meets or exceeds threshold
- `less_than_or_equal` - Trigger when price is at or below threshold

**Webhook Payload Example:**
When an alert triggers, a POST request is sent to your webhook URL with:
```json
{
  "event": "price_alert.triggered",
  "alert_id": "550e8400-e29b-41d4-a716-446655440000",
  "alert_name": "Brent High Alert",
  "commodity_code": "BRENT_CRUDE_USD",
  "condition_operator": "greater_than",
  "condition_value": 85.00,
  "current_price": 86.50,
  "triggered_at": "2025-12-15T14:30:00Z"
}
```

**Limits:**
- Maximum 100 alerts per user
- Cooldown period: 0-1440 minutes (24 hours)
- Condition value: Must be between $0.01 and $1,000,000
- Webhook URL: Must use HTTPS protocol

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

**Diesel Prices:**
```typescript
// State average (free)
const caPrice = await client.diesel.getPrice('CA');
console.log(`CA diesel: $${caPrice.price}/gal`);

// Nearby stations (paid tiers)
const stations = await client.diesel.getStations({
  lat: 37.7749,
  lng: -122.4194,
  radius: 8047  // 5 miles
});
console.log(`Found ${stations.stations.length} stations`);
```

**Price Alerts:**
```typescript
// Create an alert
const alert = await client.alerts.create({
  name: 'Brent High Alert',
  commodity_code: 'BRENT_CRUDE_USD',
  condition_operator: 'greater_than',
  condition_value: 85.00,
  webhook_url: 'https://your-app.com/webhook'
});

// List all alerts
const alerts = await client.alerts.list();

// Update an alert
await client.alerts.update(alert.id, { enabled: false });
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

### `client.diesel`

Resource for diesel price data (state averages and station-level pricing).

##### `diesel.getPrice(state)`

Get average diesel price for a US state from EIA data.

**Parameters:**
- `state` (string, required) - Two-letter US state code (e.g., "CA", "TX", "NY")

**Returns:** `Promise<DieselPrice>`

**Example:**
```typescript
const caPrice = await client.diesel.getPrice('CA');
console.log(`California: $${caPrice.price}/gallon`);
```

##### `diesel.getStations(options)`

Get nearby diesel stations with current pricing from Google Maps data.

**Parameters:**
- `options.lat` (number, required) - Latitude (-90 to 90)
- `options.lng` (number, required) - Longitude (-180 to 180)
- `options.radius` (number, optional) - Search radius in meters (default: 8047 = 5 miles, max: 50000)

**Returns:** `Promise<DieselStationsResponse>`

**Tier Requirements:** Available on paid tiers (Exploration and above)

**Example:**
```typescript
const result = await client.diesel.getStations({
  lat: 37.7749,
  lng: -122.4194,
  radius: 8047  // 5 miles
});

console.log(`Found ${result.stations.length} stations`);
console.log(`Regional average: $${result.regional_average.price}/gallon`);

const cheapest = result.stations.reduce((min, s) =>
  s.diesel_price < min.diesel_price ? s : min
);
console.log(`Cheapest: ${cheapest.name} at ${cheapest.formatted_price}`);
```

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

#### `DieselPrice`

```typescript
interface DieselPrice {
  state: string;          // State code (e.g., "CA", "TX")
  price: number;          // Average diesel price in USD per gallon
  currency: string;       // Currency code (always "USD")
  unit: string;           // Unit of measurement (always "gallon")
  granularity: string;    // Level (e.g., "state", "national")
  source: string;         // Data source (e.g., "EIA")
  updated_at: string;     // ISO 8601 timestamp of last update
  cached?: boolean;       // Whether served from cache
}
```

#### `DieselStation`

```typescript
interface DieselStation {
  name: string;           // Station name
  address: string;        // Full street address
  location: {
    lat: number;          // Latitude
    lng: number;          // Longitude
  };
  diesel_price: number;   // Price at this station (USD per gallon)
  formatted_price: string;// Formatted price (e.g., "$3.89")
  currency: string;       // Currency code (always "USD")
  unit: string;           // Unit (always "gallon")
  price_delta?: number;   // Difference from regional average
  price_vs_average?: string; // Human-readable comparison
  fuel_types?: string[];  // Available fuel types
  last_updated?: string;  // ISO 8601 timestamp
}
```

#### `DieselStationsResponse`

```typescript
interface DieselStationsResponse {
  regional_average: {
    price: number;        // Regional average price
    currency: string;     // Currency code
    unit: string;         // Unit
    region: string;       // Region name
    granularity: string;  // Granularity level
    source: string;       // Data source
  };
  stations: DieselStation[]; // List of nearby stations
  search_area: {
    center: {
      lat: number;        // Search center latitude
      lng: number;        // Search center longitude
    };
    radius_meters: number;// Search radius in meters
    radius_miles: number; // Search radius in miles
  };
  metadata: {
    total_stations: number; // Number of stations found
    source: string;        // Data source
    cached: boolean;       // Whether served from cache
    api_cost: number;      // Cost in dollars
    timestamp: string;     // ISO 8601 timestamp
    cache_age_hours?: number; // Cache age in hours
  };
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
- **Refined Products**: Gasoline, Diesel (state averages + station-level), Heating Oil, Jet Fuel
- **Natural Gas**: US Natural Gas, EU Natural Gas, UK Natural Gas
- **And more...**

See the [full list of commodities](https://www.oilpriceapi.com/commodities) in the documentation.

## Pricing & Rate Limits

- **Free Tier**: 100 requests (lifetime)
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
