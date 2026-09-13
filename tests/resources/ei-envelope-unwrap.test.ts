/**
 * #83 — Energy Intelligence named-collection methods must not return
 * `undefined` after the core client has already stripped the outer `data`
 * envelope.
 *
 * These tests drive the REAL client through a REAL fake `fetch` Response
 * carrying the ACTUAL Rails envelope (captured live from
 * api.oilpriceapi.com on 2026-09-13), rather than spying on the private
 * `request` method. Spying on `request` is exactly what let this defect
 * ship: every existing ei.* test fed the resource a bare array, so the
 * transport-to-public-method path — the only path a customer runs — was
 * never exercised.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { OilPriceAPI } from "../../src/index.js";
import { OilPriceAPIError } from "../../src/errors.js";

const KEY = "fixture_key_not_a_real_credential";

/** Serve one fixed JSON body for whatever the client asks for. */
function serve(body: unknown, status = 200): void {
  vi.spyOn(global, "fetch").mockImplementation((async () => {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch);
}

function client(): OilPriceAPI {
  return new OilPriceAPI({ apiKey: KEY, retries: 0 });
}

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// The reported case: rig counts
// ---------------------------------------------------------------------------
describe("#83 ei.rigCounts — real Rails envelope through the real client", () => {
  it("byBasin() returns the basins collection, not undefined", async () => {
    serve({
      data: {
        report_date: "2026-08-28",
        basins: [
          {
            region: "permian",
            region_type: "basin",
            count: 267,
            week_over_week: 0,
            change_direction: "flat",
          },
          {
            region: "haynesville",
            region_type: "basin",
            count: 57,
            week_over_week: 0,
            change_direction: "flat",
          },
        ],
      },
      meta: { api_version: "v1" },
    });

    const basins = await client().ei.rigCounts.byBasin();

    expect(Array.isArray(basins)).toBe(true);
    expect(basins).toHaveLength(2);
    expect(basins[0].region).toBe("permian");
    expect(basins[0].count).toBe(267);
  });

  it("byState() returns the states collection, not undefined", async () => {
    serve({
      data: {
        report_date: "2026-08-28",
        states: [
          {
            region: "texas",
            region_type: "state",
            count: 282,
            week_over_week: 1,
            change_direction: "up",
          },
        ],
      },
    });

    const states = await client().ei.rigCounts.byState();

    expect(Array.isArray(states)).toBe(true);
    expect(states[0].region).toBe("texas");
    expect(states[0].count).toBe(282);
  });

  it("historical() returns the records collection, not undefined", async () => {
    serve({
      data: {
        region: "us",
        start_date: "2025-09-13",
        end_date: "2026-09-13",
        records: [
          { date: "2026-08-28", count: 588, week_over_week: 0 },
          { date: "2026-08-21", count: 588, week_over_week: -5 },
        ],
      },
    });

    const records = await client().ei.rigCounts.historical();

    expect(Array.isArray(records)).toBe(true);
    expect(records).toHaveLength(2);
    expect(records[0].count).toBe(588);
  });

  it("list() still passes a plain array collection straight through", async () => {
    serve({
      data: [
        {
          id: "ef2d",
          report_date: "2026-08-28",
          summary: "US Rig Count: 588",
          status: "published",
        },
      ],
      meta: { page: 1 },
    });

    const rows = await client().ei.rigCounts.list();

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("ef2d");
  });
});

// ---------------------------------------------------------------------------
// The same defect across the other EI named-collection methods
// ---------------------------------------------------------------------------
describe("#83 sibling EI named-collection methods", () => {
  const cases: Array<{
    name: string;
    body: unknown;
    call: (c: OilPriceAPI) => Promise<unknown[]>;
    length: number;
  }> = [
    {
      name: "oilInventories.byProduct()",
      body: {
        data: {
          week_ending: "2026-09-04",
          products: [{ product: "crude" }, { product: "gasoline" }],
        },
      },
      call: (c) => c.ei.oilInventories.byProduct(),
      length: 2,
    },
    {
      name: "oilInventories.historical()",
      body: { data: { product_type: "crude", location: "us", records: [{ date: "2026-09-04" }] } },
      call: (c) => c.ei.oilInventories.historical(),
      length: 1,
    },
    {
      name: "opecProduction.byCountry()",
      body: {
        data: {
          report_month: "2026-08-01",
          countries: [{ country: "saudi_arabia" }],
          opec_total: 27.1,
        },
      },
      call: (c) => c.ei.opecProduction.byCountry(),
      length: 1,
    },
    {
      name: "opecProduction.historical()",
      body: {
        data: {
          country: "saudi_arabia",
          country_name: "Saudi Arabia",
          records: [{ month: "2026-08-01" }],
        },
      },
      call: (c) => c.ei.opecProduction.historical(),
      length: 1,
    },
    {
      name: "opecProduction.topProducers()",
      body: {
        data: {
          report_month: "2026-08-01",
          producers: [{ country: "saudi_arabia" }],
          opec_total: 27.1,
        },
      },
      call: (c) => c.ei.opecProduction.topProducers(),
      length: 1,
    },
    {
      name: "drillingProductivity.ducWells()",
      body: {
        data: {
          report_month: "2026-08-01",
          total_duc: 5000,
          by_basin: [{ basin: "permian", duc_count: 839 }],
        },
      },
      call: (c) => c.ei.drillingProductivity.ducWells(),
      length: 1,
    },
    {
      name: "drillingProductivity.historical()",
      body: {
        data: {
          basin: "permian",
          basin_name: "Permian",
          records: [{ report_month: "2026-08-01" }],
        },
      },
      call: (c) => c.ei.drillingProductivity.historical(),
      length: 1,
    },
    {
      name: "drillingProductivity.trends()",
      body: {
        data: { report_month: "2026-08-01", analysis_months: 5, trends: [{ basin: "permian" }] },
      },
      call: (c) => c.ei.drillingProductivity.trends(),
      length: 1,
    },
    {
      name: "forecasts.historical()",
      body: { data: { series_code: "WTIPUUS", actuals: [{ month: "2026-08-01", value: 64.2 }] } },
      call: (c) => c.ei.forecasts.historical(),
      length: 1,
    },
    {
      name: "forecasts.compare()",
      body: {
        data: {
          series_code: "WTIPUUS",
          month1: "2026-07",
          month2: "2026-08",
          comparison: [{ month: "2026-09" }],
        },
      },
      call: (c) => c.ei.forecasts.compare(),
      length: 1,
    },
    {
      name: "wellPermits.byState()",
      body: {
        status: "success",
        data: { well_permits: [{ id: "1" }], state: "TX", meta: { total_count: 1 } },
      },
      call: (c) => c.ei.wellPermits.byState("TX").then((p) => p.well_permits),
      length: 1,
    },
    {
      name: "wellPermits.byOperator()",
      body: {
        status: "success",
        data: { well_permits: [{ id: "1" }], operator_query: "Chevron", meta: { total_count: 1 } },
      },
      call: (c) => c.ei.wellPermits.byOperator("Chevron").then((p) => p.well_permits),
      length: 1,
    },
    {
      name: "wellPermits.byFormation()",
      body: {
        status: "success",
        data: { well_permits: [{ id: "1" }], formation_query: "wolfcamp", meta: { total_count: 1 } },
      },
      call: (c) => c.ei.wellPermits.byFormation("wolfcamp").then((p) => p.well_permits),
      length: 1,
    },
    {
      name: "wellPermits.list()",
      body: { status: "success", data: { well_permits: [{ id: "1" }], meta: { total_count: 1 } } },
      call: (c) => c.ei.wellPermits.list(),
      length: 1,
    },
    {
      name: "fracFocus.list()",
      body: {
        status: "success",
        data: { frac_focus_disclosures: [{ id: "1" }], meta: { total_count: 1 } },
      },
      call: (c) => c.ei.fracFocus.list(),
      length: 1,
    },
    {
      name: "fracFocus.byState()",
      body: {
        status: "success",
        data: { frac_focus_disclosures: [{ id: "1" }], state: "TX", meta: { total_count: 1 } },
      },
      call: (c) => c.ei.fracFocus.byState("TX").then((p) => p.frac_focus_disclosures),
      length: 1,
    },
    {
      name: "fracFocus.byOperator()",
      body: {
        status: "success",
        data: {
          frac_focus_disclosures: [{ id: "1" }],
          operator_query: "Chevron",
          meta: { total_count: 1 },
        },
      },
      call: (c) => c.ei.fracFocus.byOperator("Chevron").then((p) => p.frac_focus_disclosures),
      length: 1,
    },
  ];

  for (const c of cases) {
    it(`${c.name} returns its collection, not undefined`, async () => {
      serve(c.body);
      const result = await c.call(client());
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(c.length);
    });
  }
});

// ---------------------------------------------------------------------------
// Negative paths — never undefined, never a fabricated empty success
// ---------------------------------------------------------------------------
describe("#83 negative paths", () => {
  it("an empty but well-formed collection is an empty array, not an error", async () => {
    serve({ data: { report_date: "2026-08-28", basins: [] } });
    await expect(client().ei.rigCounts.byBasin()).resolves.toEqual([]);
  });

  it("an envelope missing the collection key throws rather than returning undefined", async () => {
    serve({ data: { report_date: "2026-08-28" } });
    await expect(client().ei.rigCounts.byBasin()).rejects.toBeInstanceOf(OilPriceAPIError);
  });

  it("a completely empty envelope throws rather than returning undefined", async () => {
    serve({});
    await expect(client().ei.rigCounts.byState()).rejects.toBeInstanceOf(OilPriceAPIError);
  });

  it("a null data envelope throws rather than returning undefined", async () => {
    serve({ data: null });
    await expect(client().ei.rigCounts.historical()).rejects.toBeInstanceOf(OilPriceAPIError);
  });

  it("a malformed envelope (collection key holds a scalar) throws", async () => {
    serve({ data: { report_date: "2026-08-28", basins: "all" } });
    await expect(client().ei.rigCounts.byBasin()).rejects.toBeInstanceOf(OilPriceAPIError);
  });

  it("the thrown error names the endpoint and the expected collection", async () => {
    serve({ data: { report_date: "2026-08-28" } });
    await expect(client().ei.rigCounts.byBasin()).rejects.toThrow(/\/v1\/ei\/rig_counts\/by_basin/);
  });

  it("a 401 still surfaces as an authentication error, not a shape error", async () => {
    serve({ error: "Invalid API key" }, 401);
    await expect(client().ei.rigCounts.byBasin()).rejects.toThrow(/API key|authentication/i);
  });

  it("a 429 still surfaces as a rate-limit error, not a shape error", async () => {
    serve({ error: "Rate limit exceeded" }, 429);
    await expect(client().ei.rigCounts.byBasin()).rejects.toThrow(/[Rr]ate limit/);
  });
});
