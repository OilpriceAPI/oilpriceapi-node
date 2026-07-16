import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { OilPriceAPI } from "../../src/client.js";
import { NotFoundError, OilPriceAPIError, ValidationError } from "../../src/errors.js";

/**
 * Well Production (client.wellProduction) unit tests — issue #32.
 *
 * Covers:
 * - Endpoint paths and query params for all /v1/well-production* routes
 *   (mocked private client.request, same pattern as ei.test.ts).
 * - Response-envelope unwrapping at the fetch level using live-captured
 *   { status: "success", data: { ... } } fixtures.
 * - Negative paths: entitlement (402/403), unsupported state (404),
 *   invalid API number (client-side + server 400), and empty successful
 *   responses.
 */
describe("WellProductionResource (client.wellProduction)", () => {
  let client: OilPriceAPI;

  beforeEach(() => {
    client = new OilPriceAPI({ apiKey: "test_key_123", retries: 0, retryDelay: 1 });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function spy(resolved: unknown) {
    return vi.spyOn(client as any, "request").mockResolvedValue(resolved);
  }

  /** Mock global fetch with a successful { status: "success", data } envelope. */
  function mockFetchSuccess(data: unknown) {
    return vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers(),
      text: async () => JSON.stringify({ status: "success", data }),
    } as Response);
  }

  /** Mock global fetch with an API error envelope (matches live error shape). */
  function mockFetchError(status: number, statusText: string, body: unknown) {
    return vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status,
      statusText,
      headers: new Headers(),
      text: async () => JSON.stringify(body),
    } as Response);
  }

  // ---------------------------------------------------------------------
  // Endpoint paths + params
  // ---------------------------------------------------------------------
  describe("endpoint mapping", () => {
    it("summary() hits GET /v1/well-production", async () => {
      const s = spy({ national: null, top_states: [] });
      await client.wellProduction.summary();
      expect(s).toHaveBeenCalledWith("/v1/well-production", {});
    });

    it("states() hits /states with no params by default", async () => {
      const s = spy({ period: "2026-04", count: 0, states: [] });
      await client.wellProduction.states();
      expect(s).toHaveBeenCalledWith("/v1/well-production/states", {});
    });

    it("states() passes period param", async () => {
      const s = spy({ period: "2026-04", count: 0, states: [] });
      await client.wellProduction.states({ period: "2026-04" });
      expect(s).toHaveBeenCalledWith("/v1/well-production/states", { period: "2026-04" });
    });

    it("stateDetail() hits /states/:code and passes date range", async () => {
      const s = spy({ state: "TX", period: { start: "s", end: "e" }, count: 0, data: [] });
      await client.wellProduction.stateDetail("TX", {
        start_date: "2026-01-01",
        end_date: "2026-06-30",
      });
      expect(s).toHaveBeenCalledWith("/v1/well-production/states/TX", {
        start_date: "2026-01-01",
        end_date: "2026-06-30",
      });
    });

    it("wellDetail() normalizes separators and hits /wells/:api", async () => {
      const s = spy({ api_number: "42477311220000", count: 0, data: [] });
      await client.wellProduction.wellDetail("42-477-31122-00-00");
      expect(s).toHaveBeenCalledWith("/v1/well-production/wells/42477311220000", {});
    });

    it("topProducers() stringifies limit/months and passes state_code", async () => {
      const s = spy({ state: "NM", period: { start: "s", end: "e" }, count: 0, producers: [] });
      await client.wellProduction.topProducers({ state_code: "NM", limit: 5, months: 6 });
      expect(s).toHaveBeenCalledWith("/v1/well-production/top-producers", {
        state_code: "NM",
        limit: "5",
        months: "6",
      });
    });

    it("cycleTime() passes all supported filters", async () => {
      const s = spy({
        filters: {},
        well_count: 0,
        wells_with_cycle_data: 0,
        cycle_time_stats: {},
        stage_breakdown: {},
        quarterly_cohorts: {},
        top_fastest: [],
        top_slowest: [],
      });
      await client.wellProduction.cycleTime({
        state: "TX",
        start_date: "2025-01-01",
        end_date: "2025-12-31",
        operator: "Comstock",
        formation: "Eagle Ford",
        lat: 31.5,
        lng: -102.1,
        radius_miles: 25,
      });
      expect(s).toHaveBeenCalledWith("/v1/well-production/cycle-time", {
        state: "TX",
        start_date: "2025-01-01",
        end_date: "2025-12-31",
        operator: "Comstock",
        formation: "Eagle Ford",
        lat: "31.5",
        lng: "-102.1",
        radius_miles: "25",
      });
    });

    it("cycleTimeCohorts() passes filters and group_by", async () => {
      const s = spy({ group_by: "quarter", cohorts: {} });
      await client.wellProduction.cycleTimeCohorts({ state: "TX", group_by: "state" });
      expect(s).toHaveBeenCalledWith("/v1/well-production/cycle-time/cohorts", {
        state: "TX",
        group_by: "state",
      });
    });
  });

  // ---------------------------------------------------------------------
  // Client-side validation
  // ---------------------------------------------------------------------
  describe("validation", () => {
    it("stateDetail() rejects empty state code", async () => {
      await expect(client.wellProduction.stateDetail("")).rejects.toThrow(ValidationError);
      await expect(client.wellProduction.stateDetail("")).rejects.toThrow(
        "State code must be a non-empty string",
      );
    });

    it("wellDetail() rejects empty API number", async () => {
      await expect(client.wellProduction.wellDetail("")).rejects.toThrow(ValidationError);
    });

    it("wellDetail() rejects API numbers without 14 digits", async () => {
      await expect(client.wellProduction.wellDetail("1234")).rejects.toThrow(
        "API number must be 14 digits",
      );
      await expect(client.wellProduction.wellDetail("42-477-31122-00-001")).rejects.toThrow(
        ValidationError,
      );
    });
  });

  // ---------------------------------------------------------------------
  // Response envelopes (fetch-level, live-captured fixtures)
  // ---------------------------------------------------------------------
  describe("response envelopes", () => {
    it("summary() unwraps { status, data } and preserves national/top_states/coverage", async () => {
      // Fixture captured from live GET /v1/well-production (2026-07-13).
      mockFetchSuccess({
        national: {
          period: "2026-07",
          oil_bbl: 0,
          gas_mcf: 0,
          water_bbl: 0,
          boe: 0,
          days_producing: null,
          source: "market_reporting",
        },
        top_states: [
          {
            state: "TX",
            period: "2026-04",
            oil_bbl: 174743000,
            oil_bpd: 5824767,
            gas_mcf: 1164406000,
            boe: 368810667,
          },
        ],
        data_sources: { state_aggregates: "EIA API v2 (monthly)" },
        coverage: { well_level_states_with_data: ["AK", "ND", "NM", "PA", "TX"] },
      });

      const summary = await client.wellProduction.summary();
      expect(summary.national?.source).toBe("market_reporting");
      expect(summary.top_states[0].state).toBe("TX");
      expect(summary.top_states[0].oil_bpd).toBe(5824767);
      expect(summary.coverage?.well_level_states_with_data).toContain("TX");
    });

    it("stateDetail() returns the state history envelope", async () => {
      // Fixture captured from live GET /v1/well-production/states/TX (2026-07-13).
      mockFetchSuccess({
        state: "TX",
        period: { start: "2026-01-01", end: "2026-07-13" },
        count: 1,
        data: [
          {
            period: "2026-01",
            oil_bbl: 172442000,
            gas_mcf: 1156809000,
            water_bbl: null,
            boe: 365243500,
            days_producing: null,
            source: "eia_api",
          },
        ],
      });

      const detail = await client.wellProduction.stateDetail("TX");
      expect(detail.state).toBe("TX");
      expect(detail.count).toBe(1);
      expect(detail.data[0].source).toBe("eia_api");
      expect(detail.data[0].water_bbl).toBeNull();
    });

    it("cycleTimeCohorts() returns group_by and cohort stats", async () => {
      // Fixture captured from live GET /v1/well-production/cycle-time/cohorts?state=TX.
      mockFetchSuccess({
        group_by: "quarter",
        cohorts: {
          "2025-Q3": {
            well_count: 1,
            wells_with_data: 1,
            stats: {
              count: 1,
              median_days: 46,
              p25_days: 46,
              p75_days: 46,
              p90_days: 46,
              min_days: 46,
              max_days: 46,
              avg_days: 46,
            },
          },
        },
      });

      const cohorts = await client.wellProduction.cycleTimeCohorts({ state: "TX" });
      expect(cohorts.group_by).toBe("quarter");
      expect(cohorts.cohorts["2025-Q3"].stats.median_days).toBe(46);
    });
  });

  // ---------------------------------------------------------------------
  // Negative paths
  // ---------------------------------------------------------------------
  describe("negative paths", () => {
    it("maps 403 ENTERPRISE_REQUIRED (live entitlement gate) to OilPriceAPIError", async () => {
      // Live shape: { error: { code: 'ENTERPRISE_REQUIRED', message, status: 403 } }
      mockFetchError(403, "Forbidden", {
        error: {
          code: "ENTERPRISE_REQUIRED",
          message: "Well production data requires the Scale plan.",
          status: 403,
        },
      });

      const err = await client.wellProduction.summary().catch((e) => e);
      expect(err).toBeInstanceOf(OilPriceAPIError);
      expect(err.statusCode).toBe(403);
      expect(err).not.toBeInstanceOf(NotFoundError);
    });

    it("maps 402 payment-required entitlement responses to OilPriceAPIError", async () => {
      mockFetchError(402, "Payment Required", {
        message: "Upgrade required to access well production data.",
      });

      const err = await client.wellProduction.states().catch((e) => e);
      expect(err).toBeInstanceOf(OilPriceAPIError);
      expect(err.statusCode).toBe(402);
      expect(err.message).toContain("Upgrade required");
    });

    it("maps 404 DATA_NOT_AVAILABLE (unsupported state) to NotFoundError", async () => {
      // Fixture captured from live GET /v1/well-production/states/ZZ (2026-07-13).
      mockFetchError(404, "Not Found", {
        error: {
          code: "DATA_NOT_AVAILABLE",
          message: "No production data for state: ZZ",
          status: 404,
        },
      });

      await expect(client.wellProduction.stateDetail("ZZ")).rejects.toThrow(NotFoundError);
    });

    it("maps 404 for a well with no production data to NotFoundError", async () => {
      mockFetchError(404, "Not Found", {
        error: {
          code: "DATA_NOT_AVAILABLE",
          message: "No production data for well: 99999999999999",
          status: 404,
        },
      });

      await expect(client.wellProduction.wellDetail("99999999999999")).rejects.toThrow(
        NotFoundError,
      );
    });

    it("maps server-side 400 INVALID_PARAMETER to OilPriceAPIError with status 400", async () => {
      // e.g. states({ period: 'bad-format' }) → 400 on some deployments.
      mockFetchError(400, "Bad Request", {
        error: {
          code: "INVALID_PARAMETER",
          message: "Invalid period format. Use YYYY-MM.",
          status: 400,
        },
      });

      const err = await client.wellProduction.states({ period: "bad" }).catch((e) => e);
      expect(err).toBeInstanceOf(OilPriceAPIError);
      expect(err.statusCode).toBe(400);
    });

    it("handles empty successful responses (no states for period)", async () => {
      // Live behaviour for GET /v1/well-production/states?period=<unknown>.
      mockFetchSuccess({ period: "1990-01", count: 0, states: [] });

      const res = await client.wellProduction.states({ period: "1990-01" });
      expect(res.count).toBe(0);
      expect(res.states).toEqual([]);
    });

    it("handles empty top-producers responses", async () => {
      mockFetchSuccess({
        state: "TX",
        period: { start: "2025-07-13", end: "2026-07-13" },
        count: 0,
        producers: [],
      });

      const res = await client.wellProduction.topProducers();
      expect(res.count).toBe(0);
      expect(res.producers).toEqual([]);
    });
  });
});
