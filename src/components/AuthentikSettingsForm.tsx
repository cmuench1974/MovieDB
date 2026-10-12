"use client";

import { useActionState } from "react";
import { clearAuthentikSettingsAction, saveAuthentikSettingsAction } from "@/app/admin/actions";
import type { PublicAuthentikSettings } from "@/lib/authentik";

export function AuthentikSettingsForm({ settings }: { settings: PublicAuthentikSettings }) {
  const [state, formAction, pending] = useActionState(saveAuthentikSettingsAction, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm text-zinc-300 sm:col-span-2">
          Redirect URI
          <input
            readOnly
            value={settings.redirectUri}
            onFocus={(event) => event.currentTarget.select()}
            className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 outline-none focus:border-amber-400"
          />
        </label>
        <label className="block text-sm text-zinc-300">
          Client ID
          <input
            name="clientId"
            required
            defaultValue={settings.clientId}
            autoComplete="off"
            spellCheck={false}
            placeholder="From the Authentik OAuth2 provider"
            className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-amber-400"
          />
        </label>
        <label className="block text-sm text-zinc-300">
          Client secret
          <input
            name="clientSecret"
            type="password"
            autoComplete="new-password"
            placeholder={
              settings.hasSecret ? "Leave blank to keep the saved secret" : "From the Authentik provider"
            }
            className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-amber-400"
          />
        </label>
        <label className="block text-sm text-zinc-300 sm:col-span-2">
          Issuer URL
          <input
            name="issuer"
            required
            defaultValue={settings.issuer}
            autoComplete="off"
            spellCheck={false}
            placeholder="https://auth.example.com/application/o/moviedb"
            className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-amber-400"
          />
        </label>
        <label className="block text-sm text-zinc-300">
          Administrator group
          <input
            name="adminGroup"
            defaultValue={settings.adminGroup}
            autoComplete="off"
            placeholder="Optional Authentik group name"
            className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-amber-400"
          />
        </label>
        <label className="block text-sm text-zinc-300">
          Extra scopes
          <input
            name="scopes"
            defaultValue={settings.scopes}
            autoComplete="off"
            placeholder="openid email profile"
            className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-amber-400"
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm text-zinc-300">
        <input
          name="allowSignup"
          type="checkbox"
          defaultChecked={settings.allowSignup}
          className="accent-amber-400"
        />
        Create a MovieDB account on first Authentik sign-in
      </label>
      {settings.redirectUri.includes("localhost") ? (
        <p className="text-sm text-amber-300">
          AUTH_URL still points at localhost. Behind Traefik set AUTH_URL to the public https URL
          (no trailing slash) and put that same host in Authentik as the redirect URI.
        </p>
      ) : null}
      <p className="text-xs text-zinc-500">
        Paste the redirect URI into the Authentik application. Saving contacts Authentik and stores
        the exact OpenID issuer (including a trailing slash if Authentik uses one). The client
        secret is stored encrypted and never shown again. Members of the administrator group become
        MovieDB administrators.
        {settings.configured
          ? settings.fromEnv
            ? " Authentik is currently enabled from environment variables."
            : " Authentik is enabled. Sign in with Authentik is on the login page."
          : " Not configured yet — local login still works."}
      </p>
      {state?.error ? <p className="text-sm text-red-400">{state.error}</p> : null}
      {state?.ok ? <p className="text-sm text-emerald-400">Authentik settings saved.</p> : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-300 disabled:opacity-60"
        >
          {pending ? "Checking…" : "Save Authentik"}
        </button>
        {settings.configured && !settings.fromEnv ? (
          <button
            type="submit"
            formAction={clearAuthentikSettingsAction}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-500"
          >
            Disable Authentik
          </button>
        ) : null}
      </div>
    </form>
  );
}
