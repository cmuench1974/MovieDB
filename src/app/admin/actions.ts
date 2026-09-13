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
import { clearLibrary, restoreDatabaseSql } from "@/lib/backup";
import { clearTmdbApiKey, saveTmdbApiKey } from "@/lib/settings";
import { refreshMovieMetadata, setMovieArt } from "@/lib/tmdb-sync";
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
  revalidatePath("/admin/files");
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

export async function setMovieArtAction(movieId: string, kind: "poster" | "backdrop", path: string) {
  await requireAdmin();
  await setMovieArt(movieId, kind, path);
  revalidateLibrary();
  revalidatePath(`/movies/${movieId}`);
  revalidatePath(`/admin/movies/${movieId}`);
}

export async function refreshMovieMetadataAction(
  movieId: string,
): Promise<{ error?: string; ok?: boolean }> {
  await requireAdmin();
  try {
    await refreshMovieMetadata(movieId);
    revalidateLibrary();
    revalidatePath(`/movies/${movieId}`);
    revalidatePath(`/admin/movies/${movieId}`);
    return { ok: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not refresh metadata.",
    };
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

export async function restoreLibraryAction(
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  await requireAdmin();
  try {
    const confirm = String(formData.get("confirm") ?? "").trim();
    if (confirm !== "RESTORE") {
      return { error: "Type RESTORE to confirm replacing the database." };
    }
    const file = formData.get("backup");
    if (!(file instanceof File) || file.size === 0) {
      return { error: "Choose a .sql backup file downloaded from this page." };
    }
    if (file.size > 64 * 1024 * 1024) {
      return { error: "Backup file is larger than 64 MB." };
    }
    await restoreDatabaseSql(await file.text());
    revalidateLibrary();
    revalidatePath("/");
    revalidatePath("/admin");
    revalidatePath("/lists");
    revalidatePath("/account");
    return { ok: true };
  } catch (error) {
    unstable_rethrow(error);
    return { error: error instanceof Error ? error.message : "Could not restore the database." };
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

function extractEmail(value: string): string {
  const match = value.match(/[^\s<>"]+@[^\s<>"]+\.[^\s<>"]+/);
  return match?.[0]?.replace(/[>,;]+$/, "") ?? "";
}

function isDeliverableEmail(value: string): boolean {
  const email = value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(email)) return false;
  return !email.toLowerCase().endsWith("@localhost");
}

export async function sendTestEmailAction(
  to?: string,
): Promise<{ error?: string; ok?: boolean; to?: string }> {
  try {
    const session = await requireAdmin();
    const { getSmtpSettings, sendTestMail } = await import("@/lib/mail");
    const settings = await getSmtpSettings();
    const candidates = [
      typeof to === "string" ? to.trim() : "",
      session.user.email ?? "",
      extractEmail(settings?.from ?? ""),
    ];
    const recipient = candidates.find(isDeliverableEmail);
    if (!recipient) {
      return {
        error:
          "Enter a real recipient address. Addresses like admin@localhost are rejected by most SMTP servers.",
      };
    }
    await sendTestMail(recipient);
    return { ok: true, to: recipient };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not send the test email.",
    };
  }
}
