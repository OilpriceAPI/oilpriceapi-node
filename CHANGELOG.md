# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.7.0] - 2026-02-11

### Added

- **Commodities Resource**: `client.commodities.list()`, `get()`, `categories()` for commodity catalog discovery
- **Futures Resource**: `client.futures.latest()`, `historical()`, `ohlc()`, `intraday()`, `spreads()`, `curve()`, `continuous()` for futures contract data
- **Storage Resource**: `client.storage.all()`, `cushing()`, `spr()`, `regional()` for oil inventory levels
- **Rig Counts Resource**: `client.rigCounts.current()`, `historical()`, `latest()`, `summary()` for Baker Hughes rig count data
- **Bunker Fuels Resource**: `client.bunkerFuels.all()`, `port()`, `compare()`, `spreads()`, `historical()`, `export()` for marine fuel prices
- **Analytics Resource**: `client.analytics.performance()`, `statistics()`, `correlation()`, `trend()`, `spread()`, `forecast()` for price analytics
- **Forecasts Resource**: `client.forecasts.monthly()`, `accuracy()`, `archive()`, `get()` for EIA monthly price forecasts
- **Data Quality Resource**: `client.dataQuality.summary()`, `reports()`, `report()` for data quality monitoring
- **Drilling Intelligence Resource**: `client.drilling.latest()`, `summary()`, `trends()`, `fracSpreads()`, `wellPermits()`, `ducWells()`, `completions()`, `wellsDrilled()`, `basin()` for drilling activity data
- **Energy Intelligence Resource**: `client.ei` with 7 sub-resources: `rigCounts`, `oilInventories`, `opecProduction`, `drillingProductivity`, `forecasts`, `wellPermits`, `fracFocus` for comprehensive EIA data
- **Webhooks Resource**: `client.webhooks.create()`, `list()`, `get()`, `update()`, `delete()`, `test()`, `events()` for webhook management
- **Data Sources Resource**: `client.dataSources.list()`, `get()`, `create()`, `update()`, `delete()`, `test()`, `logs()`, `health()` for data connector management
- **Enhanced Alerts**: Added `test()`, `triggers()`, `analyticsHistory()` methods to existing alerts resource
- **Data Connector Support**: `client.getDataConnectorPrices()` for BYOS (Bring Your Own Subscription) prices
- **Telemetry Headers**: `appUrl` and `appName` options for API usage attribution

### Testing

- 70 new unit tests added (185 total, 0 failures)
- 13 new test files covering all resource modules
- All tests pass with TypeScript strict mode

### Breaking Changes

None - All new resources are additive. Existing code continues to work unchanged.

## [0.6.0] - 2025-12-24

### Added

- **PERFORMANCE**: Added `interval` parameter to `getHistoricalPrices()` for aggregated queries
  - `'raw'` - Individual price points (default, can be slow for year-long queries)
  - `'hourly'` - Hourly averages
  - `'daily'` - Daily averages (recommended for year-long queries - 365 points vs 600k+)
  - `'weekly'` - Weekly averages (52 points per year)
  - `'monthly'` - Monthly averages (12 points per year)
- **PERFORMANCE**: Added `perPage` parameter for pagination control (default: 100, max: 1000)
- **PERFORMANCE**: Added `page` parameter for pagination navigation
- New TypeScript type: `AggregationInterval`

### Performance Improvements

- Year-long queries improved from 74+ seconds to <1 second when using `interval: 'daily'`
- Example: `getHistoricalPrices({ period: 'past_year', commodity: 'BRENT_CRUDE_USD', interval: 'daily' })`

### Testing

- Added 7 new tests for interval and pagination parameters
- All 118 tests passing

### Breaking Changes

None - This is a backwards-compatible feature addition. Existing code continues to work.

## [0.5.3] - 2025-12-17

### Fixed

- **CRITICAL**: Fixed historical date range queries returning incorrect dates
  - Changed `getHistoricalPrices()` to use `/v1/prices/past_year` endpoint instead of `/v1/prices`
  - The `/v1/prices` endpoint was not correctly handling `start_date`/`end_date` parameters
  - This was the same bug that affected the Python SDK (fixed in v1.4.4)
  - Users requesting data for specific date ranges now receive correct results

