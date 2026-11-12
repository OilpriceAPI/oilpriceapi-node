import { spawnSync } from "node:child_process";

// TypeDoc 0.28 needs minimatch 10's matchOne API; remove this exception in #150.
const allowedAdvisory = "https://github.com/advisories/GHSA-g3hv-75wg-m249";

function audit(args) {
  const result = spawnSync("npm", ["audit", ...args, "--json"], {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.error || ![0, 1].includes(result.status)) {
    throw new Error(`npm audit failed: ${result.error?.message ?? result.stderr}`);
  }

  const report = JSON.parse(result.stdout);
  if (!report.metadata?.vulnerabilities || !report.vulnerabilities) {
    throw new Error("npm audit returned no vulnerability report");
  }
  return report;
}

const production = audit(["--omit=dev"]);
if (production.metadata.vulnerabilities.total !== 0) {
  throw new Error("Production dependencies have audit findings");
}

const full = audit([]);
const findings = Object.values(full.vulnerabilities);
const advisories = findings.flatMap(({ via }) =>
  via.filter((entry) => typeof entry !== "string"),
);
if (
  findings.some(({ severity }) => severity === "high" || severity === "critical") ||
  (findings.length > 0 && advisories.length === 0) ||
  advisories.some(
    ({ name, severity, url }) =>
      name !== "minimatch" || severity !== "moderate" || url !== allowedAdvisory,
  )
) {
  throw new Error("Unexpected development dependency advisory; inspect npm audit");
}

console.log(
  `Dependency audit passed: 0 production findings; ${findings.length} development packages affected by the tracked minimatch advisory`,
);
