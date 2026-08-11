import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string): string => readFileSync(path, "utf8");

describe("release readiness", () => {
  it("keeps package, runtime, and changelog versions aligned", () => {
    const packageJson = JSON.parse(read("package.json")) as { version: string };
    const versionSource = read("src/version.ts");
    const changelog = read("CHANGELOG.md");
    const firstRelease = changelog.match(/^## \[([^\]]+)\]/m);

    expect(packageJson.version).toBe("1.2.2");
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
    expect(smokeScript).toMatch(/npm install[\s\S]*--package-root/);
  });

  it("keeps dependency execution outside the checksummed OIDC publisher", () => {
    const workflow = read(".github/workflows/publish.yml");
    const publishJob = workflow
      .split(/\n(?=  [a-z][a-z0-9_-]*:\n)/)
      .find((section) => section.startsWith("  publish:\n"));
    const actions = workflow.match(/uses:\s+actions\/[^@\s]+@([^\s#]+)/g) ?? [];

    expect(workflow).toContain("Verify release tag matches package version and protected main");
    expect(workflow).toContain("actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a");
    expect(workflow).toContain("actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c");
    expect(publishJob).toContain("id-token: write");
    expect(publishJob).toContain("sha256sum -c artifact.sha256");
    expect(publishJob).not.toMatch(/npm (?:ci|install)/);
    expect(publishJob).not.toContain("npx ");
    expect(publishJob).not.toContain("actions/checkout@");
    expect(actions).not.toHaveLength(0);
    for (const action of actions) expect(action).toMatch(/@[0-9a-f]{40}$/);
  });

  it("does not persist checkout credentials in repository workflows", () => {
    for (const name of readdirSync(".github/workflows").filter((file) => file.endsWith(".yml"))) {
      const workflow = read(`.github/workflows/${name}`);
      const checkoutCount = workflow.match(/actions\/checkout@/g)?.length ?? 0;
      const hardenedCount = workflow.match(/persist-credentials: false/g)?.length ?? 0;

      expect(hardenedCount, name).toBe(checkoutCount);
    }
  });

  it("documents a coverage-gated permit-to-production customer path", () => {
    const readme = read("README.md");
    const packageJson = JSON.parse(read("package.json")) as { keywords: string[] };

    expect(readme).toContain("coverage.well_level_states_with_data");
    expect(readme).toContain("client.ei.wellPermits.search");
    expect(readme).toContain("client.wellProduction.wellDetail");
    expect(packageJson.keywords).toEqual(
      expect.arrayContaining(["well-permits", "drilling-data", "oil-well-production"]),
    );
  });
});
