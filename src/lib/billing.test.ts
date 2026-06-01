import { describe, expect, test } from "vitest";
import {
  getCheckoutCustomData,
  getCheckoutVariantId,
  normalizeCheckoutTier,
} from "./billing";

describe("billing tier helpers", () => {
  test("normalizes checkout tiers", () => {
    expect(normalizeCheckoutTier("business")).toBe("business");
    expect(normalizeCheckoutTier("pro")).toBe("pro");
    expect(normalizeCheckoutTier(undefined)).toBe("pro");
    expect(normalizeCheckoutTier("free")).toBe("pro");
  });

  test("selects variant IDs by tier", () => {
    const env = {
      LEMONSQUEEZY_VARIANT_ID: "variant_pro",
      LEMONSQUEEZY_BUSINESS_VARIANT_ID: "variant_business",
    };

    expect(getCheckoutVariantId("pro", env)).toBe("variant_pro");
    expect(getCheckoutVariantId("business", env)).toBe("variant_business");
  });

  test("requires business variant for business checkout", () => {
    expect(() =>
      getCheckoutVariantId("business", {
        LEMONSQUEEZY_VARIANT_ID: "variant_pro",
      }),
    ).toThrow("Business billing variant is not configured.");
  });

  test("includes organization custom data when present", () => {
    expect(
      getCheckoutCustomData({
        userId: "user_1",
        tier: "business",
        organizationId: "org_1",
      }),
    ).toEqual({
      userId: "user_1",
      tier: "business",
      organizationId: "org_1",
    });
  });
});
