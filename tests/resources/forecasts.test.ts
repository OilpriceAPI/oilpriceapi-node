import { describe, it, expect, beforeEach, vi } from "vitest";
import { OilPriceAPI } from "../../src/client.js";

describe("ForecastsResource", () => {
  let client: OilPriceAPI;

  beforeEach(() => {
    client = new OilPriceAPI({ apiKey: "test_key_123" });
    vi.clearAllMocks();
  });

  describe("monthly()", () => {
    it("should fetch monthly forecasts", async () => {
      const mockData = [
        {
          period: "2024-03",
          commodity: "WTI_USD",
          forecast_price: 78.0,
          lower_bound: 75.0,
          upper_bound: 82.0,
          source: "EIA",
          published_at: "2024-01-15T00:00:00Z",
        },
      ];

      const requestSpy = vi
        .spyOn(client as any, "request")
        .mockResolvedValue({ forecasts: mockData });

      const result = await client.forecasts.monthly();

      expect(requestSpy).toHaveBeenCalledWith("/v1/forecasts/monthly", {});
      expect(result).toHaveLength(1);
      expect(result[0].forecast_price).toBe(78.0);
    });

    it("should fetch forecasts for specific commodity", async () => {
      const mockData = [];

      const requestSpy = vi
        .spyOn(client as any, "request")
        .mockResolvedValue({ forecasts: mockData });

      await client.forecasts.monthly("WTI_USD");

      expect(requestSpy).toHaveBeenCalledWith("/v1/forecasts/monthly", {
        commodity: "WTI_USD",
      });
    });

    it("should handle array response format", async () => {
      const mockData = [
        {
          period: "2024-03",
          commodity: "WTI_USD",
          forecast_price: 78.0,
          source: "EIA",
          published_at: "2024-01-15T00:00:00Z",
        },
      ];

      vi.spyOn(client as any, "request").mockResolvedValue(mockData);

      const result = await client.forecasts.monthly();

      expect(result).toEqual(mockData);
    });
  });

  describe("accuracy()", () => {
    it("should fetch forecast accuracy metrics", async () => {
      const mockData = {
        source: "EIA",
        mape: 8.5,
        rmse: 6.2,
        sample_size: 100,
        period_evaluated: "2023-01-01 to 2023-12-31",
        timestamp: "2024-01-15T00:00:00Z",
      };

      const requestSpy = vi
        .spyOn(client as any, "request")
        .mockResolvedValue(mockData);

      const result = await client.forecasts.accuracy();

      expect(requestSpy).toHaveBeenCalledWith("/v1/forecasts/accuracy", {});
      expect(result.mape).toBe(8.5);
    });
  });
});
