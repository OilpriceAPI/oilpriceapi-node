import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { verifyWebhookSignature } from "../src/index.js";

function makeSignature(payload: string | Buffer, secret: string): string {
  return "sha256=" + createHmac("sha256", secret).update(payload).digest("hex");
}

describe("verifyWebhookSignature()", () => {
  const secret = "test_secret_abc123";
  const payload = '{"event":"price.updated","price":75.5}';

  it("returns true for a valid signature", () => {
    const sig = makeSignature(payload, secret);
    expect(verifyWebhookSignature(payload, sig, secret)).toBe(true);
  });

  it("returns false for an invalid signature", () => {
    const badSig = "sha256=" + "a".repeat(64);
    expect(verifyWebhookSignature(payload, badSig, secret)).toBe(false);
  });

  it("returns false for an empty signature string", () => {
    expect(verifyWebhookSignature(payload, "", secret)).toBe(false);
  });

  it("returns false when the payload differs from what was signed", () => {
    const sig = makeSignature(payload, secret);
    expect(verifyWebhookSignature('{"event":"price.updated","price":99.0}', sig, secret)).toBe(
      false,
    );
  });

  it("returns false when the secret differs from what was used to sign", () => {
    const sig = makeSignature(payload, secret);
    expect(verifyWebhookSignature(payload, sig, "wrong_secret")).toBe(false);
  });

  it("returns false for a signature with wrong prefix (md5= instead of sha256=)", () => {
    const md5Sig = "md5=" + createHmac("sha256", secret).update(payload).digest("hex");
    expect(verifyWebhookSignature(payload, md5Sig, secret)).toBe(false);
  });

  it("accepts a Buffer payload and returns true for a valid signature", () => {
    const bufPayload = Buffer.from(payload);
    const sig = makeSignature(bufPayload, secret);
    expect(verifyWebhookSignature(bufPayload, sig, secret)).toBe(true);
  });
});
