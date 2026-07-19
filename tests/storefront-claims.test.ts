import { describe, expect, it } from "vitest";

import { validateStorefront } from "../scripts/validate-storefront-claims.mjs";

describe("public storefront claims", () => {
  it("match the reviewed product-facts contract", () => {
    expect(validateStorefront()).toEqual([]);
  });
});
