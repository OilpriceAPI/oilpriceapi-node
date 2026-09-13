/**
 * #94 — a published type must describe what production actually returns.
 *
 * The transport ends in `as T` (`src/client.ts` shapeResponseData), so
 * `tsc --noEmit` is clean however wrong the type is. These tests therefore do
 * two things the compiler cannot:
 *
 *  - drive the REAL client against a fixture captured verbatim from live
 *    production and assert on the value a caller actually receives; and
 *  - assert the TYPE with `@ts-expect-error` / `satisfies`, which fails the
 *    build when a declared property is missing (an UNUSED @ts-expect-error is
 *    itself a compile error, so a passing directive proves absence).
 *
 * Fixtures captured from live production on 2026-09-13.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { OilPriceAPI } from "../src/index.js";
import type { Price, Commodity } from "../src/types.js";

const KEY = "fixture_key_not_a_real_credential";

afterEach(() => {
  vi.restoreAllMocks();
});

function respondWith(body: unknown) {
  vi.spyOn(global, "fetch").mockImplementation((async () =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    })) as unknown as typeof fetch);
}

/** Verbatim from GET /v1/commodities/categories, 2026-09-13. */
const CATEGORIES_ENVELOPE = {
  status: "success",
  data: {
    categories: {
      drilling_intelligence: {
        name: "Drilling Intelligence",
        commodities: [
          {
            code: "RIG_COUNT_US",
            name: "US Rig Count",
            currency: "USD",
            description: "Total US rotary rigs",
            unit: "rigs",
            unit_description: "count",
            status: "active",
            has_data: true,
          },
        ],
      },
    },
  },
};

/** Verbatim from GET /v1/prices/latest?by_code=WTI_USD, 2026-09-13. */
const LATEST_ENVELOPE = {
  status: "success",
  data: {
    code: "WTI_USD",
    price: 99.99,
    formatted: "$99.99",
    currency: "USD",
    unit: "barrel",
    type: "spot_price",
    source: "internal",
    created_at: "2026-09-13T18:31:12Z",
    as_of: "2026-09-13T18:31:12Z",
    collected_at: "2026-09-13T18:31:12Z",
    updated_at: "2026-09-13T18:31:12Z",
    data_status: "current",
    age_days: 0,
    stale: false,
    synthetic: false,
    freshness: {
      status: "current",
      age_seconds: 1331,
      expected_max_age_seconds: 88200,
      circuit_breaker_open: false,
    },
    changes: {
      "24h": {
        amount: 0.0,
        percent: 0.0,
        previous_price: 99.99,
        previous_timestamp: "2026-09-12T17:30:43Z",
        measured_at: "2026-09-13T18:31:12Z",
        span_hours: 25.0,
      },
    },
    metadata: { source: "internal" },
  },
};

describe("#94.1 categories() describes the envelope production returns", () => {
  it("hands the caller the documented shape, not an unwrapped one", async () => {
    respondWith(CATEGORIES_ENVELOPE);
    const client = new OilPriceAPI({ apiKey: KEY, retries: 0 });

    const cats = await client.commodities.categories();

    // Production returns { status, data: { categories: {...} } } and the
    // transport unwraps exactly one level, so this is what arrives.
    expect(Object.keys(cats)).toEqual(["categories"]);
    expect(cats.categories.drilling_intelligence.commodities).toHaveLength(1);
  });

  it("the JSDoc example on categories() actually runs", async () => {
    respondWith(CATEGORIES_ENVELOPE);
    const client = new OilPriceAPI({ apiKey: KEY, retries: 0 });

    const categories = await client.commodities.categories();

    // The documented example was `categories.oil.commodities.length`, which
    // threw TypeError: Cannot read properties of undefined.
    const first = Object.values(categories.categories)[0];
    expect(() => first.commodities.length).not.toThrow();
  });

  it("no longer claims an arbitrary key yields a CommodityCategory", async () => {
    respondWith(CATEGORIES_ENVELOPE);
    const client = new OilPriceAPI({ apiKey: KEY, retries: 0 });
    const cats = await client.commodities.categories();

    // An index signature over the RESPONSE made this compile, which is what
    // hid the missing unwrap from the compiler.
    // @ts-expect-error — the response is a fixed shape, not a category map
    void cats.this_category_does_not_exist;
    expect(cats).toBeDefined();
  });
});

describe("#94.2 Price declares the fields that make the data source-timestamped", () => {
  it("returns freshness, stale, synthetic and age_days to the caller", async () => {
    respondWith(LATEST_ENVELOPE);
    const client = new OilPriceAPI({ apiKey: KEY, retries: 0 });

    const [p] = await client.getLatestPrices({ code: "WTI_USD" });

    // These reach the caller at runtime; the type used to omit all of them,
    // forcing `as any` to read the staleness data the product is sold on.
    expect(p.freshness?.status).toBe("current");
    expect(p.freshness?.circuit_breaker_open).toBe(false);
    expect(p.stale).toBe(false);
    expect(p.synthetic).toBe(false);
    expect(p.age_days).toBe(0);
    expect(p.changes?.["24h"]?.span_hours).toBe(25);
    expect(p.changes?.["24h"]?.previous_timestamp).toBe("2026-09-12T17:30:43Z");
    expect(p.changes?.["24h"]?.measured_at).toBe("2026-09-13T18:31:12Z");
  });

  it("accepts the live payload as a Price without a cast", () => {
    const live = LATEST_ENVELOPE.data satisfies Price;
    expect(live.code).toBe("WTI_USD");
  });
});

describe("#94.3 the commodity summary inside a category is its own type", () => {
  it("does not declare `category` required on a payload that omits it", () => {
    // The commodities nested in /v1/commodities/categories carry no
    // `category`, `multiplier` or `validation`. Declaring `category: string`
    // non-optional typed it `string` while it was `undefined` at runtime.
    const nested = CATEGORIES_ENVELOPE.data.categories.drilling_intelligence.commodities[0];
    expect("category" in nested).toBe(false);

    const summary: Commodity = nested;
    expect(summary.category).toBeUndefined();
  });
});
