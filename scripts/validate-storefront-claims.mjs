#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const surfaces = ["README.md", "package.json"];
const blocked = [
  /\breal[ -]?time\b/i,
  /\b(?:110|200|500)\+\s+(?:commodit|endpoint|tool)/i,
  /\b2m\+?\s+api requests/i,
  /\b(?:every|updated|refresh(?:ed)?)\s+(?:in\s+)?5 minutes\b/i,
  /\b(?:99\.\d+%|fortune 500|trading[- ]grade)\b/i,
  /\b(?:1,000|100)\s+requests?(?:\/month|\s+per month|\s+\(lifetime\))/i,
  /\bunlimited\s+(?:history|webhooks?|requests?|commodit)/i,
];
const contract = "https://api.oilpriceapi.com/product-facts.json";

export function validateStorefront() {
  const failures = [];
  for (const relativePath of surfaces) {
    const contents = readFileSync(resolve(root, relativePath), "utf8");
    for (const pattern of blocked) {
      if (pattern.test(contents)) {
        failures.push(`${relativePath}: blocked claim matched ${pattern}`);
      }
    }
  }

  const readme = readFileSync(resolve(root, "README.md"), "utf8");
  if (!readme.includes(contract)) {
    failures.push("README.md: reviewed product-facts contract is not linked");
  }

  const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
  const versionSource = readFileSync(resolve(root, "src/version.ts"), "utf8");
  const versionMatch = versionSource.match(/SDK_VERSION = "([^"]+)"/);
  if (!versionMatch || packageJson.version !== versionMatch[1]) {
    failures.push("package version differs between package.json and src/version.ts");
  }
  return failures;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const failures = validateStorefront();
  if (failures.length) {
    throw new Error(failures.join("\n"));
  }
  console.log(`validated ${surfaces.length} Node storefront surfaces`);
}
