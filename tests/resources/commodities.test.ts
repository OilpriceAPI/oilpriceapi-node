import { describe, it, expect, beforeEach, vi } from "vitest";
import { OilPriceAPI } from "../../src/client.js";
import type {
  Commodity,
  CommoditiesResponse,
  CategoriesResponse,
} from "../../src/resources/commodities.js";

describe("CommoditiesResource", () => {
  let client: OilPriceAPI;

  beforeEach(() => {
    client = new OilPriceAPI({ apiKey: "test_key_123" });
    vi.clearAllMocks();
  });

  describe("list()", () => {
    it("should fetch all commodities successfully", async () => {
      const mockResponse: CommoditiesResponse = {
        commodities: [
          {
            code: "WTI_USD",
            name: "WTI Crude Oil",
            currency: "USD",
            category: "oil",
            unit: "barrel",
            multiplier: 100,
          },
          {
            code: "BRENT_CRUDE_USD",
            name: "Brent Crude Oil",
            currency: "USD",
            category: "oil",
            unit: "barrel",
            description: "International benchmark crude oil",
            multiplier: 100,
          },
        ],
      };

      const requestSpy = vi
        .spyOn(client as any, "request")
        .mockResolvedValue(mockResponse);

      const result = await client.commodities.list();

      expect(requestSpy).toHaveBeenCalledWith("/v1/commodities", {});
      expect(result).toEqual(mockResponse);
      expect(result.commodities).toHaveLength(2);
      expect(result.commodities[0].code).toBe("WTI_USD");
    });

    it("should handle empty commodities list", async () => {
      const mockResponse: CommoditiesResponse = {
        commodities: [],
      };

      vi.spyOn(client as any, "request").mockResolvedValue(mockResponse);

      const result = await client.commodities.list();

      expect(result.commodities).toEqual([]);
    });
  });

  describe("get()", () => {
    it("should fetch a specific commodity by code", async () => {
      const mockCommodity: Commodity = {
        code: "WTI_USD",
        name: "WTI Crude Oil",
        currency: "USD",
        category: "oil",
        unit: "barrel",
        unit_description: "US barrel (42 gallons)",
        description: "West Texas Intermediate crude oil",
        multiplier: 100,
        validation: {
          min: 0,
          max: 200,
        },
        price_change_threshold: 2.5,
      };

      const requestSpy = vi
        .spyOn(client as any, "request")
        .mockResolvedValue(mockCommodity);

      const result = await client.commodities.get("WTI_USD");

      expect(requestSpy).toHaveBeenCalledWith("/v1/commodities/WTI_USD", {});
      expect(result).toEqual(mockCommodity);
      expect(result.code).toBe("WTI_USD");
      expect(result.name).toBe("WTI Crude Oil");
    });

    it("should throw error for empty commodity code", async () => {
      await expect(client.commodities.get("")).rejects.toThrow(
        "Commodity code must be a non-empty string",
      );
    });

    it("should throw error for non-string commodity code", async () => {
      await expect(client.commodities.get(null as any)).rejects.toThrow(
        "Commodity code must be a non-empty string",
      );
      await expect(client.commodities.get(123 as any)).rejects.toThrow(
        "Commodity code must be a non-empty string",
      );
    });
  });

  describe("categories()", () => {
    it("should fetch all categories with commodities", async () => {
      const mockResponse: CategoriesResponse = {
        oil: {
          name: "Oil",
          commodities: [
            {
              code: "WTI_USD",
              name: "WTI Crude Oil",
              currency: "USD",
              category: "oil",
              unit: "barrel",
              multiplier: 100,
            },
            {
              code: "BRENT_CRUDE_USD",
              name: "Brent Crude Oil",
              currency: "USD",
              category: "oil",
              unit: "barrel",
              multiplier: 100,
            },
          ],
        },
        gas: {
          name: "Natural Gas",
          commodities: [
            {
              code: "NATURAL_GAS_USD",
              name: "Natural Gas",
              currency: "USD",
              category: "gas",
              unit: "mmbtu",
              multiplier: 100,
            },
          ],
        },
      };

      const requestSpy = vi
        .spyOn(client as any, "request")
        .mockResolvedValue(mockResponse);

      const result = await client.commodities.categories();

      expect(requestSpy).toHaveBeenCalledWith("/v1/commodities/categories", {});
      expect(result).toEqual(mockResponse);
      expect(result.oil.commodities).toHaveLength(2);
      expect(result.gas.commodities).toHaveLength(1);
      expect(result.oil.name).toBe("Oil");
    });

    it("should handle empty categories", async () => {
      const mockResponse: CategoriesResponse = {};

      vi.spyOn(client as any, "request").mockResolvedValue(mockResponse);

      const result = await client.commodities.categories();

      expect(result).toEqual({});
    });
  });
});
