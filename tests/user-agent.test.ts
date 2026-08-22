import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OilPriceAPI } from "../src/index.js";

// Mock fetch to capture headers
const mockFetch = vi.fn();

describe("User-Agent Headers", () => {
  beforeEach(() => {
    // Replace global fetch with mock
    vi.stubGlobal("fetch", mockFetch);

    // Default mock response (must include text() and headers for request() compatibility)
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          status: "success",
          data: { price: 75.5, code: "WTI_USD" },
        }),
      headers: new Map([["content-type", "application/json"]]),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("should send User-Agent header with SDK identifier", async () => {
    const client = new OilPriceAPI({ apiKey: "test_key" });

    await client.getLatestPrices();

    expect(mockFetch).toHaveBeenCalled();
    const [, options] = mockFetch.mock.calls[0];
    const userAgent = options.headers["User-Agent"];

    // Should contain oilpriceapi-node identifier (for backend detection)
    expect(userAgent).toMatch(/oilpriceapi-node/);
  });

  it("should include SDK version in User-Agent", async () => {
    const client = new OilPriceAPI({ apiKey: "test_key" });

    await client.getLatestPrices();

    const [, options] = mockFetch.mock.calls[0];
    const userAgent = options.headers["User-Agent"];

    // Should include version number (e.g., oilpriceapi-node/0.5.2)
    expect(userAgent).toMatch(/oilpriceapi-node\/\d+\.\d+\.\d+/);
  });

  it("should include Node.js version in User-Agent", async () => {
    const client = new OilPriceAPI({ apiKey: "test_key" });

    await client.getLatestPrices();

    const [, options] = mockFetch.mock.calls[0];
    const userAgent = options.headers["User-Agent"];

    // Should include node version (e.g., node/v20.10.0)
    expect(userAgent).toMatch(/node\/v?\d+\.\d+/);
  });

  it("should send X-SDK-Name header", async () => {
    const client = new OilPriceAPI({ apiKey: "test_key" });

    await client.getLatestPrices();

    const [, options] = mockFetch.mock.calls[0];

    expect(options.headers["X-SDK-Name"]).toBe("oilpriceapi-node");
  });

  it("should send X-SDK-Version header matching SDK version", async () => {
    const client = new OilPriceAPI({ apiKey: "test_key" });

    await client.getLatestPrices();

    const [, options] = mockFetch.mock.calls[0];
    const clientVersion = options.headers["X-SDK-Version"];

    // Should be a valid semver version
    expect(clientVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("should send consistent version across all headers", async () => {
    const client = new OilPriceAPI({ apiKey: "test_key" });

    await client.getLatestPrices();

    const [, options] = mockFetch.mock.calls[0];
    const userAgent = options.headers["User-Agent"];
    const clientVersion = options.headers["X-SDK-Version"];

    // Extract version from User-Agent
    const uaVersionMatch = userAgent.match(/oilpriceapi-node\/(\d+\.\d+\.\d+)/);
    expect(uaVersionMatch).toBeTruthy();

    // Version in User-Agent should match X-Client-Version
    expect(uaVersionMatch![1]).toBe(clientVersion);
  });

  it("should send Authorization header with canonical Token auth", async () => {
    const client = new OilPriceAPI({ apiKey: "my_secret_key" });

    await client.getLatestPrices();

    const [, options] = mockFetch.mock.calls[0];

    expect(options.headers["Authorization"]).toBe("Token my_secret_key");
  });

  it("should send Content-Type header as application/json", async () => {
    const client = new OilPriceAPI({ apiKey: "test_key" });

    await client.getLatestPrices();

    const [, options] = mockFetch.mock.calls[0];

    expect(options.headers["Content-Type"]).toBe("application/json");
  });

  it("should include all required headers on every request", async () => {
    const client = new OilPriceAPI({ apiKey: "test_key" });

    // Make multiple different requests
    await client.getLatestPrices();
    await client.getLatestPrices({ commodity: "BRENT_CRUDE_USD" });

    // Both requests should have all headers
    for (const call of mockFetch.mock.calls) {
      const [, options] = call;
      expect(options.headers).toHaveProperty("User-Agent");
      expect(options.headers).toHaveProperty("X-SDK-Name");
      expect(options.headers).toHaveProperty("X-SDK-Version");
      expect(options.headers).toHaveProperty("Authorization");
      expect(options.headers).toHaveProperty("Content-Type");
    }
  });
});

describe("SDK Version", () => {
  it("should expose SDK version as a constant", async () => {
    // Import version from package
    const { SDK_VERSION } = await import("../src/index.js");

    expect(SDK_VERSION).toBeDefined();
    expect(SDK_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("should match package.json version", async () => {
    const { SDK_VERSION } = await import("../src/index.js");
    const packageJson = await import("../package.json", { assert: { type: "json" } });

    expect(SDK_VERSION).toBe(packageJson.default.version);
  });
});

/**
 * Server-side attribution conformance.
 *
 * `MinimalAnalyticsService#detect_sdk_info` in oilpriceapi-api parses
 * sdk_language/sdk_version out of the User-Agent with exactly this regex.
 * If a UA stops matching it, the request still succeeds but the SDK becomes
 * invisible in adoption reporting — a silent failure that no HTTP-level test
 * would catch. These tests pin the contract from the SDK side.
 *
 * Keep in step with app/services/minimal_analytics_service.rb (detect_sdk_info).
 */
const SERVER_SDK_REGEX = /oilpriceapi-([a-z0-9-]+)\/v?([\d]+\.[\d]+\.?[\d]*)/i;

describe("server attribution contract", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({ status: "success", data: { price: 75.5, code: "WTI_USD" } }),
      headers: new Map([["content-type", "application/json"]]),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("HTTP User-Agent parses to language=node and the real SDK version", async () => {
    const { SDK_VERSION } = await import("../src/index.js");
    const client = new OilPriceAPI({ apiKey: "test_key" });

    await client.getLatestPrices();

    const [, options] = mockFetch.mock.calls[0];
    const match = SERVER_SDK_REGEX.exec(options.headers["User-Agent"]);

    expect(match).not.toBeNull();
    expect(match![1]).toBe("node");
    expect(match![2]).toBe(SDK_VERSION);
  });

  it("demo (unauthenticated) requests are attributed identically", async () => {
    const { SDK_VERSION } = await import("../src/index.js");
    const client = new OilPriceAPI({ apiKey: "test_key" });

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ status: "success", data: { commodities: [] } }),
      headers: new Map([["content-type", "application/json"]]),
    });

    await client.getDemoCommodities();

    const [, options] = mockFetch.mock.calls[0];
    const match = SERVER_SDK_REGEX.exec(options.headers["User-Agent"]);

    expect(match).not.toBeNull();
    expect(match![1]).toBe("node");
    expect(match![2]).toBe(SDK_VERSION);
  });
});
