/**
 * #112 — type-level contract for `client.spreads` and `client.indicators`.
 *
 * The transport ends in `as T`, so `crack.type` compiled cleanly and printed
 * `undefined`. Only these assertions hold the contract. Shapes verified against
 * `api.oilpriceapi.com` on 2026-09-13 (tests/fixtures/calculated-metrics/) and
 * the serializers in oilpriceapi-api `app/services/calculated_metrics/`.
 */
import { describe, it, expectTypeOf } from "vitest";
import type {
  OilPriceAPI,
  BasisSpread,
  BasisSpreadHistory,
  CftcPositioning,
  CftcPositioningHistory,
  CftcPositioningPoint,
  CrackSpread,
  CrackSpreadHistory,
  CrackSpreadList,
  CurveStructure,
  FuelSwitching,
  FuelSwitchingHistory,
  GasoilCrackSpread,
  MarketAnnotation,
  MarketAnnotations,
  MarketAnnotationsBatch,
  PhysicalPremium,
  PhysicalPremiumHistory,
  PriceContext,
  RefineryMargin,
  RefineryMarginHistory,
  RelatedSpread,
  StorageAnalytics,
  // deprecated aliases
  SpreadValue,
  HistoricalSpreadValue,
  HistoricalSpreadOptions,
  MetricsDateRangeOptions,
  FuelSwitchingIndicator,
  PriceContextIndicator,
  StorageAnalyticsIndicator,
  AnnotationIndicator,
  CFTCPositioningIndicator,
} from "../src/index.js";

type SP = OilPriceAPI["spreads"];
type IND = OilPriceAPI["indicators"];
declare const sp: SP;
declare const ind: IND;

type Ret<F extends (...args: never[]) => unknown> = Awaited<ReturnType<F>>;

describe("#112 required selectors are required arguments", () => {
  it("basis, curveStructure, priceContext and annotations cannot be called without one", () => {
    // @ts-expect-error — the route answers 400 without `pair`
    void sp.basis();
    // @ts-expect-error — the route answers 400 without `pair`
    void sp.basisHistorical();
    // @ts-expect-error — the route answers 400 without `commodity`
    void sp.curveStructure();
    // @ts-expect-error — the route answers 400 without `code`
    void ind.priceContext();
    // @ts-expect-error — the route answers 400 without `code`
    void ind.annotations();
    // @ts-expect-error — the route answers 400 without `codes`
    void ind.annotationsBatch();

    expectTypeOf(sp.basis).parameter(0).toEqualTypeOf<string>();
    expectTypeOf(sp.curveStructure).parameter(0).toEqualTypeOf<string>();
    expectTypeOf(ind.priceContext).parameter(0).toEqualTypeOf<string>();
    expectTypeOf(ind.annotations).parameter(0).toEqualTypeOf<string>();
    expectTypeOf(ind.annotationsBatch).parameter(0).toEqualTypeOf<readonly string[]>();
  });

  it("optional selectors are named options that map to the route's parameters", () => {
    void sp.crack({ type: "diesel", crude: "WTI_USD" });
    void sp.crackHistorical({ type: "3-2-1", startDate: "2026-09-01", endDate: "2026-09-05" });
    void sp.crackAll({ crude: "WTI_USD" });
    void sp.margin({ index: "nwe" });
    void sp.physicalPremium({ commodity: "WTI" });
    void ind.fuelSwitching({ gas: "NATURAL_GAS_USD", crude: "BRENT_CRUDE_USD" });
    void ind.storageAnalytics({ location: "SPR" });
    void ind.cftcPositioning({ commodity: "BRENT" });
    void ind.priceContext("BRENT_CRUDE_USD", { relatedSpreads: true });
  });
});

