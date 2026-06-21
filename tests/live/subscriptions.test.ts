/**
 * LIVE read tests for the #3245 endpoints (market-brief + subscriptions).
 *
 * These hit the REAL authenticated API. They are READ-ONLY (no prod writes):
 * - getMarketBrief(["BRENT_CRUDE_USD"]) → 200 with a numeric price
 * - subscriptions.list() → 200 (an array)
 *
 * Requires a real API key in `process.env.OILPRICEAPI_TEST_KEY`. Absent the key
 * the suite is SKIPPED so it never fails CI for contributors without the secret.
 *
 * The API rate limit is ~1 request/second, so calls are spaced out.
 * Run explicitly with `npm run test:live`.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { OilPriceAPI } from "../../src/client.js";

const API_KEY = process.env.OILPRICEAPI_TEST_KEY;
const describeLive = API_KEY ? describe : describe.skip;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const RATE_LIMIT_DELAY_MS = 1100;

describeLive("LIVE #3245 endpoints (market-brief + subscriptions)", () => {
  let client: OilPriceAPI;

  beforeAll(() => {
    client = new OilPriceAPI({ apiKey: API_KEY as string, retries: 1 });
  });

  it("getMarketBrief(['BRENT_CRUDE_USD']) returns a brief with a numeric price", async () => {
    const brief = await client.getMarketBrief(["BRENT_CRUDE_USD"]);

    expect(brief).toBeDefined();
    expect(Array.isArray(brief.commodities)).toBe(true);
    expect(brief.commodities.length).toBeGreaterThan(0);

    const brent =
      brief.commodities.find((c) => c.code === "BRENT_CRUDE_USD") ?? brief.commodities[0];
    expect(typeof brent.price).toBe("number");
    expect(brent.price).toBeGreaterThan(0);
    expect(brent.price).toBeLessThan(100000);

    await sleep(RATE_LIMIT_DELAY_MS);
  });

  it("subscriptions.list() returns an array (200)", async () => {
    const subs = await client.subscriptions.list();
    expect(Array.isArray(subs)).toBe(true);
    await sleep(RATE_LIMIT_DELAY_MS);
  });
});
