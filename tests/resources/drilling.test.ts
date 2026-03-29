import { describe, it, expect, beforeEach, vi } from "vitest";
import { OilPriceAPI } from "../../src/client.js";
import type {
  LatestDrillingData,
  DrillingSummary,
  DrillingTrend,
  FracSpreadData,
  WellPermitData,
  DUCWellData,
  CompletionData,
  WellsDrilledData,
  BasinDrillingData,
  DrillingIntelligenceData,
} from "../../src/resources/drilling.js";

describe("DrillingResource", () => {
  let client: OilPriceAPI;

  beforeEach(() => {
    client = new OilPriceAPI({ apiKey: "test_key_123" });
    vi.clearAllMocks();
  });

  describe("list()", () => {
    it("should fetch all drilling intelligence records as array", async () => {
      const mockData: DrillingIntelligenceData[] = [
        {
          id: "rec-1",
          basin: "Permian",
          metric_type: "rig_count",
          value: 310,
          date: "2024-01-15",
          timestamp: "2024-01-15T00:00:00Z",
        },
        {
          id: "rec-2",
          basin: "Eagle Ford",
          metric_type: "rig_count",
          value: 65,
          date: "2024-01-15",
          timestamp: "2024-01-15T00:00:00Z",
        },
      ];

      const requestSpy = vi.spyOn(client as any, "request").mockResolvedValue(mockData);

      const result = await client.drilling.list();

      expect(requestSpy).toHaveBeenCalledWith("/v1/drilling-intelligence", {});
      expect(result).toEqual(mockData);
      expect(result).toHaveLength(2);
      expect(result[0].basin).toBe("Permian");
    });

    it("should unwrap data property when response is wrapped", async () => {
      const mockData: DrillingIntelligenceData[] = [
        {
          id: "rec-1",
          metric_type: "frac_spread",
          value: 50,
          date: "2024-01-15",
          timestamp: "2024-01-15T00:00:00Z",
        },
      ];

      vi.spyOn(client as any, "request").mockResolvedValue({ data: mockData });

      const result = await client.drilling.list();

      expect(result).toEqual(mockData);
    });
  });

  describe("latest()", () => {
    it("should fetch latest drilling data", async () => {
      const mockData: LatestDrillingData = {
        total_rigs: 625,
        total_frac_spreads: 280,
        total_permits: 1200,
        total_duc_wells: 4500,
        total_completions: 800,
        as_of_date: "2024-01-15",
      };

      const requestSpy = vi.spyOn(client as any, "request").mockResolvedValue(mockData);

      const result = await client.drilling.latest();

      expect(requestSpy).toHaveBeenCalledWith("/v1/drilling-intelligence/latest", {});
      expect(result.total_rigs).toBe(625);
      expect(result.total_frac_spreads).toBe(280);
      expect(result.total_permits).toBe(1200);
      expect(result.total_duc_wells).toBe(4500);
      expect(result.total_completions).toBe(800);
      expect(result.as_of_date).toBe("2024-01-15");
    });
  });

  describe("summary()", () => {
    it("should fetch drilling summary as array", async () => {
      const mockData: DrillingSummary[] = [
        {
          metric: "rig_count",
          total: 625,
          change: 5,
          change_percent: 0.8,
          breakdown: [
            { name: "Permian", value: 310, percentage: 49.6 },
            { name: "Eagle Ford", value: 65, percentage: 10.4 },
          ],
        },
        {
          metric: "frac_spreads",
          total: 280,
          change: -3,
          change_percent: -1.1,
        },
      ];

      const requestSpy = vi.spyOn(client as any, "request").mockResolvedValue(mockData);

      const result = await client.drilling.summary();

      expect(requestSpy).toHaveBeenCalledWith("/v1/drilling-intelligence/summary", {});
      expect(result).toHaveLength(2);
      expect(result[0].metric).toBe("rig_count");
      expect(result[0].total).toBe(625);
    });

    it("should unwrap summary property when response is wrapped", async () => {
      const mockData: DrillingSummary[] = [{ metric: "rig_count", total: 625 }];

      vi.spyOn(client as any, "request").mockResolvedValue({
        summary: mockData,
      });

      const result = await client.drilling.summary();

      expect(result).toEqual(mockData);
    });
  });

  describe("trends()", () => {
    it("should fetch drilling trends as array", async () => {
      const mockData: DrillingTrend[] = [
        {
          date: "2024-01-01",
          metric: "rig_count",
          value: 618,
          trend: "up",
        },
        {
          date: "2024-01-08",
          metric: "rig_count",
          value: 620,
          moving_average: 619,
          trend: "up",
        },
        {
          date: "2024-01-15",
          metric: "rig_count",
          value: 625,
          moving_average: 621,
          trend: "up",
        },
      ];

      const requestSpy = vi.spyOn(client as any, "request").mockResolvedValue(mockData);

      const result = await client.drilling.trends();

      expect(requestSpy).toHaveBeenCalledWith("/v1/drilling-intelligence/trends", {});
      expect(result).toHaveLength(3);
      expect(result[0].metric).toBe("rig_count");
      expect(result[2].value).toBe(625);
    });

    it("should unwrap trends property when response is wrapped", async () => {
      const mockData: DrillingTrend[] = [{ date: "2024-01-15", metric: "rig_count", value: 625 }];

      vi.spyOn(client as any, "request").mockResolvedValue({
        trends: mockData,
      });

      const result = await client.drilling.trends();

      expect(result).toEqual(mockData);
    });
  });

  describe("fracSpreads()", () => {
    it("should fetch frac spread data as array", async () => {
      const mockData: FracSpreadData[] = [
        {
          basin: "Permian",
          active_spreads: 120,
          change: 3,
          date: "2024-01-15",
        },
        {
          basin: "Haynesville",
          active_spreads: 45,
          change: -2,
          date: "2024-01-15",
        },
      ];

      const requestSpy = vi.spyOn(client as any, "request").mockResolvedValue(mockData);

      const result = await client.drilling.fracSpreads();

      expect(requestSpy).toHaveBeenCalledWith("/v1/drilling-intelligence/frac-spreads", {});
      expect(result).toHaveLength(2);
      expect(result[0].basin).toBe("Permian");
      expect(result[0].active_spreads).toBe(120);
    });

    it("should unwrap data property when response is wrapped", async () => {
      const mockData: FracSpreadData[] = [
        { basin: "Permian", active_spreads: 120, date: "2024-01-15" },
      ];

      vi.spyOn(client as any, "request").mockResolvedValue({ data: mockData });

      const result = await client.drilling.fracSpreads();

      expect(result).toEqual(mockData);
    });
  });

  describe("wellPermits()", () => {
    it("should fetch well permit data as array", async () => {
      const mockData: WellPermitData[] = [
        {
          state: "Texas",
          basin: "Permian",
          permits: 450,
          change: 25,
          date: "2024-01-15",
        },
        {
          state: "North Dakota",
          permits: 180,
          date: "2024-01-15",
        },
      ];

      const requestSpy = vi.spyOn(client as any, "request").mockResolvedValue(mockData);

      const result = await client.drilling.wellPermits();

      expect(requestSpy).toHaveBeenCalledWith("/v1/drilling-intelligence/well-permits", {});
      expect(result).toHaveLength(2);
      expect(result[0].state).toBe("Texas");
      expect(result[0].permits).toBe(450);
    });

    it("should unwrap data property when response is wrapped", async () => {
      const mockData: WellPermitData[] = [{ state: "Texas", permits: 450, date: "2024-01-15" }];

      vi.spyOn(client as any, "request").mockResolvedValue({ data: mockData });

      const result = await client.drilling.wellPermits();

      expect(result).toEqual(mockData);
    });
  });

  describe("ducWells()", () => {
    it("should fetch DUC well data as array", async () => {
      const mockData: DUCWellData[] = [
        {
          basin: "Permian",
          duc_count: 1450,
          change: -30,
          date: "2024-01-15",
        },
        {
          basin: "Eagle Ford",
          duc_count: 680,
          change: -15,
          date: "2024-01-15",
        },
      ];

      const requestSpy = vi.spyOn(client as any, "request").mockResolvedValue(mockData);

      const result = await client.drilling.ducWells();

      expect(requestSpy).toHaveBeenCalledWith("/v1/drilling-intelligence/duc-wells", {});
      expect(result).toHaveLength(2);
      expect(result[0].basin).toBe("Permian");
      expect(result[0].duc_count).toBe(1450);
    });

    it("should unwrap data property when response is wrapped", async () => {
      const mockData: DUCWellData[] = [{ basin: "Permian", duc_count: 1450, date: "2024-01-15" }];

      vi.spyOn(client as any, "request").mockResolvedValue({ data: mockData });

      const result = await client.drilling.ducWells();

      expect(result).toEqual(mockData);
    });
  });

  describe("completions()", () => {
    it("should fetch completion data as array", async () => {
      const mockData: CompletionData[] = [
        {
          basin: "Permian",
          completions: 320,
          change: 10,
          date: "2024-01-15",
        },
        {
          basin: "DJ Basin",
          completions: 75,
          date: "2024-01-15",
        },
      ];

      const requestSpy = vi.spyOn(client as any, "request").mockResolvedValue(mockData);

      const result = await client.drilling.completions();

      expect(requestSpy).toHaveBeenCalledWith("/v1/drilling-intelligence/completions", {});
      expect(result).toHaveLength(2);
      expect(result[0].basin).toBe("Permian");
      expect(result[0].completions).toBe(320);
    });

    it("should unwrap data property when response is wrapped", async () => {
      const mockData: CompletionData[] = [
        { basin: "Permian", completions: 320, date: "2024-01-15" },
      ];

      vi.spyOn(client as any, "request").mockResolvedValue({ data: mockData });

      const result = await client.drilling.completions();

      expect(result).toEqual(mockData);
    });
  });

  describe("wellsDrilled()", () => {
    it("should fetch wells drilled data as array", async () => {
      const mockData: WellsDrilledData[] = [
        {
          basin: "Permian",
          wells_drilled: 280,
          change: 8,
          date: "2024-01-15",
        },
        {
          basin: "Bakken",
          wells_drilled: 95,
          date: "2024-01-15",
        },
      ];

      const requestSpy = vi.spyOn(client as any, "request").mockResolvedValue(mockData);

      const result = await client.drilling.wellsDrilled();

      expect(requestSpy).toHaveBeenCalledWith("/v1/drilling-intelligence/wells-drilled", {});
      expect(result).toHaveLength(2);
      expect(result[0].basin).toBe("Permian");
      expect(result[0].wells_drilled).toBe(280);
    });

    it("should unwrap data property when response is wrapped", async () => {
      const mockData: WellsDrilledData[] = [
        { basin: "Permian", wells_drilled: 280, date: "2024-01-15" },
      ];

      vi.spyOn(client as any, "request").mockResolvedValue({ data: mockData });

      const result = await client.drilling.wellsDrilled();

      expect(result).toEqual(mockData);
    });
  });

  describe("basin()", () => {
    it("should fetch basin-specific drilling data", async () => {
      const mockData: BasinDrillingData = {
        basin: "Permian",
        active_rigs: 310,
        frac_spreads: 120,
        permits: 450,
        duc_wells: 1450,
        completions: 320,
        wells_drilled: 280,
        as_of_date: "2024-01-15",
      };

      const requestSpy = vi.spyOn(client as any, "request").mockResolvedValue(mockData);

      const result = await client.drilling.basin("Permian");

      expect(requestSpy).toHaveBeenCalledWith("/v1/drilling-intelligence/basin/Permian", {});
      expect(result.basin).toBe("Permian");
      expect(result.active_rigs).toBe(310);
      expect(result.frac_spreads).toBe(120);
      expect(result.as_of_date).toBe("2024-01-15");
    });

    it("should fetch basin data for Eagle Ford", async () => {
      const mockData: BasinDrillingData = {
        basin: "Eagle Ford",
        active_rigs: 65,
        as_of_date: "2024-01-15",
      };

      const requestSpy = vi.spyOn(client as any, "request").mockResolvedValue(mockData);

      const result = await client.drilling.basin("Eagle Ford");

      expect(requestSpy).toHaveBeenCalledWith("/v1/drilling-intelligence/basin/Eagle Ford", {});
      expect(result.basin).toBe("Eagle Ford");
    });

    it("should throw error for empty basin name", async () => {
      await expect(client.drilling.basin("")).rejects.toThrow(
        "Basin name must be a non-empty string",
      );
    });

    it("should throw error for non-string basin name", async () => {
      await expect(client.drilling.basin(null as any)).rejects.toThrow(
        "Basin name must be a non-empty string",
      );
      await expect(client.drilling.basin(42 as any)).rejects.toThrow(
        "Basin name must be a non-empty string",
      );
    });
  });
});
