/**
 * Shared request building and response checking for the calculated-metrics
 * routes, `/v1/spreads/*` and `/v1/indicators/*` (#112).
 *
 * Two rules are enforced here and nowhere else:
 *
 * - **Arguments are refused before any request is sent.** A blank selector
 *   raises {@link ValidationError}; so does an unparseable date or a window
 *   whose start is after its end. Measured against production 2026-09-14: the
 *   routes answer `start_date=banana` with their default window, an inverted
 *   window with an empty 200, and an unknown pair on a history route with an
 *   empty 200. None of those is the result the caller asked for.
 * - **A success body that does not match the declared type raises**
 *   `unexpected_response_shape` with the raw body. Nothing is defaulted, and a
 *   named collection is never read from the wrong key.
 */
import type { OilPriceAPI } from "../client.js";
import { OilPriceAPIError, ValidationError } from "../errors.js";
import { requireFilter } from "./ei/envelope.js";

/** Date window for the `*Historical` methods. */
export interface MetricsDateRangeOptions {
  /**
   * Start date, `YYYY-MM-DD`. Server default depends on the route (30 or 90
   * days back); the server caps the window at two years.
   */
  startDate?: string;
  /** End date, `YYYY-MM-DD`. Server default: today. */
  endDate?: string;
}

type Kind = "string" | "number" | "boolean" | "record" | "array";

/** Required keys of a payload and the JSON type each must have. */
export type ShapeSpec = Record<string, Kind>;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function kindMatches(value: unknown, kind: Kind): boolean {
  switch (kind) {
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "boolean":
      return typeof value === "boolean";
    case "record":
      return isRecord(value);
    case "array":
      return Array.isArray(value);
  }
}

/** True when `value` is an object carrying every key in `spec` with its type. */
export function matches(value: unknown, spec: ShapeSpec): value is Record<string, unknown> {
  return isRecord(value) && Object.entries(spec).every(([key, kind]) => kindMatches(value[key], kind));
}

/** True when `value` is an array whose every element satisfies `item`. */
export function everyItem(value: unknown, item: (row: unknown) => boolean): boolean {
  return Array.isArray(value) && value.every(item);
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

function shapeError(endpoint: string, expected: string, received: unknown, rawBody: unknown) {
  return new OilPriceAPIError(
    `Unexpected response shape from ${endpoint}: expected ${expected}, received ` +
      `${describeShape(received)}. The SDK will not guess at a response it cannot map. ` +
      `Please report this at https://github.com/OilpriceAPI/oilpriceapi-node/issues`,
    undefined,
    "unexpected_response_shape",
    { rawBody },
  );
}

/** The `data` object of a `{ status: "success", data: {...} }` body, or undefined. */
function successData(body: unknown): unknown {
  if (!isRecord(body)) return undefined;
  if (body.status !== undefined && body.status !== "success") return undefined;
  return body.data;
}

/**
 * GET a calculated-metrics route and return its `data` object as `T`, only if
 * `valid` accepts it.
 */
export async function getMetric<T>(
  client: OilPriceAPI,
  endpoint: string,
  params: Record<string, string>,
  expected: string,
  valid: (data: Record<string, unknown>) => boolean,
): Promise<T> {
  const body = await client["request"]<unknown>(endpoint, params, { unshaped: true });
  const data = successData(body);
  if (isRecord(data) && valid(data)) return data as T;
  throw shapeError(endpoint, expected, data === undefined ? body : data, body);
}

/**
 * GET a `/all` route and return the list the route nests under `key`
 * (`spreads`, `commodities`, `margins`, `premiums`, `locations`).
 */
export async function getMetricList<T>(
  client: OilPriceAPI,
  endpoint: string,
  key: string,
  expected: string,
  item: (row: unknown) => boolean,
): Promise<T[]> {
  const body = await client["request"]<unknown>(endpoint, {}, { unshaped: true });
  const data = successData(body);
  if (isRecord(data) && everyItem(data[key], item)) return data[key] as T[];
  throw shapeError(endpoint, `a list of ${expected} under "${key}"`, data === undefined ? body : data, body);
}

/** Refuse a missing or blank required selector (the route answers 400). */
export function requireSelector(value: unknown, label: string): string {
  return requireFilter(value, label);
}

/**
 * Pass an optional selector through when absent; refuse it when present but
 * blank, since the route would read `""` as an unknown value.
 */
export function optionalSelector(value: unknown, label: string): string | undefined {
  return value === undefined ? undefined : requireFilter(value, label);
}

/** Build a params object, dropping undefined values. */
export function compactParams(values: Record<string, string | undefined>): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) params[key] = value;
  }
  return params;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function requireDate(value: unknown, label: string): string {
  const text = typeof value === "string" ? value.trim() : "";
  const match = ISO_DATE.exec(text);
  if (match) {
    const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    ) {
      return text;
    }
  }
  throw new ValidationError(`${label} must be a calendar date in YYYY-MM-DD form`);
}

/**
 * `start_date` / `end_date` params. Refuses an unparseable date (the routes
 * silently substitute their default window) and a start after the end (the
 * routes answer an empty 200).
 */
export function dateRangeParams(options?: MetricsDateRangeOptions): Record<string, string> {
  const start = options?.startDate === undefined ? undefined : requireDate(options.startDate, "startDate");
  const end = options?.endDate === undefined ? undefined : requireDate(options.endDate, "endDate");
  if (start !== undefined && end !== undefined && start > end) {
    throw new ValidationError(`startDate (${start}) must be on or before endDate (${end})`);
  }
  return compactParams({ start_date: start, end_date: end });
}

/** Shared keys of every `*Historical` envelope. */
export const HISTORY_SPEC: ShapeSpec = { period: "record", count: "number", data: "array" };

/** True when `data` is a history envelope whose rows all satisfy `row`. */
export function isHistory(
  data: Record<string, unknown>,
  spec: ShapeSpec,
  row: ShapeSpec,
): boolean {
  return (
    matches(data, { ...HISTORY_SPEC, ...spec }) &&
    everyItem(data.data, (r) => matches(r, { date: "string", ...row }))
  );
}
