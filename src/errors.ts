/** Structured diagnostics returned with an API or transport failure. */
export interface OilPriceAPIErrorDetails {
  statusCode?: number;
  code?: string;
  requestId?: string;
  docsUrl?: string;
  currentPlan?: string;
  requiredPlan?: string;
  requiredFeature?: string;
  remediationUrl?: string;
  retryAfter?: number;
  headers?: Record<string, string>;
  rawBody?: unknown;
  /**
   * True when a non-idempotent write (POST, PATCH) failed with an ambiguous
   * outcome — a timeout, transport error or 5xx — and was deliberately not
   * replayed. The server may still have applied it; check before resending.
   */
  ambiguousWrite?: boolean;
}

/** Base class for every failure surfaced by the SDK. */
export class OilPriceAPIError extends Error {
  statusCode?: number;
  code?: string;
  requestId?: string;
  docsUrl?: string;
  currentPlan?: string;
  requiredPlan?: string;
  requiredFeature?: string;
  remediationUrl?: string;
  retryAfter?: number;
  headers?: Record<string, string>;
  rawBody?: unknown;
  /**
   * True when a non-idempotent write was not replayed after an ambiguous
   * outcome. The request may still have been applied server-side (#82).
   */
  ambiguousWrite?: boolean;

  constructor(message: string, statusCode?: number, code?: string, details: OilPriceAPIErrorDetails = {}) {
    super(message);
    this.name = "OilPriceAPIError";
    // Spreading `details` as-is let an absent field overwrite a real value:
    // `{ code: undefined }` from a body with no code erased the subclass's
    // "NOT_FOUND_ERROR" / "HTTP_ERROR", so those errors reached callers with
    // `code === undefined` (#111).
    const present = Object.fromEntries(Object.entries(details).filter(([, value]) => value !== undefined));
    Object.assign(this, { statusCode, code, ...present });
    if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor);
  }
}

export class AuthenticationError extends OilPriceAPIError {
  constructor(message = "Invalid API key", details: OilPriceAPIErrorDetails = {}) {
    super(message, 401, "AUTHENTICATION_ERROR", details);
    this.name = "AuthenticationError";
  }
}

export class RateLimitError extends OilPriceAPIError {
  constructor(message = "Rate limit exceeded", retryAfter?: number, details: OilPriceAPIErrorDetails = {}) {
    super(message, 429, "RATE_LIMIT_ERROR", { ...details, retryAfter });
    this.name = "RateLimitError";
  }
}

export class NotFoundError extends OilPriceAPIError {
  constructor(message = "Resource not found", details: OilPriceAPIErrorDetails = {}) {
    super(message, 404, "NOT_FOUND_ERROR", details);
    this.name = "NotFoundError";
  }
}

export class ServerError extends OilPriceAPIError {
  constructor(message = "Internal server error", statusCode = 500, details: OilPriceAPIErrorDetails = {}) {
    super(message, statusCode, "SERVER_ERROR", details);
    this.name = "ServerError";
  }
}

export class ValidationError extends OilPriceAPIError {
  constructor(message: string, details: OilPriceAPIErrorDetails = {}) {
    super(message, undefined, "VALIDATION_ERROR", details);
    this.name = "ValidationError";
  }
}

export class TimeoutError extends OilPriceAPIError {
  constructor(message = "Request timeout", timeout: number, details: OilPriceAPIErrorDetails = {}) {
    super(`${message} (${timeout}ms)`, undefined, "TIMEOUT_ERROR", details);
    this.name = "TimeoutError";
  }
}

type ErrorEnvelope = Record<string, unknown>;

/** Upper-snake machine codes such as `VALIDATION_ERROR` or `WATCH_LIMIT`. */
const MACHINE_CODE = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/;

function isEnvelope(value: unknown): value is ErrorEnvelope {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function redact(value: unknown, apiKey?: string): unknown {
  if (typeof value === "string") return apiKey ? value.split(apiKey).join("[REDACTED]") : value;
  if (Array.isArray(value)) return value.map((item) => redact(item, apiKey));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as ErrorEnvelope).map(([key, item]) => [key, redact(item, apiKey)]));
  }
  return value;
}