describe("#112 return types are the wire payloads", () => {
  it("spreads", () => {
    expectTypeOf<Ret<SP["crack"]>>().toEqualTypeOf<CrackSpread>();
    expectTypeOf<Ret<SP["crackHistorical"]>>().toEqualTypeOf<CrackSpreadHistory>();
    expectTypeOf<Ret<SP["crackAll"]>>().toEqualTypeOf<CrackSpreadList>();
    expectTypeOf<Ret<SP["gasoilCrack"]>>().toEqualTypeOf<GasoilCrackSpread>();
    expectTypeOf<Ret<SP["basis"]>>().toEqualTypeOf<BasisSpread>();
    expectTypeOf<Ret<SP["basisHistorical"]>>().toEqualTypeOf<BasisSpreadHistory>();
    expectTypeOf<Ret<SP["basisAll"]>>().toEqualTypeOf<BasisSpread[]>();
    expectTypeOf<Ret<SP["curveStructure"]>>().toEqualTypeOf<CurveStructure>();
    expectTypeOf<Ret<SP["curveStructureAll"]>>().toEqualTypeOf<CurveStructure[]>();
    expectTypeOf<Ret<SP["margin"]>>().toEqualTypeOf<RefineryMargin>();
    expectTypeOf<Ret<SP["marginHistorical"]>>().toEqualTypeOf<RefineryMarginHistory>();
    expectTypeOf<Ret<SP["marginAll"]>>().toEqualTypeOf<RefineryMargin[]>();
    expectTypeOf<Ret<SP["physicalPremium"]>>().toEqualTypeOf<PhysicalPremium>();
    expectTypeOf<Ret<SP["physicalPremiumHistorical"]>>().toEqualTypeOf<PhysicalPremiumHistory>();
    expectTypeOf<Ret<SP["physicalPremiumAll"]>>().toEqualTypeOf<PhysicalPremium[]>();
  });

  it("indicators", () => {
    expectTypeOf<Ret<IND["fuelSwitching"]>>().toEqualTypeOf<FuelSwitching>();
    expectTypeOf<Ret<IND["fuelSwitchingHistorical"]>>().toEqualTypeOf<FuelSwitchingHistory>();
    expectTypeOf<Ret<IND["priceContext"]>>().toEqualTypeOf<PriceContext>();
    expectTypeOf<Ret<IND["storageAnalytics"]>>().toEqualTypeOf<StorageAnalytics>();
    expectTypeOf<Ret<IND["storageAnalyticsAll"]>>().toEqualTypeOf<StorageAnalytics[]>();
    expectTypeOf<Ret<IND["annotations"]>>().toEqualTypeOf<MarketAnnotations>();
    expectTypeOf<Ret<IND["annotationsBatch"]>>().toEqualTypeOf<MarketAnnotationsBatch>();
    expectTypeOf<Ret<IND["cftcPositioning"]>>().toEqualTypeOf<CftcPositioning>();
    expectTypeOf<Ret<IND["cftcPositioningHistorical"]>>().toEqualTypeOf<CftcPositioningHistory>();
    expectTypeOf<Ret<IND["cftcPositioningAll"]>>().toEqualTypeOf<CftcPositioning[]>();
  });

  it("single-object routes are not arrays", () => {
    expectTypeOf<Ret<IND["cftcPositioning"]>>().not.toBeArray();
    expectTypeOf<Ret<IND["annotations"]>>().not.toBeArray();
    expectTypeOf<Ret<IND["priceContext"]>>().not.toBeArray();
  });
});

