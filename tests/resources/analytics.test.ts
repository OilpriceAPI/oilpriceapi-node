import { describe, it, expect, beforeEach, vi } from "vitest";
import { OilPriceAPI } from "../../src/client.js";

describe("AnalyticsResource", () => {
  let client: OilPriceAPI;

  beforeEach(() => {
    client = new OilPriceAPI({ apiKey: "test_key_123" });
    vi.clearAllMocks();
  });

  describe("performance()", () => {
    it("should fetch performance metrics", async () => {
      const mockData = {
        commodity: "WTI_USD",
        period_days: 30,
        average_price: 75.5,
        volatility: 2.5,
        return_percent: 5.2,
        high: 78.0,
        low: 72.0,
        timestamp: "2024-01-15T00:00:00Z",
      };

      const requestSpy = vi
        .spyOn(client as any, "request")
        .mockResolvedValue(mockData);

      const result = await client.analytics.performance({
        commodity: "WTI_USD",
      });

      expect(requestSpy).toHaveBeenCalledWith("/v1/analytics/performance", {
        commodity: "WTI_USD",
      });
      expect(result.average_price).toBe(75.5);
    });
  });

  describe("statistics()", () => {
    it("should fetch statistical analysis", async () => {
      const mockData = {
        commodity: "WTI_USD",
        period_days: 30,
        mean: 75.5,
        median: 75.25,
        std_dev: 2.5,
        variance: 6.25,
        min: 72.0,
        max: 78.0,
        timestamp: "2024-01-15T00:00:00Z",
      };

      const requestSpy = vi
        .spyOn(client as any, "request")
        .mockResolvedValue(mockData);

      const result = await client.analytics.statistics("WTI_USD");

      expect(requestSpy).toHaveBeenCalledWith("/v1/analytics/statistics", {
        commodity: "WTI_USD",
      });
      expect(result.mean).toBe(75.5);
    });
  });

  describe("correlation()", () => {
    it("should calculate correlation between commodities", async () => {
      const mockData = {
        commodity1: "WTI_USD",
        commodity2: "BRENT_CRUDE_USD",
        period_days: 30,
        correlation: 0.95,
        strength: "strong" as const,
        timestamp: "2024-01-15T00:00:00Z",
      };

      const requestSpy = vi
        .spyOn(client as any, "request")
        .mockResolvedValue(mockData);

      const result = await client.analytics.correlation(
        "WTI_USD",
        "BRENT_CRUDE_USD",
      );

      expect(requestSpy).toHaveBeenCalledWith("/v1/analytics/correlation", {
        commodity1: "WTI_USD",
        commodity2: "BRENT_CRUDE_USD",
      });
      expect(result.correlation).toBe(0.95);
    });
  });

  describe("trend()", () => {
    it("should detect price trends", async () => {
      const mockData = {
        commodity: "WTI_USD",
        period_days: 30,
        trend: "upward" as const,
        strength: 75,
        timestamp: "2024-01-15T00:00:00Z",
      };

      const requestSpy = vi
        .spyOn(client as any, "request")
        .mockResolvedValue(mockData);

      const result = await client.analytics.trend("WTI_USD");

      expect(requestSpy).toHaveBeenCalledWith("/v1/analytics/trend", {
        commodity: "WTI_USD",
      });
      expect(result.trend).toBe("upward");
    });
  });
});