function headersToRecord(headers: Headers): Record<string, string> {
  return Object.fromEntries(headers.entries());
}

/** Convert canonical and legacy API failure envelopes into the public SDK contract. */
export function errorFromResponse(response: Response, body: string, apiKey?: string): OilPriceAPIError {
  const headers = response.headers || new Headers();
  let parsed: ErrorEnvelope | undefined;
  try {
    const candidate = JSON.parse(body);
    if (candidate && typeof candidate === "object") parsed = candidate as ErrorEnvelope;
  } catch {
    // Text and HTML failures retain the HTTP status fallback below.
  }

  const nestedError = parsed && isEnvelope(parsed.error) ? parsed.error : undefined;
  // JSend fail envelope, `{ status: "fail", data: { error, message?, ... } }`,
  // sent by every route that uses the API's `render_fail`. The reason lives
  // under `data`; reading only the top level turned it into "HTTP 404: Not
  // Found" (#111). The canonical nested `error` object keeps precedence.
  const failData = parsed && !nestedError && (parsed.status === "fail" || parsed.status === "error") && isEnvelope(parsed.data)
    ? parsed.data
    : undefined;
  const envelope = nestedError
    ? { ...parsed, ...nestedError }
    : failData
      ? { ...parsed, ...failData }
      : parsed || {};
  // Inside a fail envelope an upper-snake `error` (`VALIDATION_ERROR`,
  // `WATCH_LIMIT`) is a machine code, and the sentence is in `message`.
  const failCode = failData && typeof failData.error === "string" && MACHINE_CODE.test(failData.error)
    ? failData.error
    : undefined;
  const safeBody = redact(parsed ?? body, apiKey);
  const fallback = `HTTP ${response.status}: ${response.statusText}`;
  const reason = stringValue(envelope.message)
    || stringValue(envelope.error_description)
    || (failCode ? undefined : stringValue(envelope.error))
    || failCode;
  const message = String(redact(reason || fallback, apiKey));
  const retryAfterHeader = headers.get("retry-after");
  const retryAfter = numberValue(envelope.retry_after) ?? (retryAfterHeader && /^\d+$/.test(retryAfterHeader) ? Number(retryAfterHeader) : undefined);
  const details: OilPriceAPIErrorDetails = {
    statusCode: response.status,
    code: stringValue(envelope.code) || stringValue(envelope.error_code) || failCode,
    requestId: stringValue(envelope.request_id) || headers.get("x-request-id") || undefined,
    docsUrl: stringValue(envelope.docs_url) || stringValue(envelope.documentation_url),
    currentPlan: stringValue(envelope.current_plan) || stringValue(envelope.plan),
    requiredPlan: stringValue(envelope.required_plan),
    requiredFeature: stringValue(envelope.required_feature) || stringValue(envelope.feature),
    remediationUrl: stringValue(envelope.remediation_url) || stringValue(envelope.upgrade_url),
    retryAfter,
    headers: headersToRecord(headers),
    rawBody: safeBody,
  };

  if (response.status === 401) return new AuthenticationError(message, details);
  if (response.status === 404) return new NotFoundError(message, details);
  if (response.status === 429) return new RateLimitError(message, retryAfter, details);
  if (response.status >= 500) return new ServerError(message, response.status, details);
  return new OilPriceAPIError(message, response.status, details.code || "HTTP_ERROR", details);
}

export const isHTTPError = (error: unknown, status: number): error is OilPriceAPIError =>
  error instanceof OilPriceAPIError && error.statusCode === status;
export const isAuthenticationError = (error: unknown): error is AuthenticationError => isHTTPError(error, 401);
export const isQuotaError = (error: unknown): error is OilPriceAPIError => isHTTPError(error, 402);
export const isEntitlementError = (error: unknown): error is OilPriceAPIError => isHTTPError(error, 403);
export const isNotFoundError = (error: unknown): error is NotFoundError => isHTTPError(error, 404);
export const isRateLimitError = (error: unknown): error is RateLimitError => isHTTPError(error, 429);
export const isServerError = (error: unknown): error is OilPriceAPIError =>
  error instanceof OilPriceAPIError && !!error.statusCode && error.statusCode >= 500 && error.statusCode <= 599;
