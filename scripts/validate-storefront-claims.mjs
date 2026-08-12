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
  ["fixed allowance", /\b(?:1,000|100)\s+requests?(?:\/month|\s+per month|\s+\(lifetime\))/i],
  [
    "quota promise",
    /\bdoes\s+not\s+consume.{0,40}\bquota\b|\bunlimited\s+(?:history|webhooks?|requests?|commodit)/i,
  ],
  [
    "fixed quota window",
    /\b(?:daily|weekly|monthly|yearly)\s+(?:(?:api|request)\s+)?quota\b|\b(?:(?:api|request)\s+)?quota\b.{0,40}\b(?:daily|weekly|monthly|yearly)\b/i,
  ],
  ["free-tier claim", /\bfree\s+tier\b|\bfree\s+api\s+key\b/i],
  [
    "free endpoint claim",
    /\b(?:endpoint|resource|api)\s+is\s+free\b|\bincluded\s+in\s+all\s+tiers\b/i,
  ],
  ["fixed query allowance", /\b\d[\d,]*\s+(?:station\s+)?queries?\s*(?:\/|per\s+)month\b/i],
  [
    "fixed demo rate",
    /\b\d+\s+(?:requests?|reqs?\.?)\s*(?:(?:per|an?)\s+|\/\s*)(?:minutes?|mins?|hours?|hrs?|days?)\b/i,
  ],
];
const telemetryIdentity =
  /\b(?:telemetry|app(?:lication)?[- ]+(?:metadata|url|name)|app[_ -]?url|app[_ -]?name|x-app-(?:url|name))\b/i;
const telemetryStrongReward =
  /\b(?:bonus|increase(?:s|d)?|unlock(?:s|ed)?|earn(?:s|ed)?|grant(?:s|ed)?|reward(?:s|ed)?|boost(?:s|ed)?)\b/i;
const telemetryModifierReward = /\b(?:more|extra|additional)\b/i;
const telemetryQuotaSignal =
  /\b(?:api[- ]+)?(?:requests?|calls?|quota|limits?|allowances?|credits?)\b|(?<![\w.])\d+(?:\.\d+)?\s*%/i;
const telemetryBoundary = /(?:\r?\n)+|[!?;]+(?:\s+|$)|\.(?:\s+|$)/g;
const telemetryModifierGapWords = new Set([
  "account",
  "annual",
  "api",
  "call",
  "daily",
  "hourly",
  "monthly",
  "quota",
  "rate",
  "request",
  "usage",
]);
const maxStrongRewardSpan = 160;
const maxTelemetryRewardSpan = 320;
const utf8Decoder = new TextDecoder("utf-8", { fatal: true });

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

function isReadableText(path) {
  const contents = readFileSync(path);
  if (contents.includes(0)) return false;
  try {
    utf8Decoder.decode(contents);
    return true;
  } catch {
    return false;
  }
}

function walkReadableFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkReadableFiles(path));
    } else if (entry.isFile() && isReadableText(path)) {
      files.push(path);
    }
  }
  return files;
}

function matches(pattern, text) {
  return [...text.matchAll(new RegExp(pattern.source, `${pattern.flags}g`))];
}

function boundedSegments(text) {
  const segments = [];
  let start = 0;
  for (const boundary of text.matchAll(telemetryBoundary)) {
    if (text.slice(start, boundary.index).trim()) {
      segments.push({ offset: start, text: text.slice(start, boundary.index) });
    }
    start = boundary.index + boundary[0].length;
  }
  if (text.slice(start).trim()) {
    segments.push({ offset: start, text: text.slice(start) });
  }
  return segments;
}

function telemetryRewardClaims(text) {
  const claims = [];
  const seen = new Set();
  for (const segment of boundedSegments(text)) {
    const searchable = segment.text.replace(/<[^>]{1,500}>/g, " ");
    const identities = matches(telemetryIdentity, searchable);
    const quotaSignals = matches(telemetryQuotaSignal, searchable);
    const strongRewards = matches(telemetryStrongReward, searchable);
    const modifierRewards = matches(telemetryModifierReward, searchable);
    const rewardPairs = [];

    for (const reward of strongRewards) {
      for (const quota of quotaSignals) {
        const start = Math.min(reward.index, quota.index);
        const end = Math.max(reward.index + reward[0].length, quota.index + quota[0].length);
        if (end - start <= maxStrongRewardSpan) rewardPairs.push({ start, end });
      }
    }
    for (const reward of modifierRewards) {
      for (const quota of quotaSignals) {
        if (reward.index + reward[0].length > quota.index) continue;
        const gap = searchable.slice(reward.index + reward[0].length, quota.index);
        const words = gap.toLowerCase().match(/[a-z]+/g) ?? [];
        if (gap.length <= 48 && words.every((word) => telemetryModifierGapWords.has(word))) {
          rewardPairs.push({
            start: reward.index,
            end: quota.index + quota[0].length,
          });
        }
      }
    }

    for (const identity of identities) {
      const related = rewardPairs
        .map((pair) => ({
          start: Math.min(identity.index, pair.start),
          end: Math.max(identity.index + identity[0].length, pair.end),
        }))
        .filter((span) => span.end - span.start <= maxTelemetryRewardSpan)
        .sort((left, right) => left.end - left.start - (right.end - right.start))[0];
      if (!related) continue;
      const claim = searchable.slice(related.start, related.end).replace(/\s+/g, " ").trim();
      const key = `${segment.offset + related.start}:${claim}`;
      if (!seen.has(key)) {
        seen.add(key);
        claims.push(claim);
      }
    }
  }
  return claims;
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
    for (const claim of telemetryRewardClaims(contents)) {
      failures.push(`${relative(baseRoot, path)}: telemetry quota reward ${JSON.stringify(claim)}`);
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
  files.push(...walkReadableFiles(resolve(packageRoot, "dist")));
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
