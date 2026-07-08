import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ExportDataSection } from "@/components/export-data-section";
import { disconnectOAuthProvider } from "./actions";

const providers = [
  { id: "google", label: "Google" },
  { id: "microsoft", label: "Microsoft" },
] as const;

export default async function AccountSettingsPage() {
  const user = await getSession();
  if (!user) redirect("/auth/login");

  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      email: true,
      passwordAuthEnabled: true,
      oauthAccounts: {
        select: {
          provider: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!account) redirect("/auth/login");

  const connectedProviders = new Set(
    account.oauthAccounts.map((oauthAccount) => oauthAccount.provider),
  );
  const authMethodLabel =
    user.authMethod === "google"
      ? "Google"
      : user.authMethod === "microsoft"
        ? "Microsoft"
        : "Password";

  return (
    <main className="mx-auto w-full max-w-[1280px] px-6 py-12">
      <div className="mb-8">
        <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-brand-coral">
          Account settings
        </p>
        <h1 className="mt-3 text-[32px] font-semibold leading-[1.25] tracking-[-0.5px] text-ink">
          Connected accounts
        </h1>
        <p className="mt-2 text-[16px] leading-[1.50] text-slate">
          Signed in as {account.email} using {authMethodLabel}.
        </p>
      </div>

      <section className="rounded-xl border border-hairline bg-canvas p-8">
        <h2 className="text-[24px] font-semibold leading-[1.30] text-ink">
          Sign-in methods
        </h2>
        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-hairline px-4 py-3">
            <div>
              <p className="text-[16px] font-semibold leading-[1.50] text-ink">Password</p>
              <p className="text-[14px] leading-[1.50] text-steel">
                {account.passwordAuthEnabled ? "Enabled" : "Not configured"}
              </p>
            </div>
            <span className={account.passwordAuthEnabled ? "badge-success" : "pill-tab"}>
              {account.passwordAuthEnabled ? "Connected" : "Unavailable"}
            </span>
          </div>

          {providers.map((provider) => {
            const connected = connectedProviders.has(provider.id);
            return (
              <div
                key={provider.id}
                className="flex items-center justify-between rounded-lg border border-hairline px-4 py-3"
              >
                <div>
                  <p className="text-[16px] font-semibold leading-[1.50] text-ink">
                    {provider.label}
                  </p>
                  <p className="text-[14px] leading-[1.50] text-steel">
                    {connected ? "Connected" : "Not connected"}
                  </p>
                </div>
                {connected ? (
                  <form action={disconnectOAuthProvider}>
                    <input type="hidden" name="provider" value={provider.id} />
                    <button
                      type="submit"
                      className="button-tertiary h-9 px-4 text-[13px] !border-error !text-error"
                    >
                      Disconnect
                    </button>
                  </form>
                ) : (
                  <Link
                    href={`/api/auth/oauth/${provider.id}`}
                    className="button-tertiary h-9 px-4 text-[13px]"
                  >
                    Connect
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <div className="mt-8">
        <ExportDataSection />
      </div>
    </main>
  );
}
