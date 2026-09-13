"use client";

import { useActionState, useState, useTransition } from "react";
import { saveSmtpSettingsAction, sendTestEmailAction } from "@/app/admin/actions";
import type { PublicSmtpSettings } from "@/lib/mail";

export function SmtpSettingsForm({ settings }: { settings: PublicSmtpSettings }) {
  const [state, formAction, pending] = useActionState(saveSmtpSettingsAction, undefined);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [testing, startTest] = useTransition();

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm text-zinc-300 sm:col-span-2">
          SMTP host
          <input
            name="host"
            required
            defaultValue={settings.host}
            placeholder="smtp.example.com"
            className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-amber-400"
          />
        </label>
        <label className="block text-sm text-zinc-300">
          Port
          <input
            name="port"
            type="number"
            min={1}
            max={65535}
            defaultValue={settings.port}
            className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-400"
          />
        </label>
        <label className="flex items-end gap-2 pb-2 text-sm text-zinc-300">
          <input
            name="secure"
            type="checkbox"
            defaultChecked={settings.secure}
            className="accent-amber-400"
          />
          Use TLS (port 465)
        </label>
        <label className="block text-sm text-zinc-300">
          SMTP username
          <input
            name="username"
            defaultValue={settings.username}
            autoComplete="off"
            className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-400"
          />
        </label>
        <label className="block text-sm text-zinc-300">
          SMTP password
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder={settings.configured ? "Leave blank to keep the saved password" : ""}
            className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-amber-400"
          />
        </label>
        <label className="block text-sm text-zinc-300 sm:col-span-2">
          From address
          <input
            name="from"
            required
            defaultValue={settings.from}
            placeholder="MovieDB <noreply@example.com>"
            className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-amber-400"
          />
        </label>
        <label className="block text-sm text-zinc-300 sm:col-span-2">
          Public site URL
          <input
            name="siteUrl"
            defaultValue={settings.siteUrl}
            placeholder="https://movies.example.com"
            className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-amber-400"
          />
        </label>
      </div>
      <p className="text-xs text-zinc-500">
        Used for welcome emails and optional new-movie notifications. The password is stored
        encrypted. {settings.configured ? "SMTP is already configured." : "No SMTP settings saved yet."}
      </p>
      {state?.error ? <p className="text-sm text-red-400">{state.error}</p> : null}
      {state?.ok ? <p className="text-sm text-emerald-400">Email settings saved.</p> : null}
      {testError ? <p className="text-sm text-red-400">{testError}</p> : null}
      {testMessage ? <p className="text-sm text-emerald-400">{testMessage}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-300 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save email settings"}
        </button>
        <button
          type="button"
          disabled={testing}
          onClick={() => {
            setTestError(null);
            setTestMessage(null);
            startTest(async () => {
              const result = await sendTestEmailAction();
              if (result.error) setTestError(result.error);
              else setTestMessage("Test email sent to your account address.");
            });
          }}
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-500 disabled:opacity-60"
        >
          {testing ? "Sending…" : "Send test email"}
        </button>
      </div>
    </form>
  );
}
