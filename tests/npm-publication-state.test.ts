import { describe, expect, it, vi } from "vitest";
import { resolveNpmPublicationState } from "../scripts/resolve-npm-publication.mjs";

const expected = {
  expectedName: "oilpriceapi",
  expectedVersion: "1.2.3",
  expectedIntegrity: "sha512-dGVzdA==",
};

function registryResponse(status: number, payload: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(payload),
  };
}

describe("npm publication state", () => {
  it("treats only an exact HTTP 404 as absent", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(registryResponse(404, { error: "Not found" }));

    await expect(resolveNpmPublicationState({ ...expected, fetchImpl })).resolves.toBe("absent");
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://registry.npmjs.org/oilpriceapi/1.2.3",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("accepts an exact name, version, and integrity document as present", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      registryResponse(200, {
        name: expected.expectedName,
        version: expected.expectedVersion,
        dist: { integrity: expected.expectedIntegrity },
      }),
    );

    await expect(resolveNpmPublicationState({ ...expected, fetchImpl })).resolves.toBe("present");
  });

  it("validates the latest selector against the same exact release", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      registryResponse(200, {
        name: expected.expectedName,
        version: expected.expectedVersion,
        dist: { integrity: expected.expectedIntegrity },
      }),
    );

    await expect(
      resolveNpmPublicationState({ ...expected, selector: "latest", fetchImpl }),
    ).resolves.toBe("present");
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://registry.npmjs.org/oilpriceapi/latest",
      expect.any(Object),
    );
  });

  it.each([
    ["wrong integrity", { name: "oilpriceapi", version: "1.2.3", dist: { integrity: "sha512-wrong" } }],
    ["wrong name", { name: "other", version: "1.2.3", dist: { integrity: "sha512-dGVzdA==" } }],
    ["wrong version", { name: "oilpriceapi", version: "9.9.9", dist: { integrity: "sha512-dGVzdA==" } }],
    ["malformed document", { error: "not package metadata" }],
  ])("rejects a 200 response with %s", async (_label, payload) => {
    const fetchImpl = vi.fn().mockResolvedValue(registryResponse(200, payload));

    await expect(resolveNpmPublicationState({ ...expected, fetchImpl })).rejects.toThrow(
      /verified tarball/,
    );
  });

  it("fails closed on non-404 registry errors", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(registryResponse(503, { error: "unavailable" }));

    await expect(resolveNpmPublicationState({ ...expected, fetchImpl })).rejects.toThrow("HTTP 503");
  });

  it("fails closed when a successful response is not valid JSON", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockRejectedValue(new SyntaxError("bad JSON")),
    });

    await expect(resolveNpmPublicationState({ ...expected, fetchImpl })).rejects.toThrow(
      "not valid JSON",
    );
  });

  it("fails closed on network errors", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network unavailable"));

    await expect(resolveNpmPublicationState({ ...expected, fetchImpl })).rejects.toThrow(
      "network unavailable",
    );
  });
});
