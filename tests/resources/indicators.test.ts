import { describe, it, expect, beforeEach, vi } from "vitest";
import { OilPriceAPI } from "../../src/client.js";
import type {
  FuelSwitchingIndicator,
  CFTCPositioningIndicator,
  CongressionalTradeIndicator,
  AnnotationIndicator,
} from "../../src/resources/indicators.js";

describe("IndicatorsResource", () => {
  let client: OilPriceAPI;

  beforeEach(() => {
    client = new OilPriceAPI({ apiKey: "test_key_123" });
    vi.clearAllMocks();
  });

  describe("get()", () => {
    it("fetches an indicator by type", async () => {
      const spy = vi
        .spyOn(client as any, "request")
        .mockResolvedValue({ value: 1, timestamp: "t" });

      await client.indicators.get("price-context");

      expect(spy).toHaveBeenCalledWith("/v1/indicators/price-context", {});
    });

    it("throws on empty type", async () => {
      await expect(client.indicators.get("" as any)).rejects.toThrow(
        "Indicator type must be a non-empty string",
      );
    });
  });

  describe("fuelSwitching()", () => {
    it("fetches fuel-switching indicator", async () => {
      const mock: FuelSwitchingIndicator = {
        value: 1.2,
        economical: true,
        from_fuel: "gas",
        to_fuel: "oil",
        timestamp: "2024-01-15T10:00:00Z",
      };

      const spy = vi.spyOn(client as any, "request").mockResolvedValue(mock);

      const result = await client.indicators.fuelSwitching();

      expect(spy).toHaveBeenCalledWith("/v1/indicators/fuel-switching", {});
      expect(result).toEqual(mock);
    });
  });

  describe("priceContext() / storageAnalytics()", () => {
    it.each([
      ["priceContext", "price-context"],
      ["storageAnalytics", "storage-analytics"],
    ])("%s() calls /v1/indicators/%s", async (method, slug) => {
      const spy = vi.spyOn(client as any, "request").mockResolvedValue({ timestamp: "t" });

      await (client.indicators as any)[method]();

      expect(spy).toHaveBeenCalledWith(`/v1/indicators/${slug}`, {});
    });
  });

  describe("annotations()", () => {
    it("fetches array of annotations", async () => {
      const mock: AnnotationIndicator[] = [
        { title: "OPEC cut", category: "supply", date: "2024-01-01" },
      ];

      const spy = vi.spyOn(client as any, "request").mockResolvedValue(mock);

      const result = await client.indicators.annotations();

      expect(spy).toHaveBeenCalledWith("/v1/indicators/annotations", {});
      expect(result).toEqual(mock);
    });

    it("unwraps { data } envelope", async () => {
      const mock: AnnotationIndicator[] = [{ title: "x", date: "2024-01-01" }];
      vi.spyOn(client as any, "request").mockResolvedValue({ data: mock });

      const result = await client.indicators.annotations();

      expect(result).toEqual(mock);
    });
  });

  describe("cftcPositioning()", () => {
    it("fetches CFTC positioning array", async () => {
      const mock: CFTCPositioningIndicator[] = [
        {
          market: "WTI",
          managed_money_long: 100,
          managed_money_short: 50,
          net_position: 50,
          report_date: "2024-01-09",
        },
      ];

      const spy = vi.spyOn(client as any, "request").mockResolvedValue(mock);

      const result = await client.indicators.cftcPositioning();

      expect(spy).toHaveBeenCalledWith("/v1/indicators/cftc-positioning", {});
      expect(result).toEqual(mock);
    });
  });

  describe("congressionalTrades()", () => {
    it("fetches congressional trades array", async () => {
      const mock: CongressionalTradeIndicator[] = [
        {
          member: "Rep. Example",
          ticker: "XOM",
          transaction_type: "buy",
          transaction_date: "2024-01-05",
        },
      ];

      const spy = vi.spyOn(client as any, "request").mockResolvedValue(mock);

      const result = await client.indicators.congressionalTrades();

      expect(spy).toHaveBeenCalledWith("/v1/indicators/congressional-trades", {});
      expect(result).toEqual(mock);
    });

    it("unwraps { data } envelope", async () => {
      const mock: CongressionalTradeIndicator[] = [
        { ticker: "CVX", transaction_date: "2024-01-05" },
      ];
      vi.spyOn(client as any, "request").mockResolvedValue({ data: mock });

      const result = await client.indicators.congressionalTrades();

      expect(result).toEqual(mock);
    });
  });
});