### Testing

- Added comprehensive test suite for historical price queries (22 new tests)
- Added error handling test suite (31 new tests)
- Test coverage now at 95%+ for all source files

### Breaking Changes

None - This is a bug fix that corrects behavior to match documentation.

## [0.5.2] - 2025-12-17

### Added

- Centralized version management in `src/version.ts`
- Export `SDK_VERSION` and `SDK_NAME` constants for tracking
- User-Agent header: `oilpriceapi-node/{version} node/{node_version}`
- `X-Api-Client` and `X-Client-Version` headers for SDK tracking

### Testing

- Added integration tests for User-Agent header verification (11 tests)

## [0.5.1] - 2025-12-16

### Added

- Minor improvements to diesel and alerts resources

## [0.5.0] - 2025-12-15

### Added

- **Price Alerts**: New `client.alerts` resource for automated price monitoring with webhook notifications
- **Alert Management**: Full CRUD operations for price alerts
  - `alerts.list()` - Get all configured alerts
  - `alerts.get(id)` - Get specific alert by ID
  - `alerts.create(params)` - Create new price alert
  - `alerts.update(id, params)` - Update existing alert
  - `alerts.delete(id)` - Delete an alert
  - `alerts.testWebhook(url)` - Test webhook endpoint
- **Alert Operators**: 5 comparison operators for flexible conditions
  - `greater_than` - Trigger when price exceeds threshold
  - `less_than` - Trigger when price falls below threshold
  - `equals` - Trigger when price matches threshold exactly
  - `greater_than_or_equal` - Trigger at or above threshold
  - `less_than_or_equal` - Trigger at or below threshold
- **Webhook Integration**: HTTPS webhook notifications when alerts trigger
- **Cooldown Periods**: Configurable cooldown (0-1440 minutes) to prevent alert spam
- New TypeScript interfaces: `PriceAlert`, `CreateAlertParams`, `UpdateAlertParams`, `AlertOperator`, `WebhookTestResponse`
- Comprehensive input validation for all alert parameters
- Detailed error handling with clear validation messages

### Documentation

- Added complete Price Alerts section to README with examples
- Added CRUD operation examples for alerts
- Added webhook payload documentation
- Updated Quick Examples section with alerts example
- Updated feature list to highlight price alerts
- Added API reference for alert limits and constraints

### Testing

- Added comprehensive test suite for alerts resource (24 test cases)
- Tests cover all CRUD operations and validation scenarios
- 100% coverage of alerts functionality
- Tests for all 5 alert operators
- Validation tests for name, commodity code, operator, value, webhook URL, and cooldown

### Supported Endpoints

Now supports **12 endpoints** (up from 7):

- `GET /v1/prices/latest` - Get latest commodity prices
- `GET /v1/prices` - Get historical commodity prices
- `GET /v1/commodities` - Get all commodities metadata
- `GET /v1/commodities/categories` - Get commodity categories
- `GET /v1/commodities/{code}` - Get specific commodity details
- `GET /v1/diesel-prices` - Get state average diesel prices
- `POST /v1/diesel-prices/stations` - Get nearby diesel stations
- `GET /v1/alerts` - List all price alerts (NEW)
- `GET /v1/alerts/{id}` - Get specific alert (NEW)
- `POST /v1/alerts` - Create price alert (NEW)
- `PATCH /v1/alerts/{id}` - Update alert (NEW)
- `DELETE /v1/alerts/{id}` - Delete alert (NEW)

### Breaking Changes

None - This is a backwards-compatible feature addition.

## [0.4.0] - 2025-12-15

### Added

- **Diesel Prices Support**: New `client.diesel` resource for diesel price data
- **State Average Diesel Prices**: `diesel.getPrice(state)` - Get EIA state-level diesel averages (free tier)
- **Station-Level Diesel Pricing**: `diesel.getStations(options)` - Get nearby diesel stations with current prices from Google Maps (paid tiers)
- New TypeScript interfaces: `DieselPrice`, `DieselStation`, `DieselStationsResponse`, `GetDieselStationsOptions`
- Comprehensive input validation for coordinates, state codes, and radius
- Detailed error handling for tier restrictions (403) and rate limits (429)

### Documentation

