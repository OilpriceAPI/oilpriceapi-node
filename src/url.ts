/**
 * Pin every request to the configured API origin (#80).
 *
 * The client used to build a request URL by concatenating the configured base
 * URL with a caller-supplied path and handing the result to `new URL()`. With
 * no separator enforced between the two, a path that does not begin with `/`
 * continues the *authority* rather than starting the path:
 *
 *     new URL("https://api.oilpriceapi.com" + "@elsewhere.example/v1/prices")
 *     -> host "elsewhere.example"
 *     new URL("https://api.oilpriceapi.com" + ".elsewhere.example/v1/prices")
 *     -> host "api.oilpriceapi.com.elsewhere.example"
 *     new URL("https://api.oilpriceapi.com" + "v1/prices/latest")
 *     -> host "api.oilpriceapi.comv1"
 *
 * `Authorization: Token <key>` is attached to every one of those requests, so
 * the customer's API key travels to whatever host the path resolved to.
 *
 * This module resolves the URL once, centrally, and refuses anything whose
 * origin (scheme, host, port) is not exactly the configured base origin. An
 * explicit `baseUrl` — a proxy, a staging host, a local test server — keeps
 * working, because the guard pins to whatever the caller configured rather
 * than to a hard-coded hostname.
 */

import { ValidationError } from "./errors.js";

/** Default ports, so `https://host` and `https://host:443` compare equal. */
const DEFAULT_PORTS: Record<string, string> = { "http:": "80", "https:": "443" };

/**
 * Characters that may never appear in an API path.
 *
 * - Backslash: several URL parsers (WHATWG browsers, some proxies and
 *   gateways) normalize `\` to `/`, turning `/\evil.example/x` into a
 *   network-path reference after this SDK decided it was a plain path.
 * - C0 controls, space and DEL: CR/LF can split a request line or smuggle a
 *   header, and the WHATWG URL parser silently strips tabs and newlines from
 *   anywhere in the input, so what we validate would not be what is sent.
 *
 * A legitimate API path carries none of these; a path that needs a space or a
 * non-ASCII character must percent-encode it, as it must for the API anyway.
 */
const FORBIDDEN_CHARACTERS = /[\\\u0000-\u0020\u007f]/;

function describe(path: unknown): string {
  if (typeof path !== "string") return String(path);
  // Echo only the part before the query string: the API key lives in a header
  // and never in a path, but a caller's own query parameters might carry a
  // secret, and this message can end up in logs.
  const [visible] = path.split("?", 1);
  return JSON.stringify(visible);
}

function reject(path: unknown, reason: string): ValidationError {
  return new ValidationError(
    `Refusing to send this request: the path ${describe(path)} ${reason}. ` +
      "API paths must be relative to the configured base URL (for example " +
      "'/v1/prices/latest'). To talk to a different host, construct a client " +
      "with that baseUrl instead — a raw path may not change the origin, " +
      "because the API key would be sent to it.",
  );
}

/** Scheme + host + effective port, lowercased, for an exact origin comparison. */
function originOf(url: URL): string {
  const protocol = url.protocol.toLowerCase();
  const port = url.port || DEFAULT_PORTS[protocol] || "";
  return `${protocol}//${url.hostname.toLowerCase()}:${port}`;
}

/**
 * Resolve `path` against `baseUrl`, refusing any origin change.
 *
 * @param baseUrl - The client's configured base URL.
 * @param path - Caller-supplied API path.
 * @returns The absolute URL to request, guaranteed to share `baseUrl`'s origin.
 * @throws {ValidationError} If `path` is not a string, contains a character a
 *   URL parser could use to change the authority, or resolves to any origin
 *   other than `baseUrl`'s.
 */
export function resolveApiUrl(baseUrl: string, path: unknown): URL {
  if (typeof path !== "string") {
    throw reject(path, `must be a string, got ${path === null ? "null" : typeof path}`);
  }

  if (path === "") {
    throw reject(path, "is empty");
  }

  const forbidden = FORBIDDEN_CHARACTERS.exec(path);
  if (forbidden) {
    throw reject(
      path,
      `contains ${JSON.stringify(forbidden[0])}, which is not allowed in an API path`,
    );
  }

  // Covers the scheme-relative "//host/..." form and any absolute URL
  // ("https://host/..."), before either can be resolved.
  const [beforeQuery] = path.split(/[?#]/, 1);
  if (beforeQuery.includes("//")) {
    throw reject(path, "may not contain '//'");
  }

  // A path is relative to the base URL, so it always starts a new path
  // segment. Without this, "v1/prices" and "@host/v1/prices" extend the
  // authority instead.
  const normalized = path.startsWith("/") ? path : `/${path}`;

  let base: URL;
  try {
    base = new URL(baseUrl);
  } catch {
    throw new ValidationError(
      `Invalid baseUrl ${JSON.stringify(baseUrl)}: the client cannot build a request URL from it.`,
    );
  }

  let resolved: URL;
  try {
    resolved = new URL(`${baseUrl}${normalized}`);
  } catch {
    throw reject(path, "cannot be resolved against the configured base URL");
  }

  // Belt and braces. The normalization above should make an origin change
  // impossible; this asserts it on the value actually about to be requested,
  // so any parser quirk fails closed instead of leaking the key.
  if (originOf(resolved) !== originOf(base)) {
    throw reject(path, "resolves to a different origin than the configured base URL");
  }

  return resolved;
}
