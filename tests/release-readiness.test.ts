import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string): string => readFileSync(path, "utf8");

describe("release readiness", () => {
  it("keeps package, runtime, and changelog versions aligned", () => {
    const packageJson = JSON.parse(read("package.json")) as { version: string };
    const versionSource = read("src/version.ts");
    const changelog = read("CHANGELOG.md");
    const firstRelease = changelog.match(/^## \[([^\]]+)\]/m);

    expect(packageJson.version).toBe("1.2.0");
    expect(versionSource).toContain(`SDK_VERSION = "${packageJson.version}"`);
    expect(firstRelease?.[1]).toBe(packageJson.version);
  });

  it("gates publication on audit, exact tag, and packed ESM/CJS imports", () => {
    const packageJson = JSON.parse(read("package.json")) as {
      scripts: Record<string, string>;
    };
    const workflow = read(".github/workflows/publish.yml");
    const smokeScript = read("scripts/clean-install-smoke.sh");

    expect(packageJson.scripts.lint).toContain("--max-warnings=0");
    expect(packageJson.scripts["smoke:package"]).toBe("./scripts/clean-install-smoke.sh");
    expect(workflow).toContain("Verify release tag matches package version");
    expect(workflow).toContain("npm audit --audit-level=low");
    expect(workflow).toContain("npm run smoke:package");
    expect(smokeScript).toMatch(/npm run build[\s\S]*npm pack/);
  });
});
