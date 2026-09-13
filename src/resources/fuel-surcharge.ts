/**
 * Carrier Fuel Surcharges Resource
 *
 * Published LTL and parcel carrier fuel-surcharge percentages from
 * `/v1/fuel-surcharge`. Every rate carries the carrier's own `effective_date`,
 * the `source` URL it was read from and when it was `retrieved_at`: the API
 * serves the latest stored row as-is and never refreshes a timestamp to make
 * a rate look current.
 *
 * Available on every plan, including free, subject to normal request limits.
 *
 * Shapes verified against `api.oilpriceapi.com` on 2026-09-13 (#79); routes
 * and parameters confirmed on oilpriceapi-api `origin/main`.
 */

import type { OilPriceAPI } from "../client.js";
import { OilPriceAPIError, ValidationError } from "../errors.js";

/** LTL carriers with fuel-surcharge coverage as of 2026-09-13. */
export type LtlFuelSurchargeCarrier =
  "odfl" | "saia" | "estes" | "xpo" | "abf" | "tforce" | "averitt" | "southeastern-freight";

/** Parcel carriers with fuel-surcharge coverage as of 2026-09-13. */
export type ParcelFuelSurchargeCarrier = "ups" | "fedex" | "dhl";

/**
 * Parcel service levels observed on 2026-09-13. Carriers differ; a route
 * answers an unsupported one with 404 (latest) or lists the valid ones in its
 * 400 (history).
 */
export type ParcelServiceLevel =
  | "air"
  | "ground"
  | "international_air_export"
  | "international_air_import"
  | "international_ground";

/** Carrier slug argument: a covered carrier, or any slug the API adds later. */
export type LtlCarrierArg = LtlFuelSurchargeCarrier | (string & {});
/** Parcel carrier slug argument: a covered carrier, or any slug the API adds later. */
export type ParcelCarrierArg = ParcelFuelSurchargeCarrier | (string & {});
/** Parcel service level argument. */
export type ParcelServiceLevelArg = ParcelServiceLevel | (string & {});

/** Rows the history routes serve per page at most. */
export const FUEL_SURCHARGE_MAX_PER_PAGE = 100;

/** DOE diesel price band a surcharge row applies to, when the carrier publishes one. */
export interface FuelSurchargeDieselBand {
  min: number | null;
  max: number | null;
}

/** One carrier's fuel surcharge for one effective date. */
export interface FuelSurchargeRate {
  /** Public carrier slug, e.g. `odfl`, `southeastern-freight`, `ups` */
  carrier: string;
  /** Carrier display name, e.g. `Old Dominion Freight Line` */
  carrier_name: string;
  mode: "ltl" | "parcel";
  /** Surcharge as a percentage, e.g. `46.32` */
  surcharge_percent: number;
  /** Date the carrier's surcharge takes effect (YYYY-MM-DD) */
  effective_date: string;
  /** DOE diesel price the surcharge was set against, when published */
  doe_diesel_price: number | null;
  /** Diesel price band, when the carrier publishes one */
  diesel_band: FuelSurchargeDieselBand | null;
  /** URL of the carrier page the rate was read from */
  source: string;
  /** ISO timestamp the rate was retrieved */
  retrieved_at: string;
  /** Present on parcel rates only */
  service_level?: string;
}

/** A parcel carrier's surcharge for one service level. */
export interface ParcelFuelSurchargeRate extends FuelSurchargeRate {
  mode: "parcel";
  service_level: string;
}

/** A parcel carrier with its latest surcharge per service level. */
export interface ParcelCarrierFuelSurcharges {
  carrier: string;
  carrier_name: string | null;
  mode: "parcel";
  service_levels: ParcelFuelSurchargeRate[];
}

/** Pagination block of {@link FuelSurchargeHistoryPage}. */
export interface FuelSurchargePageMeta {
  page: number;
  per_page: number;
  /** Rows across ALL pages */
  total_count: number;
  total_pages: number;
}

/** One page of a carrier's surcharge history, newest effective date first. */
export interface FuelSurchargeHistoryPage<R extends FuelSurchargeRate = FuelSurchargeRate> {
  history: R[];
  meta: FuelSurchargePageMeta;
}

/** Paging options for the history routes. */
export interface FuelSurchargePageOptions {
  /** 1-based page number */
  page?: number;
  /** Rows per page, clamped to 1-{@link FUEL_SURCHARGE_MAX_PER_PAGE} */
  perPage?: number;
}

/** Options for {@link ParcelFuelSurchargeResource.latest} with one service level. */
export interface ParcelLatestOptions {
  serviceLevel: ParcelServiceLevelArg;
}

