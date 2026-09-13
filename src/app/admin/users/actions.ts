"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { createUser, deleteUser, updateUser } from "@/lib/users";

function formInput(formData: FormData) {
  return {
    username: String(formData.get("username") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    role: String(formData.get("role") ?? "user"),
    notifyNewMovies: formData.get("notifyNewMovies") === "on",
  };
}

export async function createUserAction(
  _prev: { error?: string; warning?: string; ok?: boolean } | undefined,
  formData: FormData,
) {
  await requireAdmin();
  try {
    const { mailError } = await createUser(formInput(formData));
    revalidatePath("/admin/users");
    return {
      ok: true,
      warning: mailError
        ? `User created, but the welcome email could not be sent: ${mailError}`
        : undefined,
      error: undefined,
    };
  } catch (error) {
    unstable_rethrow(error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not create the user.",
    };
  }
}

export async function updateUserAction(
  userId: string,
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData,
) {
  await requireAdmin();
  try {
    await updateUser(userId, formInput(formData));
    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${userId}`);
    return { ok: true, error: undefined };
  } catch (error) {
    unstable_rethrow(error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not update the user.",
    };
  }
}

export async function deleteUserAction(userId: string) {
  const session = await requireAdmin();
  await deleteUser(userId, session.user.id);
  revalidatePath("/admin/users");
  redirect("/admin/users");
}
