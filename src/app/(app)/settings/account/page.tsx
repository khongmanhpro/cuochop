import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
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
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase text-blue-700">
          Account settings
        </p>
        <h1 className="mt-1 text-3xl font-semibold text-slate-950">
          Connected accounts
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Signed in as {account.email} using {authMethodLabel}.
        </p>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-950">Sign-in methods</h2>
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
            <div>
              <p className="text-sm font-semibold text-slate-900">Password</p>
              <p className="text-xs text-slate-500">
                {account.passwordAuthEnabled ? "Enabled" : "Not configured"}
              </p>
            </div>
            <span className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">
              {account.passwordAuthEnabled ? "Connected" : "Unavailable"}
            </span>
          </div>

          {providers.map((provider) => {
            const connected = connectedProviders.has(provider.id);
            return (
              <div
                key={provider.id}
                className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {provider.label}
                  </p>
                  <p className="text-xs text-slate-500">
                    {connected ? "Connected" : "Not connected"}
                  </p>
                </div>
                {connected ? (
                  <form action={disconnectOAuthProvider}>
                    <input type="hidden" name="provider" value={provider.id} />
                    <button
                      type="submit"
                      className="h-9 rounded-md border border-red-200 px-3 text-xs font-semibold text-red-700 hover:bg-red-50"
                    >
                      Disconnect
                    </button>
                  </form>
                ) : (
                  <Link
                    href={`/api/auth/oauth/${provider.id}`}
                    className="h-9 rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Connect
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
