import { describe, it, expect, vi } from "vitest";
import { OilPriceAPI, AuthenticationError } from "../src/index.js";

describe("OilPriceAPI", () => {
  it("should throw error if API key is missing", () => {
    const saved = process.env.OILPRICEAPI_KEY;
    delete process.env.OILPRICEAPI_KEY;
    try {
      expect(() => {
        new OilPriceAPI({ apiKey: "" });
      }).toThrow("API key required");
    } finally {
      if (saved) process.env.OILPRICEAPI_KEY = saved;
    }
  });

  it("should initialize with valid API key", () => {
    const client = new OilPriceAPI({ apiKey: "test_key" });
    expect(client).toBeInstanceOf(OilPriceAPI);
  });

  it("should use custom baseUrl if provided", () => {
    const client = new OilPriceAPI({
      apiKey: "test_key",
      baseUrl: "https://custom.api.com",
    });
    expect(client).toBeInstanceOf(OilPriceAPI);
  });

  // Note: Integration tests with real API would go here
  // For now, keeping tests minimal for crawl version
});
