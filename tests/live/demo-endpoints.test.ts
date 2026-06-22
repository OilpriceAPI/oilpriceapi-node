/**
 * LIVE contract tests for the public, no-auth demo endpoints.
 *
 * These hit the real API over the network:
 *   - GET https://api.oilpriceapi.com/v1/demo/prices
 *   - GET https://api.oilpriceapi.com/v1/demo/commodities
 *
 * They validate that the client parses the real wire envelope
 * (`{ status, data: { prices|commodities, meta } }`) correctly.
 *
 * Excluded from the default `npm test` run (see vitest.config.ts) so offline
 * unit runs are not affected. Run explicitly with `npm run test:live`.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { OilPriceAPI } from "../../src/client.js";
import { sleep, RATE_LIMIT_DELAY_MS, skipIfRateLimited } from "./helpers.js";

describe("LIVE demo endpoints", () => {
  let client: OilPriceAPI;

  beforeAll(() => {
    // The demo endpoints ignore auth, but the constructor still requires a key.
    // Any placeholder works — the demo path does not send/validate it meaningfully.
    client = new OilPriceAPI({ apiKey: "demo", retries: 1 });
  });

  it("getDemoPrices() parses the real prices envelope", async (ctx) => {
    try {
      const res = await client.getDemoPrices();

      expect(Array.isArray(res.prices)).toBe(true);
      // The demo tier exposes a fixed set of free commodities (currently 9).
      expect(res.prices.length).toBeGreaterThanOrEqual(5);

      const brent = res.prices.find((p) => p.code === "BRENT_CRUDE_USD");
      expect(brent, "BRENT_CRUDE_USD should be in the demo prices").toBeDefined();
      expect(typeof brent!.price).toBe("number");
      // Sanity range check — Brent has traded ~$60-$120/bbl historically.
      expect(brent!.price).toBeGreaterThan(20);
      expect(brent!.price).toBeLessThan(300);

      expect(res.meta).toBeDefined();
      expect(res.meta.demo_mode).toBe(true);
    } catch (e) {
      skipIfRateLimited(e, ctx);
    } finally {
      await sleep(RATE_LIMIT_DELAY_MS);
    }
  });

  it("getDemoCommodities() parses the real commodities envelope", async (ctx) => {
    try {
      const res = await client.getDemoCommodities();

      // commodities is grouped by category key -> array of commodity metadata.
      expect(res.commodities).toBeDefined();
      expect(typeof res.commodities).toBe("object");
      expect(Object.keys(res.commodities).length).toBeGreaterThan(0);

      expect(res.meta).toBeDefined();
      // Hundreds of commodities are catalogued (442 at time of writing).
      expect(res.meta.total).toBeGreaterThan(100);
      expect(Array.isArray(res.meta.free_commodities)).toBe(true);
      expect(res.meta.free_commodities).toContain("BRENT_CRUDE_USD");
      expect(res.meta.free_commodities).toContain("WTI_USD");
    } catch (e) {
      skipIfRateLimited(e, ctx);
    } finally {
      await sleep(RATE_LIMIT_DELAY_MS);
    }
  });
});
