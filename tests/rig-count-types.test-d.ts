/**
 * #104 — the EI rig-count types must describe what production returns.
 *
 * `latest()` and `get(id)` return the full weekly report; `list()` returns
 * summary rows. All three were typed as one `RigCountRecord` whose fields —
 * `total_rigs`, `date`, `timestamp`, `week` — appear on neither payload, so
 * `latest.total_rigs` compiled and printed `undefined`.
 *
 * The transport ends in `as T`, so only type-level assertions hold this
 * contract. Shapes verified against live production 2026-09-13:
 *   GET /v1/ei/rig_counts         -> data: [{ id, report_date, status, summary }]
 *   GET /v1/ei/rig_counts/latest  -> data: { id, report_date, source, last_updated,
 *                                            us_total, basins, top_states, drilling_type }
 *   GET /v1/ei/rig_counts/:id     -> same keys as /latest
 */
import { describe, it, expectTypeOf } from "vitest";
import type { EIRigCountsResource } from "../src/index.js";

type Latest = Awaited<ReturnType<EIRigCountsResource["latest"]>>;
type ById = Awaited<ReturnType<EIRigCountsResource["get"]>>;
type ListRow = Awaited<ReturnType<EIRigCountsResource["list"]>>[number];

describe("#104 latest() describes the weekly report", () => {
  it("declares the report's top-level fields", () => {
    expectTypeOf<Latest>().toHaveProperty("id");
    expectTypeOf<Latest>().toHaveProperty("report_date");
    expectTypeOf<Latest>().toHaveProperty("source");
    expectTypeOf<Latest>().toHaveProperty("last_updated");
    expectTypeOf<Latest>().toHaveProperty("us_total");
    expectTypeOf<Latest>().toHaveProperty("basins");
    expectTypeOf<Latest>().toHaveProperty("top_states");
    expectTypeOf<Latest>().toHaveProperty("drilling_type");
  });

  it("nests the US totals under us_total", () => {
    expectTypeOf<Latest["us_total"]>().toHaveProperty("total_rigs");
    expectTypeOf<Latest["us_total"]>().toHaveProperty("oil_rigs");
    expectTypeOf<Latest["us_total"]>().toHaveProperty("gas_rigs");
    expectTypeOf<Latest["us_total"]>().toHaveProperty("misc_rigs");
    expectTypeOf<Latest["us_total"]>().toHaveProperty("week_over_week");
  });

  it("types basins as a slug-keyed map and top_states as a list", () => {
    expectTypeOf<Latest["basins"][string]>().toHaveProperty("count");
    expectTypeOf<Latest["basins"][string]>().toHaveProperty("wow");
    expectTypeOf<Latest["top_states"][number]>().toHaveProperty("state");
    expectTypeOf<Latest["top_states"][number]>().toHaveProperty("count");
    expectTypeOf<Latest["drilling_type"]>().toHaveProperty("horizontal");
  });

  it("no longer claims top-level fields the API never sends", () => {
    // @ts-expect-error — total_rigs lives under us_total
    expectTypeOf<Latest>().toHaveProperty("total_rigs");
    // @ts-expect-error — the report carries report_date, not date
    expectTypeOf<Latest>().toHaveProperty("date");
    // @ts-expect-error — the report carries last_updated, not timestamp
    expectTypeOf<Latest>().toHaveProperty("timestamp");
  });
});

describe("#104 get(id) returns the same report shape as latest()", () => {
  it("is the report, not a summary row", () => {
    expectTypeOf<ById>().toEqualTypeOf<Latest>();
  });
});

describe("#104 list() describes the summary rows", () => {
  it("declares id, report_date, status and summary", () => {
    expectTypeOf<ListRow>().toHaveProperty("id");
    expectTypeOf<ListRow>().toHaveProperty("report_date");
    expectTypeOf<ListRow>().toHaveProperty("status");
    expectTypeOf<ListRow>().toHaveProperty("summary");
  });

  it("does not claim report fields a summary row lacks", () => {
    // @ts-expect-error — a summary row has no rig totals
    expectTypeOf<ListRow>().toHaveProperty("total_rigs");
    // @ts-expect-error — a summary row has no us_total block
    expectTypeOf<ListRow>().toHaveProperty("us_total");
  });
});
