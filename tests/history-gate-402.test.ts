/**
 * api#10744: from 2026-11-16 /v1/prices/historical and /v1/prices/history join
 * the paid history gate. The 402 carries its link only as `upgrade.url`; there
 * is no top-level `upgrade_url`. Body shape follows
 * `V1::PricesController#require_paid_tier_for_historical` on oilpriceapi-api
 * main (`render_standard_error`, whose top-level merge replaces the `error`
 * object with the legacy string).
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { OilPriceAPI, OilPriceAPIError, isQuotaError } from "../src/index.js";

const KEY = "fixture_key_not_a_real_credential";
const UPGRADE_URL =
  "https://www.oilpriceapi.com/pricing?utm_source=api&utm_medium=402&utm_campaign=historical_gate&ref=1";

const GATE_402 = {
  error: "Historical data requires paid access",
  error_code: "UPGRADE_REQUIRED",
  message:
    "Historical price data (past_day, past_week, past_month, past_year, historical, history) requires a paid plan. " +
    "Latest prices (/v1/prices/latest) are available on the Free tier.",
  reason: "not_entitled",
  blocked: {
    feature: "historical",
    endpoint: "/v1/prices/historical",
    requires_paid_plan: ["/v1/prices/historical", "/v1/prices/history"],
  },
  current_plan: { name: "Free", limit: 200, features: ["Latest prices (/latest)"] },
  upgrade: { url: UPGRADE_URL, recommended_plan: "Exploration" },
};

function serve(body: unknown): void {
  vi.spyOn(global, "fetch").mockImplementation(
    (async () =>
      new Response(JSON.stringify(body), {
        status: 402,
        statusText: "Payment Required",
        headers: { "content-type": "application/json" },
      })) as unknown as typeof fetch,
  );
}

async function historicalError(): Promise<OilPriceAPIError> {
  const client = new OilPriceAPI({ apiKey: KEY, retries: 0 });
  try {
    await client.getHistoricalPrices({ commodity: "WTI_USD", startDate: "2026-10-01", endDate: "2026-11-01" });
  } catch (error) {
    return error as OilPriceAPIError;
  }
  throw new Error("expected a 402");
}

describe("history gate 402 (api#10744)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("exposes the nested upgrade.url as remediationUrl", async () => {
    serve(GATE_402);
    const error = await historicalError();
    expect(error).toBeInstanceOf(OilPriceAPIError);
    expect(isQuotaError(error)).toBe(true);
    expect(error.code).toBe("UPGRADE_REQUIRED");
    expect(error.message).toContain("requires a paid plan");
    expect(error.remediationUrl).toBe(UPGRADE_URL);
  });

  it("prefers a top-level upgrade_url when one is sent", async () => {
    serve({ ...GATE_402, upgrade_url: "https://example.test/top" });
    expect((await historicalError()).remediationUrl).toBe("https://example.test/top");
  });

  it("leaves remediationUrl undefined when no link is sent", async () => {
    const { upgrade: _omit, ...body } = GATE_402;
    serve(body);
    expect((await historicalError()).remediationUrl).toBeUndefined();
  });
});
