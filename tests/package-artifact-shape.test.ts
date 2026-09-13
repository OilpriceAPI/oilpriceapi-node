import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Packaging shape guards for issue #93.
 *
 * These assert facts about what we *publish*, not about what `src/` does. The
 * defects they cover were all invisible to the rest of the suite: runtime
 * `require()` worked fine, the smoke test is JavaScript, and nothing looked at
 * the declaration files a TypeScript consumer actually resolves.
 */

const read = (path: string): string => readFileSync(path, "utf8");

interface PackageJson {
  type: string;
  version: string;
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  exports: {
    ".": {
      import: { types: string; default: string };
      require: { types: string; default: string };
    };
  };
}

const packageJson = JSON.parse(read("package.json")) as PackageJson;

/** Every file beneath `dir`, as paths relative to `dir`. */
function walk(dir: string, prefix = ""): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? walk(join(dir, entry.name), `${prefix}${entry.name}/`)
      : [`${prefix}${entry.name}`],
  );
}

describe("published package shape", () => {
  it("gives the require arm its own CommonJS declarations", () => {
    // The package root is `"type": "module"`, so TypeScript classifies any
    // `.d.ts` beneath it as ESM. Pointing the require arm at one produced
    // TS1479 for every `moduleResolution: node16` CommonJS consumer, and
    // `attw` reported "node16 (from CJS): Masquerading as ESM".
    const { import: esm, require: cjs } = packageJson.exports["."];

    expect(packageJson.type).toBe("module");
    expect(cjs.types).toMatch(/\.d\.cts$/);
    expect(cjs.types).not.toBe(esm.types);
    expect(esm.types).toMatch(/\.d\.ts$/);
  });

  it("builds the CommonJS project with declarations enabled", () => {
    const cjsConfig = JSON.parse(read("tsconfig.cjs.json")) as {
      compilerOptions: { declaration?: boolean };
    };

    expect(cjsConfig.compilerOptions.declaration).not.toBe(false);
  });

  it("declares every type dependency its public declarations import", () => {
    // `dist/resources/streaming.d.ts` imports `ws` and `node:events`, and
    // `verifyWebhookSignature` takes a `Buffer` — all in public signatures. A
    // consumer with `skipLibCheck: false` got TS7016 / TS2307 / TS2580 because
    // these types were only devDependencies.
    expect(packageJson.dependencies).toHaveProperty("@types/ws");
    expect(packageJson.dependencies).toHaveProperty("@types/node");
    expect(packageJson.devDependencies).not.toHaveProperty("@types/ws");
    expect(packageJson.devDependencies).not.toHaveProperty("@types/node");
  });

  it("cleans dist before building so stale artifacts cannot ship", () => {
    // `files: ["dist", ...]` publishes whatever the directory happens to hold.
    // Without a clean step a module renamed or deleted between releases keeps
    // shipping its previous `.js` and `.d.ts` forever.
    expect(packageJson.scripts).toHaveProperty("prebuild");
    expect(packageJson.scripts.prebuild).toContain("clean-dist");
    expect(existsSync("scripts/clean-dist.mjs")).toBe(true);
  });
});

describe("built package artifacts", () => {
  it(
    "emits .d.cts for the CommonJS build and drops stale output",
    { timeout: 180_000 },
    () => {
      mkdirSync("dist/resources", { recursive: true });
      writeFileSync("dist/resources/ghost-from-old-release.js", "module.exports = {};\n");
      writeFileSync("dist/resources/ghost-from-old-release.d.ts", "export {};\n");

      execFileSync("npm", ["run", "build"], { stdio: "pipe" });

      // 3. the clean step removed the planted stale artifacts
      expect(existsSync("dist/resources/ghost-from-old-release.js")).toBe(false);
      expect(existsSync("dist/resources/ghost-from-old-release.d.ts")).toBe(false);

      // 1. the require arm resolves to real CommonJS declarations
      const requireTypes = packageJson.exports["."].require.types.replace(/^\.\//, "");
      expect(existsSync(requireTypes)).toBe(true);
      expect(walk("dist/cjs").filter((file) => file.endsWith(".d.ts"))).toEqual([]);

      // A `.js` specifier inside a `.d.cts` only ever maps back to `.d.ts`,
      // which no longer exists here — every relative specifier must be `.cjs`.
      const staleSpecifiers = read(requireTypes).match(
        /(?:from|import|require)\s*\(?\s*["']\.{1,2}\/[^"']*\.js["']/g,
      );
      expect(staleSpecifiers).toBeNull();
    },
  );
});
