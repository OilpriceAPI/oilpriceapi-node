import { describe, it, expect, beforeEach, vi } from "vitest";
import { OilPriceAPI } from "../../src/client.js";

/**
 * Mock payloads mirror the backend V1::BunkerFuelsController responses AFTER
 * the client strips the outer `{ data: ... }` envelope — i.e. what the
 * private `request()` resolves to.
 */

const sinPortInfo = {
  code: "SIN",
  name: "Singapore",
  country: "Singapore",
  timezone: "Asia/Singapore",
  volume_rank: 1,
};

const rtmPortInfo = {
  code: "RTM",
  name: "Rotterdam",
  country: "Netherlands",
  timezone: "Europe/Amsterdam",
  volume_rank: 2,
};

// The API returns port prices as an ARRAY of per-grade entries (issue #29),
// not a `{ VLSFO: number }` keyed object.
const sinPriceEntries = [
  {
    grade: "VLSFO",
    grade_name: "Very Low Sulfur Fuel Oil",
    price: 650.5,
    currency: "USD",
    unit: "MT",
    change_24h: -2.25,
    change_pct_24h: -0.35,
    supplier_count: 12,
    availability: "Good",
    last_updated: "2024-01-15T00:00:00Z",
  },
  {
    grade: "MGO",
    grade_name: "Marine Gas Oil",
    price: 748.0,
    currency: "USD",
    unit: "MT",
    change_24h: null,
    change_pct_24h: null,
    supplier_count: 8,
    availability: "Good",
    last_updated: "2024-01-15T00:00:00Z",
  },
];

const metadata = {
  request_id: "abc123def456",
  timestamp: "2024-01-15T00:05:00Z",
  cache_ttl: 300,
  data_source: "Ship & Bunker",
  currency: "USD",
  unit: "metric_ton",
};

