/**
 * #79 — LTL and parcel carrier fuel surcharges through the REAL client and a
 * REAL `fetch` mock.
 *
 * Fixtures in tests/fixtures/fuel-surcharge/ are verbatim from
 * `api.oilpriceapi.com` on 2026-09-13 (history requested with `per_page=2`).
 * Routes and parameters confirmed on oilpriceapi-api `origin/main`
 * (`config/routes.rb`, `app/controllers/v1/fuel_surcharge_controller.rb`).
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
  JSON.parse(readFileSync(`tests/fixtures/fuel-surcharge/${name}.json`, "utf8"));

interface Wire {
  method: string;
  pathname: string;
  params: Record<string, string>;
}

function serve(body: unknown, status = 200): Wire[] {
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
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch);
  return wire;
}

const client = (timeout?: number) => new OilPriceAPI({ apiKey: KEY, retries: 0, timeout });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("#79 ltl.list()", () => {
  it("returns the latest rate for every LTL carrier with data", async () => {
    const body = fixture("ltl-list");
    const wire = serve(body);
    const rates = await client().fuelSurcharge.ltl.list();

    expect(wire[0].method).toBe("GET");
    expect(wire[0].pathname).toBe("/v1/fuel-surcharge");
    expect(rates).toHaveLength(body.data.carriers.length);
    expect(rates[0]).toEqual(body.data.carriers[0]);
    expect(rates.every((r) => r.mode === "ltl")).toBe(true);
  });
});

describe("#79 ltl.latest()", () => {
  it("returns one carrier's rate with its effective date and provenance", async () => {
    const wire = serve(fixture("ltl-latest-odfl"));
    const rate = await client().fuelSurcharge.ltl.latest("odfl");

    expect(wire[0].pathname).toBe("/v1/fuel-surcharge/odfl/latest");
    expect(rate.carrier).toBe("odfl");
    expect(rate.carrier_name).toBe("Old Dominion Freight Line");
    expect(rate.surcharge_percent).toBe(46.32);
    expect(rate.effective_date).toBe("2026-09-09");
    expect(rate.doe_diesel_price).toBe(5.599);
    expect(rate.diesel_band).toBeNull();
    expect(rate.source).toBe("https://www.odfl.com/us/en/resources/fuel-surcharge.html");
    expect(rate.retrieved_at).toBe("2026-09-08T16:10:10Z");
  });

  it("raises NotFoundError listing the covered carriers for an unknown carrier", async () => {
    const body = fixture("ltl-unknown-404");
    serve(body, 404);
    const error = await client()
      .fuelSurcharge.ltl.latest("nope")
      .catch((e) => e);

    expect(error).toBeInstanceOf(NotFoundError);
    expect(error.rawBody.data.covered_carriers).toContain("southeastern-freight");
  });

  it("raises NotFoundError for a reserved carrier that is not yet covered", async () => {
    serve(fixture("ltl-reserved-404"), 404);
    await expect(client().fuelSurcharge.ltl.latest("fedex-freight")).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  for (const bad of ["", "  ", undefined]) {
    it(`rejects carrier ${JSON.stringify(bad)} before sending`, async () => {
      const wire = serve(fixture("ltl-latest-odfl"));
      await expect(
        client().fuelSurcharge.ltl.latest(bad as unknown as string),
      ).rejects.toBeInstanceOf(ValidationError);
      expect(wire).toHaveLength(0);
    });
  }

  it("keeps a traversing carrier inside its path segment", async () => {
    const wire = serve(fixture("ltl-latest-odfl"));
    await client().fuelSurcharge.ltl.latest("../parcel/ups");

    expect(wire[0].pathname).not.toBe("/v1/fuel-surcharge/parcel/ups/latest");
    expect(wire[0].pathname.startsWith("/v1/fuel-surcharge/")).toBe(true);
    expect(wire[0].pathname.endsWith("/latest")).toBe(true);
  });
});

describe("#79 ltl.history()", () => {
  it("returns the page with its meta so the total is visible", async () => {
    const wire = serve(fixture("ltl-history-odfl"));
    const page = await client().fuelSurcharge.ltl.history("odfl", { perPage: 2 });

    expect(wire[0].pathname).toBe("/v1/fuel-surcharge/odfl/history");
    expect(wire[0].params).toEqual({ per_page: "2" });
    expect(page.history).toHaveLength(2);
    expect(page.history[1].effective_date).toBe("2026-08-26");
    expect(page.meta).toEqual({ page: 1, per_page: 2, total_count: 6, total_pages: 3 });
  });

  it("sends page and clamps perPage to 100", async () => {
    const wire = serve(fixture("ltl-history-odfl"));
    await client().fuelSurcharge.ltl.history("odfl", { page: 3, perPage: 500 });

    expect(wire[0].params).toEqual({ page: "3", per_page: "100" });
  });

  it("raises NotFoundError when a covered carrier has no data yet", async () => {
    serve(
      {
        status: "fail",
        data: {
          error:
            "No fuel-surcharge data retrieved yet for carrier 'averitt'. Call GET /v1/fuel-surcharge to see which carriers currently have data.",
          covered_carriers: [
            "odfl",
            "saia",
            "estes",
            "xpo",
            "abf",
            "tforce",
            "averitt",
            "southeastern-freight",
          ],
        },
      },
      404,
    );
    await expect(client().fuelSurcharge.ltl.history("averitt")).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe("#79 parcel.list()", () => {
  it("returns every parcel carrier with its service levels", async () => {
    const body = fixture("parcel-list");
    const wire = serve(body);
    const carriers = await client().fuelSurcharge.parcel.list();

    expect(wire[0].pathname).toBe("/v1/fuel-surcharge/parcel");
    expect(carriers.map((c) => c.carrier)).toEqual(body.data.carriers.map((c: Json) => c.carrier));
    expect(carriers[0].mode).toBe("parcel");
    expect(carriers[0].service_levels[1].service_level).toBe("ground");
    expect(carriers[0].service_levels[1].surcharge_percent).toBe(27.5);
  });
});

describe("#79 parcel.latest()", () => {
  it("without a service level returns the carrier with every service level", async () => {
    const wire = serve(fixture("parcel-latest-ups"));
    const ups = await client().fuelSurcharge.parcel.latest("ups");

    expect(wire[0].pathname).toBe("/v1/fuel-surcharge/parcel/ups/latest");
    expect(wire[0].params).toEqual({});
    expect(ups.carrier_name).toBe("UPS");
    expect(ups.service_levels.map((s) => s.service_level)).toContain("ground");
  });

  it("with a service level returns that one rate", async () => {
    const wire = serve(fixture("parcel-latest-ups-ground"));
    const ground = await client().fuelSurcharge.parcel.latest("ups", { serviceLevel: "ground" });

    expect(wire[0].params).toEqual({ service_level: "ground" });
    expect(ground.service_level).toBe("ground");
    expect(ground.surcharge_percent).toBe(27.5);
    expect(ground.effective_date).toBe("2026-09-07");
    expect(ground.doe_diesel_price).toBeNull();
  });

  it("raises NotFoundError for an unknown parcel carrier", async () => {
    serve(fixture("parcel-unknown-404"), 404);
    await expect(client().fuelSurcharge.parcel.latest("nope")).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("raises NotFoundError for a service level with no data", async () => {
    serve(fixture("parcel-no-data-404"), 404);
    await expect(
      client().fuelSurcharge.parcel.latest("ups", { serviceLevel: "teleport" }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("#79 parcel.history()", () => {
  it("sends service_level and returns the page", async () => {
    const wire = serve(fixture("parcel-history-ups-ground"));
    const page = await client().fuelSurcharge.parcel.history("ups", {
      serviceLevel: "ground",
      perPage: 2,
    });

    expect(wire[0].pathname).toBe("/v1/fuel-surcharge/parcel/ups/history");
    expect(wire[0].params).toEqual({ service_level: "ground", per_page: "2" });
    expect(page.history[0].service_level).toBe("ground");
    expect(page.meta.total_count).toBe(20);
  });

  it("requires a service level before sending (the route answers 400 without one)", async () => {
    const wire = serve(fixture("parcel-history-400"), 400);
    await expect(
      client().fuelSurcharge.parcel.history("ups", {} as unknown as { serviceLevel: string }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(wire).toHaveLength(0);
  });

  it("surfaces the route's own 400 with the available service levels", async () => {
    const body = fixture("parcel-history-400");
    serve(body, 400);
    const error = await client()
      .fuelSurcharge.parcel.history("ups", { serviceLevel: "ground" })
      .catch((e) => e);

    expect(error).toBeInstanceOf(OilPriceAPIError);
    expect(error.statusCode).toBe(400);
    expect(error.rawBody.data.available_service_levels).toContain("ground");
  });
});

describe("#79 malformed 200 raises unexpected_response_shape", () => {
  const cases: Array<[string, (c: OilPriceAPI) => Promise<unknown>, unknown]> = [
    ["ltl.list", (c) => c.fuelSurcharge.ltl.list(), { rates: [] }],
    [
      "ltl.list (row without surcharge_percent)",
      (c) => c.fuelSurcharge.ltl.list(),
      { carriers: [{ carrier: "odfl" }] },
    ],
    ["ltl.latest", (c) => c.fuelSurcharge.ltl.latest("odfl"), { carrier: "odfl", percent: 46.32 }],
    ["ltl.history (no meta)", (c) => c.fuelSurcharge.ltl.history("odfl"), { history: [] }],
    ["ltl.history (bare array)", (c) => c.fuelSurcharge.ltl.history("odfl"), []],
    ["parcel.list", (c) => c.fuelSurcharge.parcel.list(), { carriers: [{ carrier: "ups" }] }],
    ["parcel.latest", (c) => c.fuelSurcharge.parcel.latest("ups"), { carrier: "ups" }],
    [
      "parcel.latest with serviceLevel",
      (c) => c.fuelSurcharge.parcel.latest("ups", { serviceLevel: "ground" }),
      { carrier: "ups", service_levels: [] },
    ],
    [
      "parcel.history",
      (c) => c.fuelSurcharge.parcel.history("ups", { serviceLevel: "ground" }),
      { meta: { total_count: 0 } },
    ],
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

describe("#79 transport failures", () => {
  it("surfaces a 403 as an entitlement error", async () => {
    serve({ error: { code: "FORBIDDEN", message: "Access denied", status: 403 } }, 403);
    await expect(
      client()
        .fuelSurcharge.ltl.list()
        .catch((e) => e),
    ).resolves.toSatisfy(isEntitlementError);
  });

  it("surfaces a 429 as RateLimitError", async () => {
    serve({ error: { code: "RATE_LIMITED", message: "Too many requests", status: 429 } }, 429);
    await expect(client().fuelSurcharge.parcel.list()).rejects.toBeInstanceOf(RateLimitError);
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

    await expect(client(100).fuelSurcharge.ltl.history("odfl")).rejects.toBeInstanceOf(
      TimeoutError,
    );
  });

  it("maps an aborted fetch to TimeoutError", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(
      Object.assign(new Error("This operation was aborted"), { name: "AbortError" }),
    );
    await expect(client().fuelSurcharge.parcel.latest("ups")).rejects.toBeInstanceOf(TimeoutError);
  });
});
