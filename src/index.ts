/**
 * Official Node.js SDK for Oil Price API
 *
 * Get real-time and historical oil & commodity prices in your Node.js applications.
 *
 * @packageDocumentation
 */

export { OilPriceAPI } from "./client.js";
export { SDK_VERSION, SDK_NAME } from "./version.js";
export type {
  OilPriceAPIConfig,
  RetryStrategy,
  Price,
  LatestPricesOptions,
  HistoricalPricesOptions,
  HistoricalPeriod,
  AggregationInterval,
  Commodity,
  CommoditiesResponse,
  CommodityCategory,
  CategoriesResponse,
  DataConnectorPrice,
  DataConnectorOptions,
} from "./types.js";
export type {
  DieselPrice,
  DieselStation,
  DieselStationsResponse,
  GetDieselStationsOptions,
} from "./resources/diesel.js";
export type {
  PriceAlert,
  CreateAlertParams,
  UpdateAlertParams,
  AlertOperator,
  WebhookTestResponse,
} from "./resources/alerts.js";
export type {
  Commodity,
  CommoditiesResponse,
  CommodityCategory,
  CategoriesResponse,
} from "./resources/commodities.js";
export type {
  FuturesPrice,
  HistoricalFuturesPrice,
  HistoricalFuturesOptions,
  FuturesOHLC,
  IntradayPrice,
  IntradayFuturesData,
  FuturesSpread,
  FuturesCurvePoint,
  FuturesCurveData,
  ContinuousContractPrice,
  ContinuousFuturesData,
} from "./resources/futures.js";
export type {
  StorageData,
  HistoricalStorageData,
  HistoricalStorageOptions,
} from "./resources/storage.js";
export type {
  RigCountData,
  HistoricalRigCountData,
  HistoricalRigCountOptions,
  RigCountTrend,
  RigCountSummary,
} from "./resources/rig-counts.js";
export type {
  BunkerFuelPrice,
  PortBunkerPrices,
  PortPriceComparison,
  BunkerFuelSpreads,
  HistoricalBunkerPrice,
  HistoricalBunkerOptions,
} from "./resources/bunker-fuels.js";
export type {
  PerformanceMetrics,
  PerformanceOptions,
  StatisticalAnalysis,
  CorrelationAnalysis,
  TrendAnalysis,
  SpreadAnalysis,
  ForecastPoint,
  PriceForecast,
} from "./resources/analytics.js";
export type {
  MonthlyForecast,
  ForecastAccuracy,
  ArchivedForecast,
} from "./resources/forecasts.js";
export type {
  DataQualitySummary,
  DataQualityReportMeta,
  DataQualityReport,
} from "./resources/data-quality.js";
export {
  OilPriceAPIError,
  AuthenticationError,
  RateLimitError,
  NotFoundError,
  ServerError,
  TimeoutError,
} from "./errors.js";
export { DieselResource } from "./resources/diesel.js";
export { AlertsResource } from "./resources/alerts.js";
export { CommoditiesResource } from "./resources/commodities.js";
export { FuturesResource } from "./resources/futures.js";
export { StorageResource } from "./resources/storage.js";
export { RigCountsResource } from "./resources/rig-counts.js";
export { BunkerFuelsResource } from "./resources/bunker-fuels.js";
export { AnalyticsResource } from "./resources/analytics.js";
export { ForecastsResource } from "./resources/forecasts.js";
export { DataQualityResource } from "./resources/data-quality.js";
