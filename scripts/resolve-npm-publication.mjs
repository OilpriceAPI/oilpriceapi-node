#!/usr/bin/env node

import { pathToFileURL } from "node:url";

const REGISTRY_BASE = "https://registry.npmjs.org";

function requireExpectedString(value, label) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} is required`);
  }
  return value;
}

function requireIntegrity(value) {
  const integrity = requireExpectedString(value, "expected npm integrity");
  if (!/^sha512-[A-Za-z0-9+/]+={0,2}$/.test(integrity)) {
    throw new Error("expected npm integrity must be SHA-512 SRI");
  }
  const digest = Buffer.from(integrity.slice("sha512-".length), "base64");
  if (digest.length !== 64) {
    throw new Error("expected npm integrity must contain a 512-bit digest");
  }
  return integrity;
}

export async function resolveNpmPublicationState({
  expectedName,
  expectedVersion,
  expectedIntegrity,
  selector = expectedVersion,
  timeoutMs = 10_000,
  fetchImpl = fetch,
}) {
  const name = requireExpectedString(expectedName, "expected npm package name");
  const version = requireExpectedString(expectedVersion, "expected npm package version");
  const integrity = requireIntegrity(expectedIntegrity);
  if (selector !== version && selector !== "latest") {
    throw new Error("npm registry selector must be the exact version or latest");
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1) {
    throw new Error("npm registry timeout must be a positive integer");
  }

  const response = await fetchImpl(
    `${REGISTRY_BASE}/${encodeURIComponent(name)}/${encodeURIComponent(selector)}`,
    {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    },
  );

  if (response.status === 404) return "absent";
  if (!response.ok) {
    throw new Error(`npm publication-state readback returned HTTP ${response.status}`);
  }

  let document;
  try {
    document = await response.json();
  } catch (error) {
    throw new Error("npm publication-state response was not valid JSON", { cause: error });
  }
  if (
    document === null ||
    typeof document !== "object" ||
    Array.isArray(document) ||
    document.dist === null ||
    typeof document.dist !== "object" ||
    Array.isArray(document.dist) ||
    document.name !== name ||
    document.version !== version ||
    document.dist.integrity !== integrity
  ) {
    throw new Error("npm publication-state metadata did not match the verified tarball");
  }

  return "present";
}

async function main() {
  const mode = process.env.NPM_PUBLICATION_MODE;
  if (mode !== "publication-state" && mode !== "require-present") {
    throw new Error("NPM_PUBLICATION_MODE must be publication-state or require-present");
  }
  const timeoutMs = Number(process.env.NPM_PUBLICATION_TIMEOUT_MS || 10_000);
  const state = await resolveNpmPublicationState({
    expectedName: process.env.NPM_PUBLICATION_EXPECTED_NAME,
    expectedVersion: process.env.NPM_PUBLICATION_EXPECTED_VERSION,
    expectedIntegrity: process.env.NPM_PUBLICATION_EXPECTED_INTEGRITY,
    selector: process.env.NPM_PUBLICATION_SELECTOR || process.env.NPM_PUBLICATION_EXPECTED_VERSION,
    timeoutMs,
  });
  if (mode === "require-present" && state !== "present") {
    throw new Error("verified npm release is not publicly present");
  }
  process.stdout.write(`${state}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
