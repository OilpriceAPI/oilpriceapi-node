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
import { OilPriceAPIError } from "../../errors.js";

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
