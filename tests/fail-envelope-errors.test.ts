/**
 * #111 — an error must carry the API's explanation, whatever envelope it uses.
 *
 * A large family of routes answers failures with the JSend fail envelope,
 * `{ status: "fail", data: { error, ... } }` (`render_fail` in the API's
 * `V1::BaseController`). `errorFromResponse` read only the top level and a
 * nested `error` object, so every one of these surfaced as the bare status
 * line — `HTTP 404: Not Found` — with the reason buried in `rawBody`.
 *
 * Every body below except the 402 is verbatim from `api.oilpriceapi.com` on
 * 2026-09-13. The 402 follows `AgentUpgradeTriggers#render_agent_upgrade_required`
 * on `origin/main`; it could not be provoked live on the test account's tier.
 * All assertions drive the REAL client through a REAL `fetch` mock.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { OilPriceAPI, NotFoundError, OilPriceAPIError, isQuotaError } from "../src/index.js";

const KEY = "fixture_key_not_a_real_credential";

function serve(body: unknown, status: number, statusText: string): void {
  vi.spyOn(global, "fetch").mockImplementation(
    (async () =>
      new Response(JSON.stringify(body), {
        status,
        statusText,
        headers: { "content-type": "application/json" },
      })) as unknown as typeof fetch,
  );
}

const call = (path: string): Promise<OilPriceAPIError> =>
  new OilPriceAPI({ apiKey: KEY, retries: 0 })
    ["request"](path, {})
    .then(() => {
      throw new Error("expected the request to fail");
    })
    .catch((e: OilPriceAPIError) => e);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("#111 fail-envelope reasons reach error.message", () => {
  it("404 unknown carrier", async () => {
    const body = {
      status: "fail",
      data: {
        error:
          "Unknown carrier 'nope'. Covered carriers: odfl, saia, estes, xpo, abf, tforce, averitt, southeastern-freight.",
        covered_carriers: [
          "odfl",
          "saia",
          "estes",
          "xpo",
          "abf",
          "tforce",
          "averitt",
          "southeastern-freight",
        ],
        hint: "Call GET /v1/fuel-surcharge to list every covered carrier with its latest surcharge.",
      },
    };
    serve(body, 404, "Not Found");
    const error = await call("/v1/fuel-surcharge/nope/latest");

    expect(error).toBeInstanceOf(NotFoundError);
    expect(error.message).toBe(body.data.error);
    expect(error.rawBody).toEqual(body);
  });

  it("400 missing service_level", async () => {
    const body = {
      status: "fail",
      data: {
        error: "Parcel fuel-surcharge history requires a service_level parameter.",
        carrier: "ups",
        available_service_levels: [
          "air",
          "ground",
          "international_air_export",
          "international_air_import",
          "international_ground",
        ],
      },
    };
    serve(body, 400, "Bad Request");
    const error = await call("/v1/fuel-surcharge/parcel/ups/history");

    expect(error.statusCode).toBe(400);
    expect(error.message).toBe("Parcel fuel-surcharge history requires a service_level parameter.");
  });

  it("422 rig-count period", async () => {
    serve(
      {
        status: "fail",
        data: {
          error: "period is not supported by the latest endpoint; use /v1/rig-counts/historical",
        },
      },
      422,
      "Unprocessable Entity",
    );
    const error = await call("/v1/rig-counts/latest?period=1y");

    expect(error.statusCode).toBe(422);
    expect(error.message).toBe(
      "period is not supported by the latest endpoint; use /v1/rig-counts/historical",
    );
  });

  it("422 VALIDATION_ERROR: the machine code becomes code, the sentence becomes message", async () => {
    const body = {
      status: "fail",
      data: {
        error: "VALIDATION_ERROR",
        message: "Interval seconds is below your plan minimum of 60 seconds",
        details: { interval_seconds: ["is below your plan minimum of 60 seconds"] },
      },
    };
    serve(body, 422, "Unprocessable Entity");
    const error = await call("/v1/subscriptions/c27641db-012d-4a22-8939-e77fe05d7eb4");

    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.message).toBe("Interval seconds is below your plan minimum of 60 seconds");
    expect(error.rawBody).toEqual(body);
  });

  it("402 upgrade trigger keeps code, message and remediation URL", async () => {
    serve(
      {
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
      },
      402,
      "Payment Required",
    );
    const error = await call("/v1/subscriptions");

    expect(isQuotaError(error)).toBe(true);
    expect(error.code).toBe("WATCH_LIMIT");
    expect(error.message).toBe("Your plan allows up to 1 active watches. Upgrade for more.");
    expect(error.remediationUrl).toBe("https://www.oilpriceapi.com/pricing");
  });
});

describe("#111 existing envelopes are unchanged", () => {
  it("the canonical nested error object still wins", async () => {
    serve(
      {
        error: {
          code: "NOT_FOUND",
          message: "Subscription not found",
          status: 404,
          request_id: "3d88cfe9-2b09-470c-a84b-2501738ae7fc",
          docs: "https://docs.oilpriceapi.com#NOT_FOUND",
        },
      },
      404,
      "Not Found",
    );
    const error = await call("/v1/subscriptions/c27641db-012d-4a22-8939-e77fe05d7eb4");

    expect(error.message).toBe("Subscription not found");
    expect(error.code).toBe("NOT_FOUND");
    expect(error.requestId).toBe("3d88cfe9-2b09-470c-a84b-2501738ae7fc");
  });

  it("a top-level legacy error sentence is still the message, not a code", async () => {
    serve(
      {
        success: false,
        error: "Rig count data requires the Scale plan",
        upgrade_url: "https://www.oilpriceapi.com/pricing",
        required_tier: "scale",
      },
      403,
      "Forbidden",
    );
    const error = await call("/v1/rig-counts/summary");

    expect(error.message).toBe("Rig count data requires the Scale plan");
    expect(error.code).toBe("HTTP_ERROR");
  });

  it("a fail envelope with no reason still falls back to the status line", async () => {
    serve({ status: "fail", data: { covered_carriers: ["ups"] } }, 404, "Not Found");
    const error = await call("/v1/fuel-surcharge/parcel/ups/latest");

    expect(error.message).toBe("HTTP 404: Not Found");
  });

  it("the configured key is redacted from a fail-envelope reason", async () => {
    serve({ status: "fail", data: { error: `bad key ${KEY} rejected` } }, 400, "Bad Request");
    const error = await call("/v1/fuel-surcharge");

    expect(error.message).toBe("bad key [REDACTED] rejected");
    expect(JSON.stringify(error.rawBody)).not.toContain(KEY);
  });
});
