import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { run as runAuthentication } from "../examples/snippets/authentication-error.js";
import { run as runEntitlement } from "../examples/snippets/entitlement-error.js";
import { run as runHistory } from "../examples/snippets/history.js";
import { run as runLatest } from "../examples/snippets/latest-price.js";
import { run as runRateLimit } from "../examples/snippets/rate-limit-error.js";
import { run as runTimeout } from "../examples/snippets/timeout-error.js";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const originalApiKey = process.env.OILPRICEAPI_KEY;

function response(status: number, body: unknown, headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    headers: new Headers(headers),
    text: async () => JSON.stringify(body),
  } as Response;
}

beforeEach(() => {
  process.env.OILPRICEAPI_KEY = "fixture-key";
});

afterEach(() => {
  vi.restoreAllMocks();
  if (originalApiKey === undefined) {
    delete process.env.OILPRICEAPI_KEY;
  } else {
    process.env.OILPRICEAPI_KEY = originalApiKey;
  }
});

describe("versioned snippet manifest", () => {
  it("validates generated metadata against JSON Schema", async () => {
    const { buildManifest } = await import("../scripts/generate-snippet-manifest.mjs");
    const manifest = buildManifest("a".repeat(40));
    const schema = JSON.parse(
      readFileSync(resolve(root, "schemas/snippet-manifest.schema.json"), "utf8"),
    );
    const validate = new Ajv2020({ strict: true }).compile(schema);

    expect(validate(manifest), JSON.stringify(validate.errors)).toBe(true);
    expect(manifest.package).toMatchObject({ minimum_runtime: "18", language: "typescript" });
    expect(manifest.examples.map((example: { http_status?: number }) => example.http_status).filter(Boolean)).toEqual([
      401,
      403,
      429,
    ]);
  });

  it("executes the exact success files against fixtures", async () => {
    const fetchSpy = vi.spyOn(global, "fetch");
    fetchSpy.mockResolvedValueOnce(
      response(200, {
        status: "success",
        data: {
          code: "BRENT_CRUDE_USD",
          price: 72.5,
          formatted: "$72.50",
          currency: "USD",
          created_at: "2026-01-15T12:00:00Z",
          type: "spot_price",
          source: "fixture",
        },
      }),
    );
    fetchSpy.mockResolvedValueOnce(
      response(200, {
        status: "success",
        data: {
          prices: [
            {
              code: "BRENT_CRUDE_USD",
              price: 71.5,
              formatted: "$71.50",
              currency: "USD",
              created_at: "2026-01-14T12:00:00Z",
              type: "spot_price",
              source: "fixture",
            },
          ],
        },
      }),
    );

    await expect(runLatest()).resolves.toMatchObject({ commodity: "BRENT_CRUDE_USD", valueType: "number" });
    await expect(runHistory()).resolves.toMatchObject({ commodity: "BRENT_CRUDE_USD", count: 1 });
  });

  it("executes typed 401, 403, and 429 recovery files", async () => {
    const fetchSpy = vi.spyOn(global, "fetch");
    fetchSpy.mockResolvedValueOnce(response(401, { error: "authentication" }));
    fetchSpy.mockResolvedValueOnce(response(403, { error: "entitlement" }));
    fetchSpy.mockResolvedValueOnce(response(429, { error: "rate limit" }, { "Retry-After": "0" }));

    await expect(runAuthentication()).resolves.toEqual({ handled: true, statusCode: 401 });
    await expect(runEntitlement()).resolves.toEqual({ handled: true, statusCode: 403 });
    await expect(runRateLimit()).resolves.toEqual({ handled: true, statusCode: 429 });
  });

  it("executes the timeout recovery file", async () => {
    vi.spyOn(global, "fetch").mockImplementation((_url, options) => {
      return new Promise((_resolve, reject) => {
        options?.signal?.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
      });
    });

    await expect(runTimeout()).resolves.toEqual({ handled: true, errorType: "TimeoutError" });
  });
});
