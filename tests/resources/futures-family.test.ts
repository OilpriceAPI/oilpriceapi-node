import { describe, it, expect, beforeEach, vi } from "vitest";
import { OilPriceAPI } from "../../src/client.js";
import {
  FUTURES_CONTRACTS,
  FUTURES_FAMILY_SLUGS,
  FuturesContractFamily,
  resolveFuturesFamilySlug,
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
    it("latest() hits the bare slug path /v1/futures/{slug} (NO /latest suffix)", async () => {
      const spy = vi
        .spyOn(client as any, "request")
        .mockResolvedValue({ contract: "ice-gasoil", price: 800, currency: "USD", timestamp: "t" });

      await client.futures.gasoil().latest();

      // The correct latest endpoint is the bare slug; `/latest` 404s.
      expect(spy).toHaveBeenCalledWith("/v1/futures/ice-gasoil", {});
    });

    it("historical() passes date params", async () => {
      const spy = vi.spyOn(client as any, "request").mockResolvedValue([]);

      await client.futures.brent().historical({
        startDate: "2024-01-01",
        endDate: "2024-01-31",
      });

      // Controller reads from/to, not start_date/end_date.
      expect(spy).toHaveBeenCalledWith("/v1/futures/ice-brent/historical", {
        from: "2024-01-01",
        to: "2024-01-31",
      });
    });

    it("historical() unwraps { prices } envelope", async () => {
      const prices = [{ contract: "ice-brent", price: 1, timestamp: "t" }];
      vi.spyOn(client as any, "request").mockResolvedValue({ prices });

      const result = await client.futures.brent().historical();

      expect(result).toEqual(prices);
    });

    it("ohlc() passes days/interval params (no date param exists)", async () => {
      const spy = vi.spyOn(client as any, "request").mockResolvedValue({});

      await client.futures.wti().ohlc({ days: 30, interval: "1d" });

      expect(spy).toHaveBeenCalledWith("/v1/futures/ice-wti/ohlc", {
        days: "30",
        interval: "1d",
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

  describe("resolveFuturesFamilySlug()", () => {
    it.each([
      ["BZ", "ice-brent"],
      ["CL", "ice-wti"],
      ["G", "ice-gasoil"],
      ["QS", "ice-gasoil"], // Gasoil also trades under the QS ticker prefix
      ["NG", "natural-gas"],
      ["TTF", "ttf-gas"],
      ["JKM", "lng-jkm"],
      ["EUA", "eua-carbon"],
      ["UKA", "uk-carbon"],
    ])("resolves code %s -> %s", (code, slug) => {
      expect(resolveFuturesFamilySlug(code)).toBe(slug);
    });

    it("resolves codes case-insensitively", () => {
      expect(resolveFuturesFamilySlug("bz")).toBe("ice-brent");
      expect(resolveFuturesFamilySlug("qs")).toBe("ice-gasoil");
    });

    it("passes through already-valid family slugs", () => {
      expect(resolveFuturesFamilySlug("ice-brent")).toBe("ice-brent");
      expect(resolveFuturesFamilySlug("ICE-BRENT")).toBe("ice-brent");
    });

    it("returns null for unknown codes/slugs", () => {
      expect(resolveFuturesFamilySlug("ZZZ")).toBeNull();
      expect(resolveFuturesFamilySlug("crude")).toBeNull();
    });
  });

  describe("top-level futures.latest(code) maps code -> /v1/futures/{slug}", () => {
    it.each([
      ["BZ", "ice-brent"],
      ["CL", "ice-wti"],
      ["G", "ice-gasoil"],
      ["QS", "ice-gasoil"],
      ["NG", "natural-gas"],
      ["TTF", "ttf-gas"],
      ["JKM", "lng-jkm"],
      ["EUA", "eua-carbon"],
      ["UKA", "uk-carbon"],
    ])("latest('%s') -> GET /v1/futures/%s (no /latest suffix)", async (code, slug) => {
      const spy = vi
        .spyOn(client as any, "request")
        .mockResolvedValue({ contract: slug, price: 1, currency: "USD", timestamp: "t" });

      await client.futures.latest(code);

      expect(spy).toHaveBeenCalledWith(`/v1/futures/${slug}`, {});
    });

    it("accepts a family slug directly", async () => {
      const spy = vi
        .spyOn(client as any, "request")
        .mockResolvedValue({ contract: "ice-wti", price: 1, currency: "USD", timestamp: "t" });

      await client.futures.latest("ice-wti");

      expect(spy).toHaveBeenCalledWith("/v1/futures/ice-wti", {});
    });

    it("throws ValidationError for an unknown contract", async () => {
      await expect(client.futures.latest("NOPE")).rejects.toThrow(/Unknown futures contract/);
    });

    it("throws ValidationError for an empty contract", async () => {
      await expect(client.futures.latest("")).rejects.toThrow(
        "Contract symbol must be a non-empty string",
      );
    });
  });
});
