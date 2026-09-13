-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('user', 'admin');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "username" TEXT;
ALTER TABLE "User" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'user';
ALTER TABLE "User" ADD COLUMN "notifyNewMovies" BOOLEAN NOT NULL DEFAULT false;

UPDATE "User" SET "username" = LOWER(SPLIT_PART("email", '@', 1));
UPDATE "User" SET "username" = "username" || '-' || LEFT("id", 6)
WHERE "id" IN (
  SELECT "id" FROM (
    SELECT "id", ROW_NUMBER() OVER (PARTITION BY "username" ORDER BY "createdAt") AS "rn"
    FROM "User"
  ) AS ranked
  WHERE ranked."rn" > 1
);
UPDATE "User" SET "role" = 'admin';

ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateTable
CREATE TABLE "MovieList" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "comment" TEXT,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MovieList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovieListItem" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "movieId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovieListItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovieListShare" (
    "listId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovieListShare_pkey" PRIMARY KEY ("listId","userId")
);

-- CreateIndex
CREATE INDEX "MovieList_ownerId_idx" ON "MovieList"("ownerId");

-- CreateIndex
CREATE INDEX "MovieListItem_movieId_idx" ON "MovieListItem"("movieId");

-- CreateIndex
CREATE UNIQUE INDEX "MovieListItem_listId_movieId_key" ON "MovieListItem"("listId", "movieId");

-- AddForeignKey
ALTER TABLE "MovieList" ADD CONSTRAINT "MovieList_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovieListItem" ADD CONSTRAINT "MovieListItem_listId_fkey" FOREIGN KEY ("listId") REFERENCES "MovieList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovieListItem" ADD CONSTRAINT "MovieListItem_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movie"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovieListShare" ADD CONSTRAINT "MovieListShare_listId_fkey" FOREIGN KEY ("listId") REFERENCES "MovieList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovieListShare" ADD CONSTRAINT "MovieListShare_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
