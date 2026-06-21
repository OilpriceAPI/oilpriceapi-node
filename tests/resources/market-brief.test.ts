import { describe, it, expect, beforeEach, vi } from "vitest";
import { OilPriceAPI } from "../../src/client.js";
import type { MarketBrief } from "../../src/resources/market-brief.js";
import { ValidationError } from "../../src/errors.js";

const mockBrief: MarketBrief = {
  as_of: "2026-06-21T00:00:00Z",
  codes: ["BRENT_CRUDE_USD", "WTI_USD"],
  commodities: [
    {
      code: "BRENT_CRUDE_USD",
      name: "Brent Crude",
      price: 78.42,
      currency: "USD",
      unit: "barrel",
      change_24h_pct: 0.8,
      change_24h_abs: 0.62,
      as_of: "2026-06-21T00:00:00Z",
      source: "oilpriceapi",
      stale: false,
      forecast_1m: { point: 80, low: 74, high: 86, confidence: "medium" },
    },
  ],
};

describe("getMarketBrief()", () => {
  let client: OilPriceAPI;

  beforeEach(() => {
    client = new OilPriceAPI({ apiKey: "test_key_123" });
    vi.clearAllMocks();
  });

  it("requests /v1/market-brief with comma-joined codes", async () => {
    const spy = vi.spyOn(client as any, "request").mockResolvedValue(mockBrief);

    const result = await client.getMarketBrief(["BRENT_CRUDE_USD", "WTI_USD"]);

    expect(spy).toHaveBeenCalledWith("/v1/market-brief", {
      codes: "BRENT_CRUDE_USD,WTI_USD",
    });
    expect(result).toEqual(mockBrief);
    expect(result.commodities[0].forecast_1m?.point).toBe(80);
  });

  it("adds narrative=true when requested", async () => {
    const spy = vi.spyOn(client as any, "request").mockResolvedValue(mockBrief);

    await client.getMarketBrief(["BRENT_CRUDE_USD"], { narrative: true });

    expect(spy).toHaveBeenCalledWith("/v1/market-brief", {
      codes: "BRENT_CRUDE_USD",
      narrative: "true",
    });
  });

  it("omits narrative param when false/omitted", async () => {
    const spy = vi.spyOn(client as any, "request").mockResolvedValue(mockBrief);
    await client.getMarketBrief(["BRENT_CRUDE_USD"], { narrative: false });
    expect(spy).toHaveBeenCalledWith("/v1/market-brief", { codes: "BRENT_CRUDE_USD" });
  });

  it("rejects an empty codes array", async () => {
    await expect(client.getMarketBrief([])).rejects.toThrow(ValidationError);
  });
});
