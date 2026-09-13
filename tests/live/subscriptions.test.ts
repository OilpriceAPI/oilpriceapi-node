/**
 * LIVE tests for the #3245 endpoints (market-brief + subscriptions).
 *
 * These hit the REAL authenticated API.
 * - getMarketBrief(["BRENT_CRUDE_USD"]) → 200 with a numeric price (read-only)
 * - subscriptions.list() → 200 (an array) (read-only)
 * - the #78 lifecycle: create → pause → get → update → resume → pause → delete,
 *   on the key's OWN account, on a watch this test creates. The watch is paused
 *   immediately after creation and deleted in `finally`, and the test asserts
 *   the delete took effect.
 *
 * A watch is not a billing subscription. Verified in oilpriceapi-api
 * `origin/main` before this smoke was written: `SubscriptionsController`
 * pause/resume/update only change the `watches` row, and
 * `WatchSnapshotWorker` writes a `WatchEvent` without recording an API
 * request, so a live watch consumes no request quota between calls. Each
 * CRUD call here counts as one normal request.
 *
 * Requires a real API key in `process.env.OILPRICEAPI_TEST_KEY`. Absent the key
 * the suite is SKIPPED so it never fails CI for contributors without the secret.
 *
 * The API rate limit is ~1 request/second, so calls are spaced out.
 * Run explicitly with `npm run test:live`.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { OilPriceAPI } from "../../src/client.js";
import { NotFoundError } from "../../src/errors.js";
import { sleep, RATE_LIMIT_DELAY_MS, skipIfRateLimited } from "./helpers.js";

const API_KEY = process.env.OILPRICEAPI_TEST_KEY;
const describeLive = API_KEY ? describe : describe.skip;

describeLive("LIVE #3245 endpoints (market-brief + subscriptions)", () => {
  let client: OilPriceAPI;

  beforeAll(() => {
    client = new OilPriceAPI({ apiKey: API_KEY as string, retries: 1 });
  });

  it("getMarketBrief(['BRENT_CRUDE_USD']) returns a brief with a numeric price", async (ctx) => {
    try {
      const brief = await client.getMarketBrief(["BRENT_CRUDE_USD"]);

      expect(brief).toBeDefined();
      expect(Array.isArray(brief.commodities)).toBe(true);
      expect(brief.commodities.length).toBeGreaterThan(0);

      const brent =
        brief.commodities.find((c) => c.code === "BRENT_CRUDE_USD") ?? brief.commodities[0];
      expect(typeof brent.price).toBe("number");
      expect(brent.price).toBeGreaterThan(0);
      expect(brent.price).toBeLessThan(100000);
    } catch (e) {
      skipIfRateLimited(e, ctx);
    } finally {
      await sleep(RATE_LIMIT_DELAY_MS);
    }
  });

  it("subscriptions.list() returns an array (200)", async (ctx) => {
    try {
      const subs = await client.subscriptions.list();
      expect(Array.isArray(subs)).toBe(true);
    } catch (e) {
      skipIfRateLimited(e, ctx);
    } finally {
      await sleep(RATE_LIMIT_DELAY_MS);
    }
  });

  it("#78 lifecycle: create, pause, get, update, resume, delete — cleaned up in finally", async (ctx) => {
    const name = `oilpriceapi-node-live-${Date.now()}`;
    let id: string | undefined;
    const step = async <T>(fn: () => Promise<T>): Promise<T> => {
      const result = await fn();
      await sleep(RATE_LIMIT_DELAY_MS);
      return result;
    };

    try {
      const created = await step(() =>
        client.subscriptions.create({ name, codes: ["BRENT_CRUDE_USD"], interval: "1h" }),
      );
      id = created.id;
      expect(created.status).toBe("active");

      // Pause before anything else, so the watch is not evaluated while the
      // rest of the lifecycle runs.
      const paused = await step(() => client.subscriptions.pause(created.id));
      expect(paused.id).toBe(created.id);
      expect(paused.status).toBe("paused");

      const fetched = await step(() => client.subscriptions.get(created.id));
      expect(fetched.name).toBe(name);
      expect(fetched.status).toBe("paused");

      const renamed = await step(() =>
        client.subscriptions.update(created.id, { name: `${name}-renamed` }),
      );
      expect(renamed.name).toBe(`${name}-renamed`);
      expect(renamed.status).toBe("paused");

      const resumed = await step(() => client.subscriptions.resume(created.id));
      expect(resumed.status).toBe("active");

      const pausedAgain = await step(() => client.subscriptions.pause(created.id));
      expect(pausedAgain.status).toBe("paused");
    } catch (e) {
      skipIfRateLimited(e, ctx);
    } finally {
      if (id) {
        await client.subscriptions.delete(id);
        await sleep(RATE_LIMIT_DELAY_MS);
        await expect(client.subscriptions.get(id)).rejects.toBeInstanceOf(NotFoundError);
        await sleep(RATE_LIMIT_DELAY_MS);
      }
    }
  }, 60_000);
});
