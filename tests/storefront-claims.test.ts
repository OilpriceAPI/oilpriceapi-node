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
    const surfaces = discoverStorefrontSurfaces().map((path) => relative(process.cwd(), path));

    expect(surfaces).toContain("docs/index.html");
    expect(surfaces).toContain("src/index.ts");
    expect(surfaces).toContain("src/resources/streaming.ts");
  });

  it("rejects a stale claim introduced only in the packed artifact", () => {
    const root = mkdtempSync(join(tmpdir(), "oilpriceapi-package-claims-"));
    scratch.push(root);
    mkdirSync(join(root, "dist", "resources"), { recursive: true });
    writeFileSync(join(root, "README.md"), "https://api.oilpriceapi.com/product-facts.json\n");
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

  it("rejects telemetry quota rewards in future nested authored source", () => {
    const root = mkdtempSync(join(tmpdir(), "oilpriceapi-authored-telemetry-claim-"));
    scratch.push(root);
    mkdirSync(join(root, "docs"), { recursive: true });
    mkdirSync(join(root, "src", "resources", "future"), { recursive: true });
    writeFileSync(join(root, "README.md"), "https://api.oilpriceapi.com/product-facts.json\n");
    writeFileSync(join(root, "package.json"), JSON.stringify({ version: "9.9.9" }));
    writeFileSync(join(root, "src", "version.ts"), 'export const SDK_VERSION = "9.9.9";\n');
    writeFileSync(
      join(root, "src", "resources", "future", "client.ts"),
      "/** Telemetry metadata unlocks additional API calls for your app. */\n",
    );

    expect(validateStorefront(root)).toContainEqual(
      expect.stringContaining("src/resources/future/client.ts: telemetry quota reward"),
    );
  });

  it.each([
    "App telemetry may unlock a 10% bonus to your request limit.",
    "10% bonus for appUrl API calls.",
    "X-App-URL earns extra request credits.",
    "More requests are granted when application metadata is sent.",
    "Sending appUrl increases your quota allowance.",
  ])("rejects a telemetry quota reward in a future packed declaration: %s", (claim) => {
    const root = mkdtempSync(join(tmpdir(), "oilpriceapi-packed-telemetry-claim-"));
    scratch.push(root);
    mkdirSync(join(root, "dist", "resources", "future"), { recursive: true });
    writeFileSync(join(root, "README.md"), "https://api.oilpriceapi.com/product-facts.json\n");
    writeFileSync(join(root, "package.json"), JSON.stringify({ version: "9.9.9" }));
    writeFileSync(join(root, "dist", "version.js"), 'export const SDK_VERSION = "9.9.9";\n');
    writeFileSync(join(root, "dist", "resources", "future", "client.d.ts"), `/** ${claim} */\n`);

    expect(validatePackage(root)).toContainEqual(
      expect.stringContaining("dist/resources/future/client.d.ts: telemetry quota reward"),
    );
  });

  it("does not reject telemetry attribution without a quota reward", () => {
    const root = mkdtempSync(join(tmpdir(), "oilpriceapi-packed-telemetry-attribution-"));
    scratch.push(root);
    mkdirSync(join(root, "dist"), { recursive: true });
    writeFileSync(join(root, "README.md"), "https://api.oilpriceapi.com/product-facts.json\n");
    writeFileSync(join(root, "package.json"), JSON.stringify({ version: "9.9.9" }));
    writeFileSync(join(root, "dist", "version.js"), 'export const SDK_VERSION = "9.9.9";\n');
    writeFileSync(
      join(root, "dist", "client.d.ts"),
      "/** Optional app metadata identifies SDK usage. Entitlements come from Product Facts.\n" +
        " * Telemetry sends extra application metadata with API requests.\n" +
        " */\n",
    );

    expect(validatePackage(root)).toEqual([]);
  });

  it("rejects a fixed quota window without requiring a numeric allowance", () => {
    const root = mkdtempSync(join(tmpdir(), "oilpriceapi-package-quota-"));
    scratch.push(root);
    mkdirSync(join(root, "dist"), { recursive: true });
    writeFileSync(
      join(root, "README.md"),
      "Monthly quota reached.\nhttps://api.oilpriceapi.com/product-facts.json\n",
    );
    writeFileSync(join(root, "package.json"), JSON.stringify({ version: "9.9.9" }));
    writeFileSync(join(root, "dist", "version.js"), 'export const SDK_VERSION = "9.9.9";\n');

    expect(validatePackage(root)).toContainEqual(expect.stringContaining("fixed quota window"));
  });
});
