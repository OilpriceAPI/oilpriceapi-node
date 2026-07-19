#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = resolve(root, "examples/snippets/manifest-source.json");
const schemaPath = resolve(root, "schemas/snippet-manifest.schema.json");
const packagePath = resolve(root, "package.json");
const forbidden = [
  /(api[_-]?key|token)\s*[:=]\s*["'][A-Za-z0-9_-]{20,}/i,
  /your_api_key_here/i,
];

function argument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function defaultCommit() {
  return execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
}

export function buildManifest(sourceCommit = defaultCommit()) {
  if (!/^[0-9a-f]{40}$/.test(sourceCommit)) {
    throw new Error("source commit must be a full lowercase Git SHA");
  }

  const source = JSON.parse(readFileSync(sourcePath, "utf8"));
  const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
  const seenIds = new Set();
  const examples = source.examples.map((metadata) => {
    if (seenIds.has(metadata.id)) {
      throw new Error(`duplicate example id: ${metadata.id}`);
    }
    seenIds.add(metadata.id);

    const code = readFileSync(resolve(root, metadata.path), "utf8");
    if (forbidden.some((pattern) => pattern.test(code))) {
      throw new Error(`forbidden secret-like content in ${metadata.path}`);
    }
    return {
      ...metadata,
      code,
      sha256: createHash("sha256").update(code).digest("hex"),
    };
  });

  const manifest = {
    schema_version: source.schema_version,
    package: { ...source.package, version: packageJson.version },
    source_commit: sourceCommit,
    examples,
  };
  const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
  const validate = new Ajv2020({ strict: true }).compile(schema);
  if (!validate(manifest)) {
    throw new Error(`snippet manifest failed schema validation: ${JSON.stringify(validate.errors)}`);
  }
  return manifest;
}

export function writeManifest(output, sourceCommit) {
  const payload = `${JSON.stringify(buildManifest(sourceCommit), null, 2)}\n`;
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, payload);
  const digest = createHash("sha256").update(payload).digest("hex");
  writeFileSync(`${output}.sha256`, `${digest}  ${output.split("/").at(-1)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const output = argument("--output");
  if (!output) {
    throw new Error("--output is required");
  }
  writeManifest(resolve(root, output), argument("--source-commit"));
}
