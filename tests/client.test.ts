import { describe, it, expect, vi } from "vitest";
import { OilPriceAPI } from "../src/index.js";

describe("OilPriceAPI", () => {
  it("allows a keyless demo client but blocks authenticated requests before fetch", async () => {
    const saved = process.env.OILPRICEAPI_KEY;
    delete process.env.OILPRICEAPI_KEY;
    const fetchSpy = vi.spyOn(global, "fetch");
    try {
      const client = new OilPriceAPI({ apiKey: "", retries: 0 });

      await expect(client.getLatestPrices()).rejects.toThrow("API key required");
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      vi.restoreAllMocks();
      if (saved === undefined) delete process.env.OILPRICEAPI_KEY;
      else process.env.OILPRICEAPI_KEY = saved;
    }
  });

  it("calls the public demo endpoint without an API key or Authorization header", async () => {
    const saved = process.env.OILPRICEAPI_KEY;
    delete process.env.OILPRICEAPI_KEY;
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "success",
          data: {
            prices: [{ code: "BRENT_CRUDE_USD", price: 80 }],
            meta: { demo_mode: true },
          },
        }),
        { status: 200 },
      ),
    );
    try {
      const client = new OilPriceAPI({ apiKey: "", retries: 0 });

      const result = await client.getDemoPrices();

      expect(result.prices[0].code).toBe("BRENT_CRUDE_USD");
      const headers = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>;
      expect(headers.Authorization).toBeUndefined();
    } finally {
      vi.restoreAllMocks();
      if (saved === undefined) delete process.env.OILPRICEAPI_KEY;
      else process.env.OILPRICEAPI_KEY = saved;
    }
  });

  it("should initialize with valid API key", () => {
    const client = new OilPriceAPI({ apiKey: "test_key" });
    expect(client).toBeInstanceOf(OilPriceAPI);
  });

  it("should use custom baseUrl if provided", () => {
    const client = new OilPriceAPI({
      apiKey: "test_key",
      baseUrl: "https://custom.api.com",
    });
    expect(client).toBeInstanceOf(OilPriceAPI);
  });

  // Note: Integration tests with real API would go here
  // For now, keeping tests minimal for crawl version
});
