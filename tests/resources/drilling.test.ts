import { describe, it, expect, beforeEach, vi } from "vitest";
import { OilPriceAPI } from "../../src/client.js";

describe("DrillingResource", () => {
  let client: OilPriceAPI;

  beforeEach(() => {
    client = new OilPriceAPI({ apiKey: "test_key_123" });
    vi.clearAllMocks();
  });

  describe("latest()", () => {
    it("should fetch latest drilling data", async () => {
      const mockData = {
        total_rigs: 625,
        total_frac_spreads: 280,
        total_permits: 1200,
        total_duc_wells: 4500,
        total_completions: 800,
        as_of_date: "2024-01-15",
      };

      const requestSpy = vi
        .spyOn(client as any, "request")
        .mockResolvedValue(mockData);

      const result = await client.drilling.latest();

      expect(requestSpy).toHaveBeenCalledWith(
        "/v1/drilling-intelligence/latest",
        {},
      );
      expect(result.total_rigs).toBe(625);
    });
  });
});
