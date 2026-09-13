/**
 * #105 — type-level contract for the six EI by-* methods.
 *
 * The transport ends in `as T`, so a wrong element type compiles cleanly and
 * only these assertions hold it. Shapes verified against live production on
 * 2026-09-13 (fixtures in tests/fixtures/ei/).
 */
import { describe, it, expectTypeOf } from "vitest";
import type { OilPriceAPI, LatestWellPermit } from "../src/index.js";

type WP = OilPriceAPI["ei"]["wellPermits"];
type FF = OilPriceAPI["ei"]["fracFocus"];

declare const wp: WP;
declare const ff: FF;

describe("#105 wellPermits by-* signatures", () => {
  it("require the value the route filters on", () => {
    expectTypeOf<WP["byState"]>().parameter(0).toEqualTypeOf<string>();
    expectTypeOf<WP["byOperator"]>().parameter(0).toEqualTypeOf<string>();
    expectTypeOf<WP["byFormation"]>().parameter(0).toEqualTypeOf<string>();
  });

  it("cannot be called without it", () => {
    // @ts-expect-error — state is required
    void wp.byState();
    // @ts-expect-error — operator is required
    void wp.byOperator();
    // @ts-expect-error — formation is required
    void wp.byFormation();
  });

  it("return a page of individual permit records, not per-state aggregates", () => {
    type Page = Awaited<ReturnType<WP["byState"]>>;
    expectTypeOf<Page>().toHaveProperty("well_permits");
    expectTypeOf<Page["well_permits"][number]>().toEqualTypeOf<LatestWellPermit>();
    expectTypeOf<Page["meta"]>().toHaveProperty("total_count");
    expectTypeOf<Page["meta"]>().toHaveProperty("total_pages");
  });
});

describe("#105 fracFocus by-* signatures", () => {
  it("require the value the route filters on", () => {
    expectTypeOf<FF["byState"]>().parameter(0).toEqualTypeOf<string>();
    expectTypeOf<FF["byOperator"]>().parameter(0).toEqualTypeOf<string>();
    expectTypeOf<FF["byChemical"]>().parameter(0).toHaveProperty("cas");
    expectTypeOf<FF["byChemical"]>().parameter(0).toHaveProperty("name");
  });

  it("cannot be called without it", () => {
    // @ts-expect-error — state is required
    void ff.byState();
    // @ts-expect-error — operator is required
    void ff.byOperator();
    // @ts-expect-error — a cas or name query is required
    void ff.byChemical();
  });

  it("return a page of individual disclosure records", () => {
    type Page = Awaited<ReturnType<FF["byChemical"]>>;
    expectTypeOf<Page>().toHaveProperty("frac_focus_disclosures");
    type Row = Page["frac_focus_disclosures"][number];
    expectTypeOf<Row>().toHaveProperty("upload_key");
    expectTypeOf<Row>().toHaveProperty("api_number");
    expectTypeOf<Row>().toHaveProperty("water");
    expectTypeOf<Row>().toHaveProperty("job");
    expectTypeOf<Page["meta"]>().toHaveProperty("total_count");
  });
});
