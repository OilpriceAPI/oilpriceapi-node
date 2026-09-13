/**
 * #108 — `client.rigCounts` through the REAL client and a REAL `fetch` mock.
 *
 * The previous suite spied on the private `request` method and fed it the
 * declared shape, so the transport-to-method path a customer runs was never
 * exercised: `historical()` returned `undefined` against production and
 * `latest().total` was `undefined`, while every test here stayed green.
 *
 * Fixtures in tests/fixtures/rig-counts/ are verbatim from live production
 * (`api.oilpriceapi.com`) on 2026-09-13; historical was requested with
 * `per_page=2`, trends with `period=1m`. No field was edited.
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
  JSON.parse(readFileSync(`tests/fixtures/rig-counts/${name}.json`, "utf8"));

interface Wire {
  pathname: string;
  params: Record<string, string>;
}

function serve(body: unknown, status = 200, headers: Record<string, string> = {}): Wire[] {
  const wire: Wire[] = [];
  vi.spyOn(global, "fetch").mockImplementation((async (input: unknown) => {
    const url = new URL(String(input));
    wire.push({ pathname: url.pathname, params: Object.fromEntries(url.searchParams) });
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json", ...headers },
    });
  }) as unknown as typeof fetch);
  return wire;
}

const client = (timeout?: number) => new OilPriceAPI({ apiKey: KEY, retries: 0, timeout });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("#108 latest()", () => {
  it("returns the observation record, with the value under count", async () => {
    const wire = serve(fixture("latest"));
    const latest = await client().rigCounts.latest();

    expect(wire[0].pathname).toBe("/v1/rig-counts/latest");
    expect(wire[0].params).toEqual({});
    expect(latest.count).toBe(588);
    expect(latest.code).toBe("US_RIG_COUNT");
    expect(latest.region).toBe("United States");
    expect(latest.unit).toBe("rigs");
    expect(latest.source_date).toBe("2026-08-28");
    expect(latest.observed_at).toBe("2026-08-28T12:00:00.000Z");
    expect((latest as unknown as Record<string, unknown>).total).toBeUndefined();
  });

  it("sends by_code for another region", async () => {
    const wire = serve(fixture("latest"));
    await client().rigCounts.latest({ code: "CANADA_RIG_COUNT" });

    expect(wire[0].params).toEqual({ by_code: "CANADA_RIG_COUNT" });
  });

  it("raises NotFoundError when the route has no data for the code", async () => {
    // Verbatim: GET /v1/rig-counts/latest?by_code=BOGUS -> 404, 2026-09-13.
    serve({ status: "fail", data: { error: "No rig count data found" } }, 404);
    await expect(client().rigCounts.latest()).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("#108 current()", () => {
  it("returns every region's observation plus the summary block", async () => {
    const wire = serve(fixture("current"));
    const current = await client().rigCounts.current();

    expect(wire[0].pathname).toBe("/v1/rig-counts/current");
    expect(current.rig_counts.map((r) => r.code)).toEqual([
      "US_RIG_COUNT",
      "CANADA_RIG_COUNT",
      "INTERNATIONAL_RIG_COUNT",
    ]);
    expect(current.rig_counts[2].source_date).toBe("2026-06-01");
    expect(current.summary.total_us_rigs).toBe(588);
    expect(current.summary.total_canada_rigs).toBe(211);
    expect(current.summary.total_international_rigs).toBe(1073);
  });
});

describe("#108 historical()", () => {
  it("returns the page envelope, never undefined", async () => {
    serve(fixture("historical"));
    const page = await client().rigCounts.historical();

    expect(page).toBeDefined();
    expect(page.rig_counts).toHaveLength(2);
    expect(page.rig_counts[1].source_date).toBe("2026-08-21");
    // The page holds 2 of 25 rows; a bare array would hide the other 23.
    expect(page.pagination).toEqual({ page: 1, per_page: 2, total: 25, total_pages: 13 });
    expect(page.period.earliest_available).toBe("2013-01-04");
    expect(page.period.complete).toBe(true);
  });

  it("sends the date range as by_period[from]/[to] with paging and code", async () => {
    const wire = serve(fixture("historical"));
    await client().rigCounts.historical({
      startDate: "2026-01-01",
      endDate: "2026-02-01",
      page: 2,
      perPage: 50,
      code: "CANADA_RIG_COUNT",
    });

    expect(wire[0].pathname).toBe("/v1/rig-counts/historical");
    expect(wire[0].params).toEqual({
      "by_period[from]": "2026-01-01",
      "by_period[to]": "2026-02-01",
      page: "2",
      per_page: "50",
      by_code: "CANADA_RIG_COUNT",
    });
  });

  it("sends a relative period", async () => {
    const wire = serve(fixture("historical"));
    await client().rigCounts.historical({ period: "5y" });

    expect(wire[0].params).toEqual({ period: "5y" });
  });

  it("clamps perPage to the 100 rows the route serves", async () => {
    const wire = serve(fixture("historical"));
    await client().rigCounts.historical({ perPage: 5000 });

    expect(wire[0].params.per_page).toBe("100");
  });

  it("rejects period combined with a date range before sending", async () => {
    const wire = serve(fixture("historical"));
    await expect(
      client().rigCounts.historical({ period: "1y", startDate: "2026-01-01" }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(wire).toHaveLength(0);
  });

  it("surfaces the route's 422 for an unsupported period", async () => {
    serve(
      {
        status: "fail",
        data: {
          error:
            "Unsupported period. Use a relative period up to 15 years (for example 16w, 52w, 5y, or 15y).",
        },
      },
      422,
    );
    const error = await client()
      .rigCounts.historical({ period: "banana" })
      .catch((e) => e);

    expect(error).toBeInstanceOf(OilPriceAPIError);
    expect(error.statusCode).toBe(422);
  });
});

describe("#108 summary()", () => {
  it("returns totals and changes keyed by region name", async () => {
    const wire = serve(fixture("summary"));
    const summary = await client().rigCounts.summary();

    expect(wire[0].pathname).toBe("/v1/rig-counts/summary");
    expect(summary.current_totals["United States"]).toBe(588);
    expect(summary.weekly_changes.Canada).toEqual({ absolute: -5, percentage: -2.31 });
    expect(summary.yearly_changes.International).toEqual({ absolute: -2, percentage: -0.19 });
    expect(summary.source_date).toBe("2026-08-28");
  });
});

describe("#108 trends()", () => {
  it("returns trend_data and the observations it was computed from", async () => {
    const wire = serve(fixture("trends"));
    const trend = await client().rigCounts.trends({ period: "1m" });

    expect(wire[0].pathname).toBe("/v1/rig-counts/trends");
    expect(wire[0].params).toEqual({ period: "1m" });
    expect(trend.region).toBe("US_RIG_COUNT");
    expect(trend.period).toBe("1m");
    expect(trend.rig_counts).toHaveLength(3);
    if (!("trend_direction" in trend.trend_data)) throw new Error("expected trend metrics");
    expect(trend.trend_data.trend_direction).toBe("decreasing");
    expect(trend.trend_data.average_count).toBeCloseTo(589.67, 2);
    expect(trend.trend_data.total_data_points).toBe(3);
  });

  it("sends region", async () => {
    const wire = serve(fixture("trends"));
    await client().rigCounts.trends({ period: "3m", region: "CANADA_RIG_COUNT" });

    expect(wire[0].params).toEqual({ period: "3m", region: "CANADA_RIG_COUNT" });
  });

  it("still accepts the period as a bare string", async () => {
    const wire = serve(fixture("trends"));
    await client().rigCounts.trends("1m");

    expect(wire[0].params).toEqual({ period: "1m" });
  });

  it("refuses a period the route would silently replace with six months", async () => {
    // Measured 2026-09-13: period=week and period=banana both return 200 with
    // 24 points spanning six months, echoing the requested period back.
    const wire = serve(fixture("trends"));
    await expect(client().rigCounts.trends("week" as unknown as "1m")).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(wire).toHaveLength(0);
  });
});

describe("#108 malformed 200 raises unexpected_response_shape", () => {
  const cases: Array<[string, (c: OilPriceAPI) => Promise<unknown>, unknown]> = [
    ["latest", (c) => c.rigCounts.latest(), { total: 588, timestamp: "2026-08-28" }],
    ["current", (c) => c.rigCounts.current(), { total: 588 }],
    ["historical", (c) => c.rigCounts.historical(), { rig_counts: [] }],
    ["historical (bare array)", (c) => c.rigCounts.historical(), []],
    ["summary", (c) => c.rigCounts.summary(), { current: 588 }],
    ["trends", (c) => c.rigCounts.trends(), { average: 588 }],
  ];

  for (const [name, call, data] of cases) {
    it(`${name}()`, async () => {
      serve({ status: "success", data });
      const error = await call(client()).catch((e) => e);

      expect(error).toBeInstanceOf(OilPriceAPIError);
      expect(error.code).toBe("unexpected_response_shape");
    });
  }
});

describe("#108 transport failures", () => {
  it("surfaces the entitlement 403 with its message", async () => {
    // Body shape from RigCountsController#ensure_reservoir_mastery_access.
    serve(
      {
        success: false,
        error: "Rig count data requires the Scale plan",
        upgrade_url: "https://www.oilpriceapi.com/pricing",
        required_tier: "scale",
      },
      403,
    );
    const error = await client()
      .rigCounts.summary()
      .catch((e) => e);

    expect(isEntitlementError(error)).toBe(true);
    expect(error.message).toBe("Rig count data requires the Scale plan");
  });

  it("surfaces a 429 as RateLimitError", async () => {
    serve({ error: { code: "RATE_LIMITED", message: "Too many requests" } }, 429, {
      "retry-after": "1",
    });
    await expect(client().rigCounts.latest()).rejects.toBeInstanceOf(RateLimitError);
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

    await expect(client(100).rigCounts.historical()).rejects.toBeInstanceOf(TimeoutError);
  });

  it("maps an aborted fetch to TimeoutError", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(
      Object.assign(new Error("This operation was aborted"), { name: "AbortError" }),
    );
    await expect(client().rigCounts.current()).rejects.toBeInstanceOf(TimeoutError);
  });
});

describe("#108 documented examples read fields the API returns", () => {
  it("src/resources/rig-counts.ts no longer reads fields the wire lacks", () => {
    const source = readFileSync("src/resources/rig-counts.ts", "utf8");
    for (const stale of [
      /latest\.total\b/,
      /latest\.oil\b/,
      /current\.total\b/,
      /summary\.week_change\b/,
      /summary\.breakdown\b/,
      /monthlyTrend\.average\b/,
      /point\.total\b/,
    ]) {
      expect(source).not.toMatch(stale);
    }
  });
});
