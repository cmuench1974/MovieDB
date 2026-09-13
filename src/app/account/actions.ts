"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { requireUser } from "@/lib/admin";
import {
  deleteOwnAccount,
  updateOwnCredentials,
  updateOwnNotifications,
} from "@/lib/users";

export async function updateNotificationsAction(
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData,
) {
  const session = await requireUser();
  try {
    await updateOwnNotifications(session.user.id, formData.get("notifyNewMovies") === "on");
    revalidatePath("/account");
    return { ok: true, error: undefined };
  } catch (error) {
    unstable_rethrow(error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not save notification settings.",
    };
  }
}

export async function updateCredentialsAction(
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData,
) {
  const session = await requireUser();
  try {
    const newPassword = String(formData.get("newPassword") ?? "");
    await updateOwnCredentials(session.user.id, {
      email: String(formData.get("email") ?? ""),
      currentPassword: String(formData.get("currentPassword") ?? ""),
      newPassword,
    });
    revalidatePath("/account");
    if (newPassword.trim()) {
      const { signOut } = await import("@/lib/auth");
      await signOut({ redirectTo: "/login" });
    }
    return { ok: true, error: undefined };
  } catch (error) {
    unstable_rethrow(error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not update email or password.",
    };
  }
}

export async function deleteOwnAccountAction(
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData,
) {
  const session = await requireUser();
  try {
    const confirm = String(formData.get("confirm") ?? "").trim();
    if (confirm !== "DELETE") {
      return { ok: false, error: "Type DELETE to confirm removing your account." };
    }
    await deleteOwnAccount(session.user.id, String(formData.get("currentPassword") ?? ""));
  } catch (error) {
    unstable_rethrow(error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not delete the account.",
    };
  }

  const { signOut } = await import("@/lib/auth");
  await signOut({ redirectTo: "/" });
}
