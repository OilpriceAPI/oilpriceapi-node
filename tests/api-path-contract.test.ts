/**
 * Every `/v1/...` path the SDK sends must exist in the API (#125).
 *
 * Three methods shipped against routes that never existed and returned HTTP
 * 404 on every call, while the mocked resource tests stayed green. This test
 * reads the SDK source, extracts each path literal, and checks it against a
 * snapshot of `rails routes` from oilpriceapi-api. Regenerate the snapshot
 * with `scripts/refresh-api-paths.mjs` when the API adds routes.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import snapshot from "./fixtures/api-paths.json";

type Route = { method: string; path: string; audience: string };

// Browser-session and operations routes are not an API-key surface.
const NOT_CUSTOMER_FACING = new Set(["dashboard", "website", "internal", "operations"]);

const srcDir = join(__dirname, "..", "src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? sourceFiles(join(dir, entry.name))
      : entry.name.endsWith(".ts")
        ? [join(dir, entry.name)]
        : [],
  );
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}

export function normalizeSdkPath(literal: string): string {
  return literal
    .split("?")[0]
    .replace(/\$\{[^}]+\}/g, "{param}")
    .replace(/\/$/, "");
}

function extractPaths(source: string): string[] {
  const found = new Set<string>();
  for (const match of stripComments(source).matchAll(/["'`](\/v1\/[^"'`\s]*)["'`]/g)) {
    found.add(normalizeSdkPath(match[1]));
  }
  return [...found];
}

const routes = (snapshot.routes as Route[]).filter(
  (route) => !NOT_CUSTOMER_FACING.has(route.audience),
);

// Data Connector (BYOS) routes are classed as dashboard in the API's policy,
// but answer an API key with 403 ORG_REQUIRED rather than 401, so the SDK's
// dataSources resource is a supported surface for organization members.
const ALLOWED_NON_PUBLIC_PREFIXES = ["/v1/data-sources"];

// A route parameter accepts any SDK segment. An SDK parameter (e.g. a futures
// family slug) also accepts a literal route segment, because the API serves
// several families as literal routes rather than one parameterised route.
export function matchesRoute(sdkPath: string, routePath: string): boolean {
  const sdk = sdkPath.split("/");
  const route = routePath.split("/");
  if (sdk.length !== route.length) return false;
  return sdk.every(
    (segment, i) => route[i] === "{param}" || segment === "{param}" || segment === route[i],
  );
}

export function unroutedPaths(paths: string[], candidates: Route[] = routes): string[] {
  return paths.filter(
    (path) =>
      !ALLOWED_NON_PUBLIC_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`)) &&
      !candidates.some((route) => matchesRoute(path, route.path)),
  );
}

describe("API path contract (#125)", () => {
  const sdkPaths = sourceFiles(srcDir).flatMap((file) =>
    extractPaths(readFileSync(file, "utf8")).map((path) => ({
      path,
      file: file.slice(srcDir.length + 1),
    })),
  );

  it("finds the SDK's paths", () => {
    expect(sdkPaths.length).toBeGreaterThan(100);
  });

  it("sends only paths that exist in the API", () => {
    const missing = sdkPaths.filter(({ path }) => unroutedPaths([path]).length > 0);
    expect(missing).toEqual([]);
  });

  it("flags the paths that 404'd in production before #125", () => {
    expect(
      unroutedPaths([
        "/v1/drilling-intelligence/trends",
        "/v1/drilling-intelligence/basin/{param}",
        "/v1/futures/spreads",
        "/v1/futures/{param}/continuous",
      ]),
    ).toEqual([
      "/v1/drilling-intelligence/trends",
      "/v1/drilling-intelligence/basin/{param}",
      "/v1/futures/spreads",
      "/v1/futures/{param}/continuous",
    ]);
  });

  it("does not let a browser-session route satisfy an SDK path", () => {
    const dashboardOnly = (snapshot.routes as Route[]).find(
      (route) => route.audience === "dashboard" && !route.path.startsWith("/v1/data-sources"),
    );
    expect(dashboardOnly).toBeDefined();
    expect(unroutedPaths([dashboardOnly!.path])).toEqual([dashboardOnly!.path]);
  });
});
