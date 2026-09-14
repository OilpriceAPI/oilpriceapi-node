/**
 * #112 — `client.spreads` through the REAL client and a REAL `fetch` mock.
 *
 * The previous suite spied on the private `request` method and fed it the
 * declared shape, so none of these defects could fail it:
 *   - `basis()` and `curveStructure()` could not send `pair` / `commodity`, and
 *     production answers both with HTTP 400 `MISSING_PARAMETER`;
 *   - `crack()`, `margin()` and `physicalPremium()` could not send `type`,
 *     `crude`, `index` or `commodity`, so only server defaults were reachable;
 *   - `all()` returned `undefined`: the list is under `spreads`, `commodities`,
 *     `margins` or `premiums`, not `data`;
 *   - `SpreadValue` described `type` and `components: string[]`, which no route
 *     sends, and margin rows carry `margin_usd_bbl`, not `value`.
 *
 * Fixtures in tests/fixtures/calculated-metrics/ are verbatim from
 * `api.oilpriceapi.com` on 2026-09-13 (paid test account). Routes and
 * parameters confirmed on oilpriceapi-api `origin/main`
 * (`config/routes.rb`, `app/controllers/v1/spreads_controller.rb`,
 * `app/services/calculated_metrics/`).
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
  method: string;
  pathname: string;
  params: Record<string, string>;
}

function serve(body: unknown, status = 200, headers: Record<string, string> = {}): Wire[] {
  const wire: Wire[] = [];
  vi.spyOn(global, "fetch").mockImplementation((async (input: unknown, init: RequestInit) => {
    const url = new URL(String(input));
    wire.push({
      method: (init?.method ?? "GET").toUpperCase(),
      pathname: url.pathname,
      params: Object.fromEntries(url.searchParams),
    });
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json", ...headers },
    });
  }) as unknown as typeof fetch);
  return wire;
}

const client = (timeout?: number) => new OilPriceAPI({ apiKey: KEY, retries: 0, timeout });

/**
 * Body of `V1::SpreadsController#check_analytics_access` -> `render_standard_error`
 * on `origin/main`. Not captured live: every key available to this session holds
 * the entitlement. The envelope matches the live 400/404 bodies of the same
 * controller, and the status is 403 (never 402).
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

describe("#112 crack()", () => {
  it("returns the 3-2-1 composite with priced components and changes", async () => {
    const wire = serve(fixture("crack"));
    const crack = await client().spreads.crack();

    expect(wire[0].method).toBe("GET");
    expect(wire[0].pathname).toBe("/v1/spreads/crack");
    expect(wire[0].params).toEqual({});
    expect(crack.spread_type).toBe("3-2-1");
    expect(crack.crude_benchmark).toBe("BRENT_CRUDE_USD");
    expect(crack.value).toBe(58.5);
    expect(crack.unit).toBe("USD/bbl");
    expect(crack.components.gasoline).toEqual({
      code: "GASOLINE_RBOB_USD",
      price: 139.44,
      unit: "USD/bbl",
    });
    expect(crack.changes.change_1w).toBe(1.05);
    // api#8477: the composite omits data_stale today. Absent means "not flagged".
    expect(crack.data_stale).toBeUndefined();
  });

  it("sends type and crude", async () => {
    const wire = serve(fixture("crack-diesel-wti"));
    const crack = await client().spreads.crack({ type: "diesel", crude: "WTI_USD" });

    expect(wire[0].params).toEqual({ type: "diesel", crude: "WTI_USD" });
    expect(crack.components.product.code).toBe("HEATING_OIL_USD");
    expect(crack.value).toBe(109.59);
  });
});

describe("#112 crackHistorical()", () => {
  it("returns the envelope with period, coverage and rows", async () => {
    const wire = serve(fixture("crack-historical"));
    const history = await client().spreads.crackHistorical({
      startDate: "2026-09-01",
      endDate: "2026-09-05",
    });

    expect(wire[0].pathname).toBe("/v1/spreads/crack/historical");
    expect(wire[0].params).toEqual({ start_date: "2026-09-01", end_date: "2026-09-05" });
    expect(history.period).toEqual({ start: "2026-09-01", end: "2026-09-05" });
    expect(history.coverage).toEqual({
      from: "2026-09-01",
      to: "2026-09-04",
      observations: 4,
      complete: true,
    });
    expect(history.count).toBe(4);
    expect(history.data[0]).toMatchObject({ date: "2026-09-04", value: 55.97, gasoline: 131.93 });
  });

  it("sends type and crude with the window", async () => {
    const wire = serve(fixture("crack-historical"));
    await client().spreads.crackHistorical({ type: "jet", crude: "WTI_USD", startDate: "2026-09-01" });

    expect(wire[0].params).toEqual({ type: "jet", crude: "WTI_USD", start_date: "2026-09-01" });
  });
});

describe("#112 crackAll()", () => {
  it("returns every crack type under spreads, never undefined", async () => {
    const body = fixture("crack-all");
    const wire = serve(body);
    const all = await client().spreads.crackAll();

    expect(wire[0].pathname).toBe("/v1/spreads/crack/all");
    expect(all.crude_benchmark).toBe("BRENT_CRUDE_USD");
    expect(all.spreads).toHaveLength(body.data.spreads.length);
    expect(all.spreads[0].spread_type).toBe("jet");
    expect(all.spreads[0].data_stale).toBe(true);
  });

  it("sends crude", async () => {
    const wire = serve(fixture("crack-all"));
    await client().spreads.crackAll({ crude: "WTI_USD" });

    expect(wire[0].params).toEqual({ crude: "WTI_USD" });
  });
});

describe("#112 gasoilCrack()", () => {
  it("returns the tonne-denominated leg and the conversion used", async () => {
    const wire = serve(fixture("gasoil-crack"));
    const crack = await client().spreads.gasoilCrack();

    expect(wire[0].pathname).toBe("/v1/spreads/gasoil-crack");
    expect(crack.value).toBe(92.19);
    expect(crack.components.product.unit).toBe("USD/tonne");
    expect(crack.components.product.contract_month).toBe("2026-09");
    expect(crack.conversion.barrels_per_tonne).toBe(7.45);
    expect(crack.data_stale).toBe(true);
  });
});

describe("#112 basis()", () => {
  it("sends the required pair and returns the component map", async () => {
    const wire = serve(fixture("basis"));
    const basis = await client().spreads.basis("BRENT_WTI");

    expect(wire[0].pathname).toBe("/v1/spreads/basis");
    expect(wire[0].params).toEqual({ pair: "BRENT_WTI" });
    expect(basis.pair).toBe("BRENT_WTI");
    expect(basis.value).toBe(4.33);
    expect(basis.components).toEqual({ BRENT_CRUDE_USD: 104.32, WTI_USD: 99.99 });
    expect(basis.percentile_1y).toBe(49);
    expect(basis.signal).toBe("normal");
  });

  it("raises NotFoundError listing the valid pairs for an unknown pair", async () => {
    serve(fixture("basis-unknown-pair-404"), 404);
    const error = await client()
      .spreads.basis("BOGUS")
      .catch((e) => e);

    expect(error).toBeInstanceOf(NotFoundError);
    expect(error.code).toBe("DATA_NOT_AVAILABLE");
    expect(error.message).toContain("Valid: WAHA_HH, BRENT_WTI");
  });

  it("surfaces the route's 400 if it is ever reached", async () => {
    serve(fixture("basis-missing-pair-400"), 400);
    const error = await client()
      .spreads.basis("BRENT_WTI")
      .catch((e) => e);

    expect(error).toBeInstanceOf(OilPriceAPIError);
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe("MISSING_PARAMETER");
  });
});

describe("#112 basisHistorical()", () => {
  it("sends pair and the window, and returns the envelope", async () => {
    const wire = serve(fixture("basis-historical"));
    const history = await client().spreads.basisHistorical("BRENT_WTI", {
      startDate: "2026-09-01",
      endDate: "2026-09-05",
    });

    expect(wire[0].pathname).toBe("/v1/spreads/basis/historical");
    expect(wire[0].params).toEqual({
      pair: "BRENT_WTI",
      start_date: "2026-09-01",
      end_date: "2026-09-05",
    });
    expect(history.pair).toBe("BRENT_WTI");
    expect(history.count).toBe(4);
    expect(history.data[0]).toEqual({
      date: "2026-09-04",
      value: 4.49,
      code_a: 95.50933628000001,
      code_b: 91.01531469,
    });
  });
});

describe("#112 basisAll()", () => {
  it("returns the list under spreads", async () => {
    const body = fixture("basis-all");
    const wire = serve(body);
    const all = await client().spreads.basisAll();

    expect(wire[0].pathname).toBe("/v1/spreads/basis/all");
    expect(all).toHaveLength(body.data.spreads.length);
    expect(all[0].pair).toBe("WAHA_HH");
    expect(all[0].negative_streak_days).toBe(60);
  });
});

describe("#112 curveStructure()", () => {
  it("sends the required commodity", async () => {
    const wire = serve(fixture("curve-structure"));
    const curve = await client().spreads.curveStructure("ICE_BRENT");

    expect(wire[0].pathname).toBe("/v1/spreads/curve-structure");
    expect(wire[0].params).toEqual({ commodity: "ICE_BRENT" });
    expect(curve.structure).toBe("backwardation");
    expect(curve.term_slope_pct).toBe(-38.7);
    expect(curve.spreads.m1_m6).toBe(16.82);
    expect(curve.front_month).toEqual({ price: 104.32, contract: "Nov 2026" });
  });

  it("curveStructureAll() returns the list under commodities", async () => {
    const body = fixture("curve-structure-all");
    const wire = serve(body);
    const all = await client().spreads.curveStructureAll();

    expect(wire[0].pathname).toBe("/v1/spreads/curve-structure/all");
    expect(all).toHaveLength(body.data.commodities.length);
    expect(all[1].commodity).toBe("ICE_WTI");
  });
});

describe("#112 margin()", () => {
  it("returns margin_usd_bbl and the product basket", async () => {
    const wire = serve(fixture("margin"));
    const margin = await client().spreads.margin();

    expect(wire[0].pathname).toBe("/v1/spreads/margin");
    expect(wire[0].params).toEqual({});
    expect(margin.index).toBe("usgc");
    expect(margin.margin_usd_bbl).toBe(67.46);
    expect(margin.crude_input).toEqual({ code: "BRENT_CRUDE_USD", price: 104.32 });
    expect(margin.product_basket.jet_fuel).toEqual({
      yield_pct: 10,
      price: 182.28,
      code: "JET_FUEL_USD",
    });
    expect((margin as unknown as Record<string, unknown>).value).toBeUndefined();
  });

  it("sends index", async () => {
    const wire = serve(fixture("margin"));
    await client().spreads.margin({ index: "nwe" });

    expect(wire[0].params).toEqual({ index: "nwe" });
  });

  it("raises NotFoundError for an unknown index", async () => {
    serve(fixture("margin-unknown-index-404"), 404);
    await expect(client().spreads.margin({ index: "bogus" })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("marginHistorical() returns rows of margin, crude and revenue", async () => {
    const wire = serve(fixture("margin-historical"));
    const history = await client().spreads.marginHistorical({
      index: "usgc",
      startDate: "2026-09-01",
      endDate: "2026-09-05",
    });

    expect(wire[0].pathname).toBe("/v1/spreads/margin/historical");
    expect(wire[0].params).toEqual({
      index: "usgc",
      start_date: "2026-09-01",
      end_date: "2026-09-05",
    });
    expect(history.data[0]).toEqual({
      date: "2026-09-04",
      margin: 63.57,
      crude: 95.50933628000001,
      revenue: 159.08,
    });
  });

  it("marginAll() returns the list under margins", async () => {
    const wire = serve(fixture("margin-all"));
    const all = await client().spreads.marginAll();

    expect(wire[0].pathname).toBe("/v1/spreads/margin/all");
    expect(all.map((m) => m.index)).toEqual(["usgc", "singapore", "nwe"]);
  });
});

describe("#112 physicalPremium()", () => {
  it("returns premium and premium_pct, with a null percentile kept as null", async () => {
    const wire = serve(fixture("physical-premium"));
    const premium = await client().spreads.physicalPremium();

    expect(wire[0].pathname).toBe("/v1/spreads/physical-premium");
    expect(premium.premium).toBe(4.7);
    expect(premium.premium_pct).toBe(4.48);
    expect(premium.percentile_1y).toBeNull();
    expect(premium.components.futures.contract).toBe("Continuous");
    expect(premium.components.spot.contract).toBeUndefined();
  });

  it("sends commodity", async () => {
    const wire = serve(fixture("physical-premium"));
    await client().spreads.physicalPremium({ commodity: "WTI" });

    expect(wire[0].params).toEqual({ commodity: "WTI" });
  });

  it("physicalPremiumHistorical() returns an empty window as an empty list", async () => {
    const wire = serve(fixture("physical-premium-historical-empty"));
    const history = await client().spreads.physicalPremiumHistorical({
      startDate: "2026-08-01",
      endDate: "2026-09-05",
    });

    expect(wire[0].pathname).toBe("/v1/spreads/physical-premium/historical");
    expect(history.count).toBe(0);
    expect(history.data).toEqual([]);
  });

  it("physicalPremiumAll() returns the list under premiums", async () => {
    const wire = serve(fixture("physical-premium-all"));
    const all = await client().spreads.physicalPremiumAll();

    expect(wire[0].pathname).toBe("/v1/spreads/physical-premium/all");
    expect(all[0].commodity).toBe("BRENT");
  });
});

describe("#112 arguments are refused before any request", () => {
  const cases: Array<[string, (c: OilPriceAPI) => Promise<unknown>]> = [
    ["basis() with no pair", (c) => (c.spreads.basis as (p?: string) => Promise<unknown>)()],
    ["basis('')", (c) => c.spreads.basis("")],
    ["basis('   ')", (c) => c.spreads.basis("   ")],
    ["basisHistorical('')", (c) => c.spreads.basisHistorical("")],
    [
      "curveStructure() with no commodity",
      (c) => (c.spreads.curveStructure as (p?: string) => Promise<unknown>)(),
    ],
    ["curveStructure('')", (c) => c.spreads.curveStructure("")],
    ["crack({ type: '' })", (c) => c.spreads.crack({ type: "" })],
    ["crack({ crude: ' ' })", (c) => c.spreads.crack({ crude: " " })],
    ["margin({ index: '' })", (c) => c.spreads.margin({ index: "" })],
    ["physicalPremium({ commodity: '' })", (c) => c.spreads.physicalPremium({ commodity: "" })],
    [
      "an unparseable startDate (the route silently serves its default window)",
      (c) => c.spreads.basisHistorical("BRENT_WTI", { startDate: "banana" }),
    ],
    [
      "an impossible calendar date",
      (c) => c.spreads.marginHistorical({ endDate: "2026-02-30" }),
    ],
    [
      "startDate after endDate (the route answers an empty 200)",
      (c) =>
        c.spreads.crackHistorical({ startDate: "2026-09-05", endDate: "2026-09-01" }),
    ],
  ];

  for (const [name, call] of cases) {
    it(name, async () => {
      const wire = serve(fixture("basis"));
      const error = await call(client()).catch((e) => e);

      expect(error).toBeInstanceOf(ValidationError);
      expect(wire).toHaveLength(0);
    });
  }
});

describe("#112 malformed 200 raises unexpected_response_shape", () => {
  const cases: Array<[string, (c: OilPriceAPI) => Promise<unknown>, unknown]> = [
    ["crack (old declared shape)", (c) => c.spreads.crack(), { type: "crack", value: 1, timestamp: "t" }],
    ["crackHistorical (bare array)", (c) => c.spreads.crackHistorical(), [{ date: "2026-09-01", value: 1 }]],
    ["crackAll (no spreads)", (c) => c.spreads.crackAll(), { crude_benchmark: "BRENT_CRUDE_USD" }],
    ["gasoilCrack", (c) => c.spreads.gasoilCrack(), { value: 92.19 }],
    ["basis", (c) => c.spreads.basis("BRENT_WTI"), { pair: "BRENT_WTI" }],
    ["basisHistorical (row without value)", (c) => c.spreads.basisHistorical("BRENT_WTI"), {
      pair: "BRENT_WTI",
      period: { start: "2026-09-01", end: "2026-09-05" },
      count: 1,
      data: [{ date: "2026-09-04" }],
    }],
    ["basisAll (list under data)", (c) => c.spreads.basisAll(), { data: [] }],
    ["curveStructure", (c) => c.spreads.curveStructure("ICE_BRENT"), { commodity: "ICE_BRENT" }],
    ["curveStructureAll (row without structure)", (c) => c.spreads.curveStructureAll(), {
      commodities: [{ commodity: "ICE_BRENT" }],
    }],
    ["margin (value, not margin_usd_bbl)", (c) => c.spreads.margin(), { index: "usgc", value: 67.46 }],
    ["marginHistorical", (c) => c.spreads.marginHistorical(), { index: "usgc" }],
    ["marginAll", (c) => c.spreads.marginAll(), { spreads: [] }],
    ["physicalPremium", (c) => c.spreads.physicalPremium(), { commodity: "BRENT", value: 4.7 }],
    ["physicalPremiumHistorical", (c) => c.spreads.physicalPremiumHistorical(), { data: [] }],
    ["physicalPremiumAll", (c) => c.spreads.physicalPremiumAll(), { premiums: {} }],
  ];

  for (const [name, call, data] of cases) {
    it(name, async () => {
      serve({ status: "success", data });
      const error = await call(client()).catch((e) => e);

      expect(error).toBeInstanceOf(OilPriceAPIError);
      expect(error.code).toBe("unexpected_response_shape");
      expect(error.rawBody).toEqual({ status: "success", data });
    });
  }

  it("a success body with no data envelope", async () => {
    serve(fixture("basis").data);
    const error = await client()
      .spreads.basis("BRENT_WTI")
      .catch((e) => e);

    expect(error.code).toBe("unexpected_response_shape");
  });
});

describe("#112 transport failures", () => {
  it("surfaces 403 PREMIUM_REQUIRED as an entitlement error, not a quota error", async () => {
    serve(PREMIUM_REQUIRED_403, 403);
    const error = await client()
      .spreads.crack()
      .catch((e) => e);

    expect(isEntitlementError(error)).toBe(true);
    expect(error.statusCode).toBe(403);
    expect(error.code).toBe("PREMIUM_REQUIRED");
    expect(error.message).toContain("Developer and above");
  });

  it("surfaces a 429 as RateLimitError", async () => {
    serve({ error: { code: "RATE_LIMITED", message: "Too many requests", status: 429 } }, 429);
    await expect(client().spreads.basisAll()).rejects.toBeInstanceOf(RateLimitError);
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

    await expect(client(100).spreads.basis("BRENT_WTI")).rejects.toBeInstanceOf(TimeoutError);
  });

  it("maps an aborted fetch to TimeoutError", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(
      Object.assign(new Error("This operation was aborted"), { name: "AbortError" }),
    );
    await expect(client().spreads.curveStructureAll()).rejects.toBeInstanceOf(TimeoutError);
  });
});

describe("#112 methods that could not reach a route are gone", () => {
  it("get(), historical() and all() are removed", () => {
    const spreads = client().spreads as unknown as Record<string, unknown>;
    expect(spreads.get).toBeUndefined();
    expect(spreads.historical).toBeUndefined();
    expect(spreads.all).toBeUndefined();
  });
});
