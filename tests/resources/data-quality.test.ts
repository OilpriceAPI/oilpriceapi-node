import { describe, it, expect, beforeEach, vi } from "vitest";
import { OilPriceAPI } from "../../src/client.js";
import type {
  DataQualitySummary,
  DataQualityReportMeta,
  DataQualityReport,
} from "../../src/resources/data-quality.js";

describe("DataQualityResource", () => {
  let client: OilPriceAPI;

  beforeEach(() => {
    client = new OilPriceAPI({ apiKey: "test_key_123" });
    vi.clearAllMocks();
  });

  describe("summary()", () => {
    it("should fetch data quality summary with all fields", async () => {
      const mockData: DataQualitySummary = {
        overall_score: 95,
        sources_monitored: 50,
        sources_with_issues: 2,
        last_updated: "2024-01-15T00:00:00Z",
        breakdown: {
          completeness: 98,
          timeliness: 96,
          accuracy: 94,
          consistency: 92,
        },
      };

      const requestSpy = vi.spyOn(client as any, "request").mockResolvedValue(mockData);

      const result = await client.dataQuality.summary();

      expect(requestSpy).toHaveBeenCalledWith("/v1/data-quality/summary", {});
      expect(result.overall_score).toBe(95);
      expect(result.sources_monitored).toBe(50);
      expect(result.sources_with_issues).toBe(2);
      expect(result.breakdown.completeness).toBe(98);
      expect(result.breakdown.timeliness).toBe(96);
      expect(result.breakdown.accuracy).toBe(94);
      expect(result.breakdown.consistency).toBe(92);
    });

    it("should include recent_alerts when present", async () => {
      const mockData: DataQualitySummary = {
        overall_score: 72,
        sources_monitored: 50,
        sources_with_issues: 8,
        last_updated: "2024-01-15T00:00:00Z",
        breakdown: {
          completeness: 80,
          timeliness: 68,
          accuracy: 75,
          consistency: 65,
        },
        recent_alerts: [
          {
            severity: "critical",
            message: "EIA data feed offline for 2 hours",
            timestamp: "2024-01-15T08:00:00Z",
          },
          {
            severity: "warning",
            message: "OPEC data delayed by 30 minutes",
            timestamp: "2024-01-15T09:30:00Z",
          },
        ],
      };

      vi.spyOn(client as any, "request").mockResolvedValue(mockData);

      const result = await client.dataQuality.summary();

      expect(result.overall_score).toBe(72);
      expect(result.recent_alerts).toHaveLength(2);
      expect(result.recent_alerts![0].severity).toBe("critical");
      expect(result.recent_alerts![1].severity).toBe("warning");
    });

    it("should handle summary with no alerts", async () => {
      const mockData: DataQualitySummary = {
        overall_score: 100,
        sources_monitored: 50,
        sources_with_issues: 0,
        last_updated: "2024-01-15T00:00:00Z",
        breakdown: {
          completeness: 100,
          timeliness: 100,
          accuracy: 100,
          consistency: 100,
        },
      };

      vi.spyOn(client as any, "request").mockResolvedValue(mockData);

      const result = await client.dataQuality.summary();

      expect(result.overall_score).toBe(100);
      expect(result.sources_with_issues).toBe(0);
      expect(result.recent_alerts).toBeUndefined();
    });
  });

  describe("reports()", () => {
    it("should fetch all quality reports as array", async () => {
      const mockData: DataQualityReportMeta[] = [
        {
          code: "WTI_QUALITY",
          name: "WTI Price Quality",
          type: "commodity",
          scope: "WTI_USD",
          last_generated: "2024-01-15T00:00:00Z",
          status: "healthy",
        },
        {
          code: "BRENT_QUALITY",
          name: "Brent Crude Quality",
          type: "commodity",
          scope: "BRENT_CRUDE_USD",
          last_generated: "2024-01-15T00:00:00Z",
          status: "warning",
        },
      ];

      const requestSpy = vi.spyOn(client as any, "request").mockResolvedValue(mockData);

      const result = await client.dataQuality.reports();

      expect(requestSpy).toHaveBeenCalledWith("/v1/data-quality/reports", {});
      expect(result).toHaveLength(2);
      expect(result[0].code).toBe("WTI_QUALITY");
      expect(result[1].status).toBe("warning");
    });

    it("should unwrap reports property when response is wrapped", async () => {
      const mockData: DataQualityReportMeta[] = [
        {
          code: "WTI_QUALITY",
          name: "WTI Price Quality",
          type: "commodity",
          scope: "WTI_USD",
          last_generated: "2024-01-15T00:00:00Z",
          status: "healthy",
        },
      ];

      vi.spyOn(client as any, "request").mockResolvedValue({
        reports: mockData,
      });

      const result = await client.dataQuality.reports();

      expect(result).toEqual(mockData);
    });

    it("should return empty array when no reports exist", async () => {
      vi.spyOn(client as any, "request").mockResolvedValue([]);

      const result = await client.dataQuality.reports();

      expect(result).toEqual([]);
    });

    it("should include critical status reports", async () => {
      const mockData: DataQualityReportMeta[] = [
        {
          code: "EIA_QUALITY",
          name: "EIA Data Quality",
          type: "source",
          scope: "EIA",
          last_generated: "2024-01-15T00:00:00Z",
          status: "critical",
        },
      ];

      vi.spyOn(client as any, "request").mockResolvedValue(mockData);

      const result = await client.dataQuality.reports();

      expect(result[0].status).toBe("critical");
    });
  });

  describe("report()", () => {
    it("should fetch a specific quality report by code", async () => {
      const mockData: DataQualityReport = {
        code: "WTI_QUALITY",
        name: "WTI Price Quality",
        scope: "WTI_USD",
        period: {
          start: "2024-01-01",
          end: "2024-01-31",
        },
        metrics: {
          completeness: 98,
          timeliness: 96,
          accuracy: 94,
          consistency: 92,
          missing_points: 2,
          late_updates: 4,
          anomalies: 1,
        },
        generated_at: "2024-01-15T00:00:00Z",
      };

      const requestSpy = vi.spyOn(client as any, "request").mockResolvedValue(mockData);

      const result = await client.dataQuality.report("WTI_QUALITY");

      expect(requestSpy).toHaveBeenCalledWith("/v1/data-quality/reports/WTI_QUALITY", {});
      expect(result.code).toBe("WTI_QUALITY");
      expect(result.name).toBe("WTI Price Quality");
      expect(result.metrics.completeness).toBe(98);
      expect(result.period.start).toBe("2024-01-01");
    });

    it("should include issues and recommendations when present", async () => {
      const mockData: DataQualityReport = {
        code: "EIA_QUALITY",
        name: "EIA Data Quality",
        scope: "EIA",
        period: { start: "2024-01-01", end: "2024-01-31" },
        metrics: {
          completeness: 80,
          timeliness: 65,
          accuracy: 90,
          consistency: 85,
          missing_points: 12,
          late_updates: 18,
        },
        issues: [
          {
            severity: "critical",
            description: "Feed offline for 4 hours on Jan 12",
            affected_points: 8,
            detected_at: "2024-01-12T14:00:00Z",
          },
          {
            severity: "warning",
            description: "Delayed data updates on Jan 15",
            affected_points: 4,
            detected_at: "2024-01-15T10:00:00Z",
          },
        ],
        recommendations: [
          "Implement redundant feed for EIA data",
          "Set up alerting for feed delays > 15 minutes",
        ],
        generated_at: "2024-01-15T00:00:00Z",
      };

      vi.spyOn(client as any, "request").mockResolvedValue(mockData);

      const result = await client.dataQuality.report("EIA_QUALITY");

      expect(result.issues).toHaveLength(2);
      expect(result.issues![0].severity).toBe("critical");
      expect(result.recommendations).toHaveLength(2);
      expect(result.recommendations![0]).toContain("redundant feed");
    });

    it("should throw error for empty report code", async () => {
      await expect(client.dataQuality.report("")).rejects.toThrow(
        "Report code must be a non-empty string",
      );
    });

    it("should throw error for non-string report code", async () => {
      await expect(client.dataQuality.report(null as any)).rejects.toThrow(
        "Report code must be a non-empty string",
      );
      await expect(client.dataQuality.report(42 as any)).rejects.toThrow(
        "Report code must be a non-empty string",
      );
    });
  });
});
