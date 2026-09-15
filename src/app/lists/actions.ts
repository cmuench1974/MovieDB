"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { requireUser } from "@/lib/admin";
import {
  addMovieToList,
  createList,
  deleteList,
  removeMovieFromList,
  updateList,
} from "@/lib/lists";

function listInput(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    comment: String(formData.get("comment") ?? ""),
    sharedUserIds: formData.getAll("sharedUserIds").map(String),
  };
}

export async function createListAction(
  movieId: string,
  _prev: { error?: string } | undefined,
  formData: FormData,
) {
  const session = await requireUser();
  const initialMovieId = movieId.trim();
  try {
    const list = await createList(session.user.id, {
      ...listInput(formData),
      movieId: initialMovieId || undefined,
    });
    revalidatePath("/lists");
    if (initialMovieId) revalidatePath(`/movies/${initialMovieId}`);
    redirect(`/lists/${list.id}`);
  } catch (error) {
    unstable_rethrow(error);
    return { error: error instanceof Error ? error.message : "Could not create the list." };
  }
}

export async function updateListAction(
  listId: string,
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData,
) {
  const session = await requireUser();
  try {
    await updateList(listId, session.user.id, listInput(formData));
    revalidatePath("/lists");
    revalidatePath(`/lists/${listId}`);
    return { ok: true, error: undefined };
  } catch (error) {
    unstable_rethrow(error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not save the list.",
    };
  }
}

export async function deleteListAction(listId: string) {
  const session = await requireUser();
  await deleteList(listId, session.user.id);
  revalidatePath("/lists");
  redirect("/lists");
}

export async function addMovieToListAction(
  movieId: string,
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData,
) {
  const session = await requireUser();
  try {
    const listId = String(formData.get("listId") ?? "");
    if (!listId) throw new Error("Please choose a list.");
    await addMovieToList(listId, movieId, session.user.id);
    revalidatePath("/lists");
    revalidatePath(`/lists/${listId}`);
    revalidatePath(`/movies/${movieId}`);
    return { ok: true, error: undefined };
  } catch (error) {
    unstable_rethrow(error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not add the movie.",
    };
  }
}

export async function removeMovieFromListAction(listId: string, movieId: string) {
  const session = await requireUser();
  await removeMovieFromList(listId, movieId, session.user.id);
  revalidatePath("/lists");
  revalidatePath(`/lists/${listId}`);
}
