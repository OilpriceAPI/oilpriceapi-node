/**
 * #112 — `client.indicators` through the REAL client and a REAL `fetch` mock.
 *
 * The previous suite spied on the private `request` method, so none of these
 * defects could fail it:
 *   - `priceContext()` and `annotations()` could not send `code`, and
 *     production answers both with HTTP 400 `MISSING_PARAMETER`;
 *   - both routes put `price` at the top of `data`, which the core client's
 *     latest-price heuristic wraps in a one-element array, so every typed
 *     field of the result was undefined even with a code;
 *   - `cftcPositioning()` was typed as an array; the route returns one object
 *     (the list is `/cftc-positioning/all` under `commodities`);
 *   - `FuelSwitchingIndicator`, `PriceContextIndicator` and
 *     `StorageAnalyticsIndicator` described fields no route sends;
 *   - `congressionalTrades()` targets a route that has never returned data
 *     (404 `DATA_NOT_AVAILABLE`, api#8478).
 *
 * Fixtures in tests/fixtures/calculated-metrics/ are verbatim from
 * `api.oilpriceapi.com` on 2026-09-13 (paid test account). Routes confirmed on
 * oilpriceapi-api `origin/main` (`config/routes.rb`,
 * `app/controllers/v1/spreads_controller.rb`, `app/services/calculated_metrics/`).
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  OilPriceAPI,
  OilPriceAPIError,
  NotFoundError,
  RateLimitError,
  TimeoutError,
  ValidationError,
  isEntitlementError,
} from "../../src/index.js";

const KEY = "fixture_key_not_a_real_credential";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;
const fixture = (name: string): Json =>
  JSON.parse(readFileSync(`tests/fixtures/calculated-metrics/${name}.json`, "utf8"));

interface Wire {
  pathname: string;
  params: Record<string, string>;
}

function serve(body: unknown, status = 200): Wire[] {
  const wire: Wire[] = [];
  vi.spyOn(global, "fetch").mockImplementation((async (input: unknown) => {
    const url = new URL(String(input));
    wire.push({ pathname: url.pathname, params: Object.fromEntries(url.searchParams) });
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch);
  return wire;
}

const client = (timeout?: number) => new OilPriceAPI({ apiKey: KEY, retries: 0, timeout });

/**
 * `V1::SpreadsController#check_analytics_access` -> `render_standard_error` on
 * `origin/main`. Not captured live: every key available held the entitlement.
 */
