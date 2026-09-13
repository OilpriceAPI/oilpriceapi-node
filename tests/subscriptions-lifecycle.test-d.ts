/**
 * #78 — type-level contract for the subscriptions lifecycle methods.
 *
 * Shapes verified against a live lifecycle run on 2026-09-13
 * (tests/fixtures/subscriptions/): get, update, pause and resume all return
 * `data: { subscription: {...} }`, which the SDK unwraps to a `Subscription`.
 */
import { describe, it, expectTypeOf } from "vitest";
import type {
  OilPriceAPI,
  Subscription,
  SubscriptionStatus,
  UpdateSubscriptionParams,
} from "../src/index.js";

type Subs = OilPriceAPI["subscriptions"];
declare const subs: Subs;

describe("#78 lifecycle method signatures", () => {
  it("get/pause/resume take an id and return the watch", () => {
    expectTypeOf<Subs["get"]>().parameter(0).toEqualTypeOf<string>();
    expectTypeOf<Subs["pause"]>().parameter(0).toEqualTypeOf<string>();
    expectTypeOf<Subs["resume"]>().parameter(0).toEqualTypeOf<string>();
    expectTypeOf<Awaited<ReturnType<Subs["get"]>>>().toEqualTypeOf<Subscription>();
    expectTypeOf<Awaited<ReturnType<Subs["pause"]>>>().toEqualTypeOf<Subscription>();
    expectTypeOf<Awaited<ReturnType<Subs["resume"]>>>().toEqualTypeOf<Subscription>();
  });

  it("update takes an id and UpdateSubscriptionParams and returns the watch", () => {
    expectTypeOf<Subs["update"]>().parameter(0).toEqualTypeOf<string>();
    expectTypeOf<Subs["update"]>().parameter(1).toEqualTypeOf<UpdateSubscriptionParams>();
    expectTypeOf<Awaited<ReturnType<Subs["update"]>>>().toEqualTypeOf<Subscription>();
  });

  it("cannot be called without an id", () => {
    // @ts-expect-error — id is required
    void subs.get();
    // @ts-expect-error — id is required
    void subs.pause();
    // @ts-expect-error — id and params are required
    void subs.update();
  });
});

describe("#78 UpdateSubscriptionParams", () => {
  it("accepts the fields the API permits", () => {
    const params: UpdateSubscriptionParams = {
      name: "Crude desk",
      codes: ["BRENT_CRUDE_USD"],
      interval: "1h",
      deliverWebhook: false,
      status: "paused",
    };
    void params;
    expectTypeOf<UpdateSubscriptionParams["status"]>().toEqualTypeOf<
      SubscriptionStatus | undefined
    >();
  });

  it("rejects a status the API does not accept", () => {
    // @ts-expect-error — the API returns HTTP 500 for any other status (api#8471)
    const bad: UpdateSubscriptionParams = { status: "sleeping" };
    void bad;
  });

  it("does not accept the raw wire field names", () => {
    // @ts-expect-error — use interval, which the SDK maps to interval_seconds
    const bad: UpdateSubscriptionParams = { interval_seconds: 60 };
    void bad;
  });
});
