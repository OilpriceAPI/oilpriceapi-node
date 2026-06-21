import { describe, it, expect, beforeEach, vi } from "vitest";
import { OilPriceAPI } from "../../src/client.js";

/**
 * Energy Intelligence (ei.*) unit tests.
 *
 * Mocks the private client.request and asserts each sub-resource method hits
 * the correct endpoint, passes the right params, and unwraps list envelopes.
 * Previously the entire ei.* namespace had zero test coverage.
 */
describe("EnergyIntelligenceResource (ei.*)", () => {
  let client: OilPriceAPI;

  beforeEach(() => {
    client = new OilPriceAPI({ apiKey: "test_key_123" });
    vi.clearAllMocks();
  });

  function spy(resolved: unknown) {
    return vi.spyOn(client as any, "request").mockResolvedValue(resolved);
  }

  // -------------------------------------------------------------------------
  // rigCounts
  // -------------------------------------------------------------------------
  describe("rigCounts", () => {
    it("list() unwraps array directly", async () => {
      const s = spy([{ id: "1", total_rigs: 600, date: "d", timestamp: "t" }]);
      const r = await client.ei.rigCounts.list();
      expect(s).toHaveBeenCalledWith("/v1/ei/rig_counts", {});
      expect(r).toHaveLength(1);
    });

    it("list() unwraps { data } envelope", async () => {
      spy({ data: [{ id: "1", total_rigs: 1, date: "d", timestamp: "t" }] });
      const r = await client.ei.rigCounts.list();
      expect(r).toHaveLength(1);
    });

    it("get() validates id and hits id endpoint", async () => {
      await expect(client.ei.rigCounts.get("")).rejects.toThrow(
        "Record ID must be a non-empty string",
      );
      const s = spy({ id: "abc", total_rigs: 1, date: "d", timestamp: "t" });
      await client.ei.rigCounts.get("abc");
      expect(s).toHaveBeenCalledWith("/v1/ei/rig_counts/abc", {});
    });

    it("latest/byBasin/byState/historical hit correct endpoints", async () => {
      const s = spy([]);
      spy({ id: "1", total_rigs: 1, date: "d", timestamp: "t" });
      await client.ei.rigCounts.latest();
      expect(s).toHaveBeenLastCalledWith("/v1/ei/rig_counts/latest", {});

      spy([]);
      await client.ei.rigCounts.byBasin();
      await client.ei.rigCounts.byState();
      await client.ei.rigCounts.historical();
      const calls = (client as any).request.mock.calls.map((c: any[]) => c[0]);
      expect(calls).toContain("/v1/ei/rig_counts/by_basin");
      expect(calls).toContain("/v1/ei/rig_counts/by_state");
      expect(calls).toContain("/v1/ei/rig_counts/historical");
    });
  });

  // -------------------------------------------------------------------------
  // oilInventories
  // -------------------------------------------------------------------------
  describe("oilInventories", () => {
    it("covers list/get/latest/summary/byProduct/historical/cushing", async () => {
      const s = spy([]);
      spy({ id: "1", level: 1, unit: "kb", date: "d", timestamp: "t" });

      await client.ei.oilInventories.latest();
      await client.ei.oilInventories.summary();
      await client.ei.oilInventories.cushing();

      spy([]);
      await client.ei.oilInventories.list();
      await client.ei.oilInventories.byProduct();
      await client.ei.oilInventories.historical();

      const calls = (client as any).request.mock.calls.map((c: any[]) => c[0]);
      expect(calls).toContain("/v1/ei/oil_inventories/latest");
      expect(calls).toContain("/v1/ei/oil_inventories/summary");
      expect(calls).toContain("/v1/ei/oil_inventories/cushing");
      expect(calls).toContain("/v1/ei/oil_inventories");
      expect(calls).toContain("/v1/ei/oil_inventories/by_product");
      expect(calls).toContain("/v1/ei/oil_inventories/historical");
      expect(s).toBeDefined();
    });

    it("get() validates id", async () => {
      await expect(client.ei.oilInventories.get("")).rejects.toThrow(
        "Record ID must be a non-empty string",
      );
      const s = spy({ id: "x", level: 1, unit: "kb", date: "d", timestamp: "t" });
      await client.ei.oilInventories.get("x");
      expect(s).toHaveBeenCalledWith("/v1/ei/oil_inventories/x", {});
    });
  });

  // -------------------------------------------------------------------------
  // opecProduction
  // -------------------------------------------------------------------------
  describe("opecProduction", () => {
    it("covers list/get/latest/total/byCountry/historical/topProducers", async () => {
      spy({ total_production_bpd: 1, unit: "bpd", as_of_date: "d" });
      await client.ei.opecProduction.total();

      spy({ id: "1", production_bpd: 1, unit: "bpd", date: "d", timestamp: "t" });
      await client.ei.opecProduction.latest();

      spy([]);
      await client.ei.opecProduction.list();
      await client.ei.opecProduction.byCountry();
      await client.ei.opecProduction.historical();
      await client.ei.opecProduction.topProducers();

      const calls = (client as any).request.mock.calls.map((c: any[]) => c[0]);
      expect(calls).toContain("/v1/ei/opec_productions/total");
      expect(calls).toContain("/v1/ei/opec_productions/latest");
      expect(calls).toContain("/v1/ei/opec_productions");
      expect(calls).toContain("/v1/ei/opec_productions/by_country");
      expect(calls).toContain("/v1/ei/opec_productions/historical");
      expect(calls).toContain("/v1/ei/opec_productions/top_producers");
    });

    it("get() validates id", async () => {
      await expect(client.ei.opecProduction.get("")).rejects.toThrow(
        "Record ID must be a non-empty string",
      );
    });
  });

  // -------------------------------------------------------------------------
  // drillingProductivity
  // -------------------------------------------------------------------------
  describe("drillingProductivity", () => {
    it("covers all methods", async () => {
      spy({ id: "1", date: "d", timestamp: "t" });
      await client.ei.drillingProductivity.latest();

      spy({ as_of_date: "d" });
      await client.ei.drillingProductivity.summary();

      spy([]);
      await client.ei.drillingProductivity.list();
      await client.ei.drillingProductivity.ducWells();
      await client.ei.drillingProductivity.byBasin();
      await client.ei.drillingProductivity.historical();
      await client.ei.drillingProductivity.trends();

      const calls = (client as any).request.mock.calls.map((c: any[]) => c[0]);
      expect(calls).toContain("/v1/ei/drilling_productivities/latest");
      expect(calls).toContain("/v1/ei/drilling_productivities/summary");
      expect(calls).toContain("/v1/ei/drilling_productivities");
      expect(calls).toContain("/v1/ei/drilling_productivities/duc_wells");
      expect(calls).toContain("/v1/ei/drilling_productivities/by_basin");
      expect(calls).toContain("/v1/ei/drilling_productivities/historical");
      expect(calls).toContain("/v1/ei/drilling_productivities/trends");
    });

    it("get() validates id", async () => {
      await expect(client.ei.drillingProductivity.get("")).rejects.toThrow(
        "Record ID must be a non-empty string",
      );
    });
  });

  // -------------------------------------------------------------------------
  // forecasts
  // -------------------------------------------------------------------------
  describe("forecasts", () => {
    it("covers all methods", async () => {
      spy({
        id: "1",
        forecast_value: 80,
        published_date: "d",
        timestamp: "t",
      });
      await client.ei.forecasts.latest();

      spy({ total_forecasts: 1, as_of_date: "d" });
      await client.ei.forecasts.summary();

      spy([]);
      await client.ei.forecasts.list();
      await client.ei.forecasts.prices();
      await client.ei.forecasts.production();
      await client.ei.forecasts.historical();
      await client.ei.forecasts.compare();

      const calls = (client as any).request.mock.calls.map((c: any[]) => c[0]);
      expect(calls).toContain("/v1/ei/forecasts/latest");
      expect(calls).toContain("/v1/ei/forecasts/summary");
      expect(calls).toContain("/v1/ei/forecasts");
      expect(calls).toContain("/v1/ei/forecasts/prices");
      expect(calls).toContain("/v1/ei/forecasts/production");
      expect(calls).toContain("/v1/ei/forecasts/historical");
      expect(calls).toContain("/v1/ei/forecasts/compare");
    });

    it("get() validates id and hits endpoint", async () => {
      await expect(client.ei.forecasts.get("")).rejects.toThrow(
        "Record ID must be a non-empty string",
      );
      const s = spy({
        id: "f1",
        forecast_value: 1,
        published_date: "d",
        timestamp: "t",
      });
      await client.ei.forecasts.get("f1");
      expect(s).toHaveBeenCalledWith("/v1/ei/forecasts/f1", {});
    });
  });

  // -------------------------------------------------------------------------
  // wellPermits
  // -------------------------------------------------------------------------
  describe("wellPermits", () => {
    it("covers list/latest/summary/byState/byOperator/byFormation", async () => {
      spy({ id: "1", state: "TX", issue_date: "d", timestamp: "t" });
      await client.ei.wellPermits.latest();

      spy({ total_permits: 1, as_of_date: "d" });
      await client.ei.wellPermits.summary();

      spy([]);
      await client.ei.wellPermits.list();
      await client.ei.wellPermits.byState();
      await client.ei.wellPermits.byOperator();
      await client.ei.wellPermits.byFormation();

      const calls = (client as any).request.mock.calls.map((c: any[]) => c[0]);
      expect(calls).toContain("/v1/ei/well-permits/latest");
      expect(calls).toContain("/v1/ei/well-permits/summary");
      expect(calls).toContain("/v1/ei/well-permits");
      expect(calls).toContain("/v1/ei/well-permits/by-state");
      expect(calls).toContain("/v1/ei/well-permits/by-operator");
      expect(calls).toContain("/v1/ei/well-permits/by-formation");
    });

    it("search() passes query params", async () => {
      const s = spy([]);
      await client.ei.wellPermits.search({
        state: "Texas",
        operator: "ConocoPhillips",
        formation: "Wolfcamp",
        start_date: "2024-01-01",
        end_date: "2024-12-31",
      });
      expect(s).toHaveBeenCalledWith("/v1/ei/well-permits/search", {
        state: "Texas",
        operator: "ConocoPhillips",
        formation: "Wolfcamp",
        start_date: "2024-01-01",
        end_date: "2024-12-31",
      });
    });

    it("get() validates id", async () => {
      await expect(client.ei.wellPermits.get("")).rejects.toThrow(
        "Record ID must be a non-empty string",
      );
    });
  });

  // -------------------------------------------------------------------------
  // fracFocus
  // -------------------------------------------------------------------------
  describe("fracFocus", () => {
    it("covers list/latest/summary/byState/byOperator/byChemical", async () => {
      spy({ id: "1", api_number: "42", state: "TX", timestamp: "t" });
      await client.ei.fracFocus.latest();

      spy({ total_disclosures: 1, as_of_date: "d" });
      await client.ei.fracFocus.summary();

      spy([]);
      await client.ei.fracFocus.list();
      await client.ei.fracFocus.byState();
      await client.ei.fracFocus.byOperator();
      await client.ei.fracFocus.byChemical();

      const calls = (client as any).request.mock.calls.map((c: any[]) => c[0]);
      expect(calls).toContain("/v1/ei/frac-focus/latest");
      expect(calls).toContain("/v1/ei/frac-focus/summary");
      expect(calls).toContain("/v1/ei/frac-focus");
      expect(calls).toContain("/v1/ei/frac-focus/by-state");
      expect(calls).toContain("/v1/ei/frac-focus/by-operator");
      expect(calls).toContain("/v1/ei/frac-focus/by-chemical");
    });

    it("search() passes query params", async () => {
      const s = spy([]);
      await client.ei.fracFocus.search({ state: "Texas", chemical: "HCl" });
      expect(s).toHaveBeenCalledWith("/v1/ei/frac-focus/search", {
        state: "Texas",
        chemical: "HCl",
      });
    });

    it("chemicals() validates id and unwraps { chemicals }", async () => {
      await expect(client.ei.fracFocus.chemicals("")).rejects.toThrow(
        "Disclosure ID must be a non-empty string",
      );
      const chems = [{ chemical_name: "Water" }];
      const s = vi.spyOn(client as any, "request").mockResolvedValue({ chemicals: chems });
      const r = await client.ei.fracFocus.chemicals("abc");
      expect(s).toHaveBeenCalledWith("/v1/ei/frac-focus/abc/chemicals", {});
      expect(r).toEqual(chems);
    });

    it("forWell() validates apiNumber and hits endpoint", async () => {
      await expect(client.ei.fracFocus.forWell("")).rejects.toThrow(
        "API number must be a non-empty string",
      );
      const s = spy([]);
      await client.ei.fracFocus.forWell("42-123-12345");
      expect(s).toHaveBeenCalledWith("/v1/ei/frac-focus/for-well/42-123-12345", {});
    });
  });

  // -------------------------------------------------------------------------
  // wellTimeline (top-level ei method)
  // -------------------------------------------------------------------------
  describe("wellTimeline()", () => {
    it("validates apiNumber", async () => {
      await expect(client.ei.wellTimeline("")).rejects.toThrow(
        "API number must be a non-empty string",
      );
    });

    it("hits the well timeline endpoint", async () => {
      const s = spy({ api_number: "42-123-12345", events: [] });
      const r = await client.ei.wellTimeline("42-123-12345");
      expect(s).toHaveBeenCalledWith("/v1/ei/wells/42-123-12345/timeline", {});
      expect(r.api_number).toBe("42-123-12345");
    });
  });
});
