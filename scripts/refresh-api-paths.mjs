#!/usr/bin/env node
// Regenerate tests/fixtures/api-paths.json, the route snapshot that
// tests/api-path-contract.test.ts checks every SDK path against (#125).
//
// Run from an oilpriceapi-api checkout of origin/main:
//   bundle exec rails routes > /tmp/routes.txt
//   node scripts/refresh-api-paths.mjs \
//     --routes /tmp/routes.txt \
//     --swagger <api>/swagger/v1/swagger.json \
//     --policy <api>/config/openapi_route_policy.yml \
//     --commit "$(git -C <api> rev-parse --short HEAD)"

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, arg, i, all) => {
    if (arg.startsWith("--")) pairs.push([arg.slice(2), all[i + 1]]);
    return pairs;
  }, []),
);
for (const required of ["routes", "swagger", "policy"]) {
  if (!args[required]) {
    console.error(`Missing --${required}. See the header of this script.`);
    process.exit(2);
  }
}

// Every path parameter, however spelled (:code, {code}), becomes {param}.
const normalize = (path) =>
  path
    .replace(/\(\.:format\)$/, "")
    .replace(/:[A-Za-z_]+/g, "{param}")
    .replace(/\{[^}]+\}/g, "{param}")
    .replace(/\/$/, "");

const swaggerPaths = new Set(
  Object.keys(JSON.parse(readFileSync(args.swagger, "utf8")).paths).map(normalize),
);

// The policy file is a flat list of `- prefix:` / `audience:` pairs.
const exclusions = [];
let current;
for (const line of readFileSync(args.policy, "utf8").split("\n")) {
  const prefix = line.match(/^\s*-\s*prefix:\s*(\S+)/);
  if (prefix) exclusions.push((current = { prefix: prefix[1] }));
  const audience = line.match(/^\s*audience:\s*(\S+)/);
  if (audience && current) current.audience = audience[1];
}
exclusions.sort((a, b) => b.prefix.length - a.prefix.length);

const routes = new Map();
for (const line of readFileSync(args.routes, "utf8").split("\n")) {
  const match = line.match(/\b(GET|POST|PUT|PATCH|DELETE)\s+(\/v1\/\S+)/);
  if (!match) continue;
  const path = normalize(match[2]);
  const key = `${match[1]} ${path}`;
  if (routes.has(key)) continue;
  const audience = swaggerPaths.has(path)
    ? "openapi"
    : (exclusions.find((e) => path === e.prefix || path.startsWith(`${e.prefix}/`) || path.startsWith(e.prefix))
        ?.audience ?? "unlisted");
  routes.set(key, { method: match[1], path, audience });
}

const snapshot = {
  generatedFrom: {
    api: "OilpriceAPI/oilpriceapi-api",
    commit: args.commit ?? "unknown",
    generatedAt: new Date().toISOString().slice(0, 10),
  },
  routes: [...routes.values()].sort((a, b) =>
    `${a.path} ${a.method}`.localeCompare(`${b.path} ${b.method}`),
  ),
};

const out = fileURLToPath(new URL("../tests/fixtures/api-paths.json", import.meta.url));
writeFileSync(out, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`Wrote ${snapshot.routes.length} routes to ${out}`);
