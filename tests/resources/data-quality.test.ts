import { describe, it, expect, beforeEach, vi } from "vitest";
import { OilPriceAPI } from "../../src/client.js";

describe("DataQualityResource", () => {
  let client: OilPriceAPI;

  beforeEach(() => {
    client = new OilPriceAPI({ apiKey: "test_key_123" });
    vi.clearAllMocks();
  });

  describe("summary()", () => {
    it("should fetch data quality summary", async () => {
      const mockData = {
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

      const requestSpy = vi
        .spyOn(client as any, "request")
        .mockResolvedValue(mockData);

      const result = await client.dataQuality.summary();

      expect(requestSpy).toHaveBeenCalledWith("/v1/data-quality/summary", {});
      expect(result.overall_score).toBe(95);
      expect(result.breakdown.completeness).toBe(98);
    });
  });

  describe("reports()", () => {
    it("should fetch all quality reports", async () => {
      const mockData = [
        {
          code: "WTI_QUALITY",
          name: "WTI Price Quality",
          type: "commodity",
          scope: "WTI_USD",
          last_generated: "2024-01-15T00:00:00Z",
          status: "healthy" as const,
        },
      ];

      const requestSpy = vi
        .spyOn(client as any, "request")
        .mockResolvedValue({ reports: mockData });

      const result = await client.dataQuality.reports();

      expect(requestSpy).toHaveBeenCalledWith("/v1/data-quality/reports", {});
      expect(result).toHaveLength(1);
    });
  });

  describe("report()", () => {
    it("should fetch a specific quality report", async () => {
      const mockData = {
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
        },
        generated_at: "2024-01-15T00:00:00Z",
      };

      const requestSpy = vi
        .spyOn(client as any, "request")
        .mockResolvedValue(mockData);

      const result = await client.dataQuality.report("WTI_QUALITY");

      expect(requestSpy).toHaveBeenCalledWith(
        "/v1/data-quality/reports/WTI_QUALITY",
        {},
      );
      expect(result.code).toBe("WTI_QUALITY");
    });

    it("should throw error for empty report code", async () => {
      await expect(client.dataQuality.report("")).rejects.toThrow(
        "Report code must be a non-empty string",
      );
    });
  });
});
