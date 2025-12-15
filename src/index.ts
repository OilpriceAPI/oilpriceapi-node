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
  Commodity,
  CommoditiesResponse,
  CommodityCategory,
  CategoriesResponse,
} from './types.js';
export type {
  DieselPrice,
  DieselStation,
  DieselStationsResponse,
  GetDieselStationsOptions,
} from './resources/diesel.js';
export type {
  PriceAlert,
  CreateAlertParams,
  UpdateAlertParams,
  AlertOperator,
  WebhookTestResponse,
} from './resources/alerts.js';
export {
  OilPriceAPIError,
  AuthenticationError,
  RateLimitError,
  NotFoundError,
  ServerError,
  TimeoutError,
} from './errors.js';
