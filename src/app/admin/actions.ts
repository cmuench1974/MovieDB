"use server";

import { AuthError } from "next-auth";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { ignoreFile, matchFileByUrl, matchFileToTmdb } from "@/lib/matching";
import {
  addScanFolder,
  deleteMovie,
  removeScanFolder,
  saveMovieVersion,
  setMovieHidden,
} from "@/lib/library";
import { clearLibrary } from "@/lib/backup";
import { clearTmdbApiKey, saveTmdbApiKey } from "@/lib/settings";
import { redirect, unstable_rethrow } from "next/navigation";

export async function matchByTmdbId(fileId: string, tmdbId: number) {
  await requireAdmin();
  const result = await matchFileToTmdb(fileId, tmdbId);
  if (result.created) {
    try {
      const { notifyUsersAboutNewMovies } = await import("@/lib/notify");
      await notifyUsersAboutNewMovies([
        { id: result.movie.id, title: result.movie.title, year: result.movie.year },
      ]);
    } catch (error) {
      console.error("Could not send new-movie notifications:", error);
    }
  }
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/review");
}

export async function matchByUrl(fileId: string, url: string) {
  await requireAdmin();
  const result = await matchFileByUrl(fileId, url);
  if (result.created) {
    try {
      const { notifyUsersAboutNewMovies } = await import("@/lib/notify");
      await notifyUsersAboutNewMovies([
        { id: result.movie.id, title: result.movie.title, year: result.movie.year },
      ]);
    } catch (error) {
      console.error("Could not send new-movie notifications:", error);
    }
  }
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/review");
}

export async function ignoreVideoFile(fileId: string) {
  await requireAdmin();
  await ignoreFile(fileId);
  revalidatePath("/admin");
  revalidatePath("/admin/review");
}

function safeRedirectPath(value: string): string {
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  return "/";
}

export async function loginAction(_prev: { error?: string } | undefined, formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const redirectTo = safeRedirectPath(String(formData.get("callbackUrl") ?? "/"));

  const { signIn } = await import("@/lib/auth");
  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Invalid username, email, or password." };
    }
    throw error;
  }
}

export async function logoutAction() {
  const { signOut } = await import("@/lib/auth");
  await signOut({ redirectTo: "/" });
}

function revalidateLibrary() {
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/review");
  revalidatePath("/admin/movies");
}

export async function addFolderAction(_prev: { error?: string } | undefined, formData: FormData) {
  await requireAdmin();
  const kind = String(formData.get("kind") ?? "local") === "smb" ? "smb" : "local";
  try {
    await addScanFolder({
      label: String(formData.get("label") ?? ""),
      kind,
      path: String(formData.get("path") ?? ""),
      smbHost: String(formData.get("smbHost") ?? ""),
      smbShare: String(formData.get("smbShare") ?? ""),
      smbFolder: String(formData.get("smbFolder") ?? ""),
      smbDomain: String(formData.get("smbDomain") ?? ""),
      smbUsername: String(formData.get("smbUsername") ?? ""),
      smbPassword: String(formData.get("smbPassword") ?? ""),
    });
    revalidateLibrary();
    return { error: undefined };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not add folder." };
  }
}

export async function removeFolderAction(folderId: string) {
  await requireAdmin();
  await removeScanFolder(folderId);
  revalidateLibrary();
}

export async function hideMovieAction(movieId: string, hidden: boolean) {
  await requireAdmin();
  await setMovieHidden(movieId, hidden);
  revalidateLibrary();
  revalidatePath(`/movies/${movieId}`);
  revalidatePath(`/admin/movies/${movieId}`);
}

export async function updateMovieAction(
  movieId: string,
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  await requireAdmin();
  try {
    const fileId = String(formData.get("fileId") ?? "").trim() || null;
    const result = await saveMovieVersion({
      movieId,
      fileId,
      title: String(formData.get("title") ?? ""),
      year: String(formData.get("year") ?? ""),
      overview: String(formData.get("overview") ?? ""),
      tmdb: String(formData.get("tmdb") ?? ""),
    });
    revalidateLibrary();
    revalidatePath(`/movies/${result.movieId}`);
    revalidatePath(`/admin/movies/${result.movieId}`);
    if (result.movieId !== movieId) {
      revalidatePath(`/movies/${movieId}`);
      revalidatePath(`/admin/movies/${movieId}`);
      redirect(
        fileId
          ? `/admin/movies/${result.movieId}?v=${fileId}`
          : `/admin/movies/${result.movieId}`,
      );
    }
    return { ok: true };
  } catch (error) {
    unstable_rethrow(error);
    return { error: error instanceof Error ? error.message : "Could not save movie." };
  }
}

export async function clearLibraryAction(
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  await requireAdmin();
  try {
    const confirm = String(formData.get("confirm") ?? "").trim();
    if (confirm !== "CLEAR") {
      return { error: "Type CLEAR to confirm wiping the library." };
    }
    await clearLibrary();
    revalidateLibrary();
    revalidatePath("/movies");
    return { ok: true };
  } catch (error) {
    unstable_rethrow(error);
    return { error: error instanceof Error ? error.message : "Could not clear the database." };
  }
}

export async function deleteMovieAction(movieId: string) {
  await requireAdmin();
  await deleteMovie(movieId);
  revalidateLibrary();
}

export async function saveTmdbKeyAction(
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData,
) {
  await requireAdmin();
  try {
    await saveTmdbApiKey(String(formData.get("tmdbApiKey") ?? ""));
    revalidatePath("/admin");
    return { ok: true, error: undefined };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not save the key." };
  }
}

export async function clearTmdbKeyAction() {
  await requireAdmin();
  await clearTmdbApiKey();
  revalidatePath("/admin");
}

export async function saveSmtpSettingsAction(
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData,
) {
  await requireAdmin();
  try {
    const { saveSmtpSettings } = await import("@/lib/mail");
    await saveSmtpSettings({
      host: String(formData.get("host") ?? ""),
      port: String(formData.get("port") ?? "587"),
      secure: formData.get("secure") === "on",
      username: String(formData.get("username") ?? ""),
      password: String(formData.get("password") ?? ""),
      from: String(formData.get("from") ?? ""),
      siteUrl: String(formData.get("siteUrl") ?? ""),
    });
    revalidatePath("/admin");
    return { ok: true, error: undefined };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not save email settings.",
    };
  }
}

export async function sendTestEmailAction(): Promise<{ error?: string; ok?: boolean }> {
  try {
    const session = await requireAdmin();
    const { sendTestMail } = await import("@/lib/mail");
    const to = session.user.email;
    if (!to) return { error: "Your account has no email address." };
    await sendTestMail(to);
    return { ok: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not send the test email.",
    };
  }
}
