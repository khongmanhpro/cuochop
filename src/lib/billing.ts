export type CheckoutTier = "pro" | "business";

type BillingEnv = {
  LEMONSQUEEZY_VARIANT_ID?: string;
  LEMONSQUEEZY_BUSINESS_VARIANT_ID?: string;
};

export function normalizeCheckoutTier(value: unknown): CheckoutTier {
  return value === "business" ? "business" : "pro";
}

export function getCheckoutVariantId(tier: CheckoutTier, env: BillingEnv) {
  if (tier === "business") {
    const variantId = env.LEMONSQUEEZY_BUSINESS_VARIANT_ID;
    if (!variantId) {
      throw new Error("Business billing variant is not configured.");
    }
    return variantId;
  }

  const variantId = env.LEMONSQUEEZY_VARIANT_ID;
  if (!variantId) {
    throw new Error("Pro billing variant is not configured.");
  }
  return variantId;
}

export function getCheckoutCustomData({
  userId,
  tier,
  organizationId,
}: {
  userId: string;
  tier: CheckoutTier;
  organizationId?: string | null;
}) {
  return {
    userId,
    tier,
    ...(organizationId ? { organizationId } : {}),
  };
}
