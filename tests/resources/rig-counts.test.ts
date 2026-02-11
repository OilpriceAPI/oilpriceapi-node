import { describe, it, expect, beforeEach, vi } from "vitest";
import { OilPriceAPI } from "../../src/client.js";

describe("RigCountsResource", () => {
  let client: OilPriceAPI;

  beforeEach(() => {
    client = new OilPriceAPI({ apiKey: "test_key_123" });
    vi.clearAllMocks();
  });

  describe("current()", () => {
    it("should fetch current rig counts", async () => {
      const mockData = {
        total: 625,
        oil: 500,
        gas: 120,
        misc: 5,
        timestamp: "2024-01-15T00:00:00Z",
        change: 5,
      };

      const requestSpy = vi
        .spyOn(client as any, "request")
        .mockResolvedValue(mockData);

      const result = await client.rigCounts.current();

      expect(requestSpy).toHaveBeenCalledWith("/v1/rig-counts/current", {});
      expect(result.total).toBe(625);
    });
  });

  describe("historical()", () => {
    it("should fetch historical rig counts", async () => {
      const mockData = [
        { date: "2024-01-08", total: 620, oil: 498, gas: 118 },
        { date: "2024-01-15", total: 625, oil: 500, gas: 120 },
      ];

      const requestSpy = vi
        .spyOn(client as any, "request")
        .mockResolvedValue(mockData);

      const result = await client.rigCounts.historical();

      expect(requestSpy).toHaveBeenCalledWith("/v1/rig-counts/historical", {});
      expect(result).toHaveLength(2);
    });
  });
});
