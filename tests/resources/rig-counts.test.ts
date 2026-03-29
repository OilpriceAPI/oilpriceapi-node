import { describe, it, expect, beforeEach, vi } from "vitest";
import { OilPriceAPI } from "../../src/client.js";
import type {
  RigCountData,
  HistoricalRigCountData,
  RigCountTrend,
  RigCountSummary,
} from "../../src/resources/rig-counts.js";

describe("RigCountsResource", () => {
  let client: OilPriceAPI;

  beforeEach(() => {
    client = new OilPriceAPI({ apiKey: "test_key_123" });
    vi.clearAllMocks();
  });

  describe("latest()", () => {
    it("should fetch latest rig count data", async () => {
      const mockData: RigCountData = {
        total: 625,
        oil: 500,
        gas: 120,
        misc: 5,
        timestamp: "2024-01-15T00:00:00Z",
        change: 5,
        year_over_year_change: -30,
      };

      const requestSpy = vi.spyOn(client as any, "request").mockResolvedValue(mockData);

      const result = await client.rigCounts.latest();

      expect(requestSpy).toHaveBeenCalledWith("/v1/rig-counts/latest", {});
      expect(result.total).toBe(625);
      expect(result.oil).toBe(500);
      expect(result.gas).toBe(120);
      expect(result.change).toBe(5);
    });

    it("should return minimal rig count data without optional fields", async () => {
      const mockData: RigCountData = {
        total: 600,
        timestamp: "2024-01-15T00:00:00Z",
      };

      vi.spyOn(client as any, "request").mockResolvedValue(mockData);

      const result = await client.rigCounts.latest();

      expect(result.total).toBe(600);
      expect(result.oil).toBeUndefined();
      expect(result.gas).toBeUndefined();
    });
  });

  describe("current()", () => {
    it("should fetch current rig counts", async () => {
      const mockData: RigCountData = {
        total: 625,
        oil: 500,
        gas: 120,
        misc: 5,
        timestamp: "2024-01-15T00:00:00Z",
        change: 5,
      };

      const requestSpy = vi.spyOn(client as any, "request").mockResolvedValue(mockData);

      const result = await client.rigCounts.current();

      expect(requestSpy).toHaveBeenCalledWith("/v1/rig-counts/current", {});
      expect(result.total).toBe(625);
      expect(result.oil).toBe(500);
    });
  });

  describe("historical()", () => {
    it("should fetch historical rig counts without date filters", async () => {
      const mockData: HistoricalRigCountData[] = [
        { date: "2024-01-08", total: 620, oil: 498, gas: 118 },
        { date: "2024-01-15", total: 625, oil: 500, gas: 120 },
      ];

      const requestSpy = vi.spyOn(client as any, "request").mockResolvedValue(mockData);

      const result = await client.rigCounts.historical();

      expect(requestSpy).toHaveBeenCalledWith("/v1/rig-counts/historical", {});
      expect(result).toHaveLength(2);
      expect(result[0].date).toBe("2024-01-08");
      expect(result[1].total).toBe(625);
    });

    it("should fetch historical rig counts with date filters", async () => {
      const mockData: HistoricalRigCountData[] = [
        { date: "2024-01-15", total: 625, oil: 500, gas: 120 },
      ];

      const requestSpy = vi.spyOn(client as any, "request").mockResolvedValue(mockData);

      await client.rigCounts.historical({
        startDate: "2024-01-01",
        endDate: "2024-01-31",
      });

      expect(requestSpy).toHaveBeenCalledWith("/v1/rig-counts/historical", {
        start_date: "2024-01-01",
        end_date: "2024-01-31",
      });
    });

    it("should pass only startDate if endDate is omitted", async () => {
      const requestSpy = vi.spyOn(client as any, "request").mockResolvedValue([]);

      await client.rigCounts.historical({ startDate: "2024-01-01" });

      expect(requestSpy).toHaveBeenCalledWith("/v1/rig-counts/historical", {
        start_date: "2024-01-01",
      });
    });

    it("should unwrap data property when response is wrapped", async () => {
      const mockData: HistoricalRigCountData[] = [{ date: "2024-01-15", total: 625 }];

      vi.spyOn(client as any, "request").mockResolvedValue({ data: mockData });

      const result = await client.rigCounts.historical();

      expect(result).toEqual(mockData);
    });

    it("should return empty array when no data exists", async () => {
      vi.spyOn(client as any, "request").mockResolvedValue([]);

      const result = await client.rigCounts.historical();

      expect(result).toEqual([]);
    });
  });

  describe("trends()", () => {
    it("should fetch rig count trends without period", async () => {
      const mockData: RigCountTrend = {
        period: "week",
        average: 622,
        min: 615,
        max: 630,
        trend: "up",
        change_percent: 0.8,
      };

      const requestSpy = vi.spyOn(client as any, "request").mockResolvedValue(mockData);

      const result = await client.rigCounts.trends();

      expect(requestSpy).toHaveBeenCalledWith("/v1/rig-counts/trends", {});
      expect(result.average).toBe(622);
      expect(result.trend).toBe("up");
    });

    it("should fetch rig count trends with period parameter", async () => {
      const mockData: RigCountTrend = {
        period: "month",
        average: 618,
        min: 610,
        max: 630,
        trend: "flat",
        change_percent: 0.2,
      };

      const requestSpy = vi.spyOn(client as any, "request").mockResolvedValue(mockData);

      const result = await client.rigCounts.trends("month");

      expect(requestSpy).toHaveBeenCalledWith("/v1/rig-counts/trends", {
        period: "month",
      });
      expect(result.period).toBe("month");
      expect(result.average).toBe(618);
    });

    it("should pass year period correctly", async () => {
      const mockData: RigCountTrend = {
        period: "year",
        average: 590,
        min: 540,
        max: 640,
        trend: "up",
        change_percent: 5.4,
      };

      const requestSpy = vi.spyOn(client as any, "request").mockResolvedValue(mockData);

      await client.rigCounts.trends("year");

      expect(requestSpy).toHaveBeenCalledWith("/v1/rig-counts/trends", {
        period: "year",
      });
    });
  });

  describe("summary()", () => {
    it("should fetch rig count summary with all fields", async () => {
      const mockData: RigCountSummary = {
        current: 625,
        week_change: 5,
        month_change: -10,
        year_change: -30,
        breakdown: {
          oil: 500,
          gas: 120,
          misc: 5,
        },
        timestamp: "2024-01-15T00:00:00Z",
      };

      const requestSpy = vi.spyOn(client as any, "request").mockResolvedValue(mockData);

      const result = await client.rigCounts.summary();

      expect(requestSpy).toHaveBeenCalledWith("/v1/rig-counts/summary", {});
      expect(result.current).toBe(625);
      expect(result.week_change).toBe(5);
      expect(result.month_change).toBe(-10);
      expect(result.year_change).toBe(-30);
      expect(result.breakdown.oil).toBe(500);
      expect(result.breakdown.gas).toBe(120);
    });

    it("should include misc breakdown when present", async () => {
      const mockData: RigCountSummary = {
        current: 625,
        week_change: 5,
        month_change: 0,
        year_change: -30,
        breakdown: {
          oil: 500,
          gas: 120,
          misc: 5,
        },
        timestamp: "2024-01-15T00:00:00Z",
      };

      vi.spyOn(client as any, "request").mockResolvedValue(mockData);

      const result = await client.rigCounts.summary();

      expect(result.breakdown.misc).toBe(5);
    });
  });
});
