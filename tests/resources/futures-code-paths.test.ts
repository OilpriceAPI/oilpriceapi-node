import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { OilPriceAPI } from "../../src/client.js";
import { futuresPathSlug } from "../../src/resources/futures.js";
import type { FuturesCurveData } from "../../src/resources/futures.js";

// #152: the per-family futures routes accept family slugs only. Checked live
// 2026-11-14 with a paid key: /v1/futures/CL/curve, /CL/historical, /CL/ohlc and
// /CL/intraday were 404; the same paths with `wti` were 200.
const curveFixture = JSON.parse(
  readFileSync(new URL("../fixtures/futures/wti-curve-2026-11-13.json", import.meta.url), "utf8"),
) as FuturesCurveData;

describe("futures contract-code paths (#152)", () => {
  let client: OilPriceAPI;
  let requestSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    client = new OilPriceAPI({ apiKey: "test_key_123" });
    requestSpy = vi.spyOn(client as any, "request").mockResolvedValue(curveFixture);
  });

  it.each([
    ["CL", "wti"],
    ["cl", "wti"],
    ["BZ", "brent"],
    ["NG", "natural-gas"],
    ["wti", "wti"],
    ["ice-wti", "ice-wti"],
  ])("curve(%s) requests /v1/futures/%s/curve", async (code, slug) => {
    await client.futures.curve(code);
    expect(requestSpy).toHaveBeenCalledWith(`/v1/futures/${slug}/curve`, {});
  });

  it("historical, ohlc and intraday map a contract code to its slug", async () => {
    requestSpy.mockResolvedValue([]);
    await client.futures.historical("CL");
    await client.futures.ohlc("BZ");
    await client.futures.intraday("NG");
    expect(requestSpy).toHaveBeenNthCalledWith(1, "/v1/futures/wti/historical", {});
    expect(requestSpy).toHaveBeenNthCalledWith(2, "/v1/futures/brent/ohlc", {});
    expect(requestSpy).toHaveBeenNthCalledWith(3, "/v1/futures/natural-gas/intraday", {});
  });

  it("passes an unlisted slug through unchanged", () => {
    expect(futuresPathSlug("gold")).toBe("gold");
    expect(futuresPathSlug("CL.1")).toBe("CL.1");
  });

  it("types the recorded live curve response", async () => {
    const curve = await client.futures.curve("CL");
    expect(curve.analysis_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(curve.contracts?.length).toBeGreaterThan(0);
    const first = curve.contracts![0];
    expect(typeof first.settlement_price).toBe("number");
    expect(first.contract_month).toMatch(/^\d{4}-\d{2}$/);
    expect(curve.front_month?.contract_code).toMatch(/^WTI_FUTURES_/);
  });
});