/** Options for {@link ParcelFuelSurchargeResource.history}. */
export interface ParcelHistoryOptions extends FuelSurchargePageOptions {
  /** Required: the route answers 400 without it. */
  serviceLevel: ParcelServiceLevelArg;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function describeShape(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "an array";
  if (isRecord(value)) {
    const keys = Object.keys(value);
    return keys.length === 0 ? "an empty object" : `an object with keys [${keys.join(", ")}]`;
  }
  return typeof value;
}

function expectShape<T>(response: unknown, endpoint: string, expected: string, valid: boolean): T {
  if (valid) return response as T;
  throw new OilPriceAPIError(
    `Unexpected response shape from ${endpoint}: expected ${expected}, received ` +
      `${describeShape(response)}. The SDK will not guess at a response it cannot map. ` +
      `Please report this at https://github.com/OilpriceAPI/oilpriceapi-node/issues`,
    undefined,
    "unexpected_response_shape",
    { rawBody: response },
  );
}

const isRate = (value: unknown): boolean =>
  isRecord(value) &&
  typeof value.carrier === "string" &&
  typeof value.surcharge_percent === "number" &&
  typeof value.effective_date === "string";

const isParcelRate = (value: unknown): boolean =>
  isRate(value) && typeof (value as Record<string, unknown>).service_level === "string";

const isParcelCarrier = (value: unknown): boolean =>
  isRecord(value) &&
  typeof value.carrier === "string" &&
  Array.isArray(value.service_levels) &&
  value.service_levels.every(isParcelRate);

const isHistoryPage = (value: unknown, rowCheck: (row: unknown) => boolean): boolean =>
  isRecord(value) &&
  Array.isArray(value.history) &&
  value.history.every(rowCheck) &&
  isRecord(value.meta) &&
  typeof value.meta.total_count === "number";

function requireSlug(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ValidationError(`${label} must be a non-empty string`);
  }
  return value.trim();
}

function pageParams(options?: FuelSurchargePageOptions): Record<string, string> {
  const params: Record<string, string> = {};
  if (options?.page !== undefined && Number.isFinite(options.page)) {
    params.page = String(Math.max(1, Math.floor(options.page)));
  }
  if (options?.perPage !== undefined && Number.isFinite(options.perPage)) {
    params.per_page = String(
      Math.min(Math.max(1, Math.floor(options.perPage)), FUEL_SURCHARGE_MAX_PER_PAGE),
    );
  }
  return params;
}

/**
 * LTL carrier fuel surcharges.
 *
 * @example
 * ```typescript
 * const odfl = await client.fuelSurcharge.ltl.latest('odfl');
 * console.log(`${odfl.carrier_name}: ${odfl.surcharge_percent}% effective ${odfl.effective_date}`);
 * ```
 */
export class LtlFuelSurchargeResource {
  constructor(private client: OilPriceAPI) {}

  /**
   * Latest surcharge for every LTL carrier that has data.
   *
   * A covered carrier with no retrieved rate yet is absent, not reported as 0.
   */
  async list(): Promise<FuelSurchargeRate[]> {
    const endpoint = "/v1/fuel-surcharge";
    const response = await this.client["request"]<unknown>(endpoint, {});
    const valid =
      isRecord(response) && Array.isArray(response.carriers) && response.carriers.every(isRate);
    return expectShape<{ carriers: FuelSurchargeRate[] }>(
      response,
      endpoint,
      'a "carriers" array of rates',
      valid,
    ).carriers;
  }

  /**
   * Current surcharge for one LTL carrier.
   *
   * @param carrier - Carrier slug, e.g. `odfl`
   * @throws {ValidationError} If `carrier` is empty
   * @throws {NotFoundError} For an unknown or not-yet-covered carrier, or one
   *   with no data yet; `rawBody.data.covered_carriers` lists the valid slugs
   */
  async latest(carrier: LtlCarrierArg): Promise<FuelSurchargeRate> {
    const slug = requireSlug(carrier, "carrier");
    const endpoint = `/v1/fuel-surcharge/${encodeURIComponent(slug)}/latest`;
    const response = await this.client["request"]<unknown>(endpoint, {});
    return expectShape(response, "/v1/fuel-surcharge/:carrier/latest", "a rate", isRate(response));
  }

  /**
   * One page of an LTL carrier's surcharge history, newest first.
   *
   * @param carrier - Carrier slug, e.g. `odfl`
   * @param options - `page` and `perPage` (max 100)
   * @returns The page with `meta.total_count` across all pages
   */
  async history(
    carrier: LtlCarrierArg,
    options?: FuelSurchargePageOptions,
  ): Promise<FuelSurchargeHistoryPage<FuelSurchargeRate>> {
    const slug = requireSlug(carrier, "carrier");
    const endpoint = `/v1/fuel-surcharge/${encodeURIComponent(slug)}/history`;
    const response = await this.client["request"]<unknown>(endpoint, pageParams(options));
    return expectShape(
      response,
      "/v1/fuel-surcharge/:carrier/history",
      'a page with "history" and "meta"',
      isHistoryPage(response, isRate),
    );
  }
}

