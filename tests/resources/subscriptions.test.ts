/**
 * #78 — subscriptions (watches) through the REAL client and a REAL `fetch` mock.
 *
 * Fixtures in tests/fixtures/subscriptions/ are verbatim from a live lifecycle
 * run against `api.oilpriceapi.com` on 2026-09-13 with the test key's own
 * account: create -> pause -> get -> update -> resume -> delete. The watch was
 * deleted in `finally` (DELETE 204, then GET 404).
 *
 * The previous suite spied on the private `request` method, so it could not
 * see the envelope production actually sends, and `list()` turned a missing
 * `subscriptions` key into an empty array.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  OilPriceAPI,
  OilPriceAPIError,
  NotFoundError,
  RateLimitError,
  TimeoutError,
  ValidationError,
  intervalToSeconds,
  isQuotaError,
} from "../../src/index.js";

const KEY = "fixture_key_not_a_real_credential";
const ID = "c27641db-012d-4a22-8939-e77fe05d7eb4";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;
const fixture = (name: string): Json =>
  JSON.parse(readFileSync(`tests/fixtures/subscriptions/${name}.json`, "utf8"));

interface Wire {
  method: string;
  pathname: string;
  params: Record<string, string>;
  headers: Record<string, string>;
  body: unknown;
}

function serve(body: unknown, status = 200, headers: Record<string, string> = {}): Wire[] {
  const wire: Wire[] = [];
  vi.spyOn(global, "fetch").mockImplementation((async (input: unknown, init: RequestInit) => {
    const url = new URL(String(input));
    wire.push({
      method: (init?.method ?? "GET").toUpperCase(),
      pathname: url.pathname,
      params: Object.fromEntries(url.searchParams),
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: init?.body === undefined ? undefined : JSON.parse(String(init.body)),
    });
    if (status === 204) return new Response(null, { status });
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json", ...headers },
    });
  }) as unknown as typeof fetch);
  return wire;
}

const client = (options: { retries?: number; timeout?: number } = {}) =>
  new OilPriceAPI({
    apiKey: KEY,
    retries: options.retries ?? 0,
    retryDelay: 1,
    timeout: options.timeout,
  });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("#78 get()", () => {
  it("returns the watch from the { subscription } envelope", async () => {
    const wire = serve(fixture("get"));
    const watch = await client().subscriptions.get(ID);

    expect(wire).toHaveLength(1);
    expect(wire[0].method).toBe("GET");
    expect(wire[0].pathname).toBe(`/v1/subscriptions/${ID}`);
    expect(watch.id).toBe(ID);
    expect(watch.status).toBe("paused");
    expect(watch.codes).toEqual(["BRENT_CRUDE_USD"]);
  });

  it("raises NotFoundError with the API's message for an unknown id", async () => {
    serve(fixture("not-found"), 404);
    const error = await client()
      .subscriptions.get(ID)
      .catch((e) => e);

    expect(error).toBeInstanceOf(NotFoundError);
    expect(error.message).toBe("Subscription not found");
    expect(error.code).toBe("NOT_FOUND");
  });

  for (const bad of ["", "   ", undefined, 42]) {
    it(`rejects id ${JSON.stringify(bad)} before sending`, async () => {
      const wire = serve(fixture("get"));
      await expect(client().subscriptions.get(bad as unknown as string)).rejects.toBeInstanceOf(
        ValidationError,
      );
      expect(wire).toHaveLength(0);
    });
  }

  it("keeps a traversing id inside its path segment", async () => {
    const wire = serve(fixture("get"));
    await client().subscriptions.get("../alerts/someone-elses");

    expect(wire[0].pathname.startsWith("/v1/subscriptions/")).toBe(true);
    expect(wire[0].pathname).not.toContain("/v1/alerts/");
  });
});

describe("#78 update()", () => {
  it("PATCHes only the fields given and returns the updated watch", async () => {
    const wire = serve(fixture("update"));
    const watch = await client().subscriptions.update(ID, { name: "node-78-renamed" });

    expect(wire[0].method).toBe("PATCH");
    expect(wire[0].pathname).toBe(`/v1/subscriptions/${ID}`);
    expect(wire[0].body).toEqual({ name: "node-78-renamed" });
    expect(watch.name).toBe("node-78-renamed");
  });

  it("maps interval, deliverWebhook, codes and status to the API's fields", async () => {
    const wire = serve(fixture("update"));
    await client().subscriptions.update(ID, {
      interval: "1h",
      deliverWebhook: false,
      codes: ["WTI_USD", "BRENT_CRUDE_USD"],
      status: "active",
    });

    expect(wire[0].body).toEqual({
      interval_seconds: 3600,
      deliver_webhook: false,
      codes: ["WTI_USD", "BRENT_CRUDE_USD"],
      status: "active",
    });
  });

  it("rejects an update with no fields before sending", async () => {
    const wire = serve(fixture("update"));
    await expect(client().subscriptions.update(ID, {})).rejects.toBeInstanceOf(ValidationError);
    expect(wire).toHaveLength(0);
  });

  it("rejects empty codes before sending", async () => {
    const wire = serve(fixture("update"));
    await expect(client().subscriptions.update(ID, { codes: [] })).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(wire).toHaveLength(0);
  });

  it("rejects a status other than active/paused before sending", async () => {
    // Measured 2026-09-13: PATCH status=sleeping returns HTTP 500 (api#8471).
    const wire = serve(fixture("update"));
    await expect(
      client().subscriptions.update(ID, { status: "sleeping" as unknown as "active" }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(wire).toHaveLength(0);
  });

  it("rejects an invalid interval before sending", async () => {
    const wire = serve(fixture("update"));
    await expect(client().subscriptions.update(ID, { interval: "banana" })).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(wire).toHaveLength(0);
  });

  it("keeps the 422 validation details on the error", async () => {
    serve(fixture("update-422-interval"), 422);
    const error = await client()
      .subscriptions.update(ID, { interval: 1 })
      .catch((e) => e);

    expect(error).toBeInstanceOf(OilPriceAPIError);
    expect(error.statusCode).toBe(422);
    expect(error.rawBody.data.error).toBe("VALIDATION_ERROR");
    expect(error.rawBody.data.details.interval_seconds).toEqual([
      "is below your plan minimum of 60 seconds",
    ]);
  });

  it("does not replay a PATCH that timed out, and flags it as ambiguous", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockImplementation((async (
      _input: unknown,
      init: RequestInit,
    ) => {
      const body = new ReadableStream({
        start(controller) {
          init?.signal?.addEventListener("abort", () =>
            controller.error(Object.assign(new Error("aborted"), { name: "AbortError" })),
          );
        },
      });
      return new Response(body, { status: 200 });
    }) as unknown as typeof fetch);

    const error = await client({ retries: 2, timeout: 100 })
      .subscriptions.update(ID, { name: "x" })
      .catch((e) => e);

    expect(error).toBeInstanceOf(TimeoutError);
    expect(error.ambiguousWrite).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

describe("#78 pause() and resume()", () => {
  it("pause() POSTs to the member route and returns the paused watch", async () => {
    const wire = serve(fixture("pause"));
    const watch = await client().subscriptions.pause(ID);

    expect(wire[0].method).toBe("POST");
    expect(wire[0].pathname).toBe(`/v1/subscriptions/${ID}/pause`);
    expect(wire[0].body).toBeUndefined();
    expect(watch.status).toBe("paused");
  });

  it("resume() POSTs to the member route and returns the active watch", async () => {
    const wire = serve(fixture("resume"));
    const watch = await client().subscriptions.resume(ID);

    expect(wire[0].method).toBe("POST");
    expect(wire[0].pathname).toBe(`/v1/subscriptions/${ID}/resume`);
    expect(watch.status).toBe("active");
    expect(watch.next_run_at).toBe("2026-09-13T20:15:16Z");
  });

  it("pause() rejects an empty id before sending", async () => {
    const wire = serve(fixture("pause"));
    await expect(client().subscriptions.pause("")).rejects.toBeInstanceOf(ValidationError);
    expect(wire).toHaveLength(0);
  });

  it("resume() surfaces a 404 as NotFoundError", async () => {
    serve(fixture("not-found"), 404);
    await expect(client().subscriptions.resume(ID)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("pause() surfaces a 429 as RateLimitError", async () => {
    serve({ error: { code: "RATE_LIMITED", message: "Too many requests" } }, 429);
    await expect(client().subscriptions.pause(ID)).rejects.toBeInstanceOf(RateLimitError);
  });

  it("resume() maps an aborted fetch to TimeoutError", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(
      Object.assign(new Error("This operation was aborted"), { name: "AbortError" }),
    );
    await expect(client().subscriptions.resume(ID)).rejects.toBeInstanceOf(TimeoutError);
  });
});

describe("#78 entitlement limits keep their recovery metadata", () => {
  it("a 402 watch-limit on create is a quota error carrying the upgrade block", async () => {
    // Shape from AgentUpgradeTriggers#render_agent_upgrade_required on
    // origin/main. Not captured live: the test key's tier allows 1,000 watches.
    const body = {
      status: "fail",
      data: {
        error: "WATCH_LIMIT",
        message: "Your plan allows up to 1 active watches. Upgrade for more.",
        limit: 1,
        current: 1,
        upgrade_trigger: "watch_limit",
        upgrade_url: "https://www.oilpriceapi.com/pricing",
        upgrade: { url: "https://www.oilpriceapi.com/pricing", next_tier: "developer" },
      },
    };
    serve(body, 402);
    const error = await client()
      .subscriptions.create({ codes: ["BRENT_CRUDE_USD"], interval: "1h" })
      .catch((e) => e);

    expect(isQuotaError(error)).toBe(true);
    expect(error.rawBody.data.upgrade_trigger).toBe("watch_limit");
    expect(error.rawBody.data.limit).toBe(1);
    expect(error.rawBody.data.upgrade.next_tier).toBe("developer");
  });
});

describe("#78 malformed 200 raises unexpected_response_shape", () => {
  const watchCases: Array<[string, (c: OilPriceAPI) => Promise<unknown>]> = [
    ["get", (c) => c.subscriptions.get(ID)],
    ["update", (c) => c.subscriptions.update(ID, { name: "x" })],
    ["pause", (c) => c.subscriptions.pause(ID)],
    ["resume", (c) => c.subscriptions.resume(ID)],
    ["create", (c) => c.subscriptions.create({ codes: ["BRENT_CRUDE_USD"] })],
  ];

  for (const [name, call] of watchCases) {
    for (const [label, data] of [
      ["no subscription key", { id: ID, status: "active" }],
      ["subscription without an id", { subscription: { status: "active" } }],
      ["subscription with an unknown status", { subscription: { id: ID, status: "sleeping" } }],
    ] as const) {
      it(`${name}() with ${label}`, async () => {
        serve({ status: "success", data });
        const error = await call(client()).catch((e) => e);

        expect(error).toBeInstanceOf(OilPriceAPIError);
        expect(error.code).toBe("unexpected_response_shape");
      });
    }
  }

  it("list() with no subscriptions key no longer returns []", async () => {
    serve({ status: "success", data: {} });
    const error = await client()
      .subscriptions.list()
      .catch((e) => e);

    expect(error).toBeInstanceOf(OilPriceAPIError);
    expect(error.code).toBe("unexpected_response_shape");
  });

  it("list() with a non-array subscriptions value", async () => {
    serve({ status: "success", data: { subscriptions: "none" } });
    const error = await client()
      .subscriptions.list()
      .catch((e) => e);

    expect(error.code).toBe("unexpected_response_shape");
  });
});

describe("existing methods through the real client", () => {
  it("list() returns the watches from the live envelope", async () => {
    const body = fixture("list");
    const wire = serve(body);
    const watches = await client().subscriptions.list();

    expect(wire[0].pathname).toBe("/v1/subscriptions");
    expect(watches).toHaveLength(1);
    expect(watches[0].id).toBe(body.data.subscriptions[0].id);
  });

  it("list() returns [] only when the API sends an empty list", async () => {
    serve({ status: "success", data: { subscriptions: [] } });
    await expect(client().subscriptions.list()).resolves.toEqual([]);
  });

  it("create() maps the interval, sends attribution headers and returns the watch", async () => {
    const wire = serve(fixture("create"));
    const watch = await client().subscriptions.create({
      name: "Crude desk",
      codes: ["BRENT_CRUDE_USD"],
      interval: "1h",
      tool: "my-bot",
    });

    expect(wire[0].method).toBe("POST");
    expect(wire[0].body).toEqual({
      name: "Crude desk",
      codes: ["BRENT_CRUDE_USD"],
      interval_seconds: 3600,
    });
    expect(wire[0].headers["X-OPA-Source"]).toBe("sdk-node");
    expect(wire[0].headers["X-OPA-Tool"]).toBe("my-bot");
    expect(watch.id).toBe(ID);
    expect(watch.status).toBe("active");
  });

  it("create() rejects empty codes and an invalid interval", async () => {
    const wire = serve(fixture("create"));
    await expect(client().subscriptions.create({ codes: [] })).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(
      client().subscriptions.create({ codes: ["WTI_USD"], interval: "banana" }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(wire).toHaveLength(0);
  });

  it("delete() sends DELETE and resolves on 204", async () => {
    const wire = serve(null, 204);
    await expect(client().subscriptions.delete(ID)).resolves.toBeUndefined();

    expect(wire[0].method).toBe("DELETE");
    expect(wire[0].pathname).toBe(`/v1/subscriptions/${ID}`);
  });

  it("events() passes since/watchId/limit as query params", async () => {
    const wire = serve({ status: "success", data: { cursor: 42, has_more: false, events: [] } });
    const result = await client().subscriptions.events({ since: 10, watchId: ID, limit: 50 });

    expect(wire[0].pathname).toBe("/v1/subscriptions/events");
    expect(wire[0].params).toEqual({ since: "10", watch_id: ID, limit: "50" });
    expect(result.cursor).toBe(42);
  });
});

describe("intervalToSeconds()", () => {
  it("maps presets", () => {
    expect(intervalToSeconds("5m")).toBe(300);
    expect(intervalToSeconds("15m")).toBe(900);
    expect(intervalToSeconds("1h")).toBe(3600);
    expect(intervalToSeconds("hourly")).toBe(3600);
    expect(intervalToSeconds("daily")).toBe(86400);
  });

  it("defaults to 5m when undefined", () => {
    expect(intervalToSeconds(undefined)).toBe(300);
  });

  it("parses unit expressions", () => {
    expect(intervalToSeconds("30s")).toBe(30);
    expect(intervalToSeconds("10m")).toBe(600);
    expect(intervalToSeconds("2h")).toBe(7200);
    expect(intervalToSeconds("1d")).toBe(86400);
  });

  it("accepts raw seconds", () => {
    expect(intervalToSeconds(120)).toBe(120);
  });

  it("is case/whitespace tolerant", () => {
    expect(intervalToSeconds(" 1H ")).toBe(3600);
    expect(intervalToSeconds("DAILY")).toBe(86400);
  });

  it("throws on invalid values", () => {
    expect(() => intervalToSeconds("banana")).toThrow(ValidationError);
    expect(() => intervalToSeconds(0)).toThrow(ValidationError);
    expect(() => intervalToSeconds(-5)).toThrow(ValidationError);
  });
});
