/**
 * Official Node.js SDK for Oil Price API
 *
 * Get real-time and historical oil & commodity prices in your Node.js applications.
 *
 * @packageDocumentation
 */

export { OilPriceAPI } from './client.js';
export type {
  OilPriceAPIConfig,
  RetryStrategy,
  Price,
  LatestPricesOptions,
  HistoricalPricesOptions,
  HistoricalPeriod,
} from './types.js';
export {
  OilPriceAPIError,
  AuthenticationError,
  RateLimitError,
  NotFoundError,
  ServerError,
  TimeoutError,
} from './errors.js';
