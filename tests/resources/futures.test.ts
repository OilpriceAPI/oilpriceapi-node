import { describe, it, expect, beforeEach, vi } from "vitest";
import { OilPriceAPI } from "../../src/client.js";
import type {
  FuturesPrice,
  HistoricalFuturesPrice,
  FuturesOHLC,
  IntradayFuturesData,
  FuturesSpread,
  FuturesCurveData,
  ContinuousFuturesData,
} from "../../src/resources/futures.js";

describe("FuturesResource", () => {
  let client: OilPriceAPI;

  beforeEach(() => {
    client = new OilPriceAPI({ apiKey: "test_key_123" });
    vi.clearAllMocks();
  });

  describe("latest()", () => {
    it("should fetch latest futures price", async () => {
      const mockPrice: FuturesPrice = {
        contract: "CL.1",
        price: 75.5,
        formatted: "$75.50",
        currency: "USD",
        expiration: "2024-03-20",
        timestamp: "2024-01-15T10:00:00Z",
      };

      const requestSpy = vi
        .spyOn(client as any, "request")
        .mockResolvedValue(mockPrice);

      const result = await client.futures.latest("CL.1");

      expect(requestSpy).toHaveBeenCalledWith("/v1/futures/CL.1", {});
      expect(result).toEqual(mockPrice);
      expect(result.contract).toBe("CL.1");
      expect(result.price).toBe(75.5);
    });

    it("should throw error for empty contract", async () => {
      await expect(client.futures.latest("")).rejects.toThrow(
        "Contract symbol must be a non-empty string",
      );
    });

    it("should throw error for non-string contract", async () => {
      await expect(client.futures.latest(null as any)).rejects.toThrow(
        "Contract symbol must be a non-empty string",
      );
    });
  });

  describe("historical()", () => {
    it("should fetch historical prices without date filters", async () => {
      const mockPrices: HistoricalFuturesPrice[] = [
        {
          contract: "CL.1",
          price: 75.5,
          timestamp: "2024-01-15T10:00:00Z",
          volume: 100000,
          open_interest: 250000,
        },
        {
          contract: "CL.1",
          price: 75.75,
          timestamp: "2024-01-16T10:00:00Z",
          volume: 110000,
        },
      ];

      const requestSpy = vi
        .spyOn(client as any, "request")
        .mockResolvedValue(mockPrices);

      const result = await client.futures.historical("CL.1");

      expect(requestSpy).toHaveBeenCalledWith(
        "/v1/futures/CL.1/historical",
        {},
      );
      expect(result).toEqual(mockPrices);
      expect(result).toHaveLength(2);
    });

    it("should fetch historical prices with date filters", async () => {
      const mockPrices: HistoricalFuturesPrice[] = [];

      const requestSpy = vi
        .spyOn(client as any, "request")
        .mockResolvedValue(mockPrices);

      await client.futures.historical("CL.1", {
        startDate: "2024-01-01",
        endDate: "2024-01-31",
      });

      expect(requestSpy).toHaveBeenCalledWith("/v1/futures/CL.1/historical", {
        start_date: "2024-01-01",
        end_date: "2024-01-31",
      });
    });

    it("should handle response wrapped in prices property", async () => {
      const mockPrices: HistoricalFuturesPrice[] = [
        { contract: "CL.1", price: 75.5, timestamp: "2024-01-15T10:00:00Z" },
      ];

      vi.spyOn(client as any, "request").mockResolvedValue({
        prices: mockPrices,
      });

      const result = await client.futures.historical("CL.1");

      expect(result).toEqual(mockPrices);
    });
  });

  describe("ohlc()", () => {
    it("should fetch OHLC data without date", async () => {
      const mockOHLC: FuturesOHLC = {
        contract: "CL.1",
        date: "2024-01-15",
        open: 75.0,
        high: 76.5,
        low: 74.5,
        close: 75.75,
        volume: 150000,
        open_interest: 250000,
      };

      const requestSpy = vi
        .spyOn(client as any, "request")
        .mockResolvedValue(mockOHLC);

      const result = await client.futures.ohlc("CL.1");

      expect(requestSpy).toHaveBeenCalledWith("/v1/futures/CL.1/ohlc", {});
      expect(result).toEqual(mockOHLC);
    });

    it("should fetch OHLC data with specific date", async () => {
      const mockOHLC: FuturesOHLC = {
        contract: "CL.1",
        date: "2024-01-15",
        open: 75.0,
        high: 76.5,
        low: 74.5,
        close: 75.75,
      };

      const requestSpy = vi
        .spyOn(client as any, "request")
        .mockResolvedValue(mockOHLC);

      await client.futures.ohlc("CL.1", "2024-01-15");

      expect(requestSpy).toHaveBeenCalledWith("/v1/futures/CL.1/ohlc", {
        date: "2024-01-15",
      });
    });
  });

  describe("intraday()", () => {
    it("should fetch intraday price data", async () => {
      const mockData: IntradayFuturesData = {
        contract: "CL.1",
        date: "2024-01-15",
        prices: [
          { time: "09:30", price: 75.0, volume: 5000 },
          { time: "10:00", price: 75.25, volume: 6000 },
          { time: "10:30", price: 75.5 },
        ],
      };

      const requestSpy = vi
        .spyOn(client as any, "request")
        .mockResolvedValue(mockData);

      const result = await client.futures.intraday("CL.1");

      expect(requestSpy).toHaveBeenCalledWith("/v1/futures/CL.1/intraday", {});
      expect(result).toEqual(mockData);
      expect(result.prices).toHaveLength(3);
    });

    it("should throw error for empty contract", async () => {
      await expect(client.futures.intraday("")).rejects.toThrow(
        "Contract symbol must be a non-empty string",
      );
    });
  });

  describe("spreads()", () => {
    it("should calculate spread between two contracts", async () => {
      const mockSpread: FuturesSpread = {
        contract1: "CL.1",
        contract2: "CL.2",
        spread: 0.5,
        spread_percent: 0.66,
        timestamp: "2024-01-15T10:00:00Z",
      };

      const requestSpy = vi
        .spyOn(client as any, "request")
        .mockResolvedValue(mockSpread);

      const result = await client.futures.spreads("CL.1", "CL.2");

      expect(requestSpy).toHaveBeenCalledWith("/v1/futures/spreads", {
        contract1: "CL.1",
        contract2: "CL.2",
      });
      expect(result).toEqual(mockSpread);
    });

    it("should throw error for empty first contract", async () => {
      await expect(client.futures.spreads("", "CL.2")).rejects.toThrow(
        "First contract symbol must be a non-empty string",
      );
    });

    it("should throw error for empty second contract", async () => {
      await expect(client.futures.spreads("CL.1", "")).rejects.toThrow(
        "Second contract symbol must be a non-empty string",
      );
    });
  });

  describe("curve()", () => {
    it("should fetch futures curve", async () => {
      const mockCurve: FuturesCurveData = {
        contract: "CL",
        timestamp: "2024-01-15T10:00:00Z",
        curve: [
          {
            expiration: "2024-02-20",
            months_out: 1,
            price: 75.5,
            contract: "CL.1",
          },
          {
            expiration: "2024-03-20",
            months_out: 2,
            price: 75.75,
            contract: "CL.2",
          },
          {
            expiration: "2024-04-20",
            months_out: 3,
            price: 76.0,
            contract: "CL.3",
          },
        ],
      };

      const requestSpy = vi
        .spyOn(client as any, "request")
        .mockResolvedValue(mockCurve);

      const result = await client.futures.curve("CL");

      expect(requestSpy).toHaveBeenCalledWith("/v1/futures/CL/curve", {});
      expect(result).toEqual(mockCurve);
      expect(result.curve).toHaveLength(3);
    });

    it("should throw error for empty contract", async () => {
      await expect(client.futures.curve("")).rejects.toThrow(
        "Contract symbol must be a non-empty string",
      );
    });
  });

  describe("continuous()", () => {
    it("should fetch continuous contract without months parameter", async () => {
      const mockData: ContinuousFuturesData = {
        contract: "CL",
        months: 1,
        prices: [
          { date: "2024-01-01", price: 75.0, active_contract: "CL.1" },
          { date: "2024-01-02", price: 75.25, active_contract: "CL.1" },
        ],
      };

      const requestSpy = vi
        .spyOn(client as any, "request")
        .mockResolvedValue(mockData);

      const result = await client.futures.continuous("CL");

      expect(requestSpy).toHaveBeenCalledWith("/v1/futures/CL/continuous", {});
      expect(result).toEqual(mockData);
    });

    it("should fetch continuous contract with months parameter", async () => {
      const mockData: ContinuousFuturesData = {
        contract: "CL",
        months: 2,
        prices: [],
      };

      const requestSpy = vi
        .spyOn(client as any, "request")
        .mockResolvedValue(mockData);

      await client.futures.continuous("CL", 2);

      expect(requestSpy).toHaveBeenCalledWith("/v1/futures/CL/continuous", {
        months: "2",
      });
    });

    it("should throw error for empty contract", async () => {
      await expect(client.futures.continuous("")).rejects.toThrow(
        "Contract symbol must be a non-empty string",
      );
    });
  });
});
