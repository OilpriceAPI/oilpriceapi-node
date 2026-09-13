#!/usr/bin/env node
/**
 * Rename the CommonJS build's declaration files from `.d.ts` to `.d.cts`.
 *
 * Why this exists
 * ---------------
 * The package root declares `"type": "module"`, so TypeScript classifies every
 * `.d.ts` beneath it as ESM. While both arms of the exports map pointed at the
 * same `dist/index.d.ts`, a `require`-mode consumer got:
 *
 *   error TS1479: The current file is a CommonJS module whose imports will
 *   produce 'require' calls; however, the referenced file is an ECMAScript
 *   module and cannot be imported with 'require'.
 *
 * The `.d.cts` extension is unambiguous: TypeScript always classifies it as
 * CommonJS, independently of any enclosing `package.json`. See issue #93.
 *
 * TypeScript has no `outExtension` option, so the CJS project emits `.d.ts`
 * and this script renames them. Relative specifiers inside those declarations
 * are emitted as `./foo.js`; under `node16` resolution a `.js` specifier only
 * ever maps to `.d.ts`, never to `.d.cts`, so they are rewritten to `./foo.cjs`
 * — which does map to `./foo.d.cts`. The emitted runtime JavaScript is left
 * untouched: it stays `.js` and remains CommonJS by way of the
 * `dist/cjs/package.json` `{"type":"commonjs"}` marker the build writes.
 */
import { readdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * Rewrite relative module specifiers ending in `.js` to `.cjs`.
 *
 * Covers the forms TypeScript emits in declaration files: `from "./x.js"`,
 * `import("./x.js")` and `require("./x.js")`.
 *
 * @param {string} source
 * @returns {string}
 */
export function rewriteSpecifiers(source) {
  return source.replace(
    /(from\s*|import\s*\(\s*|require\s*\(\s*)(["'])(\.{1,2}\/[^"']*?)\.js\2/g,
    (_match, prefix, quote, specifier) => `${prefix}${quote}${specifier}.cjs${quote}`,
  );
}

/**
 * List every file beneath `dir`, recursively.
 *
 * @param {string} dir
 * @returns {Promise<string[]>}
 */
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else files.push(full);
  }
  return files;
}

async function main() {
  const cjsDir = fileURLToPath(new URL("../dist/cjs/", import.meta.url));
  const declarations = (await walk(cjsDir)).filter((file) => file.endsWith(".d.ts"));

  if (declarations.length === 0) {
    throw new Error(
      'no .d.ts files in dist/cjs — is "declaration" still false in tsconfig.cjs.json?',
    );
  }

  for (const file of declarations) {
    await writeFile(file, rewriteSpecifiers(await readFile(file, "utf8")));
    await rename(file, `${file.slice(0, -".d.ts".length)}.d.cts`);
  }

  process.stdout.write(
    `emit-cjs-declarations: renamed ${declarations.length} declaration file(s) to .d.cts\n`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
