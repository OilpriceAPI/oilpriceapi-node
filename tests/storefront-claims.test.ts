import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  discoverStorefrontSurfaces,
  validatePackage,
  validateStorefront,
} from "../scripts/validate-storefront-claims.mjs";

const scratch: string[] = [];

afterEach(() => {
  for (const path of scratch.splice(0)) {
    rmSync(path, { force: true, recursive: true });
  }
});

describe("public storefront claims", () => {
  it("match the reviewed product-facts contract", () => {
    expect(validateStorefront()).toEqual([]);
  });

  it("discovers generated docs and nested package source", () => {
    const surfaces = discoverStorefrontSurfaces().map((path) =>
      relative(process.cwd(), path),
    );

    expect(surfaces).toContain("docs/index.html");
    expect(surfaces).toContain("src/index.ts");
    expect(surfaces).toContain("src/resources/streaming.ts");
  });

  it("rejects a stale claim introduced only in the packed artifact", () => {
    const root = mkdtempSync(join(tmpdir(), "oilpriceapi-package-claims-"));
    scratch.push(root);
    mkdirSync(join(root, "dist", "resources"), { recursive: true });
    writeFileSync(
      join(root, "README.md"),
      "https://api.oilpriceapi.com/product-facts.json\n",
    );
    writeFileSync(join(root, "package.json"), JSON.stringify({ version: "9.9.9" }));
    writeFileSync(join(root, "dist", "version.js"), 'export const SDK_VERSION = "9.9.9";\n');
    writeFileSync(
      join(root, "dist", "resources", "future.d.ts"),
      "/** Guaranteed 99.9% uptime. */\n",
    );

    expect(validatePackage(root)).toContainEqual(
      expect.stringContaining("dist/resources/future.d.ts"),
    );
  });
});