describe("#112 field types and nullability", () => {
  it("crack spreads", () => {
    expectTypeOf<CrackSpread["value"]>().toEqualTypeOf<number>();
    expectTypeOf<CrackSpread["components"]["crude"]["price"]>().toEqualTypeOf<number>();
    // api#8477: the 3-2-1 composite omits data_stale. Absent is "not flagged", not "fresh".
    expectTypeOf<CrackSpread["data_stale"]>().toEqualTypeOf<true | undefined>();
    expectTypeOf<CrackSpread["changes"]["change_1d"]>().toEqualTypeOf<number | undefined>();
    expectTypeOf<CrackSpreadHistory["coverage"]["from"]>().toEqualTypeOf<string | null>();
    expectTypeOf<CrackSpreadHistory["data_revised_at"]>().toEqualTypeOf<string | null>();
    // @ts-expect-error — the wire sends spread_type, not type
    expectTypeOf<CrackSpread>().toHaveProperty("type");
  });

  it("basis, margin and premium", () => {
    expectTypeOf<BasisSpread["components"]>().toEqualTypeOf<Record<string, number>>();
    expectTypeOf<BasisSpread["percentile_1y"]>().toEqualTypeOf<number | null>();
    expectTypeOf<BasisSpread["negative_streak_days"]>().toEqualTypeOf<number | undefined>();
    expectTypeOf<RefineryMargin["margin_usd_bbl"]>().toEqualTypeOf<number>();
    // @ts-expect-error — margins carry margin_usd_bbl, not value
    expectTypeOf<RefineryMargin>().toHaveProperty("value");
    expectTypeOf<RefineryMarginHistory["data"][number]["margin"]>().toEqualTypeOf<number>();
    expectTypeOf<PhysicalPremium["premium"]>().toEqualTypeOf<number>();
    expectTypeOf<PhysicalPremium["percentile_1y"]>().toEqualTypeOf<number | null>();
    expectTypeOf<CurveStructure["spreads"]["m1_m6"]>().toEqualTypeOf<number>();
  });

  it("indicators", () => {
    expectTypeOf<FuelSwitching["oil_parity"]["ratio_pct"]>().toEqualTypeOf<number>();
    expectTypeOf<FuelSwitching["historical_context"]["data_points"]>().toEqualTypeOf<
      number | undefined
    >();
    expectTypeOf<PriceContext["context"]["anomaly"]>().toEqualTypeOf<boolean>();
    expectTypeOf<PriceContext["context"]["percentile_1y"]>().toEqualTypeOf<number | undefined>();
    // @ts-expect-error — percentile is nested under context as percentile_1y / percentile_5y
    expectTypeOf<PriceContext>().toHaveProperty("percentile");
    expectTypeOf<RelatedSpread["value"]>().toEqualTypeOf<number | string>();
    expectTypeOf<StorageAnalytics["current"]["utilization_pct"]>().toEqualTypeOf<number | null>();
    expectTypeOf<StorageAnalytics["draw_rate"]["days_to_depletion"]>().toEqualTypeOf<
      number | null | undefined
    >();
    expectTypeOf<MarketAnnotation["type"]>().toEqualTypeOf<string>();
    expectTypeOf<CftcPositioning["positioning"]["speculative"]["net"]>().toEqualTypeOf<number>();
    expectTypeOf<CftcPositioning["positioning"]["speculative"]["long"]>().toEqualTypeOf<
      number | null
    >();
    expectTypeOf<CftcPositioning["week_change"]>().toEqualTypeOf<number | null>();
    // api#8476: production sends a fabricated 0 today; the correct value can be null.
    expectTypeOf<CftcPositioningPoint["spec_net_pct_oi"]>().toEqualTypeOf<number | null>();
  });
});

describe("#112 removed methods", () => {
  it("congressionalTrades and the untyped get/historical/all are gone", () => {
    // @ts-expect-error — the route has never returned data (api#8478)
    expectTypeOf<IND>().toHaveProperty("congressionalTrades");
    // @ts-expect-error — could not send a route's parameters
    expectTypeOf<IND>().toHaveProperty("get");
    // @ts-expect-error — could not send a route's parameters
    expectTypeOf<SP>().toHaveProperty("get");
    // @ts-expect-error — returned undefined for every type
    expectTypeOf<SP>().toHaveProperty("historical");
    // @ts-expect-error — returned undefined for every type
    expectTypeOf<SP>().toHaveProperty("all");
  });
});

describe("#112 deprecated names are aliases of the wire types", () => {
  it("keep compiling, with the corrected shape", () => {
    expectTypeOf<SpreadValue>().toEqualTypeOf<
      CrackSpread | BasisSpread | CurveStructure | RefineryMargin | PhysicalPremium
    >();
    expectTypeOf<HistoricalSpreadValue>().toEqualTypeOf<
      | CrackSpreadHistory["data"][number]
      | BasisSpreadHistory["data"][number]
      | RefineryMarginHistory["data"][number]
      | PhysicalPremiumHistory["data"][number]
    >();
    expectTypeOf<HistoricalSpreadOptions>().toEqualTypeOf<MetricsDateRangeOptions>();
    expectTypeOf<FuelSwitchingIndicator>().toEqualTypeOf<FuelSwitching>();
    expectTypeOf<PriceContextIndicator>().toEqualTypeOf<PriceContext>();
    expectTypeOf<StorageAnalyticsIndicator>().toEqualTypeOf<StorageAnalytics>();
    expectTypeOf<AnnotationIndicator>().toEqualTypeOf<MarketAnnotation>();
    expectTypeOf<CFTCPositioningIndicator>().toEqualTypeOf<CftcPositioning>();
  });
});
