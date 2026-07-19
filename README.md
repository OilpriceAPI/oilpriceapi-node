# OilPriceAPI Node.js SDK

Official Node.js and TypeScript client for source-timestamped OilPriceAPI energy
data. It provides typed resources, bounded retries, explicit errors, raw response
access, and executable example manifests.

[![npm version](https://img.shields.io/npm/v/oilpriceapi)](https://www.npmjs.com/package/oilpriceapi)
[![Tests](https://github.com/OilpriceAPI/oilpriceapi-node/actions/workflows/test.yml/badge.svg)](https://github.com/OilpriceAPI/oilpriceapi-node/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-yellow.svg)](LICENSE)

Mutable offer, catalog, freshness, entitlement, and data-rights wording is
governed by the reviewed
[`product-facts.json`](https://api.oilpriceapi.com/product-facts.json) contract.
Latest available values include source timestamps; cadence, history depth, and
access vary by source, market hours, dataset, and account entitlement.

## Install

```bash
npm install oilpriceapi
```

The SDK requires Node.js 18 or newer. An installed resource helper does not
imply that every dataset or workflow is enabled for an account; confirm access
in the current API response and documentation.

## Authenticate

Create an API key in the [OilPriceAPI dashboard](https://www.oilpriceapi.com/auth/signup)
and provide it through the environment. Do not put a key in source code, a URL,
logs, screenshots, generated artifacts, or issue text.

```bash
export OILPRICEAPI_KEY="your-key-from-the-dashboard"
```

The API authentication header is `Authorization: Token YOUR_API_KEY`.

## First Request With Source Context

The canonical first request is
`GET /v1/prices/latest?by_code=BRENT_CRUDE_USD`. This TypeScript example fails
closed if the response omits the context needed to interpret the value:

```typescript
import { OilPriceAPI } from "oilpriceapi";

const client = new OilPriceAPI({
  apiKey: process.env.OILPRICEAPI_KEY,
  retries: 0,
  timeout: 30_000,
});

const [record] = await client.getLatestPrices({
  commodity: "BRENT_CRUDE_USD",
});

const timestampFields = [
  "as_of",
  "source_timestamp",
  "created_at",
  "updated_at",
] as const;
const timestampField = timestampFields.find(
  (field) => typeof record?.[field] === "string" && record[field].trim(),
);

if (
  !record ||
  !Number.isFinite(record.price) ||
  typeof record.code !== "string" ||
  typeof record.currency !== "string" ||
  typeof record.unit !== "string" ||
  typeof record.source !== "string" ||
  !timestampField
) {
  throw new Error("MALFORMED_RESPONSE: source context is incomplete");
}

console.log({
  code: record.code,
  price: record.price,
  currency: record.currency,
  unit: record.unit,
  source: record.source,
  apiTimestampField: timestampField,
  apiTimestamp: record[timestampField],
  freshness: record.data_status,
});
```

The reviewed standalone form is
[`examples/snippets/latest-price.ts`](examples/snippets/latest-price.ts). CI
type-checks and executes it against production-shaped fixtures, then publishes
its exact code and checksum in the release snippet manifest.

## CommonJS

```javascript
const { OilPriceAPI } = require("oilpriceapi");

const client = new OilPriceAPI({ apiKey: process.env.OILPRICEAPI_KEY });
const [price] = await client.getLatestPrices({
  commodity: "BRENT_CRUDE_USD",
});
console.log(price.code, price.price, price.currency, price.unit, price.created_at);
```

## Recovery

The package exposes typed errors for customer-recoverable boundaries:

```typescript
import {
  AuthenticationError,
  OilPriceAPI,
  OilPriceAPIError,
  RateLimitError,
  TimeoutError,
} from "oilpriceapi";

const client = new OilPriceAPI({ apiKey: process.env.OILPRICEAPI_KEY });

try {
  await client.getLatestPrices({ commodity: "BRENT_CRUDE_USD" });
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error("Replace the missing, expired, or revoked API key.");
  } else if (error instanceof RateLimitError) {
    console.error("Wait for the API-provided reset window.");
  } else if (error instanceof TimeoutError) {
    console.error("Retry once, then check https://status.oilpriceapi.com.");
  } else if (
    error instanceof OilPriceAPIError &&
    (error.statusCode === 402 || error.statusCode === 403)
  ) {
    console.error("Review dataset access for this account.");
  } else {
    throw error;
  }
}
```

Executable recovery examples cover 401, 403, 429, and timeout responses under
[`examples/snippets/`](examples/snippets/). Empty or malformed successful
responses should stop processing rather than inventing a price, unit, currency,
source, or timestamp.

## Capabilities

The client includes resources for latest and historical values plus additional
dataset and workflow families. Availability is determined by the live API and
account entitlement, not by the presence of a method or exported type.

- Use [API documentation](https://docs.oilpriceapi.com) for current paths and parameters.
- Use the [commodity catalog](https://www.oilpriceapi.com/commodities) to inspect codes.
- Use [pricing](https://www.oilpriceapi.com/pricing) to review current account options.
- Use the [data usage policy](https://www.oilpriceapi.com/legal/data-usage) before redistributing data.

Standard plans provide API access, normalization, monitoring, and delivery;
they do not transfer ownership of underlying source data or unrestricted raw
data redistribution rights.

## Raw Responses

`client.raw` returns response data together with HTTP status and response
headers when the application needs request IDs, rate-limit metadata, or an
unwrapped payload. Do not log authorization headers or mutable account data.

```typescript
const response = await client.raw.getLatestPrices({
  commodity: "BRENT_CRUDE_USD",
});
console.log(response.status, response.headers.get("x-request-id"), response.data);
```

## Reproducible Examples

Website and documentation snippets are maintained in `examples/snippets/`.
Every release attaches a versioned manifest containing the package version,
minimum runtime, source commit, expected response shape, exact code, and SHA-256
for each example.

```bash
npm run snippets:check
npm run snippets:build -- --source-commit "$(git rev-parse HEAD)"
```

## Development

```bash
npm ci
npm run storefront:check
npm run check:secrets
npm run lint
npm test
npm run build
npm pack --dry-run
```

Live tests require an explicitly supplied non-customer test credential. Unit
and snippet tests use local fixtures and do not print or persist credentials.

## Support

- [API documentation](https://docs.oilpriceapi.com)
- [Service status](https://status.oilpriceapi.com)
- [Product facts](https://api.oilpriceapi.com/product-facts.json)
- [GitHub issues](https://github.com/OilpriceAPI/oilpriceapi-node/issues)

Licensed under the [MIT License](LICENSE).
