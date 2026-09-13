/**
 * #92 — a caller-supplied id must stay one path segment.
 *
 * Every assertion here reads the URL handed to the REAL outbound `fetch`.
 * That is the only thing that matters: an internal flag saying "we validated
 * it" proved nothing about what left the process, which is how the origin
 * leaks in #80 were found.
 *
 * The ids are rarely literals in practice — they come from a list response, a
 * config file, a webhook payload or an LLM tool call — so `..`, `?` and `#`
 * reaching the wire is a DELETE landing on a resource the caller never named.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { OilPriceAPI } from "../src/index.js";

const KEY = "fixture_key_not_a_real_credential";

interface Wire {
  method: string;
  pathname: string;
  search: string;
}

function captureWire(): Wire[] {
  const wire: Wire[] = [];
  vi.spyOn(global, "fetch").mockImplementation((async (input: unknown, init: RequestInit) => {
    const url = new URL(String(input));
    wire.push({
      method: (init?.method ?? "GET").toUpperCase(),
      pathname: url.pathname,
      search: url.search,
    });
    return new Response(JSON.stringify({ status: "success", data: {} }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch);
  return wire;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("#92 caller-supplied ids stay inside their path segment", () => {
  it("keeps a traversing id from escaping the collection", async () => {
    const wire = captureWire();
    const client = new OilPriceAPI({ apiKey: KEY, retries: 0 });

    await client.webhooks.delete("../data-sources/other-tenant-source");

    expect(wire).toHaveLength(1);
    expect(wire[0].method).toBe("DELETE");
    // The whole id is one segment under /v1/webhooks/, whatever it contains.
    expect(wire[0].pathname.startsWith("/v1/webhooks/")).toBe(true);
    expect(wire[0].pathname).not.toContain("/v1/data-sources/");
  });

  it("keeps a '?' in an id out of the query string", async () => {
    const wire = captureWire();
    const client = new OilPriceAPI({ apiKey: KEY, retries: 0 });

    await client.commodities.get("WTI_USD?by_code=BRENT_CRUDE_USD");

    expect(wire).toHaveLength(1);
    expect(wire[0].search).not.toContain("by_code=BRENT_CRUDE_USD");
    expect(wire[0].pathname.startsWith("/v1/commodities/")).toBe(true);
  });

  it("keeps a '#' in an id from truncating the path", async () => {
    const wire = captureWire();
    const client = new OilPriceAPI({ apiKey: KEY, retries: 0 });

    await client.webhooks.delete("abc#frag/nope");

    expect(wire).toHaveLength(1);
    // Pre-fix this was exactly "/v1/webhooks/abc" — a different object.
    expect(wire[0].pathname).not.toBe("/v1/webhooks/abc");
    expect(wire[0].pathname.startsWith("/v1/webhooks/")).toBe(true);
  });

  it("leaves a well-formed id byte-for-byte unchanged", async () => {
    const wire = captureWire();
    const client = new OilPriceAPI({ apiKey: KEY, retries: 0 });

    await client.webhooks.delete("normal-id-123");

    expect(wire[0].pathname).toBe("/v1/webhooks/normal-id-123");
  });

  it("holds across resource families, not just webhooks", async () => {
    const wire = captureWire();
    const client = new OilPriceAPI({ apiKey: KEY, retries: 0 });

    await client.dataSources.get("../webhooks/someone-elses");

    expect(wire[0].pathname.startsWith("/v1/data-sources/")).toBe(true);
    expect(wire[0].pathname).not.toContain("/v1/webhooks/");
  });
});

describe("#92 the whole resource layer encodes, not just the sites tested above", () => {
  it("has no raw /v1/ template interpolation left in src/resources", async () => {
    const { readdirSync, readFileSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");

    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((entry) => {
        const full = join(dir, entry);
        return statSync(full).isDirectory() ? walk(full) : full.endsWith(".ts") ? [full] : [];
      });

    // A template literal path whose interpolation is not an encodeURIComponent
    // call. Keeps the fix from being undone one new endpoint at a time.
    const offenders: string[] = [];
    for (const file of walk("src/resources")) {
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, i) => {
          const m = line.match(/`\/v1\/[^`]*\$\{(?!encodeURIComponent)/);
          if (m) offenders.push(`${file}:${i + 1}: ${line.trim()}`);
        });
    }

    expect(offenders).toEqual([]);
  });
});
