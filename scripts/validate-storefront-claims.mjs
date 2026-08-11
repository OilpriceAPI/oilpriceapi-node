#!/usr/bin/env node
import { readFileSync, readdirSync } from "node:fs";
import { dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const contract = "https://api.oilpriceapi.com/product-facts.json";
const blocked = [
  ["real-time claim", /\breal[ -]?time\b/i],
  ["fixed catalog total", /\b\d+\+\s+(?:commodit|endpoint|tool|api)/i],
  ["fixed traffic total", /\b2m\+?\s+api requests/i],
  ["fixed update cadence", /\b(?:every|updated|refresh(?:ed)?)\s+(?:in\s+)?\d+\s+minutes\b/i],
  ["uptime or SLA", /\b\d+(?:\.\d+)?%\s+uptime\b|\bSLA\b/i],
  ["price comparison", /\bbloomberg\b|\b\d+(?:\.\d+)?%\s+less\s+cost\b/i],
  ["unreviewed plan name", /\bprofessional\+?\b|\bstarter plan\b|\bscale tier\b/i],
  ["unreviewed plan price", /\$\d+(?:\.\d+)?\s*(?:\/|per\s+)(?:mo(?:nth)?|year)\b/i],
  [
    "fixed allowance",
    /\b(?:1,000|100)\s+requests?(?:\/month|\s+per month|\s+\(lifetime\))/i,
  ],
  ["quota promise", /\bdoes\s+not\s+consume.{0,40}\bquota\b|\bunlimited\s+(?:history|webhooks?|requests?|commodit)/i],
  [
    "fixed quota window",
    /\b(?:daily|weekly|monthly|yearly)\s+(?:(?:api|request)\s+)?quota\b|\b(?:(?:api|request)\s+)?quota\b.{0,40}\b(?:daily|weekly|monthly|yearly)\b/i,
  ],
  ["free-tier claim", /\bfree\s+tier\b|\bfree\s+api\s+key\b/i],
  ["free endpoint claim", /\b(?:endpoint|resource|api)\s+is\s+free\b|\bincluded\s+in\s+all\s+tiers\b/i],
  ["fixed query allowance", /\b\d[\d,]*\s+(?:station\s+)?queries?\s*(?:\/|per\s+)month\b/i],
  [
    "fixed demo rate",
    /\b\d+\s+(?:requests?|reqs?\.?)\s*(?:(?:per|an?)\s+|\/\s*)(?:minutes?|mins?|hours?|hrs?|days?)\b/i,
  ],
];

function walkFiles(directory, extensions) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(path, extensions));
    } else if (extensions.has(extname(entry.name))) {
      files.push(path);
    }
  }
  return files;
}

export function discoverStorefrontSurfaces(baseRoot = defaultRoot) {
  const files = [resolve(baseRoot, "README.md"), resolve(baseRoot, "package.json")];
  for (const [directory, extensions] of [
    ["docs", new Set([".html", ".md"])],
    ["src", new Set([".ts"])],
  ]) {
    files.push(...walkFiles(resolve(baseRoot, directory), extensions));
  }
  return files.sort();
}

function claimFailures(baseRoot, files) {
  const failures = [];
  for (const path of files) {
    const contents = readFileSync(path, "utf8");
    for (const [label, pattern] of blocked) {
      const match = contents.match(pattern);
      if (match) {
        failures.push(`${relative(baseRoot, path)}: ${label} ${JSON.stringify(match[0])}`);
      }
    }
  }
  return failures;
}

function requireContractLink(baseRoot, failures) {
  const readme = readFileSync(resolve(baseRoot, "README.md"), "utf8");
  if (!readme.includes(contract)) {
    failures.push("README.md: reviewed product-facts contract is not linked");
  }
}

export function validateStorefront(baseRoot = defaultRoot) {
  const failures = claimFailures(baseRoot, discoverStorefrontSurfaces(baseRoot));
  requireContractLink(baseRoot, failures);

  const packageJson = JSON.parse(readFileSync(resolve(baseRoot, "package.json"), "utf8"));
  const versionSource = readFileSync(resolve(baseRoot, "src/version.ts"), "utf8");
  const versionMatch = versionSource.match(/SDK_VERSION = "([^"]+)"/);
  if (!versionMatch || packageJson.version !== versionMatch[1]) {
    failures.push("package version differs between package.json and src/version.ts");
  }
  return failures;
}

export function validatePackage(packageRoot) {
  const files = [resolve(packageRoot, "README.md"), resolve(packageRoot, "package.json")];
  files.push(...walkFiles(resolve(packageRoot, "dist"), new Set([".js", ".ts", ".json"])));
  const failures = claimFailures(packageRoot, files);
  requireContractLink(packageRoot, failures);

  const packageJson = JSON.parse(readFileSync(resolve(packageRoot, "package.json"), "utf8"));
  const versionSource = readFileSync(resolve(packageRoot, "dist/version.js"), "utf8");
  const versionMatch = versionSource.match(/SDK_VERSION\s*=\s*"([^"]+)"/);
  if (!versionMatch || packageJson.version !== versionMatch[1]) {
    failures.push("package version differs between package.json and dist/version.js");
  }
  return failures;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const packageArg = process.argv.indexOf("--package-root");
  const packageRoot = packageArg >= 0 ? process.argv[packageArg + 1] : undefined;
  const failures = packageRoot ? validatePackage(resolve(packageRoot)) : validateStorefront();
  if (failures.length) {
    throw new Error(failures.join("\n"));
  }
  console.log(
    packageRoot
      ? "validated exact packed Node artifact claims"
      : `validated ${discoverStorefrontSurfaces().length} Node public surfaces`,
  );
}
