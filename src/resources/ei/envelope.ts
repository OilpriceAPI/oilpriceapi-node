/**
 * Energy Intelligence response-envelope unwrapping (#83).
 *
 * The core client already strips the outer `data` envelope before a resource
 * method sees the body (`OilPriceAPI#shapeResponseData`). EI collection
 * endpoints return a NAMED collection inside that envelope —
 * `data: { report_date, basins: [...] }`, not `data: [...]` — so a resource
 * that reached for `response.data` a second time unwrapped a level that was
 * no longer there and silently produced `undefined` while its signature
 * promised an array.
 *
 * This is the single place that knows how to get from a shaped response to a
 * collection. It never returns `undefined` and never fabricates an empty
 * success: an unrecognised shape raises {@link OilPriceAPIError} naming the
 * endpoint and the key that was expected.
 */
import { OilPriceAPIError, ValidationError } from "../../errors.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A short, non-leaking description of what arrived instead of a collection. */
function describeShape(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "an array";
  if (isRecord(value)) {
    const keys = Object.keys(value);
    return keys.length === 0 ? "an empty object" : `an object with keys [${keys.join(", ")}]`;
  }
  return typeof value;
}

/**
 * Extract the collection an EI endpoint returns.
 *
 * @param response - The value the core client handed back (outer `data`
 *   envelope already stripped).
 * @param collectionKey - The key the Rails endpoint puts the collection under,
 *   e.g. `basins`, `states`, `records`, `well_permits`.
 * @param endpoint - The request path, used in the error message.
 *
 * @throws {OilPriceAPIError} If no collection can be found. Callers get a
 *   truthful failure rather than `undefined` typed as an array.
 */
export function unwrapCollection<T>(
  response: unknown,
  collectionKey: string,
  endpoint: string,
): T[] {
  // Already a bare collection (list endpoints return `data: [...]`).
  if (Array.isArray(response)) return response as T[];

  if (isRecord(response)) {
    const named = response[collectionKey];
    if (Array.isArray(named)) return named as T[];

    // Defensive: a response that still carries its outer envelope, e.g. when
    // the body was not shaped because it lacked a `status` field.
    const inner = response.data;
    if (Array.isArray(inner)) return inner as T[];
    if (isRecord(inner) && Array.isArray(inner[collectionKey])) {
      return inner[collectionKey] as T[];
    }
  }

  throw new OilPriceAPIError(
    `Unexpected response shape from ${endpoint}: expected an array under "${collectionKey}", ` +
      `received ${describeShape(response)}. The SDK will not guess or return an empty result ` +
      `for a response it cannot map. Please report this at ` +
      `https://github.com/OilpriceAPI/oilpriceapi-node/issues`,
    undefined,
    "unexpected_response_shape",
    { rawBody: response },
  );
}

/** Rows the paginated EI by-* routes serve per page at most (#105). */
export const EI_MAX_PER_PAGE = 100;

/** Paging options for the paginated EI by-* methods. */
export interface EIPageOptions {
  /** 1-based page number. @default 1 */
  page?: number;
  /**
   * Rows per page, clamped to 1-{@link EI_MAX_PER_PAGE}.
   * @default 100
   */
  perPage?: number;
}

/**
 * Pagination block returned by the EI by-* routes.
 *
 * `total_count` is the number of matching rows across ALL pages, so a caller
 * can tell a complete result from the first page of a large one.
 */
export interface EIPageMeta {
  total_count: number;
  page: number;
  per_page: number;
  total_pages: number;
  [key: string]: unknown;
}

/**
 * Build `page` / `per_page` query params.
 *
 * `per_page` is ALWAYS sent. Measured against production 2026-09-13: with no
 * `per_page` the routes serve 100 rows while `meta.per_page` reports 25, so a
 * caller paging by the meta would skip rows. With an explicit value the two
 * agree.
 */
export function pageParams(options?: EIPageOptions): Record<string, string> {
  const requested = options?.perPage ?? EI_MAX_PER_PAGE;
  const perPage = Number.isFinite(requested)
    ? Math.min(Math.max(1, Math.floor(requested)), EI_MAX_PER_PAGE)
    : EI_MAX_PER_PAGE;
  const params: Record<string, string> = { per_page: String(perPage) };
  if (options?.page !== undefined && Number.isFinite(options.page)) {
    params.page = String(Math.max(1, Math.floor(options.page)));
  }
  return params;
}

/**
 * Require a non-empty filter value before any request is made (#105).
 *
 * The by-* routes answer a missing filter with HTTP 400, so sending the
 * request cannot succeed; failing locally names the missing argument instead.
 */
export function requireFilter(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ValidationError(`${label} must be a non-empty string`);
  }
  return value.trim();
}

/**
 * Return a paginated EI envelope with its collection and `meta` intact.
 *
 * A bare array cannot say how many rows exist beyond this page, so an
 * envelope without `meta` is rejected rather than handed back as if it were
 * the complete result.
 */
export function unwrapPage<P>(response: unknown, collectionKey: string, endpoint: string): P {
  const items = unwrapCollection<unknown>(response, collectionKey, endpoint);
  if (!isRecord(response) || !isRecord(response.meta)) {
    throw new OilPriceAPIError(
      `Unexpected response shape from ${endpoint}: expected a paginated envelope with ` +
        `"${collectionKey}" and "meta", received ${describeShape(response)}. The SDK will not ` +
        `return one page as if it were the whole result. Please report this at ` +
        `https://github.com/OilpriceAPI/oilpriceapi-node/issues`,
      undefined,
      "unexpected_response_shape",
      { rawBody: response },
    );
  }
  return { ...response, [collectionKey]: items } as P;
}
