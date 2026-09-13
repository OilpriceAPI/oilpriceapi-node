/**
 * #82 — retry must not replay a write, and must not wait on a signal it
 * cannot bound.
 *
 * Every assertion here counts the ACTUAL outbound requests handed to `fetch`,
 * and the ACTUAL delays handed to `setTimeout`. A duplicated subscription is
 * not visible in a return value, only in how many times the request left.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { OilPriceAPI } from "../src/index.js";

const KEY = "fixture_key_not_a_real_credential";
// Distinctive so the abort timer can be told apart from a retry sleep.
const TIMEOUT_MS = 12345;

interface Sent {
  url: string;
  method: string;
}

function captureFetch(
  respond: (attempt: number) => Response | Promise<Response> | never,
): Sent[] {
  const sent: Sent[] = [];
  vi.spyOn(global, "fetch").mockImplementation((async (input: unknown, init: RequestInit) => {
    sent.push({ url: String(input), method: (init?.method ?? "GET").toUpperCase() });
    return respond(sent.length);
  }) as unknown as typeof fetch);
  return sent;
}

/** Record every retry sleep, and make it return instantly. */
function captureSleeps(): number[] {
  const sleeps: number[] = [];
  const realSetTimeout = global.setTimeout;
  vi.spyOn(global, "setTimeout").mockImplementation(((
    fn: () => void,
    ms?: number,
    ...rest: unknown[]
  ) => {
    if (ms !== TIMEOUT_MS) {
      sleeps.push(ms ?? 0);
      return realSetTimeout(fn, 0, ...rest);
    }
    return realSetTimeout(fn, ms, ...rest);
  }) as unknown as typeof setTimeout);
  return sleeps;
}

function abortError(): Error {
  const error = new Error("The operation was aborted");
  error.name = "AbortError";
  return error;
}

function client(overrides: Record<string, unknown> = {}) {
  return new OilPriceAPI({
    apiKey: KEY,
    retries: 3,
    retryDelay: 5,
    timeout: TIMEOUT_MS,
    ...overrides,
  });
}

