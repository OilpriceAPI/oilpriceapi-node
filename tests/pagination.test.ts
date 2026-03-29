import { describe, it, expect, beforeEach, vi } from "vitest";
import { OilPriceAPI } from "../src/client.js";
import type { Price } from "../src/types.js";

function makePrices(count: number, offset = 0): Price[] {
  return Array.from({ length: count }, (_, i) => ({
    type: "WTI_USD",
    price: 70 + i + offset,
    currency: "USD",
    unit: "per barrel",
    created_at: new Date(2024, 0, i + 1 + offset).toISOString(),
    formatted: `$${70 + i + offset}.00`,
    code: "WTI_USD",
    commodity: "WTI Crude Oil",
  }));
}

describe("paginateHistoricalPrices()", () => {
  let client: OilPriceAPI;

  beforeEach(() => {
    client = new OilPriceAPI({ apiKey: "test_key_123" });
    vi.clearAllMocks();
  });

  it("yields all pages when data spans multiple pages", async () => {
    const spy = vi
      .spyOn(client, "getHistoricalPrices")
      .mockResolvedValueOnce(makePrices(2)) // page 1 — full (perPage=2)
      .mockResolvedValueOnce(makePrices(2, 2)) // page 2 — full
      .mockResolvedValueOnce(makePrices(1, 4)); // page 3 — partial → stop

    const pages: Price[][] = [];
    for await (const page of client.paginateHistoricalPrices({ perPage: 2 })) {
      pages.push(page);
    }

    expect(pages).toHaveLength(3);
    expect(pages[0]).toHaveLength(2);
    expect(pages[1]).toHaveLength(2);
    expect(pages[2]).toHaveLength(1);
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it("stops when a page returns fewer items than perPage", async () => {
    vi.spyOn(client, "getHistoricalPrices")
      .mockResolvedValueOnce(makePrices(5)) // full page
      .mockResolvedValueOnce(makePrices(3)); // partial → stop

    const pages: Price[][] = [];
    for await (const page of client.paginateHistoricalPrices({ perPage: 5 })) {
      pages.push(page);
    }

    expect(pages).toHaveLength(2);
  });

  it("stops when a page returns 0 items", async () => {
    vi.spyOn(client, "getHistoricalPrices")
      .mockResolvedValueOnce(makePrices(5))
      .mockResolvedValueOnce([]);

    const pages: Price[][] = [];
    for await (const page of client.paginateHistoricalPrices({ perPage: 5 })) {
      pages.push(page);
    }

    // The empty page stops iteration before yielding — only 1 page yielded
    expect(pages).toHaveLength(1);
  });

  it("uses default perPage of 100 when not specified", async () => {
    const spy = vi.spyOn(client, "getHistoricalPrices").mockResolvedValueOnce(makePrices(50)); // less than 100 → stop after first page

    const pages: Price[][] = [];
    for await (const page of client.paginateHistoricalPrices()) {
      pages.push(page);
    }

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ page: 1, perPage: 100 }));
    expect(pages).toHaveLength(1);
  });

  it("passes options through to getHistoricalPrices", async () => {
    const spy = vi.spyOn(client, "getHistoricalPrices").mockResolvedValueOnce(makePrices(3)); // partial → single page

    for await (const _ of client.paginateHistoricalPrices({
      commodity: "BRENT_CRUDE_USD",
      startDate: "2024-01-01",
      endDate: "2024-12-31",
      perPage: 50,
    })) {
      // drain
    }

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        commodity: "BRENT_CRUDE_USD",
        startDate: "2024-01-01",
        endDate: "2024-12-31",
        perPage: 50,
        page: 1,
      }),
    );
  });

  it("yields a single page when first response has fewer items than perPage", async () => {
    vi.spyOn(client, "getHistoricalPrices").mockResolvedValueOnce(makePrices(10));

    const pages: Price[][] = [];
    for await (const page of client.paginateHistoricalPrices({ perPage: 100 })) {
      pages.push(page);
    }

    expect(pages).toHaveLength(1);
    expect(pages[0]).toHaveLength(10);
  });
});
