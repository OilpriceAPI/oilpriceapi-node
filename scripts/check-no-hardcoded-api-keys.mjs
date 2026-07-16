import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const scanPaths = [
  "README.md",
  "CHANGELOG.md",
  "PUBLISH_GUIDE.md",
  "docs",
  "example.ts",
  "example-walk.ts",
  "example-commodities.ts",
  "examples",
  "qa_test.js",
  "src",
  "tests",
];
const textExtensions = new Set([
  ".cjs",
  ".cts",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".mts",
  ".ts",
  ".txt",
  ".yaml",
  ".yml",
]);
const skippedDirs = new Set([".git", "coverage", "dist", "node_modules"]);
const tokenPattern = /(?<![A-Fa-f0-9])[A-Fa-f0-9]{64}(?![A-Fa-f0-9])/g;

function extensionFor(path) {
  const index = path.lastIndexOf(".");
  return index === -1 ? "" : path.slice(index);
}

function* walk(path) {
  const stat = statSync(path);
  if (stat.isFile()) {
    if (textExtensions.has(extensionFor(path).toLowerCase())) {
      yield path;
    }
    return;
  }

  for (const entry of readdirSync(path)) {
    if (skippedDirs.has(entry)) {
      continue;
    }
    yield* walk(join(path, entry));
  }
}

const findings = [];

for (const scanPath of scanPaths) {
  const absolute = join(root, scanPath);
  try {
    for (const file of walk(absolute)) {
      const lines = readFileSync(file, "utf8").split(/\r?\n/);
      lines.forEach((line, index) => {
        for (const match of line.matchAll(tokenPattern)) {
          const tokenHash = createHash("sha256").update(match[0]).digest("hex").slice(0, 16);
          findings.push(`${relative(root, file)}:${index + 1}: sha256:${tokenHash}`);
        }
      });
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}

if (findings.length > 0) {
  console.error("Hardcoded OilPriceAPI-shaped token(s) found:");
  for (const finding of findings) {
    console.error(finding);
  }
  process.exit(1);
}
