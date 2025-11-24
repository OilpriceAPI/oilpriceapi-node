# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.2.0]: https://github.com/OilpriceAPI/oilpriceapi-node/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/OilpriceAPI/oilpriceapi-node/releases/tag/v0.1.0
