/**
 * Official Node.js SDK for Oil Price API
 *
 * Get real-time and historical oil & commodity prices in your Node.js applications.
 *
 * @packageDocumentation
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export { OilPriceAPI } from "./client.js";
export type { APIResponse } from "./client.js";
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
  DemoPrice,
  DemoPricesResponse,
  DemoCommoditiesResponse,
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
} from "./resources/alerts.js";
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
  FuturesSpreadHistoryPoint,
  FuturesSpreadHistory,
  FuturesContractFamilySlug,
} from "./resources/futures.js";
export {
  FUTURES_CONTRACTS,
  FUTURES_FAMILY_SLUGS,
  FuturesContractFamily,
} from "./resources/futures.js";
export type {
  SpreadType,
  SpreadValue,
  HistoricalSpreadValue,
  HistoricalSpreadOptions,
} from "./resources/spreads.js";
export { SpreadsResource } from "./resources/spreads.js";
export type {
  IndicatorType,
  FuelSwitchingIndicator,
  PriceContextIndicator,
  StorageAnalyticsIndicator,
  AnnotationIndicator,
  CFTCPositioningIndicator,
  CongressionalTradeIndicator,
} from "./resources/indicators.js";
export { IndicatorsResource } from "./resources/indicators.js";
export { RawResource } from "./resources/raw.js";
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
  BunkerPortInfo,
  BunkerFuelPrice,
  BunkerSpreadValue,
  BunkerResponseMetadata,
  PortPricesEntry,
  AllBunkerPrices,
  PortBunkerPrices,
  PortPriceComparison,
  PortToPortSpreadDetail,
  BunkerFuelSpreads,
  HistoricalBunkerPrice,
  HistoricalBunkerData,
  BunkerExportRow,
  HistoricalBunkerOptions,
  BunkerSpreadOptions,
} from "./resources/bunker-fuels.js";
export type {
  PerformanceMetrics,
  PerformanceOptions,
  StatisticalAnalysis,
  CorrelationAnalysis,
  CorrelationOptions,
  TrendAnalysis,
  TrendOptions,
  SpreadAnalysis,
  SpreadOptions,
  ForecastOptions,
  PriceForecast as AnalyticsPriceForecast,
} from "./resources/analytics.js";
export type { MonthlyForecast, ForecastAccuracy, ArchivedForecast } from "./resources/forecasts.js";
export type {
  DataQualitySummary,
  DataQualityReportMeta,
  DataQualityReport,
} from "./resources/data-quality.js";
export type {
  DrillingIntelligenceData,
  LatestDrillingData,
  DrillingSummary,
  DrillingTrend,
  FracSpreadData,
  WellPermitData,
  DUCWellData,
  CompletionData,
  WellsDrilledData,
  BasinDrillingData,
} from "./resources/drilling.js";
export type {
  WellTimelineEvent,
  WellTimeline,
  RigCountRecord,
  RigCountByBasin,
  RigCountByState,
  HistoricalRigCount,
  OilInventoryRecord,
  OilInventorySummary,
  InventoryByProduct,
  HistoricalInventory,
  CushingInventory,
  OPECProductionRecord,
  TotalOPECProduction,
  ProductionByCountry,
  HistoricalProduction,
  TopProducer,
  DrillingProductivityRecord,
  DrillingProductivitySummary,
  DUCWellInventory,
  ProductivityByBasin,
  HistoricalProductivity,
  ProductivityTrend,
  ForecastRecord,
  ForecastSummary,
  PriceForecast,
  ProductionForecast,
  HistoricalForecast,
  ForecastComparison,
  WellPermitRecord,
  WellPermitSummary,
  PermitsByState,
  PermitsByOperator,
  PermitsByFormation,
  WellPermitSearchQuery,
  LatestWellPermit,
  WellPermitLatestResponse,
  FracFocusRecord,
  FracFocusSummary,
  DisclosuresByState,
  DisclosuresByOperator,
  ChemicalUsage,
  WellChemical,
  FracFocusSearchQuery,
} from "./resources/ei/index.js";
export type {
  MarketBrief,
  MarketBriefCommodity,
  MarketBriefForecast,
  MarketBriefOptions,
} from "./resources/market-brief.js";
export type {
  Subscription,
  SubscriptionStatus,
  SubscriptionSource,
  SubscriptionInterval,
  CreateSubscriptionParams,
  SubscriptionEvent,
  SubscriptionEventsResult,
  SubscriptionEventsOptions,
} from "./resources/subscriptions.js";
export { SubscriptionsResource, intervalToSeconds } from "./resources/subscriptions.js";
export { WellProductionResource } from "./resources/well-production.js";
export type {
  WellProductionRecord,
  StateProductionSummary,
  WellProductionSummary,
  StatesProductionResponse,
  StateProductionDetail,
  WellProductionDetail,
  TopProducingWell,
  TopProducersResponse,
  StatesOptions,
  StateDetailOptions,
  TopProducersOptions,
  CycleTimeStats,
  CycleTimeWell,
  CycleTimeAnalysis,
  CycleTimeCohort,
  CycleTimeCohortsResponse,
  CycleTimeQuery,
  CycleTimeCohortsQuery,
} from "./resources/well-production.js";
export type {
  WebhookEndpoint,
  CreateWebhookParams,
  UpdateWebhookParams,
  WebhookTestResponse as WebhookTestResult,
  WebhookEvent,
} from "./resources/webhooks.js";
export type {
  DataSourceType,
  DataSourceStatus,
  DataSource,
  CreateDataSourceParams,
  UpdateDataSourceParams,
  DataSourceTestResponse,
  DataSourceLog,
  DataSourceHealth,
  CredentialRotationResponse,
} from "./resources/data-sources.js";
export {
  OilPriceAPIError,
  AuthenticationError,
  RateLimitError,
  NotFoundError,
  ServerError,
  ValidationError,
  TimeoutError,
  errorFromResponse,
  isHTTPError,
  isAuthenticationError,
  isQuotaError,
  isEntitlementError,
  isNotFoundError,
  isRateLimitError,
  isServerError,
} from "./errors.js";
export type { OilPriceAPIErrorDetails } from "./errors.js";
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
export { DrillingIntelligenceResource } from "./resources/drilling.js";
export {
  EnergyIntelligenceResource,
  EIRigCountsResource,
  EIOilInventoriesResource,
  EIOPECProductionResource,
  EIDrillingProductivityResource,
  EIForecastsResource,
  EIWellPermitsResource,
  EIFracFocusResource,
} from "./resources/ei/index.js";
export { WebhooksResource } from "./resources/webhooks.js";
export { DataSourcesResource } from "./resources/data-sources.js";
export {
  StreamingResource,
  PriceStreamSubscription,
  ENERGY_PRICES_CHANNEL,
} from "./resources/streaming.js";
export type {
  StreamPricesOptions,
  PriceUpdateHandler,
  StreamMessage,
  WelcomeMessage,
  PriceUpdateMessage,
  RigCountUpdateMessage,
  StreamedPrice,
  StreamedPriceMap,
} from "./resources/streaming.js";

/**
 * Standalone webhook signature verification.
 *
 * Convenience function for verifying webhook signatures without
 * instantiating a full client.
 *
 * @example
 * ```typescript
 * import { verifyWebhookSignature } from 'oilpriceapi';
 *
 * const isValid = verifyWebhookSignature(rawBody, signatureHeader, secret);
 * ```
 */
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string,
  secret: string,
): boolean {
  const expectedSignature = "sha256=" + createHmac("sha256", secret).update(payload).digest("hex");

  try {
    return timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature));
  } catch {
    return false;
  }
}