describe("BunkerFuelsResource", () => {
  let client: OilPriceAPI;

  beforeEach(() => {
    client = new OilPriceAPI({ apiKey: "test_key_123" });
    vi.clearAllMocks();
  });

  describe("port()", () => {
    it("should fetch bunker prices for a port with prices as an ARRAY of grade entries", async () => {
      const mockData = {
        port: sinPortInfo,
        prices: sinPriceEntries,
        spreads: {
          to_rtm: { vlsfo: { value: 29.5, percentage: 4.54 } },
          vlsfo_hsfo_spread: {
            value: 85.0,
            percentage: 15.03,
            scrubber_benefit_daily: 2125.0,
          },
        },
        metadata,
      };

      const requestSpy = vi.spyOn(client as any, "request").mockResolvedValue(mockData);

      const result = await client.bunkerFuels.port("SIN");

      expect(requestSpy).toHaveBeenCalledWith("/v1/bunker-fuels/ports/SIN", {});

      // port is an info object, not a string
      expect(result.port.code).toBe("SIN");
      expect(result.port.name).toBe("Singapore");

      // prices is an array (the #29 fix)
      expect(Array.isArray(result.prices)).toBe(true);
      expect(result.prices).toHaveLength(2);

      const vlsfo = result.prices.find((p) => p.grade === "VLSFO");
      expect(vlsfo?.price).toBe(650.5);
      expect(vlsfo?.grade_name).toBe("Very Low Sulfur Fuel Oil");
      expect(vlsfo?.unit).toBe("MT");
      expect(vlsfo?.change_24h).toBe(-2.25);

      // change fields are null when the API has no prior-day data
      const mgo = result.prices.find((p) => p.grade === "MGO");
      expect(mgo?.change_24h).toBeNull();
      expect(mgo?.change_pct_24h).toBeNull();

      expect(result.metadata.cache_ttl).toBe(300);
    });

    it("should throw error for empty port code", async () => {
      await expect(client.bunkerFuels.port("")).rejects.toThrow(
        "Port code must be a non-empty string",
      );
    });
  });

  describe("all()", () => {
    it("should return ports keyed by port code, each with an array of grade prices", async () => {
      const mockData = {
        ports: {
          SIN: { port: sinPortInfo, prices: sinPriceEntries },
          RTM: { port: rtmPortInfo, prices: [{ ...sinPriceEntries[0], price: 680.0 }] },
        },
        metadata: { ...metadata, port_count: 2 },
      };

      const requestSpy = vi.spyOn(client as any, "request").mockResolvedValue(mockData);

      const result = await client.bunkerFuels.all();

      expect(requestSpy).toHaveBeenCalledWith("/v1/bunker-fuels/all", {});
      expect(Object.keys(result.ports)).toEqual(["SIN", "RTM"]);
      expect(Array.isArray(result.ports.SIN.prices)).toBe(true);
      expect(result.ports.SIN.prices[0].grade).toBe("VLSFO");
      expect(result.ports.RTM.port.name).toBe("Rotterdam");
    });
  });

  describe("compare()", () => {
    it("should compare prices across ports (comparison keyed by port code)", async () => {
      const mockData = {
        comparison: {
          SIN: { port: sinPortInfo, prices: sinPriceEntries },
          RTM: { port: rtmPortInfo, prices: [{ ...sinPriceEntries[0], price: 680.0 }] },
        },
        spreads: {
          SIN_RTM: { vlsfo: { value: 29.5, percentage: 4.54 } },
        },
        metadata,
      };

      const requestSpy = vi.spyOn(client as any, "request").mockResolvedValue(mockData);

      const result = await client.bunkerFuels.compare(["SIN", "RTM"]);

      expect(requestSpy).toHaveBeenCalledWith("/v1/bunker-fuels/compare", {
        ports: "SIN,RTM",
      });
      expect(Object.keys(result.comparison)).toHaveLength(2);
      expect(result.comparison.SIN.prices[0].price).toBe(650.5);
      expect(result.comparison.RTM.prices[0].price).toBe(680.0);
    });

    it("should throw error for empty ports array", async () => {
      await expect(client.bunkerFuels.compare([])).rejects.toThrow(
        "Ports must be a non-empty array of port codes",
      );
    });
  });

  describe("spreads()", () => {
    it("should fetch a graded port-to-port spread", async () => {
      const mockData = {
        from_port: sinPortInfo,
        to_port: rtmPortInfo,
        fuel_grade: "VLSFO",
        spreads: {
          value: 29.5,
          percentage: 4.54,
          from_price: 650.5,
          to_price: 680.0,
          arbitrage_opportunity: "Yes (>$29.5/MT)",
        },
        metadata,
      };

      const requestSpy = vi.spyOn(client as any, "request").mockResolvedValue(mockData);

      const result = await client.bunkerFuels.spreads({
        from: "SIN",
        to: "RTM",
        grade: "VLSFO",
      });

      expect(requestSpy).toHaveBeenCalledWith("/v1/bunker-fuels/spreads/ports", {
        from: "SIN",
        to: "RTM",
        grade: "VLSFO",
      });
      expect(result.from_port.code).toBe("SIN");
      expect(result.fuel_grade).toBe("VLSFO");
      expect((result.spreads as { value: number }).value).toBe(29.5);
    });

    it("should throw when from/to missing", async () => {
      await expect(client.bunkerFuels.spreads({ from: "SIN" } as any)).rejects.toThrow(
        "Both 'from' and 'to' port codes are required",
      );
    });
  });

  describe("historical()", () => {
    it("should return port info, historical_data array and period", async () => {
      const mockData = {
        port: sinPortInfo,
        historical_data: [
          {
            timestamp: "2024-01-15T00:00:00Z",
            code: "VLSFO_SIN",
            average_value: 65050.0,
            interval_type: "daily",
          },
          {
            timestamp: "2024-01-14T00:00:00Z",
            code: "VLSFO_SIN",
            average_value: 65275.0,
            interval_type: "daily",
          },
        ],
        period: { from: "2024-01-01T00:00:00Z", to: "2024-01-15T00:00:00Z", interval: "daily" },
        metadata,
      };

      const requestSpy = vi.spyOn(client as any, "request").mockResolvedValue(mockData);

      const result = await client.bunkerFuels.historical("SIN", {
        startDate: "2024-01-01",
        endDate: "2024-01-15",
      });

      expect(requestSpy).toHaveBeenCalledWith("/v1/bunker-fuels/historical/SIN", {
        from: "2024-01-01",
        to: "2024-01-15",
      });
      expect(result.port.code).toBe("SIN");
      expect(result.historical_data).toHaveLength(2);
      expect(result.historical_data[0].code).toBe("VLSFO_SIN");
      expect(result.period.interval).toBe("daily");
    });

    it("should throw error for empty port code", async () => {
      await expect(client.bunkerFuels.historical("")).rejects.toThrow(
        "Port code must be a non-empty string",
      );
    });
  });

  describe("export()", () => {
    it("should return an array of export rows", async () => {
      const mockData = [
        {
          timestamp: "2024-01-15T00:00:00Z",
          port_code: "SIN",
          port_name: "Singapore",
          fuel_grade: "VLSFO",
          price_usd_mt: 650.5,
          supplier_count: 12,
          availability: "Good",
        },
      ];

      const requestSpy = vi.spyOn(client as any, "request").mockResolvedValue(mockData);

      const result = await client.bunkerFuels.export("json");

      expect(requestSpy).toHaveBeenCalledWith("/v1/bunker-fuels/export", { format: "json" });
      expect(result).toHaveLength(1);
      expect(result[0].price_usd_mt).toBe(650.5);
    });
  });
});
