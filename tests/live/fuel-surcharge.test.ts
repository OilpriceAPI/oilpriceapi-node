/**
 * LIVE read-only smoke for `client.fuelSurcharge` (#79).
 *
 * Hits the REAL authenticated API with GETs only; nothing is written. Every
 * fuel-surcharge route is available on every plan, so a 403 here is a defect,
 * not an entitlement boundary.
 *
 * Requires `process.env.OILPRICEAPI_TEST_KEY`; the suite is SKIPPED without it.
 * Calls are spaced to respect the ~1 request/second limit on the shared key.
 * Run explicitly with `npm run test:live`.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { OilPriceAPI } from "../../src/client.js";
import { NotFoundError, ValidationError } from "../../src/errors.js";
import { sleep, RATE_LIMIT_DELAY_MS, skipIfRateLimited } from "./helpers.js";

const API_KEY = process.env.OILPRICEAPI_TEST_KEY;
const describeLive = API_KEY ? describe : describe.skip;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

describeLive("LIVE #79 fuel surcharges", () => {
  let client: OilPriceAPI;

  beforeAll(() => {
    client = new OilPriceAPI({ apiKey: API_KEY as string, retries: 1 });
  });

  const live = (name: string, fn: () => Promise<void>) =>
    it(name, async (ctx) => {
      try {
        await fn();
      } catch (e) {
        skipIfRateLimited(e, ctx);
      } finally {
        await sleep(RATE_LIMIT_DELAY_MS);
      }
    });

  live("ltl.list() returns rates with effective dates and provenance", async () => {
    const rates = await client.fuelSurcharge.ltl.list();
    expect(rates.length).toBeGreaterThan(0);
    for (const rate of rates) {
      expect(rate.mode).toBe("ltl");
      expect(typeof rate.surcharge_percent).toBe("number");
      expect(rate.effective_date).toMatch(ISO_DATE);
      expect(rate.source).toMatch(/^https:\/\//);
      expect(Number.isNaN(Date.parse(rate.retrieved_at))).toBe(false);
    }
  });

  live("ltl.latest() and ltl.history() agree for one carrier", async () => {
    const [first] = await client.fuelSurcharge.ltl.list();
    await sleep(RATE_LIMIT_DELAY_MS);
    const latest = await client.fuelSurcharge.ltl.latest(first.carrier);
    await sleep(RATE_LIMIT_DELAY_MS);
    const page = await client.fuelSurcharge.ltl.history(first.carrier, { perPage: 2 });

    expect(latest.carrier).toBe(first.carrier);
    expect(page.history.length).toBeGreaterThan(0);
    expect(page.history.length).toBeLessThanOrEqual(2);
    expect(page.meta.total_count).toBeGreaterThanOrEqual(page.history.length);
    expect(page.history[0].effective_date).toBe(latest.effective_date);
  });

  live("an unknown LTL carrier is a NotFoundError naming the covered carriers", async () => {
    const error = await client.fuelSurcharge.ltl.latest("not-a-carrier").catch((e) => e);
    expect(error).toBeInstanceOf(NotFoundError);
    expect(Array.isArray(error.rawBody?.data?.covered_carriers)).toBe(true);
  });

  live("parcel.list(), latest() by service level, and history()", async () => {
    const carriers = await client.fuelSurcharge.parcel.list();
    expect(carriers.length).toBeGreaterThan(0);
    const carrier = carriers[0];
    const level = carrier.service_levels[0].service_level;
    await sleep(RATE_LIMIT_DELAY_MS);

    const one = await client.fuelSurcharge.parcel.latest(carrier.carrier, { serviceLevel: level });
    expect(one.service_level).toBe(level);
    expect(one.effective_date).toMatch(ISO_DATE);
    await sleep(RATE_LIMIT_DELAY_MS);

    const page = await client.fuelSurcharge.parcel.history(carrier.carrier, {
      serviceLevel: level,
      perPage: 2,
    });
    expect(page.history.every((row) => row.service_level === level)).toBe(true);
    expect(page.meta.total_count).toBeGreaterThanOrEqual(page.history.length);
  });

  it("parcel.history() without a service level fails before sending", async () => {
    await expect(
      client.fuelSurcharge.parcel.history("ups", {} as unknown as { serviceLevel: string }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
