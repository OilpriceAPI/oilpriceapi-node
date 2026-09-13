/**
 * #104 — EI rig-count payloads through the REAL client.
 *
 * Fixtures are verbatim from live production on 2026-09-13, trimmed only by
 * dropping basins and top_states entries beyond the first two. The type-level
 * half of this contract lives in tests/rig-count-types.test-d.ts; this file
 * proves what a caller actually receives and guards the documented examples,
 * which printed `Total rigs: undefined` against production.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { OilPriceAPI } from "../../src/index.js";

const KEY = "fixture_key_not_a_real_credential";

function serve(body: unknown): string[] {
  const urls: string[] = [];
  vi.spyOn(global, "fetch").mockImplementation((async (input: unknown) => {
    urls.push(String(input));
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch);
  return urls;
}

const client = () => new OilPriceAPI({ apiKey: KEY, retries: 0 });

afterEach(() => {
  vi.restoreAllMocks();
});

/** GET /v1/ei/rig_counts/latest, 2026-09-13. */
const LATEST = {
  data: {
    id: "ef2d0848-3822-4f0a-9d45-01f899c9039d",
    report_date: "2026-08-28",
    source: "baker_hughes",
    last_updated: "2026-08-29T14:04:33Z",
    us_total: { total_rigs: 588, oil_rigs: 447, gas_rigs: 132, misc_rigs: 9, week_over_week: 0 },
    basins: { utica: { count: 10, wow: -1 }, barnett: { count: 1, wow: 0 } },
    top_states: [
      { state: "texas", count: 282, wow: 1 },
      { state: "new_mexico", count: 95, wow: -1 },
    ],
    drilling_type: { vertical: 10, horizontal: 535, directional: 43 },
  },
  meta: {
    api_version: "v1",
    tier_required: "reservoir_mastery",
    cache_ttl: 3600,
    next_update: "2026-09-18T18:00:00Z",
  },
};

/** GET /v1/ei/rig_counts, 2026-09-13 (first row). */
const LIST = {
  data: [
    {
      id: "ef2d0848-3822-4f0a-9d45-01f899c9039d",
      report_date: "2026-08-28",
      summary: "US Rig Count: 588 (0 WoW)",
      status: "published",
    },
  ],
  meta: { page: 1, per_page: 10 },
};

describe("#104 ei.rigCounts payloads through the real client", () => {
  it("latest() carries the US total under us_total, not at the top level", async () => {
    serve(LATEST);
    const latest = await client().ei.rigCounts.latest();

    expect(latest.us_total.total_rigs).toBe(588);
    expect(latest.basins.utica.count).toBe(10);
    expect(latest.top_states[0].state).toBe("texas");
    expect((latest as unknown as Record<string, unknown>).total_rigs).toBeUndefined();
  });

  it("get(id) returns the same report shape as latest()", async () => {
    const urls = serve(LATEST);
    const report = await client().ei.rigCounts.get("ef2d0848-3822-4f0a-9d45-01f899c9039d");

    expect(new URL(urls[0]).pathname).toBe("/v1/ei/rig_counts/ef2d0848-3822-4f0a-9d45-01f899c9039d");
    expect(report.us_total.total_rigs).toBe(588);
  });

  it("list() returns summary rows", async () => {
    serve(LIST);
    const rows = await client().ei.rigCounts.list();

    expect(rows).toHaveLength(1);
    expect(rows[0].summary).toBe("US Rig Count: 588 (0 WoW)");
    expect(rows[0].status).toBe("published");
  });
});

describe("#104 documented examples read fields the API returns", () => {
  // Pre-fix both JSDoc examples were
  //   const latest = await client.ei.rigCounts.latest();
  //   console.log(`Total rigs: ${latest.total_rigs}`);
  // which prints "Total rigs: undefined" against production.
  const stale = /rigCounts\.latest\(\);[\s*]*console\.log\(`Total rigs: \$\{\w+\.total_rigs\}`\)/;

  for (const file of ["src/resources/ei/rig-counts.ts", "src/resources/ei/index.ts"]) {
    it(`${file} does not read a top-level total_rigs from latest()`, () => {
      expect(readFileSync(file, "utf8")).not.toMatch(stale);
    });
  }
});
