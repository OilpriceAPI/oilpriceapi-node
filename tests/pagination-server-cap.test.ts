/**
 * #90 — the generator must not treat the server's page cap as end-of-data.
 *
 * These tests drive the REAL client against a REAL `fetch` that behaves the
 * way production does: it caps a page at 500 rows no matter what `per_page`
 * asks for. Verified against live production 2026-09-13 — per_page=1000,
 * per_page=600 and per_page=500 all return exactly 500 rows.
 *
 * The old last-page test compared against the REQUESTED page size, so the
 * documented maximum (@max 1000) was the value that made page one look short
 * and ended the loop after 500 of 5,500 rows.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { OilPriceAPI, MAX_PER_PAGE } from "../src/index.js";

const KEY = "fixture_key_not_a_real_credential";
/** What production actually enforces, whatever per_page says. */
const SERVER_CAP = 500;

afterEach(() => {
  vi.restoreAllMocks();
});

interface Sent {
  perPage: number | null;
  page: number | null;
}

/**
 * A fetch stub with `total` rows behind it that caps every page at
 * `SERVER_CAP`, exactly like production.
 */
function cappingFetch(total: number, cap = SERVER_CAP): Sent[] {
  const sent: Sent[] = [];
  vi.spyOn(global, "fetch").mockImplementation((async (input: unknown) => {
    const url = new URL(String(input));
    const perPage = Number(url.searchParams.get("per_page") ?? 100);
    const page = Number(url.searchParams.get("page") ?? 1);
    sent.push({ perPage, page });

    const size = Math.min(perPage, cap);
    const start = (page - 1) * size;
    const count = Math.max(0, Math.min(size, total - start));
    const prices = Array.from({ length: count }, (_, i) => ({
      type: "WTI_USD",
      code: "WTI_USD",
      price: 70 + start + i,
      currency: "USD",
      unit: "per barrel",
      created_at: new Date(Date.UTC(2024, 0, 1) + (start + i) * 3600_000).toISOString(),
      formatted: "$70.00",
      commodity: "WTI Crude Oil",
    }));

    return new Response(JSON.stringify({ status: "success", data: { prices } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch);
  return sent;
}

async function collect(gen: AsyncGenerator<unknown[]>): Promise<number> {
  let rows = 0;
  for await (const page of gen) rows += page.length;
  return rows;
}

describe("#90 paginateHistoricalPrices vs the server page cap", () => {
  it("returns every row when perPage exceeds the server cap", async () => {
    cappingFetch(5_500);
    const client = new OilPriceAPI({ apiKey: KEY, retries: 0 });

    const rows = await collect(
      client.paginateHistoricalPrices({ code: "WTI_USD", perPage: 1000 }),
    );

    expect(rows).toBe(5_500);
  });

  it("returns every row at the previously documented maximum of 1000", async () => {
    cappingFetch(1_234);
    const client = new OilPriceAPI({ apiKey: KEY, retries: 0 });

    const rows = await collect(
      client.paginateHistoricalPrices({ code: "WTI_USD", perPage: 1000 }),
    );

    expect(rows).toBe(1_234);
  });

  it("never asks the server for a page larger than it will serve", async () => {
    const sent = cappingFetch(1_200);
    const client = new OilPriceAPI({ apiKey: KEY, retries: 0 });

    await collect(client.paginateHistoricalPrices({ code: "WTI_USD", perPage: 5000 }));

    expect(sent.length).toBeGreaterThan(0);
    for (const req of sent) {
      expect(req.perPage).toBeLessThanOrEqual(SERVER_CAP);
    }
  });

  it("still stops on a short page for a small result set", async () => {
    const sent = cappingFetch(37);
    const client = new OilPriceAPI({ apiKey: KEY, retries: 0 });

    const rows = await collect(
      client.paginateHistoricalPrices({ code: "WTI_USD", perPage: 100 }),
    );

    expect(rows).toBe(37);
    expect(sent).toHaveLength(1);
  });
});

describe("#90 MAX_PER_PAGE matches what production enforces", () => {
  it("is the cap measured against live production on 2026-09-13", () => {
    // per_page=500, 600 and 1000 each returned exactly 500 rows for
    // /v1/prices/past_year?by_code=WTI_USD&period=past_month&interval=hourly.
    // If the API's cap ever moves, this constant has to move with it or the
    // generator silently truncates again.
    expect(MAX_PER_PAGE).toBe(SERVER_CAP);
  });
});