/**
 * Parcel carrier fuel surcharges, by service level.
 *
 * @example
 * ```typescript
 * const ground = await client.fuelSurcharge.parcel.latest('ups', { serviceLevel: 'ground' });
 * console.log(`UPS ground: ${ground.surcharge_percent}% effective ${ground.effective_date}`);
 * ```
 */
export class ParcelFuelSurchargeResource {
  constructor(private client: OilPriceAPI) {}

  /** Latest surcharge per service level for every parcel carrier that has data. */
  async list(): Promise<ParcelCarrierFuelSurcharges[]> {
    const endpoint = "/v1/fuel-surcharge/parcel";
    const response = await this.client["request"]<unknown>(endpoint, {});
    const valid =
      isRecord(response) &&
      Array.isArray(response.carriers) &&
      response.carriers.every(isParcelCarrier);
    return expectShape<{ carriers: ParcelCarrierFuelSurcharges[] }>(
      response,
      endpoint,
      'a "carriers" array of parcel carriers with "service_levels"',
      valid,
    ).carriers;
  }

  /**
   * Latest surcharge for one parcel carrier: every service level, or one.
   *
   * @param carrier - Carrier slug, e.g. `ups`
   * @param options - `serviceLevel` to return a single rate
   * @throws {NotFoundError} For an unknown carrier, or a service level with no data
   */
  latest(carrier: ParcelCarrierArg): Promise<ParcelCarrierFuelSurcharges>;
  latest(carrier: ParcelCarrierArg, options: ParcelLatestOptions): Promise<ParcelFuelSurchargeRate>;
  async latest(
    carrier: ParcelCarrierArg,
    options?: ParcelLatestOptions,
  ): Promise<ParcelCarrierFuelSurcharges | ParcelFuelSurchargeRate> {
    const slug = requireSlug(carrier, "carrier");
    const endpoint = `/v1/fuel-surcharge/parcel/${encodeURIComponent(slug)}/latest`;
    const label = "/v1/fuel-surcharge/parcel/:carrier/latest";

    if (options !== undefined) {
      const serviceLevel = requireSlug(options?.serviceLevel, "serviceLevel");
      const response = await this.client["request"]<unknown>(endpoint, {
        service_level: serviceLevel,
      });
      return expectShape<ParcelFuelSurchargeRate>(
        response,
        label,
        "a parcel rate with a service_level",
        isParcelRate(response),
      );
    }

    const response = await this.client["request"]<unknown>(endpoint, {});
    return expectShape<ParcelCarrierFuelSurcharges>(
      response,
      label,
      'a parcel carrier with "service_levels"',
      isParcelCarrier(response),
    );
  }

  /**
   * One page of a parcel carrier's history for one service level, newest first.
   *
   * @param carrier - Carrier slug, e.g. `ups`
   * @param options - `serviceLevel` (required), `page`, `perPage` (max 100)
   * @throws {ValidationError} If `serviceLevel` is missing, before sending
   * @throws {OilPriceAPIError} HTTP 400 listing `available_service_levels` on
   *   `rawBody.data` when the carrier does not offer that level
   */
  async history(
    carrier: ParcelCarrierArg,
    options: ParcelHistoryOptions,
  ): Promise<FuelSurchargeHistoryPage<ParcelFuelSurchargeRate>> {
    const slug = requireSlug(carrier, "carrier");
    const serviceLevel = requireSlug(options?.serviceLevel, "serviceLevel");
    const endpoint = `/v1/fuel-surcharge/parcel/${encodeURIComponent(slug)}/history`;
    const response = await this.client["request"]<unknown>(endpoint, {
      service_level: serviceLevel,
      ...pageParams(options),
    });
    return expectShape(
      response,
      "/v1/fuel-surcharge/parcel/:carrier/history",
      'a page with "history" and "meta"',
      isHistoryPage(response, isParcelRate),
    );
  }
}

/**
 * Carrier fuel surcharges: `ltl` and `parcel`.
 *
 * @example
 * ```typescript
 * const rates = await client.fuelSurcharge.ltl.list();
 * const page = await client.fuelSurcharge.ltl.history('saia', { perPage: 52 });
 * console.log(`${page.history.length} of ${page.meta.total_count} weeks`);
 *
 * const ups = await client.fuelSurcharge.parcel.latest('ups');
 * ups.service_levels.forEach(s => console.log(s.service_level, s.surcharge_percent));
 * ```
 */
export class FuelSurchargeResource {
  /** LTL carriers */
  public readonly ltl: LtlFuelSurchargeResource;
  /** Parcel carriers, by service level */
  public readonly parcel: ParcelFuelSurchargeResource;

  constructor(client: OilPriceAPI) {
    this.ltl = new LtlFuelSurchargeResource(client);
    this.parcel = new ParcelFuelSurchargeResource(client);
  }
}
