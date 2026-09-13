/**
 * #108 — type-level contract for the non-EI `client.rigCounts` resource.
 *
 * The transport ends in `as T`, so `latest.total` compiled cleanly and printed
 * `undefined`. Only these assertions hold the contract. Shapes verified
 * against live production 2026-09-13 (fixtures in tests/fixtures/rig-counts/):
 *   latest     -> { code, region, count, currency, unit, source, created_at,
 *                   collected_at, observed_at, source_date, formatted_date }
 *   current    -> { rig_counts: [...], summary: { total_us_rigs, ... } }
 *   historical -> { rig_counts: [...], pagination: {...}, period: {...} }
 *   summary    -> { current_totals, weekly_changes, yearly_changes, last_updated, source_date }
 *   trends     -> { region, period, trend_data: {...}, rig_counts: [...] }
 */
import { describe, it, expectTypeOf } from "vitest";
import type { OilPriceAPI, RigCountObservation } from "../src/index.js";

type RC = OilPriceAPI["rigCounts"];
declare const rc: RC;

type Latest = Awaited<ReturnType<RC["latest"]>>;
type Current = Awaited<ReturnType<RC["current"]>>;
type Historical = Awaited<ReturnType<RC["historical"]>>;
type Summary = Awaited<ReturnType<RC["summary"]>>;
type Trend = Awaited<ReturnType<RC["trends"]>>;

describe("#108 latest() is one observation", () => {
  it("declares the wire fields", () => {
    expectTypeOf<Latest>().toEqualTypeOf<RigCountObservation>();
    expectTypeOf<Latest["count"]>().toEqualTypeOf<number>();
    expectTypeOf<Latest>().toHaveProperty("code");
    expectTypeOf<Latest>().toHaveProperty("region");
    expectTypeOf<Latest>().toHaveProperty("source_date");
    expectTypeOf<Latest>().toHaveProperty("observed_at");
    expectTypeOf<Latest>().toHaveProperty("collected_at");
  });

  it("no longer claims fields the route never sends", () => {
    // @ts-expect-error — the value is `count`
    expectTypeOf<Latest>().toHaveProperty("total");
    // @ts-expect-error — /v1/rig-counts carries no oil/gas split
    expectTypeOf<Latest>().toHaveProperty("oil");
    // @ts-expect-error — the record carries observed_at/source_date, not timestamp
    expectTypeOf<Latest>().toHaveProperty("timestamp");
  });
});

describe("#108 current() is the rows plus a summary", () => {
  it("declares both blocks", () => {
    expectTypeOf<Current["rig_counts"]>().toEqualTypeOf<RigCountObservation[]>();
    expectTypeOf<Current["summary"]["total_us_rigs"]>().toEqualTypeOf<number>();
    expectTypeOf<Current["summary"]>().toHaveProperty("total_canada_rigs");
    expectTypeOf<Current["summary"]>().toHaveProperty("total_international_rigs");
  });
});

describe("#108 historical() is a page, not an array", () => {
  it("returns the envelope with pagination and period coverage", () => {
    expectTypeOf<Historical>().not.toBeArray();
    expectTypeOf<Historical["rig_counts"]>().toEqualTypeOf<RigCountObservation[]>();
    expectTypeOf<Historical["pagination"]["total"]>().toEqualTypeOf<number>();
    expectTypeOf<Historical["pagination"]>().toHaveProperty("total_pages");
    expectTypeOf<Historical["period"]["complete"]>().toEqualTypeOf<boolean>();
    expectTypeOf<Historical["period"]>().toHaveProperty("earliest_available");
  });
});

describe("#108 summary() is keyed by region name", () => {
  it("declares the blocks the route sends", () => {
    expectTypeOf<Summary>().toHaveProperty("current_totals");
    expectTypeOf<Summary>().toHaveProperty("weekly_changes");
    expectTypeOf<Summary>().toHaveProperty("yearly_changes");
    expectTypeOf<NonNullable<Summary["weekly_changes"]["Canada"]>>().toHaveProperty("absolute");
    expectTypeOf<NonNullable<Summary["weekly_changes"]["Canada"]>>().toHaveProperty("percentage");
  });

  it("no longer claims the invented fields", () => {
    // @ts-expect-error — no week_change on the wire
    expectTypeOf<Summary>().toHaveProperty("week_change");
    // @ts-expect-error — no breakdown on the wire
    expectTypeOf<Summary>().toHaveProperty("breakdown");
  });
});

describe("#108 trends()", () => {
  it("declares region, period, trend_data and rig_counts", () => {
    expectTypeOf<Trend>().toHaveProperty("region");
    expectTypeOf<Trend>().toHaveProperty("trend_data");
    expectTypeOf<Trend["rig_counts"]>().toEqualTypeOf<RigCountObservation[]>();
    // @ts-expect-error — the metrics are average_count inside trend_data
    expectTypeOf<Trend>().toHaveProperty("average");
  });

  it("only accepts the periods the route honours", () => {
    void rc.trends("1m");
    void rc.trends({ period: "2years", region: "CANADA_RIG_COUNT" });
    // @ts-expect-error — the route silently serves six months for "week"
    void rc.trends("week");
    // @ts-expect-error — not a rig-count region code
    void rc.trends({ region: "TEXAS" });
  });
});
