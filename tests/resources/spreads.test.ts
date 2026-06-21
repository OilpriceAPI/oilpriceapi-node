import { describe, it, expect, beforeEach, vi } from "vitest";
import { OilPriceAPI } from "../../src/client.js";
import type { SpreadValue, HistoricalSpreadValue } from "../../src/resources/spreads.js";

describe("SpreadsResource", () => {
  let client: OilPriceAPI;

  beforeEach(() => {
    client = new OilPriceAPI({ apiKey: "test_key_123" });
    vi.clearAllMocks();
  });

  describe("get()", () => {
    it("fetches a spread by type", async () => {
      const mock: SpreadValue = {
        type: "crack",
        name: "3:2:1 Crack",
        value: 22.5,
        unit: "USD/bbl",
        timestamp: "2024-01-15T10:00:00Z",
      };

      const spy = vi.spyOn(client as any, "request").mockResolvedValue(mock);

      const result = await client.spreads.get("crack");

      expect(spy).toHaveBeenCalledWith("/v1/spreads/crack", {});
      expect(result).toEqual(mock);
    });

    it("throws on empty type", async () => {
      await expect(client.spreads.get("" as any)).rejects.toThrow(
        "Spread type must be a non-empty string",
      );
    });
  });

  describe("named helpers", () => {
    it.each([
      ["crack", "crack"],
      ["basis", "basis"],
      ["curveStructure", "curve-structure"],
      ["margin", "margin"],
      ["physicalPremium", "physical-premium"],
    ])("%s() calls /v1/spreads/%s", async (method, slug) => {
      const spy = vi
        .spyOn(client as any, "request")
        .mockResolvedValue({ type: slug, value: 1, timestamp: "t" });

      await (client.spreads as any)[method]();

      expect(spy).toHaveBeenCalledWith(`/v1/spreads/${slug}`, {});
    });
  });

  describe("historical()", () => {
    it("fetches historical with date filters", async () => {
      const mock: HistoricalSpreadValue[] = [
        { date: "2024-01-01", value: 20 },
        { date: "2024-01-02", value: 21 },
      ];

      const spy = vi.spyOn(client as any, "request").mockResolvedValue(mock);

      const result = await client.spreads.historical("basis", {
        startDate: "2024-01-01",
        endDate: "2024-01-31",
      });

      expect(spy).toHaveBeenCalledWith("/v1/spreads/basis/historical", {
        start_date: "2024-01-01",
        end_date: "2024-01-31",
      });
      expect(result).toHaveLength(2);
    });

    it("unwraps { data } envelope", async () => {
      const mock: HistoricalSpreadValue[] = [{ date: "2024-01-01", value: 1 }];
      vi.spyOn(client as any, "request").mockResolvedValue({ data: mock });

      const result = await client.spreads.historical("margin");

      expect(result).toEqual(mock);
    });
  });

  describe("all()", () => {
    it("fetches all spreads for a type", async () => {
      const mock: SpreadValue[] = [
        { type: "crack", value: 22, timestamp: "t1" },
        { type: "crack", value: 23, timestamp: "t2" },
      ];

      const spy = vi.spyOn(client as any, "request").mockResolvedValue(mock);

      const result = await client.spreads.all("crack");

      expect(spy).toHaveBeenCalledWith("/v1/spreads/crack/all", {});
      expect(result).toHaveLength(2);
    });

    it("unwraps { data } envelope", async () => {
      const mock: SpreadValue[] = [{ type: "basis", value: 1, timestamp: "t" }];
      vi.spyOn(client as any, "request").mockResolvedValue({ data: mock });

      const result = await client.spreads.all("basis");

      expect(result).toEqual(mock);
    });
  });
});
