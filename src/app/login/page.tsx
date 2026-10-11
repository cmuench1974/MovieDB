import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isAuthentikConfigured } from "@/lib/authentik";
import { LoginForm } from "@/components/LoginForm";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import Link from "next/link";

function oauthErrorMessage(error: string | undefined): string | undefined {
  if (!error) return undefined;
  let decoded = error;
  try {
    decoded = decodeURIComponent(error.replace(/\+/g, " "));
  } catch {
    decoded = error;
  }
  switch (decoded) {
    case "AccessDenied":
      return "Authentik sign-in was denied. Ask an administrator if your account is allowed.";
    case "Configuration":
      return "Authentik is not configured correctly.";
    case "OAuthCallback":
    case "Callback":
    case "OAuthSignin":
      return "Authentik sign-in failed. Check the issuer URL and the redirect URI.";
    case "OAuthAccountNotLinked":
      return "This email already has a MovieDB account. Sign in locally, or ask an administrator to link it.";
    default:
      return decoded.includes(" ") ? decoded : "Authentik sign-in failed.";
  }
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const session = await auth();
  if (session?.user) redirect("/");

  const params = await searchParams;
  const callbackUrl = typeof params.callbackUrl === "string" ? params.callbackUrl : "/";
  const authentikEnabled = await isAuthentikConfigured();
  const oauthError = authentikEnabled
    ? oauthErrorMessage(typeof params.error === "string" ? params.error : undefined)
    : undefined;

  return (
    <>
      <Header />
      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <h1 className="text-xl font-semibold">Sign in</h1>
          <p className="mt-2 mb-6 text-sm text-zinc-400">
            The catalog can be viewed without an account. Sign in to see hidden titles and to create
            lists.
          </p>
          {oauthError ? <p className="mb-4 text-sm text-red-400">{oauthError}</p> : null}
          <LoginForm callbackUrl={callbackUrl} authentikEnabled={authentikEnabled} />
          <p className="mt-6 text-center text-sm">
            <Link href="/" className="text-zinc-400 hover:text-zinc-200">
              Back to catalog
            </Link>
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
