import { logoutAction } from "@/app/admin/actions";
import Link from "next/link";
import type { ReactNode } from "react";

export function AdminNav({
  current,
}: {
  current: "settings" | "review" | "movies" | "users" | "files";
}) {
  return (
    <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
      <nav className="flex gap-2">
        <NavLink href="/admin" active={current === "settings"}>
          Settings
        </NavLink>
        <NavLink href="/admin/review" active={current === "review"}>
          Review matches
        </NavLink>
        <NavLink href="/admin/files" active={current === "files"}>
          Files
        </NavLink>
        <NavLink href="/admin/movies" active={current === "movies"}>
          Library
        </NavLink>
        <NavLink href="/admin/users" active={current === "users"}>
          Users
        </NavLink>
        <NavLink href="/" active={false}>
          View catalog
        </NavLink>
      </nav>
      <form action={logoutAction}>
        <button type="submit" className="text-sm text-zinc-400 hover:text-zinc-200">
          Sign out
        </button>
      </form>
    </div>
  );
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-lg px-3 py-2 text-sm ${
        active ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"
      }`}
    >
      {children}
    </Link>
  );
}