function rateLimited(headers: Record<string, string>, body = '{"error":"Rate limit exceeded"}') {
  return new Response(body, { status: 429, headers });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("#82 a write is never replayed after an ambiguous outcome", () => {
  it("sends a POST exactly once when the response is lost to a timeout", async () => {
    const sent = captureFetch(() => {
      throw abortError();
    });

    await expect(
      client().subscriptions.create({ codes: ["WTI_USD"] } as never),
    ).rejects.toThrow();

    expect(sent.map((s) => s.method)).toEqual(["POST"]);
  });

  it("sends a POST exactly once on a 503", async () => {
    const sent = captureFetch(() => new Response("upstream down", { status: 503 }));

    await expect(
      client().subscriptions.create({ codes: ["WTI_USD"] } as never),
    ).rejects.toThrow();

    expect(sent).toHaveLength(1);
  });

  it("sends a PATCH exactly once on a 502", async () => {
    const sent = captureFetch(() => new Response("bad gateway", { status: 502 }));

    await expect(client().webhooks.update("wh_1", { url: "https://x.test/h" })).rejects.toThrow();

    expect(sent).toHaveLength(1);
  });

  it("tells the caller the write outcome is unknown", async () => {
    captureFetch(() => {
      throw abortError();
    });

    const error = await client()
      .subscriptions.create({ codes: ["WTI_USD"] } as never)
      .catch((e: unknown) => e as Error & { ambiguousWrite?: boolean });

    expect(error.ambiguousWrite).toBe(true);
    expect(error.message).toMatch(/not retried|may have been applied/i);
  });

  it("still retries an idempotent DELETE", async () => {
    const sent = captureFetch(() => new Response("upstream down", { status: 503 }));
    captureSleeps();

    await expect(client().subscriptions.delete("sub_1")).rejects.toThrow();

    expect(sent).toHaveLength(4); // 1 initial + 3 retries
  });

  it("still retries a GET through a transient 502", async () => {
    const sent = captureFetch((attempt) =>
      attempt === 1
        ? new Response("bad gateway", { status: 502 })
        : new Response(JSON.stringify({ status: "success", data: { prices: [] } }), {
            status: 200,
          }),
    );
    captureSleeps();

    await expect(client().getLatestPrices()).resolves.toEqual([]);
    expect(sent).toHaveLength(2);
  });

  it("retries a POST the SDK marks replay-safe (a search, not a write)", async () => {
    const sent = captureFetch((attempt) =>
      attempt === 1
        ? new Response("bad gateway", { status: 502 })
        : new Response(JSON.stringify({ status: "success", data: { stations: [] } }), {
            status: 200,
          }),
    );
    captureSleeps();

    await client().diesel.getStations({ lat: 29.76, lng: -95.37, radius: 5000 });

    expect(sent.map((s) => s.method)).toEqual(["POST", "POST"]);
  });

  it("never replays a malformed 200, on any method", async () => {
    const postSent = captureFetch(() => new Response("<html>not json</html>", { status: 200 }));
    await expect(
      client().subscriptions.create({ codes: ["WTI_USD"] } as never),
    ).rejects.toThrow(/JSON/i);
    expect(postSent).toHaveLength(1);

    vi.restoreAllMocks();

    const getSent = captureFetch(() => new Response("<html>not json</html>", { status: 200 }));
    await expect(client().getLatestPrices()).rejects.toThrow(/JSON/i);
    expect(getSent).toHaveLength(1);
  });
});

describe("#82 durable quota exhaustion is never retried", () => {
  it.each(["monthly_counter", "daily_counter", "trial_counter"])(
    "stops after one attempt when the %s window is exhausted",
    async (window) => {
      const sent = captureFetch(() =>
        rateLimited({
          "Retry-After": "3600",
          "X-RateLimit-State": "exhausted",
          "X-RateLimit-Window": window,
        }),
      );
      const sleeps = captureSleeps();

      await expect(client().getLatestPrices()).rejects.toThrow(/rate limit/i);

      expect(sent).toHaveLength(1);
      expect(sleeps).toEqual([]);
    },
  );

  it("still retries the recoverable hourly circuit breaker", async () => {
    // The circuit breaker emits state=exhausted too, with a window that does
    // reset shortly. State alone cannot tell the two apart.
    const sent = captureFetch((attempt) =>
      attempt === 1
        ? rateLimited({
            "Retry-After": "2",
            "X-RateLimit-State": "exhausted",
            "X-RateLimit-Window": "hourly_circuit_breaker",
          })
        : new Response(JSON.stringify({ status: "success", data: { prices: [] } }), {
            status: 200,
          }),
    );
    const sleeps = captureSleeps();

    await expect(client().getLatestPrices()).resolves.toEqual([]);

    expect(sent).toHaveLength(2);
    expect(sleeps).toContain(2000);
  });

  it("still retries a 429 with no rate-limit headers at all", async () => {
    const sent = captureFetch((attempt) =>
      attempt === 1
        ? rateLimited({ "Retry-After": "1" })
        : new Response(JSON.stringify({ status: "success", data: { prices: [] } }), {
            status: 200,
          }),
    );
    captureSleeps();

    await expect(client().getLatestPrices()).resolves.toEqual([]);
    expect(sent).toHaveLength(2);
  });
});

describe("#82 any Retry-After is bounded and non-negative", () => {
  it("clamps a huge Retry-After to the wait budget", async () => {
    captureFetch(() => rateLimited({ "Retry-After": "86400" }));
    const sleeps = captureSleeps();

    await expect(client({ retries: 1 }).getLatestPrices()).rejects.toThrow();

    expect(sleeps.every((ms) => ms <= 60_000)).toBe(true);
    expect(Math.max(...sleeps)).toBe(60_000);
  });

  it("never sleeps on a negative retry_after from the body", async () => {
    captureFetch(() => rateLimited({}, '{"error":"slow down","retry_after":-30}'));
    const sleeps = captureSleeps();

    await expect(client({ retries: 2 }).getLatestPrices()).rejects.toThrow();

    expect(sleeps.every((ms) => ms >= 0)).toBe(true);
  });

  it("ignores an unparseable Retry-After instead of producing NaN", async () => {
    captureFetch(() => rateLimited({ "Retry-After": "Wed, 21 Oct 2015 07:28:00 GMT" }));
    const sleeps = captureSleeps();

    await expect(client({ retries: 2 }).getLatestPrices()).rejects.toThrow();

    expect(sleeps.every((ms) => Number.isFinite(ms) && ms >= 0 && ms <= 60_000)).toBe(true);
  });

  it("bounds the computed exponential backoff too", async () => {
    captureFetch(() => new Response("upstream down", { status: 503 }));
    const sleeps = captureSleeps();

    await expect(
      client({ retries: 5, retryDelay: 30_000 }).getLatestPrices(),
    ).rejects.toThrow();

    expect(sleeps.every((ms) => ms <= 60_000)).toBe(true);
  });
});

describe("#82 retry configuration is honoured as given", () => {
  it("makes exactly one attempt when retries is 0", async () => {
    const sent = captureFetch(() => new Response("upstream down", { status: 503 }));

    await expect(client({ retries: 0 }).getLatestPrices()).rejects.toThrow();

    expect(sent).toHaveLength(1);
  });

  it("honours retryDelay: 0 instead of falling back to 1000ms", async () => {
    captureFetch(() => new Response("upstream down", { status: 503 }));
    const sleeps = captureSleeps();

    await expect(client({ retries: 2, retryDelay: 0 }).getLatestPrices()).rejects.toThrow();

    expect(sleeps).toEqual([0, 0]);
  });

  it("refuses a negative retries instead of failing with 'Unknown error occurred'", () => {
    expect(() => new OilPriceAPI({ apiKey: KEY, retries: -1 })).toThrow(/retries/i);
  });
});
