/**
 * Market Brief types (OilPriceAPI #3245 Phase 1a)
 *
 * A multi-commodity structured (+ optional narrative) market summary composed
 * from existing price + forecast data. Served by `GET /v1/market-brief` and
 * surfaced on the client as {@link OilPriceAPI.getMarketBrief}.
 */

/**
 * Short-horizon (1-month) point forecast for a commodity in a market brief.
 */
export interface MarketBriefForecast {
  /** Central point estimate. */
  point: number;
  /** Low end of the forecast band. */
  low: number;
  /** High end of the forecast band. */
  high: number;
  /** Model confidence label (e.g. "low", "medium", "high"). */
  confidence: string;
}

/**
 * One commodity's slice of a market brief.
 */
export interface MarketBriefCommodity {
  /** Commodity code (e.g. "BRENT_CRUDE_USD"). */
  code: string;
  /** Human-readable commodity name. */
  name: string;
  /** Latest price. */
  price: number;
  /** ISO currency code (e.g. "USD"). */
  currency: string;
  /** Price unit (e.g. "barrel"). */
  unit: string;
  /** 24h percentage change. */
  change_24h_pct: number;
  /** 24h absolute change. */
  change_24h_abs: number;
  /** ISO timestamp the price was observed. */
  as_of: string;
  /** Upstream data source. */
  source: string;
  /** True when the price is stale (no fresh update). */
  stale: boolean;
  /** 1-month forecast band, when available. */
  forecast_1m: MarketBriefForecast | null;
}

/**
 * A multi-commodity market brief.
 *
 * Returned by {@link OilPriceAPI.getMarketBrief}.
 */
export interface MarketBrief {
  /** ISO timestamp the brief was generated. */
  as_of: string;
  /** The (resolved, canonical) codes included in the brief. */
  codes: string[];
  /** Per-commodity structured summary. */
  commodities: MarketBriefCommodity[];
  /** Optional natural-language narrative (only when `narrative: true`). */
  narrative?: string;
}

/**
 * Options for {@link OilPriceAPI.getMarketBrief}.
 */
export interface MarketBriefOptions {
  /**
   * Request a natural-language narrative alongside the structured data.
   * Defaults to `false`.
   */
  narrative?: boolean;
}