const PREMIUM_REQUIRED_403 = {
  error: {
    code: "PREMIUM_REQUIRED",
    message:
      "Calculated metrics require a paid plan (Developer and above). Upgrade at https://oilpriceapi.com/pricing",
    status: 403,
    request_id: "fixture-request-id",
    docs: "https://docs.oilpriceapi.com#PREMIUM_REQUIRED",
  },
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("#112 fuelSwitching()", () => {
  it("returns the oil_parity block, components and trailing context", async () => {
    const wire = serve(fixture("fuel-switching"));
    const parity = await client().indicators.fuelSwitching();

    expect(wire[0].pathname).toBe("/v1/indicators/fuel-switching");
    expect(wire[0].params).toEqual({});
    expect(parity.oil_parity.ratio_pct).toBe(15.73);
    expect(parity.oil_parity.signal).toBe("gas_cheap_vs_oil");
    expect(parity.components.gas).toEqual({ code: "NATURAL_GAS_USD", price: 2.83, unit: "USD/MMBtu" });
    expect(parity.energy_equivalent.crude_per_mmbtu).toBe(17.99);
    expect(parity.historical_context.data_points).toBe(347);
  });

  it("sends gas and crude", async () => {
    const wire = serve(fixture("fuel-switching"));
    await client().indicators.fuelSwitching({ gas: "DUTCH_TTF_NATURAL_GAS_USD", crude: "WTI_USD" });

    expect(wire[0].params).toEqual({ gas: "DUTCH_TTF_NATURAL_GAS_USD", crude: "WTI_USD" });
  });

  it("fuelSwitchingHistorical() sends the window and returns the envelope", async () => {
    const wire = serve(fixture("fuel-switching-historical"));
    const history = await client().indicators.fuelSwitchingHistorical({
      startDate: "2026-09-01",
      endDate: "2026-09-05",
    });

    expect(wire[0].pathname).toBe("/v1/indicators/fuel-switching/historical");
    expect(wire[0].params).toEqual({ start_date: "2026-09-01", end_date: "2026-09-05" });
    expect(history.gas_benchmark).toBe("NATURAL_GAS_USD");
    expect(history.data[0]).toMatchObject({ date: "2026-09-04", ratio_pct: 17.84, above_parity: false });
  });
});

describe("#112 priceContext()", () => {
  it("sends the required code and returns the object, not a one-element array", async () => {
    const wire = serve(fixture("price-context"));
    const ctx = await client().indicators.priceContext("BRENT_CRUDE_USD");

    expect(wire[0].pathname).toBe("/v1/indicators/price-context");
    expect(wire[0].params).toEqual({ code: "BRENT_CRUDE_USD" });
    expect(Array.isArray(ctx)).toBe(false);
    expect(ctx.code).toBe("BRENT_CRUDE_USD");
    expect(ctx.price).toBe(104.32);
    expect(ctx.context.percentile_1y).toBe(90);
    expect(ctx.context.percentile_5y).toBe(91);
    expect(ctx.context.high_52w).toBe(126.39);
    expect(ctx.context.anomaly).toBe(true);
    expect(ctx.related_spreads).toBeUndefined();
  });

  it("requests related spreads, whose value is a number or a structure label", async () => {
    const wire = serve(fixture("price-context-related"));
    const ctx = await client().indicators.priceContext("BRENT_CRUDE_USD", { relatedSpreads: true });

    expect(wire[0].params).toEqual({ code: "BRENT_CRUDE_USD", spreads: "related" });
    expect(ctx.related_spreads?.[0]).toEqual({
      name: "Brent-WTI",
      value: 4.33,
      unit: "USD/bbl",
      signal: "normal",
    });
    expect(ctx.related_spreads?.[3]).toEqual({
      name: "Curve Structure",
      value: "backwardation",
      signal: "extreme",
      slope: -38.7,
    });
  });

  it("surfaces the route's 400 if it is ever reached", async () => {
    serve(fixture("price-context-missing-code-400"), 400);
    const error = await client()
      .indicators.priceContext("BRENT_CRUDE_USD")
      .catch((e) => e);

    expect(error.statusCode).toBe(400);
    expect(error.code).toBe("MISSING_PARAMETER");
  });
});

describe("#112 storageAnalytics()", () => {
  it("returns nested current / draw_rate blocks, keeping {} blocks as {}", async () => {
    const wire = serve(fixture("storage-analytics"));
    const storage = await client().indicators.storageAnalytics();

    expect(wire[0].pathname).toBe("/v1/indicators/storage-analytics");
    expect(storage.location).toBe("CUSHING");
    expect(storage.current.volume_mmbbl).toBe(21.82);
    expect(storage.current.utilization_pct).toBe(35.8);
    expect(storage.draw_rate.days_to_depletion).toBe(225);
    expect(storage.seasonal).toEqual({});
    expect(storage.range_52w).toEqual({});
  });

  it("sends location", async () => {
    const wire = serve(fixture("storage-analytics"));
    await client().indicators.storageAnalytics({ location: "SPR" });

    expect(wire[0].params).toEqual({ location: "SPR" });
  });

  it("storageAnalyticsAll() returns the list under locations", async () => {
    const wire = serve(fixture("storage-analytics-all"));
    const all = await client().indicators.storageAnalyticsAll();

    expect(wire[0].pathname).toBe("/v1/indicators/storage-analytics/all");
    expect(all[0].location).toBe("CUSHING");
  });
});

describe("#112 annotations()", () => {
  it("sends the required code and returns the object, not a one-element array", async () => {
    const wire = serve(fixture("annotations"));
    const result = await client().indicators.annotations("BRENT_CRUDE_USD");

    expect(wire[0].pathname).toBe("/v1/indicators/annotations");
    expect(wire[0].params).toEqual({ code: "BRENT_CRUDE_USD" });
    expect(Array.isArray(result)).toBe(false);
    expect(result.code).toBe("BRENT_CRUDE_USD");
    expect(result.annotation_count).toBe(3);
    expect(result.annotations.map((a) => a.type)).toEqual(["anomaly", "velocity", "streak"]);
    expect(result.annotations[2].streak_days).toBe(5);
  });

  it("annotationsBatch() sends comma-joined codes", async () => {
    const wire = serve(fixture("annotations-batch"));
    const batch = await client().indicators.annotationsBatch([
      "BRENT_CRUDE_USD",
      "WTI_USD",
      "NATURAL_GAS_USD",
    ]);

    expect(wire[0].pathname).toBe("/v1/indicators/annotations/batch");
    expect(wire[0].params).toEqual({ codes: "BRENT_CRUDE_USD,WTI_USD,NATURAL_GAS_USD" });
    expect(batch.total_codes).toBe(3);
    expect(batch.codes_with_annotations).toBe(2);
    expect(batch.annotated.map((a) => a.code)).toEqual(["BRENT_CRUDE_USD", "WTI_USD"]);
  });
});

describe("#112 cftcPositioning()", () => {
  it("returns one object with nested positioning, keeping nulls", async () => {
    const wire = serve(fixture("cftc-positioning"));
    const cftc = await client().indicators.cftcPositioning();

    expect(wire[0].pathname).toBe("/v1/indicators/cftc-positioning");
    expect(Array.isArray(cftc)).toBe(false);
    expect(cftc.commodity).toBe("WTI");
    expect(cftc.report_date).toBe("2026-09-11");
    expect(cftc.positioning.speculative).toEqual({
      net: 136579,
      long: 350118,
      short: 213539,
      net_pct_of_oi: 7.04,
    });
    expect(cftc.week_change).toBe(6668);
  });

  it("sends commodity", async () => {
    const wire = serve(fixture("cftc-positioning"));
    await client().indicators.cftcPositioning({ commodity: "BRENT" });

    expect(wire[0].params).toEqual({ commodity: "BRENT" });
  });

  it("cftcPositioningHistorical() returns rows with spec_net_pct_oi as sent", async () => {
    const wire = serve(fixture("cftc-positioning-historical"));
    const history = await client().indicators.cftcPositioningHistorical({
      startDate: "2026-07-01",
      endDate: "2026-09-05",
    });

    expect(wire[0].pathname).toBe("/v1/indicators/cftc-positioning/historical");
    expect(history.count).toBe(9);
    // api#8476: production sends a fabricated 0 today. The SDK passes the value
    // through; the type is number | null so the fix can send null.
    expect(history.data[0]).toEqual({
      date: "2026-09-04",
      spec_net: 129911,
      open_interest: 1921085,
      spec_net_pct_oi: 0,
    });
  });

  it("cftcPositioningAll() returns the list under commodities with null components", async () => {
    const wire = serve(fixture("cftc-positioning-all"));
    const all = await client().indicators.cftcPositioningAll();

    expect(wire[0].pathname).toBe("/v1/indicators/cftc-positioning/all");
    expect(all).toHaveLength(5);
    expect(all[1].commodity).toBe("BRENT");
    expect(all[1].positioning.speculative.long).toBeNull();
    expect(all[1].positioning.open_interest).toBeNull();
  });
});

describe("#112 arguments are refused before any request", () => {
  const tooMany = Array.from({ length: 21 }, (_, i) => `CODE_${i}`);
  const cases: Array<[string, (c: OilPriceAPI) => Promise<unknown>]> = [
    [
      "priceContext() with no code",
      (c) => (c.indicators.priceContext as (code?: string) => Promise<unknown>)(),
    ],
    ["priceContext('')", (c) => c.indicators.priceContext("")],
    [
      "annotations() with no code",
      (c) => (c.indicators.annotations as (code?: string) => Promise<unknown>)(),
    ],
    ["annotations(' ')", (c) => c.indicators.annotations(" ")],
    ["annotationsBatch([])", (c) => c.indicators.annotationsBatch([])],
    [
      "annotationsBatch with 21 codes (the route silently annotates only 20)",
      (c) => c.indicators.annotationsBatch(tooMany),
    ],
    ["annotationsBatch with a blank code", (c) => c.indicators.annotationsBatch(["WTI_USD", ""])],
    ["annotationsBatch with a comma inside a code", (c) => c.indicators.annotationsBatch(["WTI_USD,X"])],
    [
      "annotationsBatch with a bare string",
      (c) => (c.indicators.annotationsBatch as (codes: unknown) => Promise<unknown>)("WTI_USD"),
    ],
    ["fuelSwitching({ gas: '' })", (c) => c.indicators.fuelSwitching({ gas: "" })],
    ["storageAnalytics({ location: '' })", (c) => c.indicators.storageAnalytics({ location: "" })],
    ["cftcPositioning({ commodity: '' })", (c) => c.indicators.cftcPositioning({ commodity: "" })],
    [
      "an unparseable startDate",
      (c) => c.indicators.cftcPositioningHistorical({ startDate: "13/01/2026" }),
    ],
    [
      "startDate after endDate",
      (c) =>
        c.indicators.fuelSwitchingHistorical({ startDate: "2026-09-05", endDate: "2026-09-01" }),
    ],
  ];

  for (const [name, call] of cases) {
    it(name, async () => {
      const wire = serve(fixture("price-context"));
      const error = await call(client()).catch((e) => e);

      expect(error).toBeInstanceOf(ValidationError);
      expect(wire).toHaveLength(0);
    });
  }
});

describe("#112 malformed 200 raises unexpected_response_shape", () => {
  const cases: Array<[string, (c: OilPriceAPI) => Promise<unknown>, unknown]> = [
    [
      "fuelSwitching (old declared shape)",
      (c) => c.indicators.fuelSwitching(),
      { value: 1.2, economical: true, timestamp: "t" },
    ],
    ["fuelSwitchingHistorical", (c) => c.indicators.fuelSwitchingHistorical(), { data: [] }],
    [
      "priceContext (percentile at the top level)",
      (c) => c.indicators.priceContext("BRENT_CRUDE_USD"),
      { code: "BRENT_CRUDE_USD", price: 104.32, percentile: 90, timestamp: "t" },
    ],
    [
      "storageAnalytics (old declared shape)",
      (c) => c.indicators.storageAnalytics(),
      { level: 21.82, capacity_percent: 35.8 },
    ],
    ["storageAnalyticsAll", (c) => c.indicators.storageAnalyticsAll(), { locations: [{}] }],
    [
      "annotations (bare array)",
      (c) => c.indicators.annotations("BRENT_CRUDE_USD"),
      [{ title: "OPEC cut", date: "2024-01-01" }],
    ],
    [
      "annotationsBatch",
      (c) => c.indicators.annotationsBatch(["WTI_USD"]),
      { annotated: {}, total_codes: 1 },
    ],
    [
      "cftcPositioning (array)",
      (c) => c.indicators.cftcPositioning(),
      [{ market: "WTI", net_position: 50, report_date: "2024-01-09" }],
    ],
    ["cftcPositioningHistorical", (c) => c.indicators.cftcPositioningHistorical(), { count: 0 }],
    ["cftcPositioningAll", (c) => c.indicators.cftcPositioningAll(), { data: [] }],
  ];

  for (const [name, call, data] of cases) {
    it(name, async () => {
      serve({ status: "success", data });
      const error = await call(client()).catch((e) => e);

      expect(error).toBeInstanceOf(OilPriceAPIError);
      expect(error.code).toBe("unexpected_response_shape");
    });
  }
});

describe("#112 transport failures", () => {
  it("surfaces 403 PREMIUM_REQUIRED as an entitlement error", async () => {
    serve(PREMIUM_REQUIRED_403, 403);
    const error = await client()
      .indicators.priceContext("BRENT_CRUDE_USD")
      .catch((e) => e);

    expect(isEntitlementError(error)).toBe(true);
    expect(error.code).toBe("PREMIUM_REQUIRED");
  });

  it("raises NotFoundError for a 404", async () => {
    serve(fixture("margin-unknown-index-404"), 404);
    await expect(client().indicators.cftcPositioning({ commodity: "BOGUS" })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("surfaces a 429 as RateLimitError", async () => {
    serve({ error: { code: "RATE_LIMITED", message: "Too many requests", status: 429 } }, 429);
    await expect(client().indicators.annotations("WTI_USD")).rejects.toBeInstanceOf(RateLimitError);
  });

  it("times out when the body stalls after headers", async () => {
    vi.spyOn(global, "fetch").mockImplementation((async (_input: unknown, init: RequestInit) => {
      const body = new ReadableStream({
        start(controller) {
          init?.signal?.addEventListener("abort", () =>
            controller.error(Object.assign(new Error("aborted"), { name: "AbortError" })),
          );
        },
      });
      return new Response(body, { status: 200 });
    }) as unknown as typeof fetch);

    await expect(client(100).indicators.storageAnalytics()).rejects.toBeInstanceOf(TimeoutError);
  });

  it("maps an aborted fetch to TimeoutError", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(
      Object.assign(new Error("This operation was aborted"), { name: "AbortError" }),
    );
    await expect(client().indicators.cftcPositioningAll()).rejects.toBeInstanceOf(TimeoutError);
  });
});

describe("#112 routes without an observed shape are not exposed", () => {
  it("congressionalTrades() and the untyped get() are removed", () => {
    const indicators = client().indicators as unknown as Record<string, unknown>;
    expect(indicators.congressionalTrades).toBeUndefined();
    expect(indicators.get).toBeUndefined();
  });

  it("the resource docs no longer read fields the wire lacks", () => {
    const source = readFileSync("src/resources/indicators.ts", "utf8");
    for (const stale of [/fs\.economical\b/, /p\.net_position\b/, /p\.market\b/, /congressional/i]) {
      expect(source).not.toMatch(stale);
    }
  });
});
