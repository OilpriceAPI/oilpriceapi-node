/**
 * #80 — a caller-supplied raw path must never change the origin the API key
 * is sent to.
 *
 * These assert on the ACTUAL outbound request (the URL and headers handed to
 * `fetch`), not on an internal flag: the only thing that matters is whether
 * `Authorization: Token <key>` ever leaves for a host other than the one the
 * client was configured with.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { OilPriceAPI } from "../src/index.js";

const FIXTURE_KEY = "fixture_key_not_a_real_credential";
const BASE = "https://api.oilpriceapi.com";
const BASE_HOST = "api.oilpriceapi.com";

interface Outbound {
  url: string;
  host: string;
  authorization: string | undefined;
}

function captureFetch(): Outbound[] {
  const sent: Outbound[] = [];
  vi.spyOn(global, "fetch").mockImplementation((async (input: unknown, init: RequestInit) => {
    const url = String(input);
    const headers = (init?.headers ?? {}) as Record<string, string>;
    sent.push({ url, host: new URL(url).host, authorization: headers.Authorization });
    return new Response(JSON.stringify({ status: "success", data: {} }), { status: 200 });
  }) as unknown as typeof fetch);
  return sent;
}

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * The adversarial probe set. `preFixHost` is the host `new URL(baseUrl + path)`
 * actually resolved to on origin/main — every entry that is not
 * `api.oilpriceapi.com` was a request carrying the customer's API key to a
 * host they never configured.
 *
 * The contract asserted here is not "every one of these is rejected" — some
 * are legitimately normalized into a harmless same-origin path. It is that
 * NONE of them ever produce an outbound request to another origin.
 */
const PROBES: Array<[name: string, path: string, preFixHost: string]> = [
  ["scheme-relative", "//fixture.invalid/v1/prices", BASE_HOST],
  ["userinfo-embedded", "@fixture.invalid/v1/prices", "fixture.invalid"],
  ["network-path with userinfo", "//user@fixture.invalid/v1/prices", BASE_HOST],
  ["subdomain-suffix", ".fixture.invalid/v1/prices", "api.oilpriceapi.com.fixture.invalid"],
  ["port-change", ":8443/v1/prices", "api.oilpriceapi.com:8443"],
  ["backslash", "\\\\fixture.invalid/v1/prices", BASE_HOST],
  ["percent-encoded slashes", "/%2F%2Ffixture.invalid/v1/prices", BASE_HOST],
  ["uppercase scheme", "HTTP://fixture.invalid/v1/prices", "api.oilpriceapi.comhttp"],
  ["absolute URL", "https://fixture.invalid/v1/prices", "api.oilpriceapi.comhttps"],
  ["whitespace-padded", "  //fixture.invalid/v1/prices", "(TypeError: Invalid URL)"],
  ["protocol downgrade", "http://api.oilpriceapi.com/v1/prices", "api.oilpriceapi.comhttp"],
  ["bare relative", "v1/prices/latest", "api.oilpriceapi.comv1"],
  ["dot-dot traversal", "/v1/../../v1/prices", BASE_HOST],
  ["CRLF injection", "/v1/prices\r\nX-Injected: 1", BASE_HOST],
];

