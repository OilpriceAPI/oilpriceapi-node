import { describe, it, expect, beforeEach, vi } from "vitest";
import { OilPriceAPI } from "../../src/client.js";
import {
  FUTURES_CONTRACTS,
  FUTURES_FAMILY_SLUGS,
  FuturesContractFamily,
} from "../../src/resources/futures.js";

/**
 * Typed futures contract-family helper tests (issue #1).
 *
 * Verifies ergonomic ICE Brent / Gasoil / WTI and gas/carbon family helpers
 * reach the correct endpoints.
 */
describe("Futures contract families (issue #1)", () => {
  let client: OilPriceAPI;

  beforeEach(() => {
    client = new OilPriceAPI({ apiKey: "test_key_123" });
    vi.clearAllMocks();
  });

  describe("FUTURES_CONTRACTS constants", () => {
    it("exposes ICE Brent, WTI and Gasoil codes", () => {
      expect(FUTURES_CONTRACTS.BRENT).toBe("BZ");
      expect(FUTURES_CONTRACTS.WTI).toBe("CL");
      expect(FUTURES_CONTRACTS.GASOIL).toBe("G");
    });

    it("maps codes to family slugs", () => {
      expect(FUTURES_FAMILY_SLUGS[FUTURES_CONTRACTS.BRENT]).toBe("ice-brent");
      expect(FUTURES_FAMILY_SLUGS[FUTURES_CONTRACTS.GASOIL]).toBe("ice-gasoil");
      expect(FUTURES_FAMILY_SLUGS[FUTURES_CONTRACTS.TTF_GAS]).toBe("ttf-gas");
      expect(FUTURES_FAMILY_SLUGS[FUTURES_CONTRACTS.EUA_CARBON]).toBe("eua-carbon");
    });
  });

  describe("family() factory", () => {
    it("returns a FuturesContractFamily bound to the slug", () => {
      const fam = client.futures.family("ice-brent");
      expect(fam).toBeInstanceOf(FuturesContractFamily);
      expect(fam.slug).toBe("ice-brent");
    });

    it("throws for empty slug", () => {
      expect(() => client.futures.family("" as any)).toThrow(
        "Contract family slug must be a non-empty string",
      );
    });
  });

  describe("named family helpers map to correct slugs", () => {
    it.each([
      ["brent", "ice-brent"],
      ["wti", "ice-wti"],
      ["gasoil", "ice-gasoil"],
      ["naturalGas", "natural-gas"],
      ["ttfGas", "ttf-gas"],
      ["lngJkm", "lng-jkm"],
      ["euaCarbon", "eua-carbon"],
      ["ukCarbon", "uk-carbon"],
    ])("futures.%s() -> %s", (method, slug) => {
      const fam = (client.futures as any)[method]();
      expect(fam.slug).toBe(slug);
    });
  });

  describe("family endpoint coverage", () => {
    it("latest() hits /v1/futures/{slug}/latest", async () => {
      const spy = vi
        .spyOn(client as any, "request")
        .mockResolvedValue({ contract: "ice-gasoil", price: 800, currency: "USD", timestamp: "t" });

      await client.futures.gasoil().latest();

      expect(spy).toHaveBeenCalledWith("/v1/futures/ice-gasoil/latest", {});
    });

    it("historical() passes date params", async () => {
      const spy = vi.spyOn(client as any, "request").mockResolvedValue([]);

      await client.futures.brent().historical({
        startDate: "2024-01-01",
        endDate: "2024-01-31",
      });

      expect(spy).toHaveBeenCalledWith("/v1/futures/ice-brent/historical", {
        start_date: "2024-01-01",
        end_date: "2024-01-31",
      });
    });

    it("historical() unwraps { prices } envelope", async () => {
      const prices = [{ contract: "ice-brent", price: 1, timestamp: "t" }];
      vi.spyOn(client as any, "request").mockResolvedValue({ prices });

      const result = await client.futures.brent().historical();

      expect(result).toEqual(prices);
    });

    it("ohlc() passes date param", async () => {
      const spy = vi.spyOn(client as any, "request").mockResolvedValue({});

      await client.futures.wti().ohlc("2024-01-15");

      expect(spy).toHaveBeenCalledWith("/v1/futures/ice-wti/ohlc", {
        date: "2024-01-15",
      });
    });

    it("intraday() hits /intraday", async () => {
      const spy = vi.spyOn(client as any, "request").mockResolvedValue({});
      await client.futures.naturalGas().intraday();
      expect(spy).toHaveBeenCalledWith("/v1/futures/natural-gas/intraday", {});
    });

    it("spreads() hits /spreads and unwraps { data }", async () => {
      const data = [{ contract1: "a", contract2: "b", spread: 1, timestamp: "t" }];
      const spy = vi.spyOn(client as any, "request").mockResolvedValue({ data });

      const result = await client.futures.ttfGas().spreads();

      expect(spy).toHaveBeenCalledWith("/v1/futures/ttf-gas/spreads", {});
      expect(result).toEqual(data);
    });

    it("curve() hits /curve", async () => {
      const spy = vi.spyOn(client as any, "request").mockResolvedValue({});
      await client.futures.lngJkm().curve();
      expect(spy).toHaveBeenCalledWith("/v1/futures/lng-jkm/curve", {});
    });

    it("spreadHistory() hits /spread-history", async () => {
      const spy = vi.spyOn(client as any, "request").mockResolvedValue({});
      await client.futures.euaCarbon().spreadHistory();
      expect(spy).toHaveBeenCalledWith("/v1/futures/eua-carbon/spread-history", {});
    });
  });
});
