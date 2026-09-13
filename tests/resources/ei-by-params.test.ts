/**
 * #105 — the six EI by-* methods must send the parameter their route requires.
 *
 * Every assertion reads the URL handed to the REAL outbound `fetch`. Pre-fix
 * the methods took no arguments, so `state` / `operator` / `formation` /
 * `cas` / `name` could never reach the wire and every call was a guaranteed
 * HTTP 400. (The issue's second claim — that the API answers that failure
 * with HTTP 200 — was refuted by re-probing production on 2026-09-13: all six
 * routes return 400, and the SDK's error path fires. Nothing here models a
 * 200-on-failure.)
 *
 * The routes are paginated (`meta.total_count`, default 25, max 100), so the
 * methods return the page envelope rather than a bare array: an array would
 * hand back one page of a 420,354-row result with nothing saying so.
 *
 * Fixtures in tests/fixtures/ei/ are verbatim from live production on
 * 2026-09-13, requested with per_page=1; the only edit is trimming
 * `meta.state_health` to three keys.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { OilPriceAPI, ValidationError } from "../../src/index.js";

const KEY = "fixture_key_not_a_real_credential";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;
const fixture = (name: string): Json =>
  JSON.parse(readFileSync(`tests/fixtures/ei/${name}.json`, "utf8"));

interface Wire {
  pathname: string;
  params: Record<string, string>;
}

function serve(body: unknown, status = 200): Wire[] {
  const wire: Wire[] = [];
  vi.spyOn(global, "fetch").mockImplementation((async (input: unknown) => {
    const url = new URL(String(input));
    wire.push({ pathname: url.pathname, params: Object.fromEntries(url.searchParams) });
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch);
  return wire;
}

const client = () => new OilPriceAPI({ apiKey: KEY, retries: 0 });

afterEach(() => {
  vi.restoreAllMocks();
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyMethod = (...args: any[]) => Promise<any>;
const method = (c: OilPriceAPI, resource: "wellPermits" | "fracFocus", name: string) =>
  (c.ei[resource] as unknown as Record<string, AnyMethod>)[name].bind(c.ei[resource]);

const WELL_PERMIT_CASES = [
  { name: "byState", value: "TX", param: "state", path: "/v1/ei/well-permits/by-state", fx: "wp-by-state" },
  { name: "byOperator", value: "EOG", param: "operator", path: "/v1/ei/well-permits/by-operator", fx: "wp-by-operator" },
  { name: "byFormation", value: "Wolfcamp", param: "formation", path: "/v1/ei/well-permits/by-formation", fx: "wp-by-formation" },
] as const;

const FRAC_FOCUS_CASES = [
  { name: "byState", value: "TX", param: "state", path: "/v1/ei/frac-focus/by-state", fx: "ff-by-state" },
  { name: "byOperator", value: "EOG", param: "operator", path: "/v1/ei/frac-focus/by-operator", fx: "ff-by-operator" },
] as const;

describe("#105 wellPermits by-* send the required parameter", () => {
  for (const tc of WELL_PERMIT_CASES) {
    it(`${tc.name}("${tc.value}") puts ${tc.param}=${tc.value} on the wire`, async () => {
      const wire = serve(fixture(tc.fx));
      await method(client(), "wellPermits", tc.name)(tc.value);

      expect(wire).toHaveLength(1);
      expect(wire[0].pathname).toBe(tc.path);
      expect(wire[0].params[tc.param]).toBe(tc.value);
    });

    it(`${tc.name}() returns the page envelope, so the total is visible`, async () => {
      const body = fixture(tc.fx);
      serve(body);
      const page = await method(client(), "wellPermits", tc.name)(tc.value);

      expect(page.well_permits[0].api_number).toBe(body.data.well_permits[0].api_number);
      expect(page.well_permits[0].operator.name).toBe(body.data.well_permits[0].operator.name);
      expect(page.meta.total_count).toBe(body.data.meta.total_count);
    });

    for (const bad of [undefined, "", "   "]) {
      it(`${tc.name}(${JSON.stringify(bad)}) throws ValidationError and sends nothing`, async () => {
        const wire = serve(fixture(tc.fx));
        await expect(method(client(), "wellPermits", tc.name)(bad)).rejects.toBeInstanceOf(
          ValidationError,
        );
        expect(wire).toHaveLength(0);
      });
    }
  }

  it("passes page and perPage through as page / per_page", async () => {
    const wire = serve(fixture("wp-by-state"));
    await method(client(), "wellPermits", "byState")("TX", { page: 2, perPage: 50 });

    expect(wire[0].params.page).toBe("2");
    expect(wire[0].params.per_page).toBe("50");
  });

  it("always sends an explicit per_page, so meta.per_page matches the rows served", async () => {
    // Measured 2026-09-13: with no per_page the routes serve 100 rows while
    // meta.per_page reports 25. With an explicit per_page the two agree.
    const wire = serve(fixture("wp-by-state"));
    await method(client(), "wellPermits", "byState")("TX");

    expect(wire[0].params.per_page).toBeDefined();
  });
});

describe("#105 fracFocus by-* send the required parameter", () => {
  for (const tc of FRAC_FOCUS_CASES) {
    it(`${tc.name}("${tc.value}") puts ${tc.param}=${tc.value} on the wire`, async () => {
      const wire = serve(fixture(tc.fx));
      await method(client(), "fracFocus", tc.name)(tc.value);

      expect(wire).toHaveLength(1);
      expect(wire[0].pathname).toBe(tc.path);
      expect(wire[0].params[tc.param]).toBe(tc.value);
    });

    it(`${tc.name}() returns the page envelope, so the total is visible`, async () => {
      const body = fixture(tc.fx);
      serve(body);
      const page = await method(client(), "fracFocus", tc.name)(tc.value);

      expect(page.frac_focus_disclosures[0].upload_key).toBe(
        body.data.frac_focus_disclosures[0].upload_key,
      );
      expect(page.meta.total_count).toBe(body.data.meta.total_count);
    });

    for (const bad of [undefined, "", "   "]) {
      it(`${tc.name}(${JSON.stringify(bad)}) throws ValidationError and sends nothing`, async () => {
        const wire = serve(fixture(tc.fx));
        await expect(method(client(), "fracFocus", tc.name)(bad)).rejects.toBeInstanceOf(
          ValidationError,
        );
        expect(wire).toHaveLength(0);
      });
    }
  }

  it("byChemical({ cas }) sends cas — the param the route reads, not cas_number", async () => {
    const wire = serve(fixture("ff-by-chemical"));
    await method(client(), "fracFocus", "byChemical")({ cas: "7732-18-5" });

    expect(wire[0].pathname).toBe("/v1/ei/frac-focus/by-chemical");
    expect(wire[0].params.cas).toBe("7732-18-5");
    expect(wire[0].params.cas_number).toBeUndefined();
  });

  it("byChemical({ name }) sends name", async () => {
    const wire = serve(fixture("ff-by-chemical"));
    await method(client(), "fracFocus", "byChemical")({ name: "Water" });

    expect(wire[0].params.name).toBe("Water");
  });

  it("byChemical() returns the page envelope", async () => {
    const body = fixture("ff-by-chemical");
    serve(body);
    const page = await method(client(), "fracFocus", "byChemical")({ cas: "7732-18-5" });

    expect(page.frac_focus_disclosures).toHaveLength(1);
    expect(page.meta.total_count).toBe(body.data.meta.total_count);
  });

  for (const bad of [undefined, {}, { cas: "" }, { name: "  " }]) {
    it(`byChemical(${JSON.stringify(bad)}) throws ValidationError and sends nothing`, async () => {
      const wire = serve(fixture("ff-by-chemical"));
      await expect(method(client(), "fracFocus", "byChemical")(bad)).rejects.toBeInstanceOf(
        ValidationError,
      );
      expect(wire).toHaveLength(0);
    });
  }
});

describe("#105 a 400 from a by-* route surfaces as an error", () => {
  it("does not resolve on the route's own fail body", async () => {
    // Verbatim fail body; production returns it with HTTP 400.
    serve(
      {
        status: "fail",
        data: {
          error:
            "Invalid state. Supported: TX, OK, NM, CO, ND, PA, WY, MT, LA, KS, CA, AK, OH, WV, AR, MS, UT, NE, NY, MI, FL, IN, TN, KY, VA, IL, AL",
        },
      },
      400,
    );

    await expect(method(client(), "wellPermits", "byState")("ZZ")).rejects.toThrow();
  });
});
