/**
 * LIVE contract tests for the futures latest endpoints.
 *
 * These hit the REAL authenticated API over the network and verify the
 * futures-path fix (v0.9.1): latest is served from the bare slug path
 * `GET /v1/futures/{slug}` (NO `/latest` suffix, which 404s).
 *
 * Requires a real API key in `process.env.OILPRICEAPI_TEST_KEY`. When the key
 * is absent (offline runs, external forks) the suite is SKIPPED gracefully so
 * it never fails CI for contributors without the secret.
 *
 * The API rate limit is 1 request/second, so live requests are spaced out and
 * the suite keeps to a handful of calls to avoid 429s.
 *
 * Run explicitly with `npm run test:live`.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { OilPriceAPI } from "../../src/client.js";
import type { FuturesPrice } from "../../src/resources/futures.js";

const API_KEY = process.env.OILPRICEAPI_TEST_KEY;

// Skip the entire suite (rather than fail) when no key is available.
const describeLive = API_KEY ? describe : describe.skip;

/** Space requests to respect the 1 req/sec rate limit. */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const RATE_LIMIT_DELAY_MS = 1100;

/**
 * Assert the response looks like a sane futures latest/curve payload.
 * The latest endpoint returns a curve envelope; we look for a front-month
 * price somewhere in the response and sanity-check the number.
 */
function expectSaneFuturesPayload(res: FuturesPrice | Record<string, unknown>) {
  expect(res).toBeDefined();
  expect(typeof res).toBe("object");

  const obj = res as Record<string, unknown>;

  // Pull a representative price from one of the common shapes the latest
  // endpoint can return (front_month, top-level price, or first contract).
  const frontMonth = obj.front_month as Record<string, unknown> | undefined;
  const contracts = obj.contracts as Array<Record<string, unknown>> | undefined;
  const candidate =
    (typeof obj.price === "number" ? obj.price : undefined) ??
    (frontMonth && typeof frontMonth.last_price === "number"
      ? (frontMonth.last_price as number)
      : undefined) ??
    (contracts && contracts.length > 0 && typeof contracts[0].last_price === "number"
      ? (contracts[0].last_price as number)
      : undefined);

  expect(candidate, "expected a numeric price in the futures payload").toBeTypeOf("number");
  // Energy futures trade in a wide but bounded range across commodities.
  expect(candidate as number).toBeGreaterThan(0);
  expect(candidate as number).toBeLessThan(100000);
}

describeLive("LIVE futures latest endpoints (v0.9.1 path fix)", () => {
  let client: OilPriceAPI;

  beforeAll(() => {
    client = new OilPriceAPI({ apiKey: API_KEY as string, retries: 1 });
  });

  it("client.futures.brent().latest() returns 200 + a sane price (GET /v1/futures/ice-brent)", async () => {
    const res = await client.futures.brent().latest();
    expectSaneFuturesPayload(res);
    await sleep(RATE_LIMIT_DELAY_MS);
  });

  it("top-level client.futures.latest('BZ') returns 200 + a sane price", async () => {
    const res = await client.futures.latest("BZ");
    expectSaneFuturesPayload(res);
    await sleep(RATE_LIMIT_DELAY_MS);
  });

  it("top-level client.futures.latest('CL') (WTI) returns 200 + a sane price", async () => {
    const res = await client.futures.latest("CL");
    expectSaneFuturesPayload(res);
  });
});
