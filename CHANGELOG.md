# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