- Added diesel prices usage examples to README
- Added API reference section for `client.diesel` resource
- Added complete type definitions for all diesel-related interfaces
- Updated Quick Examples section with diesel examples
- Updated feature list to highlight diesel prices support

### Testing

- Added comprehensive test suite for diesel resource (15 test cases)
- Tests cover input validation, error handling, and API responses
- 100% coverage of diesel functionality

### Supported Endpoints

Now supports **7 endpoints** (up from 5):

- `GET /v1/prices/latest` - Get latest commodity prices
- `GET /v1/prices` - Get historical commodity prices
- `GET /v1/commodities` - Get all commodities metadata
- `GET /v1/commodities/categories` - Get commodity categories
- `GET /v1/commodities/{code}` - Get specific commodity details
- `GET /v1/diesel-prices` - Get state average diesel prices (NEW)
- `POST /v1/diesel-prices/stations` - Get nearby diesel stations (NEW)

### Breaking Changes

None - This is a backwards-compatible feature addition.

## [0.3.1] - 2025-11-26

### Fixed

- **Fixed QA test** to use correct API response fields (`price` instead of `value`, `formatted` instead of `code + name`)
- **Updated README examples** to match actual API response structure
- **Corrected blog post examples** for accuracy
- Verified 100% test pass rate (7/7 tests passing)

### Documentation

- All code examples now use correct fields: `price`, `formatted`, `code`, `created_at`
- Removed references to non-existent `name`, `value`, and `unit` fields in latest prices response
- Added clarification on timeout configuration for historical data queries (120s recommended)

### Testing

- Historical prices endpoint working correctly with 120s timeout
- All 5 endpoints tested and verified against live API

## [0.3.0] - 2024-11-25

### Added

- **Commodities Endpoint**: `getCommodities()` - Get metadata for all supported commodities
- **Commodity Categories**: `getCommodityCategories()` - Get all commodity categories with their commodities
- **Commodity Details**: `getCommodity(code)` - Get metadata for a specific commodity by code
- New TypeScript interfaces: `Commodity`, `CommoditiesResponse`, `CommodityCategory`, `CategoriesResponse`

### Supported Endpoints

Now supports **5 endpoints** (up from 2):

- `GET /v1/prices/latest` - Get latest commodity prices
- `GET /v1/prices` - Get historical commodity prices
- `GET /v1/commodities` - Get all commodities metadata
- `GET /v1/commodities/categories` - Get commodity categories
- `GET /v1/commodities/{code}` - Get specific commodity details

## [0.2.0] - 2024-11-24

### Added

- **Retry Logic**: Automatic retries with configurable strategies (exponential, linear, fixed)
- **Timeout Handling**: Request timeouts with AbortController
- **Debug Logging**: Optional debug mode for detailed request/response logging
- **TimeoutError**: New error class for timeout scenarios
- **Smart Error Handling**: Intelligent retry logic based on error type
- **Rate Limit Handling**: Automatic retry with `Retry-After` header support

### Changed

- User-Agent updated to `oilpriceapi-node/0.2.0`
- Improved error messages with more context
- Better TypeScript type definitions for configuration options

### Configuration Options

New configuration options available:

- `retries`: Maximum number of retry attempts (default: 3)
- `retryDelay`: Initial delay between retries in ms (default: 1000)
- `retryStrategy`: Retry backoff strategy - 'exponential', 'linear', or 'fixed' (default: 'exponential')
- `timeout`: Request timeout in milliseconds (default: 30000)
- `debug`: Enable debug logging (default: false)

## [0.1.0] - 2024-11-24

### Added

- Initial release
- Basic API client with TypeScript support
- Latest prices endpoint support
- Historical prices endpoint support
- Custom error classes (AuthenticationError, RateLimitError, NotFoundError, ServerError)
- Zero runtime dependencies
- Full TypeScript type definitions
- Comprehensive README documentation

### Supported Endpoints

- `GET /v1/prices/latest` - Get latest commodity prices
- `GET /v1/prices` - Get historical commodity prices

[0.3.0]: https://github.com/OilpriceAPI/oilpriceapi-node/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/OilpriceAPI/oilpriceapi-node/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/OilpriceAPI/oilpriceapi-node/releases/tag/v0.1.0
