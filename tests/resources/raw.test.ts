import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { OilPriceAPI } from "../../src/client.js";

/**
 * Raw-response access tests (issue #7).
 *
 * Verifies that client.raw.* exposes the underlying HTTP status + headers
 * alongside the parsed data, and that the parsed data matches the non-raw
 * methods exactly.
 */
describe("RawResource", () => {
  let client: OilPriceAPI;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    client = new OilPriceAPI({ apiKey: "test_key_123", retries: 0 });
    fetchSpy = vi.spyOn(global, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: "OK",
      headers: new Headers(headers),
      text: async () => JSON.stringify(body),
    } as Response;
  }

  describe("getLatestPrices()", () => {
    it("returns data, status, and headers", async () => {
      fetchSpy.mockResolvedValue(
        mockResponse({ status: "success", data: { price: 75.5, commodity: "WTI_USD" } }, 200, {
          "x-ratelimit-remaining": "99",
        }),
      );

      const result = await client.raw.getLatestPrices({ commodity: "WTI_USD" });

      expect(result.status).toBe(200);
      expect(result.headers.get("x-ratelimit-remaining")).toBe("99");
      // Same shape as client.getLatestPrices (single price wrapped in array)
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data[0]).toMatchObject({ price: 75.5 });
    });

    it("parsed data matches the non-raw method", async () => {
      const body = { status: "success", data: { price: 80, commodity: "WTI_USD" } };

      fetchSpy.mockResolvedValue(mockResponse(body));
      const plain = await client.getLatestPrices();

      fetchSpy.mockResolvedValue(mockResponse(body));
      const raw = await client.raw.getLatestPrices();

      expect(raw.data).toEqual(plain);
    });

    it("sends by_code query param when commodity provided", async () => {
      fetchSpy.mockResolvedValue(mockResponse({ status: "success", data: { price: 1 } }));

      await client.raw.getLatestPrices({ commodity: "BRENT_CRUDE_USD" });

      const url = (fetchSpy.mock.calls[0][0] as string).toString();
      expect(url).toContain("by_code=BRENT_CRUDE_USD");
    });
  });

  describe("getHistoricalPrices()", () => {
    it("returns historical prices array with status", async () => {
      fetchSpy.mockResolvedValue(
        mockResponse({
          status: "success",
          data: { prices: [{ price: 1 }, { price: 2 }] },
        }),
      );

      const result = await client.raw.getHistoricalPrices({ period: "past_week" });

      expect(result.status).toBe(200);
      expect(result.data).toHaveLength(2);
    });

    it("forwards all filter params", async () => {
      fetchSpy.mockResolvedValue(mockResponse({ status: "success", data: { prices: [] } }));

      await client.raw.getHistoricalPrices({
        commodity: "WTI_USD",
        startDate: "2024-01-01",
        endDate: "2024-12-31",
        interval: "daily",
        perPage: 50,
        page: 2,
      });

      const url = (fetchSpy.mock.calls[0][0] as string).toString();
      expect(url).toContain("by_code=WTI_USD");
      expect(url).toContain("start_date=2024-01-01");
      expect(url).toContain("end_date=2024-12-31");
      expect(url).toContain("interval=daily");
      expect(url).toContain("per_page=50");
      expect(url).toContain("page=2");
    });
  });

  describe("getCommodities()", () => {
    it("returns commodities response with headers", async () => {
      fetchSpy.mockResolvedValue(
        mockResponse({ status: "success", data: { commodities: [{ code: "WTI_USD" }] } }, 200, {
          "content-type": "application/json",
        }),
      );

      const result = await client.raw.getCommodities();

      expect(result.status).toBe(200);
      expect(result.headers.get("content-type")).toBe("application/json");
      expect(result.data).toMatchObject({ commodities: [{ code: "WTI_USD" }] });
    });
  });

  describe("getCommodityCategories() / getCommodity()", () => {
    it("getCommodityCategories() hits the categories endpoint", async () => {
      fetchSpy.mockResolvedValue(
        mockResponse({ status: "success", data: { oil: { name: "Oil" } } }),
      );

      const result = await client.raw.getCommodityCategories();

      expect(result.status).toBe(200);
      const url = (fetchSpy.mock.calls[0][0] as string).toString();
      expect(url).toContain("/v1/commodities/categories");
    });

    it("getCommodity() hits the code endpoint", async () => {
      fetchSpy.mockResolvedValue(
        mockResponse({ status: "success", data: { code: "WTI_USD", name: "WTI" } }),
      );

      const result = await client.raw.getCommodity("WTI_USD");

      expect(result.status).toBe(200);
      expect(result.data).toMatchObject({ code: "WTI_USD" });
      const url = (fetchSpy.mock.calls[0][0] as string).toString();
      expect(url).toContain("/v1/commodities/WTI_USD");
    });
  });

  describe("get() generic", () => {
    it("makes an arbitrary GET and returns raw response", async () => {
      fetchSpy.mockResolvedValue(
        mockResponse({ status: "success", data: { contract: "CL.1", last: 70 } }, 201),
      );

      const result = await client.raw.get<{ contract: string; last: number }>("/v1/futures/CL.1");

      expect(result.status).toBe(201);
      expect(result.data).toEqual({ contract: "CL.1", last: 70 });
      const url = (fetchSpy.mock.calls[0][0] as string).toString();
      expect(url).toContain("/v1/futures/CL.1");
    });
  });

  it("does not break the existing non-raw return shape", async () => {
    fetchSpy.mockResolvedValue(mockResponse({ status: "success", data: { price: 99 } }));

    const prices = await client.getLatestPrices();
    // Still returns a plain array, not an APIResponse wrapper
    expect(Array.isArray(prices)).toBe(true);
    expect((prices as any).status).toBeUndefined();
  });
});
