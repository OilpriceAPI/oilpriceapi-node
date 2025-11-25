# Examples

Real-world code examples for using the Oil Price API Node.js SDK.

## Quick Start

All examples use environment variables for API keys:

```bash
export OIL_PRICE_API_KEY="your_api_key_here"
```

Or create a `.env` file in the examples directory (don't commit this!):

```
OIL_PRICE_API_KEY=your_api_key_here
```

## Running Examples

Using `tsx` (recommended for TypeScript):

```bash
npx tsx examples/basic.ts
```

Or compile and run:

```bash
npm run build
node dist/examples/basic.js
```

## Available Examples

### 1. [basic.ts](./basic.ts)
**Simple usage patterns**
- Get latest commodity prices
- Filter by specific commodity
- Get historical price data
- Work with different time periods

```bash
npx tsx examples/basic.ts
```

### 2. [express.ts](./express.ts)
**Express.js API server integration**
- RESTful API endpoints
- Error handling middleware
- Client connection reuse
- Query parameter handling

```bash
npm install express @types/express
npx tsx examples/express.ts
```

Then visit:
- `http://localhost:3000/api/prices/latest`
- `http://localhost:3000/api/commodities`

### 3. [nextjs-api-route.ts](./nextjs-api-route.ts)
**Next.js API route example**
- API route handler (Pages Router)
- Response caching headers
- Error handling
- TypeScript types

Place in your Next.js project at: `pages/api/oil-prices.ts`

### 4. [error-handling.ts](./error-handling.ts)
**Comprehensive error handling**
- Catch specific error types
- Graceful degradation
- Fallback strategies
- Custom retry configurations

```bash
npx tsx examples/error-handling.ts
```

### 5. [commodities.ts](./commodities.ts)
**Working with commodity metadata**
- List all commodities
- Explore categories
- Get specific commodity details
- Validate commodity codes
- Build UI dropdowns

```bash
npx tsx examples/commodities.ts
```

## Common Patterns

### Initialize Client (Singleton Pattern)

```typescript
// lib/oilpriceapi.ts
import { OilPriceAPI } from 'oilpriceapi';

export const oilPriceClient = new OilPriceAPI({
  apiKey: process.env.OIL_PRICE_API_KEY!,
  retries: 3,
  timeout: 10000
});
```

Then import and use across your application:

```typescript
import { oilPriceClient } from './lib/oilpriceapi';

const prices = await oilPriceClient.getLatestPrices();
```

### Error Handling with Type Guards

```typescript
import { OilPriceAPIError, RateLimitError } from 'oilpriceapi';

try {
  const prices = await client.getLatestPrices();
} catch (error) {
  if (error instanceof RateLimitError) {
    // Handle rate limit specifically
    console.log('Rate limited, retry after:', error.statusCode);
  } else if (error instanceof OilPriceAPIError) {
    // Handle other API errors
    console.error('API Error:', error.message);
  }
}
```

### Caching Responses

```typescript
const cache = new Map();

async function getCachedPrices(commodity: string) {
  const cacheKey = `prices:${commodity}`;

  if (cache.has(cacheKey)) {
    const { data, timestamp } = cache.get(cacheKey);
    if (Date.now() - timestamp < 5 * 60 * 1000) { // 5 minutes
      return data;
    }
  }

  const prices = await client.getLatestPrices({ commodity });
  cache.set(cacheKey, { data: prices, timestamp: Date.now() });
  return prices;
}
```

## Get Your API Key

Sign up for a free API key at [oilpriceapi.com](https://www.oilpriceapi.com)

## Need Help?

- 📚 [Full Documentation](https://github.com/OilpriceAPI/oilpriceapi-node#readme)
- 🐛 [Report Issues](https://github.com/OilpriceAPI/oilpriceapi-node/issues)
- 💬 [API Documentation](https://docs.oilpriceapi.com)
