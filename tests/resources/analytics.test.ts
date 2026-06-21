import { describe, it, expect, beforeEach, vi } from "vitest";
import { OilPriceAPI } from "../../src/client.js";

describe("AnalyticsResource", () => {
  let client: OilPriceAPI;

  beforeEach(() => {
    client = new OilPriceAPI({ apiKey: "test_key_123" });
    vi.clearAllMocks();
  });

  describe("performance()", () => {
    it("should fetch usage analytics with a range param", async () => {
      const mockData = {
        overview: { totalRequests: 100 },
        dailyUsage: [],
      };

      const requestSpy = vi.spyOn(client as any, "request").mockResolvedValue(mockData);

      const result = await client.analytics.performance({ range: "7d" });

      expect(requestSpy).toHaveBeenCalledWith("/v1/analytics/performance", {
        range: "7d",
      });
      expect((result.overview as any).totalRequests).toBe(100);
    });

    it("should send no params when called without options", async () => {
      const requestSpy = vi.spyOn(client as any, "request").mockResolvedValue({});

      await client.analytics.performance();

      expect(requestSpy).toHaveBeenCalledWith("/v1/analytics/performance", {});
    });
  });

  describe("statistics()", () => {
    it("should send code and period params", async () => {
      const mockData = {
        code: "WTI_USD",
        period: 30,
        statistics: { mean: 75.5 },
      };

      const requestSpy = vi.spyOn(client as any, "request").mockResolvedValue(mockData);

      const result = await client.analytics.statistics("WTI_USD", 30);

      expect(requestSpy).toHaveBeenCalledWith("/v1/analytics/statistics", {
        code: "WTI_USD",
        period: "30",
      });
      expect((result.statistics as any).mean).toBe(75.5);
    });

    it("should send only code when period omitted", async () => {
      const requestSpy = vi.spyOn(client as any, "request").mockResolvedValue({});

      await client.analytics.statistics("WTI_USD");

      expect(requestSpy).toHaveBeenCalledWith("/v1/analytics/statistics", {
        code: "WTI_USD",
      });
    });
  });

  describe("correlation()", () => {
    it("should send code1/code2 (not commodity1/commodity2)", async () => {
      const mockData = {
        type: "analysis",
        code1: "WTI_USD",
        code2: "BRENT_CRUDE_USD",
        period: 30,
        correlation: 0.95,
        strength: "very_strong",
      };

      const requestSpy = vi.spyOn(client as any, "request").mockResolvedValue(mockData);

      const result = await client.analytics.correlation("WTI_USD", "BRENT_CRUDE_USD");

      expect(requestSpy).toHaveBeenCalledWith("/v1/analytics/correlation", {
        code1: "WTI_USD",
        code2: "BRENT_CRUDE_USD",
      });
      expect(result.correlation).toBe(0.95);
    });

    it("should accept a numeric period (backward compatible)", async () => {
      const requestSpy = vi.spyOn(client as any, "request").mockResolvedValue({});

      await client.analytics.correlation("WTI_USD", "BRENT_CRUDE_USD", 90);

      expect(requestSpy).toHaveBeenCalledWith("/v1/analytics/correlation", {
        code1: "WTI_USD",
        code2: "BRENT_CRUDE_USD",
        period: "90",
      });
    });

    it("should support rolling correlation with type/window", async () => {
      const requestSpy = vi.spyOn(client as any, "request").mockResolvedValue({});

      await client.analytics.correlation("WTI_USD", "BRENT_CRUDE_USD", {
        period: 60,
        type: "rolling",
        window: 7,
      });

      expect(requestSpy).toHaveBeenCalledWith("/v1/analytics/correlation", {
        code1: "WTI_USD",
        code2: "BRENT_CRUDE_USD",
        period: "60",
        type: "rolling",
        window: "7",
      });
    });
  });

  describe("trend()", () => {
    it("should send code (not commodity)", async () => {
      const mockData = {
        type: "analysis",
        code: "WTI_USD",
        period: 30,
      };

      const requestSpy = vi.spyOn(client as any, "request").mockResolvedValue(mockData);

      const result = await client.analytics.trend("WTI_USD");

      expect(requestSpy).toHaveBeenCalledWith("/v1/analytics/trend", {
        code: "WTI_USD",
      });
      expect(result.code).toBe("WTI_USD");
    });

    it("should support indicator variants via type/window", async () => {
      const requestSpy = vi.spyOn(client as any, "request").mockResolvedValue({});

      await client.analytics.trend("WTI_USD", { type: "rsi", window: 14 });

      expect(requestSpy).toHaveBeenCalledWith("/v1/analytics/trend", {
        code: "WTI_USD",
        type: "rsi",
        window: "14",
      });
    });
  });

  describe("spread()", () => {
    it("should send the named spread and period", async () => {
      const requestSpy = vi
        .spyOn(client as any, "request")
        .mockResolvedValue({ type: "current", spread: "wti_brent" });

      await client.analytics.spread("wti_brent", { period: 30 });

      expect(requestSpy).toHaveBeenCalledWith("/v1/analytics/spread", {
        spread: "wti_brent",
        period: "30",
      });
    });

    it("should send no spread param to list available spreads", async () => {
      const requestSpy = vi
        .spyOn(client as any, "request")
        .mockResolvedValue({ available_spreads: [] });

      await client.analytics.spread();

      expect(requestSpy).toHaveBeenCalledWith("/v1/analytics/spread", {});
    });
  });

  describe("forecast()", () => {
    it("should send code/method/period", async () => {
      const requestSpy = vi
        .spyOn(client as any, "request")
        .mockResolvedValue({ code: "WTI_USD", method: "ema" });

      await client.analytics.forecast("WTI_USD", {
        method: "ema",
        period: 90,
      });

      expect(requestSpy).toHaveBeenCalledWith("/v1/analytics/forecast", {
        code: "WTI_USD",
        method: "ema",
        period: "90",
      });
    });
  });
});
