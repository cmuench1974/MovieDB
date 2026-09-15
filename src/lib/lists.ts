import { prisma } from "./prisma";

const MAX_COMMENT = 3000;

/** Eigene und geteilte Listen des angemeldeten Nutzers. */
export async function getOwnedLists(userId: string) {
  return prisma.movieList.findMany({
    where: { ownerId: userId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export async function getAccessibleList(listId: string, userId: string) {
  const list = await prisma.movieList.findUnique({
    where: { id: listId },
    include: {
      owner: { select: { id: true, username: true } },
      shares: { select: { userId: true } },
      items: {
        orderBy: { position: "asc" },
        include: {
          movie: {
            select: {
              id: true,
              title: true,
              year: true,
              directorName: true,
              posterPath: true,
              hidden: true,
            },
          },
        },
      },
    },
  });
  if (!list) return null;
  const canView =
    list.ownerId === userId || list.shares.some((share) => share.userId === userId);
  if (!canView) return null;
  return list;
}

export async function listListsForUser(userId: string) {
  const [owned, shared] = await Promise.all([
    prisma.movieList.findMany({
      where: { ownerId: userId },
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { items: true, shares: true } } },
    }),
    prisma.movieList.findMany({
      where: { shares: { some: { userId } } },
      orderBy: { updatedAt: "desc" },
      include: {
        owner: { select: { username: true } },
        _count: { select: { items: true, shares: true } },
      },
    }),
  ]);
  return { owned, shared };
}

export async function createList(
  userId: string,
  input: { name: string; comment: string; sharedUserIds: string[]; movieId?: string },
) {
  const name = input.name.trim();
  if (!name) throw new Error("Please name the list.");
  const comment = parseComment(input.comment);
  const shareIds = await sanitizeShareIds(userId, input.sharedUserIds);
  // Nur gültige Filme aus der Bibliothek übernehmen (z. B. von der Filmseite).
  const movieId = await resolveListMovieId(input.movieId);

  return prisma.movieList.create({
    data: {
      name,
      comment,
      ownerId: userId,
      shares: { create: shareIds.map((id) => ({ userId: id })) },
      items: movieId ? { create: { movieId, position: 1 } } : undefined,
    },
  });
}

export async function updateList(
  listId: string,
  userId: string,
  input: { name: string; comment: string; sharedUserIds: string[] },
) {
  const list = await prisma.movieList.findUnique({ where: { id: listId } });
  if (!list || list.ownerId !== userId) {
    throw new Error("You can only edit your own lists.");
  }
  const name = input.name.trim();
  if (!name) throw new Error("Please name the list.");
  const comment = parseComment(input.comment);
  const shareIds = await sanitizeShareIds(userId, input.sharedUserIds);

  await prisma.$transaction([
    prisma.movieListShare.deleteMany({ where: { listId } }),
    prisma.movieList.update({
      where: { id: listId },
      data: {
        name,
        comment,
        shares: { create: shareIds.map((id) => ({ userId: id })) },
      },
    }),
  ]);
}

export async function deleteList(listId: string, userId: string) {
  const list = await prisma.movieList.findUnique({ where: { id: listId } });
  if (!list || list.ownerId !== userId) {
    throw new Error("You can only delete your own lists.");
  }
  await prisma.movieList.delete({ where: { id: listId } });
}

export async function addMovieToList(listId: string, movieId: string, userId: string) {
  const list = await prisma.movieList.findUnique({ where: { id: listId } });
  if (!list || list.ownerId !== userId) {
    throw new Error("You can only add movies to your own lists.");
  }
  const movie = await prisma.movie.findUnique({ where: { id: movieId } });
  if (!movie) throw new Error("Movie not found.");

  const last = await prisma.movieListItem.findFirst({
    where: { listId },
    orderBy: { position: "desc" },
  });
  try {
    await prisma.movieListItem.create({
      data: { listId, movieId, position: (last?.position ?? 0) + 1 },
    });
  } catch {
    throw new Error("That movie is already on this list.");
  }
}

export async function removeMovieFromList(listId: string, movieId: string, userId: string) {
  const list = await prisma.movieList.findUnique({ where: { id: listId } });
  if (!list || list.ownerId !== userId) {
    throw new Error("You can only change your own lists.");
  }
  await prisma.movieListItem.deleteMany({ where: { listId, movieId } });
}

async function resolveListMovieId(movieId: string | undefined): Promise<string | undefined> {
  const id = movieId?.trim();
  if (!id) return undefined;
  const movie = await prisma.movie.findUnique({ where: { id }, select: { id: true } });
  return movie?.id;
}

function parseComment(value: string): string | null {
  const comment = value.trim();
  if (comment.length > MAX_COMMENT) {
    throw new Error(`The comment can be at most ${MAX_COMMENT} characters.`);
  }
  return comment || null;
}

async function sanitizeShareIds(ownerId: string, ids: string[]): Promise<string[]> {
  const unique = [...new Set(ids.filter((id) => id && id !== ownerId))];
  if (unique.length === 0) return [];
  const users = await prisma.user.findMany({
    where: { id: { in: unique } },
    select: { id: true },
  });
  return users.map((user) => user.id);
}
