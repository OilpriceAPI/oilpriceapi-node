import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("live test failure policy", () => {
  it("never applies the shared authenticated-key 429 skip to keyless demo tests", () => {
    const source = readFileSync(
      new URL("./live/demo-endpoints.test.ts", import.meta.url),
      "utf8",
    );

    expect(source).not.toContain("skipIfRateLimited");
    expect(source).not.toMatch(/\bctx\.skip\s*\(/);
  });
});
