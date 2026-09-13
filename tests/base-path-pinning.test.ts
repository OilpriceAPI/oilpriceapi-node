/**
 * #89 — the origin guard pins the origin but not the base path.
 *
 * #80/#87 stopped the key going to a different HOST. On a gateway that scopes
 * by path prefix — a per-tenant or per-environment mount — a raw path could
 * still climb out of its prefix and take `Authorization: Token <key>` with it,
 * because resolution was string concatenation and the WHATWG parser resolves
 * `%2e%2e` as a dot segment after the `//` and control-character screens have
 * already run (both of those target the authority).
 *
 * The wire assertions here read the URL handed to the REAL `fetch`.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { OilPriceAPI, ValidationError } from "../src/index.js";
import { resolveApiUrl } from "../src/url.js";

const KEY = "fixture_key_not_a_real_credential";
const PROXY = "https://proxy.example/tenant-a";

afterEach(() => {
  vi.restoreAllMocks();
});

function captureUrls(): string[] {
  const urls: string[] = [];
  vi.spyOn(global, "fetch").mockImplementation((async (input: unknown) => {
    urls.push(String(input));
    return new Response(JSON.stringify({ status: "success", data: {} }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch);
  return urls;
}

describe("#89 a raw path may not escape the configured base path", () => {
  const escapes = [
    "/%2e%2e/tenant-b/v1/prices",
    "/%2E%2E/%2E%2E/v1/prices",
    "/.%2e/tenant-b",
    "/../tenant-b/v1/prices",
  ];

  for (const path of escapes) {
    it(`refuses ${path}`, () => {
      expect(() => resolveApiUrl(PROXY, path)).toThrow(ValidationError);
    });
  }

  it("still allows an ordinary path under the configured prefix", () => {
    expect(resolveApiUrl(PROXY, "/v1/prices/latest").toString()).toBe(
      "https://proxy.example/tenant-a/v1/prices/latest",
    );
  });

  it("still allows a query string on the path", () => {
    expect(resolveApiUrl(PROXY, "/v1/prices?by_code=WTI_USD").toString()).toBe(
      "https://proxy.example/tenant-a/v1/prices?by_code=WTI_USD",
    );
  });

  it("is unaffected for a base URL with no path prefix", () => {
    expect(resolveApiUrl("https://api.oilpriceapi.com", "/v1/prices").toString()).toBe(
      "https://api.oilpriceapi.com/v1/prices",
    );
  });

  it("never lets an escaping path reach the wire with the key attached", async () => {
    const urls = captureUrls();
    const client = new OilPriceAPI({ apiKey: KEY, baseUrl: PROXY, retries: 0 });

    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (client as any).request("/%2e%2e/tenant-b/v1/prices"),
    ).rejects.toThrow(ValidationError);

    expect(urls).toEqual([]);
  });
});

describe("#89 a baseUrl carrying a query or fragment is a configuration error", () => {
  const bad = [
    "https://api.oilpriceapi.com?x=1",
    "https://api.oilpriceapi.com#frag",
    "https://api.oilpriceapi.com/x?a=b",
  ];

  for (const baseUrl of bad) {
    it(`rejects ${baseUrl} at client construction`, () => {
      expect(() => new OilPriceAPI({ apiKey: KEY, baseUrl })).toThrow(ValidationError);
    });

    it(`never silently rewrites every request for ${baseUrl}`, () => {
      // Pre-fix this returned https://api.oilpriceapi.com/?x=1/v1/prices —
      // the path folded into the query and every request went to "/".
      expect(() => resolveApiUrl(baseUrl, "/v1/prices")).toThrow(ValidationError);
    });
  }
});
