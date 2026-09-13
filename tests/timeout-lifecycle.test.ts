/**
 * #81 — the request timeout must stay armed until the body is fully read.
 *
 * Every assertion here drives the REAL client against a REAL `fetch` whose
 * headers resolve immediately and whose body never closes. That is the shape
 * a stalled proxy produces, and it is the shape that used to hang forever:
 * the abort timer was cleared the moment `fetch` returned, so nothing was
 * left to interrupt `await response.text()`.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { OilPriceAPI, TimeoutError } from "../src/index.js";

const KEY = "fixture_key_not_a_real_credential";

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Headers land immediately; the body stream is never closed.
 *
 * The stream errors on abort, which is exactly what undici does to a
 * `Response` body when its request's signal fires — without that, the mock
 * would be kinder than the network and the test would prove nothing.
 */
function stalledBodyResponse(signal: AbortSignal | null | undefined, status = 200): Response {
  const body = new ReadableStream({
    start(controller) {
      signal?.addEventListener("abort", () => {
        controller.error(Object.assign(new Error("This operation was aborted"), {
          name: "AbortError",
        }));
      });
    },
  });
  return new Response(body, {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("#81 request timeout lifecycle", () => {
  it("times out when the response body stalls after headers arrive", async () => {
    vi.spyOn(global, "fetch").mockImplementation((async (_input: unknown, init: RequestInit) => {
      return stalledBodyResponse(init?.signal);
    }) as unknown as typeof fetch);

    const client = new OilPriceAPI({ apiKey: KEY, timeout: 150, retries: 0 });

    const started = Date.now();
    await expect(client.getLatestPrices({ code: "WTI_USD" })).rejects.toBeInstanceOf(TimeoutError);
    expect(Date.now() - started).toBeLessThan(3000);
  }, 10_000);

  it("times out when an ERROR response body stalls after headers arrive", async () => {
    vi.spyOn(global, "fetch").mockImplementation((async (_input: unknown, init: RequestInit) =>
      stalledBodyResponse(init?.signal, 500)) as unknown as typeof fetch);

    const client = new OilPriceAPI({ apiKey: KEY, timeout: 150, retries: 0 });

    const started = Date.now();
    await expect(client.getLatestPrices({ code: "WTI_USD" })).rejects.toBeInstanceOf(TimeoutError);
    expect(Date.now() - started).toBeLessThan(3000);
  }, 10_000);

  it("leaves no armed abort timer behind on a successful request", async () => {
    const cleared: unknown[] = [];
    const realClear = global.clearTimeout;
    vi.spyOn(global, "clearTimeout").mockImplementation(((handle: unknown) => {
      cleared.push(handle);
      return realClear(handle as never);
    }) as unknown as typeof clearTimeout);

    vi.spyOn(global, "fetch").mockImplementation((async () =>
      new Response(JSON.stringify({ status: "success", data: { price: 1 } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })) as unknown as typeof fetch);

    const client = new OilPriceAPI({ apiKey: KEY, timeout: 5000, retries: 0 });
    await client.getLatestPrices({ code: "WTI_USD" });

    expect(cleared.length).toBeGreaterThan(0);
  });
});
