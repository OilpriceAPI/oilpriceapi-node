import { describe, it, expect, beforeEach, vi } from "vitest";
import { OilPriceAPI } from "../../src/client.js";

describe("BunkerFuelsResource", () => {
  let client: OilPriceAPI;

  beforeEach(() => {
    client = new OilPriceAPI({ apiKey: "test_key_123" });
    vi.clearAllMocks();
  });

  describe("port()", () => {
    it("should fetch bunker prices for a port", async () => {
      const mockData = {
        port: "SIN",
        port_name: "Singapore",
        timestamp: "2024-01-15T00:00:00Z",
        prices: {
          VLSFO: 650,
          MGO: 750,
        },
        currency: "USD",
        unit: "MT",
      };

      const requestSpy = vi
        .spyOn(client as any, "request")
        .mockResolvedValue(mockData);

      const result = await client.bunkerFuels.port("SIN");

      expect(requestSpy).toHaveBeenCalledWith("/v1/bunker-fuels/ports/SIN", {});
      expect(result.port).toBe("SIN");
    });

    it("should throw error for empty port code", async () => {
      await expect(client.bunkerFuels.port("")).rejects.toThrow(
        "Port code must be a non-empty string",
      );
    });
  });

  describe("compare()", () => {
    it("should compare prices across ports", async () => {
      const mockData = {
        fuel_type: "VLSFO",
        timestamp: "2024-01-15T00:00:00Z",
        ports: [
          { port: "SIN", port_name: "Singapore", price: 650, rank: 1 },
          { port: "RTM", port_name: "Rotterdam", price: 680, rank: 2 },
        ],
        currency: "USD",
        unit: "MT",
      };

      const requestSpy = vi
        .spyOn(client as any, "request")
        .mockResolvedValue(mockData);

      const result = await client.bunkerFuels.compare(["SIN", "RTM"]);

      expect(requestSpy).toHaveBeenCalledWith("/v1/bunker-fuels/compare", {
        ports: "SIN,RTM",
      });
      expect(result.ports).toHaveLength(2);
    });
  });
});
