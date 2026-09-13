/**
 * #94 — type-level contract for what production actually returns.
 *
 * `shapeResponseData` ends in `as T`, so the compiler never checks a response
 * against its declared type: `tsc --noEmit` stays clean however wrong the
 * declaration is. These assertions are the only thing that holds the contract,
 * and they run under `npm test` so they are a guard rather than a comment.
 *
 * Every payload below was captured verbatim from live production on
 * 2026-09-13.
 */
import { describe, it, expectTypeOf } from "vitest";
import type { Price, Commodity, CategoriesResponse, CommodityCategory } from "../src/types.js";

describe("#94.1 CategoriesResponse", () => {
  it("is the envelope production returns, not a map of category keys", () => {
    // GET /v1/commodities/categories -> { status, data: { categories: {...} } }
    // and the transport unwraps one level, so the caller gets { categories }.
    expectTypeOf<CategoriesResponse>().toHaveProperty("categories");
    expectTypeOf<CategoriesResponse["categories"]>().toEqualTypeOf<
      Record<string, CommodityCategory>
    >();
  });

  it("does not claim an arbitrary key yields a CommodityCategory", () => {
    // The index signature is what hid the missing unwrap from the compiler:
    // `cats.oil.commodities.length` and `cats.does_not_exist.name` both
    // compiled, and the first one threw at runtime.
    // @ts-expect-error — a fixed-shape response has no arbitrary keys
    expectTypeOf<CategoriesResponse>().toHaveProperty("oil");
  });
});

describe("#94.2 Price declares the freshness fields the product is sold on", () => {
  it("declares freshness", () => {
    expectTypeOf<Price>().toHaveProperty("freshness");
    expectTypeOf<Price["freshness"]>().not.toBeNever();
    expectTypeOf<NonNullable<Price["freshness"]>>().toHaveProperty("status");
    expectTypeOf<NonNullable<Price["freshness"]>>().toHaveProperty("age_seconds");
    expectTypeOf<NonNullable<Price["freshness"]>>().toHaveProperty(
      "expected_max_age_seconds",
    );
    expectTypeOf<NonNullable<Price["freshness"]>>().toHaveProperty("circuit_breaker_open");
  });

  it("declares stale, synthetic and age_days", () => {
    expectTypeOf<Price>().toHaveProperty("stale");
    expectTypeOf<Price>().toHaveProperty("synthetic");
    expectTypeOf<Price>().toHaveProperty("age_days");
  });

  it("declares the full 24h change block", () => {
    type Change24h = NonNullable<NonNullable<Price["changes"]>["24h"]>;
    expectTypeOf<Change24h>().toHaveProperty("previous_timestamp");
    expectTypeOf<Change24h>().toHaveProperty("measured_at");
    expectTypeOf<Change24h>().toHaveProperty("span_hours");
  });
});

describe("#94.3 Commodity.category", () => {
  it("is optional, because half the payloads using this type omit it", () => {
    // The commodities nested in /v1/commodities/categories carry only
    // code, name, currency, description, unit, unit_description, status,
    // has_data. Declaring `category: string` typed it `string` while it was
    // `undefined` at runtime.
    expectTypeOf<Commodity["category"]>().toEqualTypeOf<string | undefined>();
  });

  it("declares the fields /v1/commodities actually returns", () => {
    expectTypeOf<Commodity>().toHaveProperty("status");
    expectTypeOf<Commodity>().toHaveProperty("has_data");
    expectTypeOf<Commodity>().toHaveProperty("data_source");
    expectTypeOf<Commodity>().toHaveProperty("update_frequency");
    expectTypeOf<Commodity>().toHaveProperty("sources");
  });
});
