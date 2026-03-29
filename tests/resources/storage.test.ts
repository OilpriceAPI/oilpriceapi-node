import { describe, it, expect, beforeEach, vi } from "vitest";
import { OilPriceAPI } from "../../src/client.js";
import type { StorageData, HistoricalStorageData } from "../../src/resources/storage.js";

describe("StorageResource", () => {
  let client: OilPriceAPI;

  beforeEach(() => {
    client = new OilPriceAPI({ apiKey: "test_key_123" });
    vi.clearAllMocks();
  });

  describe("all()", () => {
    it("should fetch all current US storage data", async () => {
      const mockData: StorageData = {
        code: "US_TOTAL",
        name: "US Total Commercial Crude Inventory",
        level: 450000,
        unit: "thousand_barrels",
        timestamp: "2024-01-15T00:00:00Z",
        change: -2500,
        change_percent: -0.55,
      };

      const requestSpy = vi.spyOn(client as any, "request").mockResolvedValue(mockData);

      const result = await client.storage.all();

      expect(requestSpy).toHaveBeenCalledWith("/v1/storage", {});
      expect(result.code).toBe("US_TOTAL");
      expect(result.level).toBe(450000);
      expect(result.unit).toBe("thousand_barrels");
      expect(result.change).toBe(-2500);
      expect(result.change_percent).toBe(-0.55);
    });

    it("should return minimal storage data without optional fields", async () => {
      const mockData: StorageData = {
        code: "US_TOTAL",
        level: 450000,
        unit: "thousand_barrels",
        timestamp: "2024-01-15T00:00:00Z",
      };

      vi.spyOn(client as any, "request").mockResolvedValue(mockData);

      const result = await client.storage.all();

      expect(result.level).toBe(450000);
      expect(result.change).toBeUndefined();
      expect(result.name).toBeUndefined();
    });
  });

  describe("cushing()", () => {
    it("should fetch Cushing, OK storage data", async () => {
      const mockData: StorageData = {
        code: "CUSHING",
        name: "Cushing, Oklahoma WTI Crude Inventory",
        level: 25000,
        unit: "thousand_barrels",
        timestamp: "2024-01-15T00:00:00Z",
        change: -800,
        change_percent: -3.1,
      };

      const requestSpy = vi.spyOn(client as any, "request").mockResolvedValue(mockData);

      const result = await client.storage.cushing();

      expect(requestSpy).toHaveBeenCalledWith("/v1/storage/cushing", {});
      expect(result.code).toBe("CUSHING");
      expect(result.level).toBe(25000);
      expect(result.change_percent).toBe(-3.1);
    });

    it("should handle Cushing build (positive change)", async () => {
      const mockData: StorageData = {
        code: "CUSHING",
        level: 26200,
        unit: "thousand_barrels",
        timestamp: "2024-01-22T00:00:00Z",
        change: 1200,
        change_percent: 4.8,
      };

      vi.spyOn(client as any, "request").mockResolvedValue(mockData);

      const result = await client.storage.cushing();

      expect(result.change).toBe(1200);
      expect(result.change_percent).toBeGreaterThan(0);
    });
  });

  describe("spr()", () => {
    it("should fetch Strategic Petroleum Reserve data", async () => {
      const mockData: StorageData = {
        code: "SPR",
        name: "US Strategic Petroleum Reserve",
        level: 350000,
        unit: "thousand_barrels",
        timestamp: "2024-01-15T00:00:00Z",
        change: 0,
        change_percent: 0,
      };

      const requestSpy = vi.spyOn(client as any, "request").mockResolvedValue(mockData);

      const result = await client.storage.spr();

      expect(requestSpy).toHaveBeenCalledWith("/v1/storage/spr", {});
      expect(result.code).toBe("SPR");
      expect(result.level).toBe(350000);
      expect(result.unit).toBe("thousand_barrels");
    });
  });

  describe("regional()", () => {
    it("should fetch all regional storage without specifying region", async () => {
      const mockData: StorageData[] = [
        {
          code: "PADD1",
          name: "PADD 1 (East Coast)",
          level: 8500,
          unit: "thousand_barrels",
          timestamp: "2024-01-15T00:00:00Z",
        },
        {
          code: "PADD2",
          name: "PADD 2 (Midwest)",
          level: 120000,
          unit: "thousand_barrels",
          timestamp: "2024-01-15T00:00:00Z",
        },
        {
          code: "PADD3",
          name: "PADD 3 (Gulf Coast)",
          level: 250000,
          unit: "thousand_barrels",
          timestamp: "2024-01-15T00:00:00Z",
        },
      ];

      const requestSpy = vi.spyOn(client as any, "request").mockResolvedValue(mockData);

      const result = await client.storage.regional();

      expect(requestSpy).toHaveBeenCalledWith("/v1/storage/regional", {});
      expect(Array.isArray(result)).toBe(true);
      expect((result as StorageData[]).length).toBe(3);
    });

    it("should fetch specific region data with region parameter", async () => {
      const mockData: StorageData = {
        code: "PADD3",
        name: "PADD 3 (Gulf Coast)",
        level: 250000,
        unit: "thousand_barrels",
        timestamp: "2024-01-15T00:00:00Z",
        change: -5000,
      };

      const requestSpy = vi.spyOn(client as any, "request").mockResolvedValue(mockData);

      const result = await client.storage.regional("PADD3");

      expect(requestSpy).toHaveBeenCalledWith("/v1/storage/regional", {
        region: "PADD3",
      });
      expect((result as StorageData).code).toBe("PADD3");
      expect((result as StorageData).level).toBe(250000);
    });

    it("should pass PADD1 region correctly", async () => {
      const mockData: StorageData = {
        code: "PADD1",
        level: 8500,
        unit: "thousand_barrels",
        timestamp: "2024-01-15T00:00:00Z",
      };

      const requestSpy = vi.spyOn(client as any, "request").mockResolvedValue(mockData);

      await client.storage.regional("PADD1");

      expect(requestSpy).toHaveBeenCalledWith("/v1/storage/regional", {
        region: "PADD1",
      });
    });
  });

  describe("history()", () => {
    it("should fetch historical storage data for a location code", async () => {
      const mockData: HistoricalStorageData[] = [
        {
          date: "2024-01-01",
          level: 455000,
          unit: "thousand_barrels",
          change: -1200,
        },
        {
          date: "2024-01-08",
          level: 453000,
          unit: "thousand_barrels",
          change: -2000,
        },
        {
          date: "2024-01-15",
          level: 450000,
          unit: "thousand_barrels",
          change: -3000,
        },
      ];

      const requestSpy = vi.spyOn(client as any, "request").mockResolvedValue(mockData);

      const result = await client.storage.history("US");

      expect(requestSpy).toHaveBeenCalledWith("/v1/storage/US/history", {});
      expect(result).toHaveLength(3);
      expect(result[0].date).toBe("2024-01-01");
      expect(result[2].level).toBe(450000);
    });

    it("should fetch history with date filters", async () => {
      const mockData: HistoricalStorageData[] = [
        { date: "2024-01-15", level: 25000, unit: "thousand_barrels" },
      ];

      const requestSpy = vi.spyOn(client as any, "request").mockResolvedValue(mockData);

      await client.storage.history("CUSHING", {
        startDate: "2024-01-01",
        endDate: "2024-01-31",
      });

      expect(requestSpy).toHaveBeenCalledWith("/v1/storage/CUSHING/history", {
        start_date: "2024-01-01",
        end_date: "2024-01-31",
      });
    });

    it("should pass only startDate when endDate is omitted", async () => {
      const requestSpy = vi.spyOn(client as any, "request").mockResolvedValue([]);

      await client.storage.history("SPR", { startDate: "2024-01-01" });

      expect(requestSpy).toHaveBeenCalledWith("/v1/storage/SPR/history", {
        start_date: "2024-01-01",
      });
    });

    it("should unwrap data property when response is wrapped", async () => {
      const mockData: HistoricalStorageData[] = [
        { date: "2024-01-15", level: 25000, unit: "thousand_barrels" },
      ];

      vi.spyOn(client as any, "request").mockResolvedValue({ data: mockData });

      const result = await client.storage.history("CUSHING");

      expect(result).toEqual(mockData);
    });

    it("should throw error for empty location code", async () => {
      await expect(client.storage.history("")).rejects.toThrow(
        "Storage location code must be a non-empty string",
      );
    });

    it("should throw error for non-string location code", async () => {
      await expect(client.storage.history(null as any)).rejects.toThrow(
        "Storage location code must be a non-empty string",
      );
    });
  });
});
