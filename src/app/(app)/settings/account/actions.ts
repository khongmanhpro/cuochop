"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { canDisconnectAuthMethod } from "@/lib/oauth";
import { getSession } from "@/lib/session";

export async function disconnectOAuthProvider(formData: FormData) {
  const user = await getSession();
  if (!user) throw new Error("Authentication is required.");

  const provider = String(formData.get("provider") || "");
  if (provider !== "google" && provider !== "microsoft") {
    throw new Error("Unsupported OAuth provider.");
  }

  const current = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      passwordAuthEnabled: true,
      oauthAccounts: { select: { provider: true } },
    },
  });

  if (!current) throw new Error("User not found.");

  if (
    !canDisconnectAuthMethod({
      passwordAuthEnabled: current.passwordAuthEnabled,
      oauthProviderCount: current.oauthAccounts.length,
    })
  ) {
    throw new Error("You must keep at least one sign-in method.");
  }

  await prisma.oAuthAccount.deleteMany({
    where: {
      userId: user.id,
      provider,
    },
  });

  revalidatePath("/settings/account");
}