describe("#80 raw paths may not change the authenticated origin", () => {
  it.each(PROBES)(
    "never sends the API key off-origin for %s",
    async (_name, path) => {
      const sent = captureFetch();
      const client = new OilPriceAPI({ apiKey: FIXTURE_KEY, retries: 0 });

      try {
        await client.raw.get(path);
      } catch {
        // Rejecting is one acceptable outcome. The assertion below is the
        // contract, and it holds whether the path was refused or normalized.
      }

      for (const request of sent) {
        expect(request.host).toBe(BASE_HOST);
        expect(request.url.startsWith(`${BASE}/`)).toBe(true);
      }
    },
  );

  it.each([
    ["scheme-relative", "//fixture.invalid/v1/prices"],
    ["network-path with userinfo", "//user@fixture.invalid/v1/prices"],
    ["absolute URL", "https://fixture.invalid/v1/prices"],
    ["uppercase scheme", "HTTP://fixture.invalid/v1/prices"],
    ["protocol downgrade", "http://api.oilpriceapi.com/v1/prices"],
    ["backslash", "\\\\fixture.invalid/v1/prices"],
    ["whitespace-padded", "  //fixture.invalid/v1/prices"],
    ["CRLF injection", "/v1/prices\r\nX-Injected: 1"],
  ])("refuses %s outright, before any request is built", async (_name, path) => {
    const sent = captureFetch();
    const client = new OilPriceAPI({ apiKey: FIXTURE_KEY, retries: 0 });

    await expect(client.raw.get(path)).rejects.toThrow(/API paths must be relative/);
    expect(sent).toHaveLength(0);
  });

  it("normalizes an authority-extending path into a same-origin path", async () => {
    const sent = captureFetch();
    const client = new OilPriceAPI({ apiKey: FIXTURE_KEY, retries: 0 });

    // Pre-fix these reached fixture.invalid, api.oilpriceapi.com.fixture.invalid
    // and api.oilpriceapi.comv1 respectively, each with the API key attached.
    await client.raw.get("@fixture.invalid/v1/prices");
    await client.raw.get(".fixture.invalid/v1/prices");
    await client.raw.get("v1/prices/latest");

    expect(sent.map((r) => r.url)).toEqual([
      `${BASE}/@fixture.invalid/v1/prices`,
      `${BASE}/.fixture.invalid/v1/prices`,
      `${BASE}/v1/prices/latest`,
    ]);
    expect(sent.every((r) => r.host === BASE_HOST)).toBe(true);
  });

  it("rejects an empty or non-string path", async () => {
    const sent = captureFetch();
    const client = new OilPriceAPI({ apiKey: FIXTURE_KEY, retries: 0 });

    await expect(client.raw.get("")).rejects.toThrow(/is empty/);
    await expect(client.raw.get(undefined as unknown as string)).rejects.toThrow(
      /must be a string/,
    );
    await expect(client.raw.get(null as unknown as string)).rejects.toThrow(/must be a string/);
    expect(sent).toHaveLength(0);
  });

  it("still resolves legitimate paths, with query and fragment", async () => {
    const sent = captureFetch();
    const client = new OilPriceAPI({ apiKey: FIXTURE_KEY, retries: 0 });

    await client.raw.get("/v1/prices/latest");
    await client.raw.get("/v1/prices/latest?by_code=WTI_USD");
    await client.raw.get("/v1/prices/latest#section");
    await client.raw.get("/v1/commodities/WTI_USD", { by_code: "WTI_USD" });
    await client.raw.get("/v1/commodities/BRENT%20CRUDE");

    expect(sent.map((r) => r.url)).toEqual([
      `${BASE}/v1/prices/latest`,
      `${BASE}/v1/prices/latest?by_code=WTI_USD`,
      `${BASE}/v1/prices/latest#section`,
      `${BASE}/v1/commodities/WTI_USD?by_code=WTI_USD`,
      `${BASE}/v1/commodities/BRENT%20CRUDE`,
    ]);
    expect(sent.every((r) => r.authorization === `Token ${FIXTURE_KEY}`)).toBe(true);
  });

  it("keeps an explicitly configured custom base URL working", async () => {
    const sent = captureFetch();
    const client = new OilPriceAPI({
      apiKey: FIXTURE_KEY,
      baseUrl: "http://localhost:5000",
      retries: 0,
    });

    await client.raw.get("/v1/prices/latest");

    expect(sent[0].url).toBe("http://localhost:5000/v1/prices/latest");
    expect(sent[0].authorization).toBe(`Token ${FIXTURE_KEY}`);
  });

  it("pins the guard to the configured base, not a hard-coded hostname", async () => {
    const sent = captureFetch();
    const client = new OilPriceAPI({
      apiKey: FIXTURE_KEY,
      baseUrl: "https://staging.example.test",
      retries: 0,
    });

    // Our own production host is just as off-origin as anyone else's when the
    // client was pointed somewhere else.
    await expect(client.raw.get("https://api.oilpriceapi.com/v1/prices")).rejects.toThrow(
      /API paths must be relative/,
    );
    expect(sent).toHaveLength(0);

    await client.raw.get("/v1/prices/latest");
    expect(sent[0].url).toBe("https://staging.example.test/v1/prices/latest");
  });

  it("guards every raw entry point, not just raw.get", async () => {
    const sent = captureFetch();
    const client = new OilPriceAPI({ apiKey: FIXTURE_KEY, retries: 0 });

    await client.raw.getLatestPrices({ commodity: "WTI_USD" });
    await client.raw.getHistoricalPrices({ period: "past_week" });
    await client.raw.getCommodities();
    await client.raw.getCommodityCategories();
    await client.raw.getCommodity("WTI_USD");
    await client.getLatestPrices();
    await client.getCommodity("@fixture.invalid");

    expect(sent.every((r) => r.host === BASE_HOST)).toBe(true);
    expect(sent).toHaveLength(7);
  });

  it("guards the keyless demo endpoints too", async () => {
    const sent = captureFetch();
    const client = new OilPriceAPI({ apiKey: FIXTURE_KEY, retries: 0 });

    // Demo requests carry no Authorization header, but an SDK that can be
    // pointed at an arbitrary host is still an SSRF primitive.
    await client.getDemoPrices();
    await client.getDemoCommodities();

    expect(sent.every((r) => r.host === BASE_HOST)).toBe(true);
    expect(sent.every((r) => r.authorization === undefined)).toBe(true);
  });
});
