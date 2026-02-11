import { describe, it, expect, beforeEach, vi } from "vitest";
import { OilPriceAPI } from "../../src/client.js";

describe("StorageResource", () => {
  let client: OilPriceAPI;

  beforeEach(() => {
    client = new OilPriceAPI({ apiKey: "test_key_123" });
    vi.clearAllMocks();
  });

  describe("all()", () => {
    it("should fetch all storage data", async () => {
      const mockData = {
        code: "US_TOTAL",
        name: "US Total Commercial Crude Inventory",
        level: 450000,
        unit: "thousand_barrels",
        timestamp: "2024-01-15T00:00:00Z",
        change: -2500,
        change_percent: -0.55,
      };

      const requestSpy = vi
        .spyOn(client as any, "request")
        .mockResolvedValue(mockData);

      const result = await client.storage.all();

      expect(requestSpy).toHaveBeenCalledWith("/v1/storage", {});
      expect(result.level).toBe(450000);
    });
  });

  describe("cushing()", () => {
    it("should fetch Cushing storage data", async () => {
      const mockData = {
        code: "CUSHING",
        level: 25000,
        unit: "thousand_barrels",
        timestamp: "2024-01-15T00:00:00Z",
      };

      const requestSpy = vi
        .spyOn(client as any, "request")
        .mockResolvedValue(mockData);

      const result = await client.storage.cushing();

      expect(requestSpy).toHaveBeenCalledWith("/v1/storage/cushing", {});
      expect(result.code).toBe("CUSHING");
    });
  });

  describe("spr()", () => {
    it("should fetch SPR data", async () => {
      const mockData = {
        code: "SPR",
        level: 350000,
        unit: "thousand_barrels",
        timestamp: "2024-01-15T00:00:00Z",
      };

      const requestSpy = vi
        .spyOn(client as any, "request")
        .mockResolvedValue(mockData);

      const result = await client.storage.spr();

      expect(requestSpy).toHaveBeenCalledWith("/v1/storage/spr", {});
      expect(result.code).toBe("SPR");
    });
  });
});
