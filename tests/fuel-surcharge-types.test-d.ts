/**
 * #79 — type-level contract for `client.fuelSurcharge`.
 *
 * Shapes verified against `api.oilpriceapi.com` on 2026-09-13
 * (tests/fixtures/fuel-surcharge/):
 *   GET /v1/fuel-surcharge                         -> { carriers: [rate] }
 *   GET /v1/fuel-surcharge/:carrier/latest         -> rate
 *   GET /v1/fuel-surcharge/:carrier/history        -> { history: [rate], meta }
 *   GET /v1/fuel-surcharge/parcel                  -> { carriers: [{ carrier, carrier_name, mode, service_levels: [rate] }] }
 *   GET /v1/fuel-surcharge/parcel/:carrier/latest  -> carrier block, or one rate with ?service_level=
 *   GET /v1/fuel-surcharge/parcel/:carrier/history -> { history: [rate], meta } (service_level required)
 */
import { describe, it, expectTypeOf } from "vitest";
import type {
  OilPriceAPI,
  FuelSurchargeRate,
  FuelSurchargeHistoryPage,
  LtlFuelSurchargeCarrier,
  ParcelFuelSurchargeCarrier,
  ParcelCarrierFuelSurcharges,
  ParcelFuelSurchargeRate,
} from "../src/index.js";

type FS = OilPriceAPI["fuelSurcharge"];
declare const fs: FS;

describe("#79 rate fields", () => {
  it("preserve effective date and provenance", () => {
    expectTypeOf<FuelSurchargeRate["surcharge_percent"]>().toEqualTypeOf<number>();
    expectTypeOf<FuelSurchargeRate["effective_date"]>().toEqualTypeOf<string>();
    expectTypeOf<FuelSurchargeRate["retrieved_at"]>().toEqualTypeOf<string>();
    expectTypeOf<FuelSurchargeRate["source"]>().toEqualTypeOf<string>();
    expectTypeOf<FuelSurchargeRate["doe_diesel_price"]>().toEqualTypeOf<number | null>();
    expectTypeOf<FuelSurchargeRate>().toHaveProperty("diesel_band");
    expectTypeOf<FuelSurchargeRate["mode"]>().toEqualTypeOf<"ltl" | "parcel">();
  });

  it("parcel rates always carry a service level", () => {
    expectTypeOf<ParcelFuelSurchargeRate["service_level"]>().toEqualTypeOf<string>();
    expectTypeOf<ParcelFuelSurchargeRate["mode"]>().toEqualTypeOf<"parcel">();
  });
});

describe("#79 ltl client", () => {
  it("returns rates and history pages", () => {
    expectTypeOf<Awaited<ReturnType<FS["ltl"]["list"]>>>().toEqualTypeOf<FuelSurchargeRate[]>();
    expectTypeOf<Awaited<ReturnType<FS["ltl"]["latest"]>>>().toEqualTypeOf<FuelSurchargeRate>();
    type Page = Awaited<ReturnType<FS["ltl"]["history"]>>;
    expectTypeOf<Page>().toEqualTypeOf<FuelSurchargeHistoryPage<FuelSurchargeRate>>();
    expectTypeOf<Page["meta"]["total_count"]>().toEqualTypeOf<number>();
    expectTypeOf<Page>().not.toBeArray();
  });

  it("suggests the covered carriers without rejecting new ones", () => {
    expectTypeOf<"southeastern-freight">().toMatchTypeOf<LtlFuelSurchargeCarrier>();
    void fs.ltl.latest("odfl");
    void fs.ltl.latest("a-carrier-added-later");
    // @ts-expect-error — carrier is required
    void fs.ltl.latest();
  });
});

describe("#79 parcel client", () => {
  it("latest() without a service level returns the carrier block", () => {
    const all = fs.parcel.latest("ups");
    expectTypeOf(all).resolves.toEqualTypeOf<ParcelCarrierFuelSurcharges>();
  });

  it("latest() with a service level returns one rate", () => {
    const one = fs.parcel.latest("ups", { serviceLevel: "ground" });
    expectTypeOf(one).resolves.toEqualTypeOf<ParcelFuelSurchargeRate>();
  });

  it("history() requires a service level", () => {
    expectTypeOf(fs.parcel.history("ups", { serviceLevel: "ground" })).resolves.toEqualTypeOf<
      FuelSurchargeHistoryPage<ParcelFuelSurchargeRate>
    >();
    // @ts-expect-error — the route answers 400 without service_level
    void fs.parcel.history("ups");
    // @ts-expect-error — the route answers 400 without service_level
    void fs.parcel.history("ups", { page: 2 });
  });

  it("lists carriers with their service levels", () => {
    expectTypeOf<Awaited<ReturnType<FS["parcel"]["list"]>>>().toEqualTypeOf<
      ParcelCarrierFuelSurcharges[]
    >();
    expectTypeOf<"dhl">().toMatchTypeOf<ParcelFuelSurchargeCarrier>();
  });
});
