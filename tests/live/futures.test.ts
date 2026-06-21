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
import type { FuturesCurveData, FuturesPrice } from "../../src/resources/futures.js";

const API_KEY = process.env.OILPRICEAPI_TEST_KEY;

// Skip the entire suite (rather than fail) when no key is available.
const describeLive = API_KEY ? describe : describe.skip;

/** Space requests to respect the 1 req/sec rate limit. */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const RATE_LIMIT_DELAY_MS = 1100;

/**
 * Assert the latest payload is the real TOP-LEVEL futures response shape.
 *
 * `GET /v1/futures/{slug}` returns a top-level object (NO `{ status, data }`
 * envelope). The latest price lives at `front_month.last_price`, with the full
 * term structure in `contracts[]`. We require a numeric front-month price in a
 * sane range, and fall back to the first contract / a legacy flat `price` for
 * resilience.
 */
function expectSaneFuturesPayload(res: FuturesPrice | Record<string, unknown>) {
  expect(res).toBeDefined();
  expect(typeof res).toBe("object");

  const obj = res as Record<string, unknown>;

  // Primary contract: front_month.last_price (the documented latest price).
  const frontMonth = obj.front_month as Record<string, unknown> | undefined;
  const contracts = obj.contracts as Array<Record<string, unknown>> | undefined;
  const candidate =
    (frontMonth && typeof frontMonth.last_price === "number"
      ? (frontMonth.last_price as number)
      : undefined) ??
    (contracts && contracts.length > 0 && typeof contracts[0].last_price === "number"
      ? (contracts[0].last_price as number)
      : undefined) ??
    (typeof obj.price === "number" ? obj.price : undefined);

  expect(candidate, "expected a numeric front_month.last_price in the futures payload").toBeTypeOf(
    "number",
  );
  // Energy futures trade in a wide but bounded range across commodities.
  expect(candidate as number).toBeGreaterThan(0);
  expect(candidate as number).toBeLessThan(100000);
}

/**
 * Assert the curve payload is EITHER real curve data OR the documented
 * no-data response. `GET /v1/futures/{slug}/curve` can legitimately return
 * `{ error: "No futures data available for curve analysis", date: "..." }`
 * when no curve can be built — that is a valid state, not a failure.
 */
function expectSaneCurveOrNoData(res: FuturesCurveData | Record<string, unknown>) {
  expect(res).toBeDefined();
  expect(typeof res).toBe("object");

  const obj = res as Record<string, unknown>;

  // No-data state: accept the documented error response without failing.
  if (typeof obj.error === "string") {
    expect(obj.error).toMatch(/no futures data available/i);
    return;
  }

  // Otherwise we expect real curve data: an array of points with prices.
  const curve = obj.curve as Array<Record<string, unknown>> | undefined;
  expect(Array.isArray(curve), "expected a `curve` array when not a no-data response").toBe(true);
  if (curve && curve.length > 0) {
    const point = curve[0];
    const price =
      typeof point.price === "number"
        ? point.price
        : typeof point.last_price === "number"
          ? (point.last_price as number)
          : undefined;
    expect(price, "expected a numeric price in the first curve point").toBeTypeOf("number");
    expect(price as number).toBeGreaterThan(0);
    expect(price as number).toBeLessThan(100000);
  }
}

describeLive("LIVE futures latest endpoints (v0.9.1 path fix)", () => {
  let client: OilPriceAPI;

  beforeAll(() => {
    client = new OilPriceAPI({ apiKey: API_KEY as string, retries: 1 });
  });

  it("client.futures.brent().latest() returns the top-level response with front_month.last_price (GET /v1/futures/ice-brent)", async () => {
    const res = await client.futures.brent().latest();
    expectSaneFuturesPayload(res);
    await sleep(RATE_LIMIT_DELAY_MS);
  });

  it("client.futures.brent().curve() returns curve data OR the documented no-data response (tolerant)", async () => {
    const res = await client.futures.brent().curve();
    expectSaneCurveOrNoData(res);
    await sleep(RATE_LIMIT_DELAY_MS);
  });

  // Note: the shared CI test key is rate-limited to ~1 req/sec. We keep the live
  // suite to 2 spaced calls (brent latest + curve) to stay reliable; the top-level
  // latest() + code→slug mapping (e.g. 'CL'→ice-wti) is covered by unit tests in
  // tests/resources/futures.test.ts. Adding a 3rd live call here intermittently
  // trips the rate limit (the SDK's retry-on-429 then times out the test).
});
