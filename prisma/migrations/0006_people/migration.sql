-- CreateEnum
CREATE TYPE "CreditRole" AS ENUM ('actor', 'director');

-- AlterTable
ALTER TABLE "Movie" ADD COLUMN "directorName" TEXT;

-- CreateIndex
CREATE INDEX "Movie_directorName_idx" ON "Movie"("directorName");

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "tmdbId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "profilePath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovieCredit" (
    "id" TEXT NOT NULL,
    "movieId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "role" "CreditRole" NOT NULL,
    "character" TEXT,
    "billingOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MovieCredit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Person_tmdbId_key" ON "Person"("tmdbId");

-- CreateIndex
CREATE INDEX "Person_name_idx" ON "Person"("name");

-- CreateIndex
CREATE UNIQUE INDEX "MovieCredit_movieId_personId_role_key" ON "MovieCredit"("movieId", "personId", "role");

-- CreateIndex
CREATE INDEX "MovieCredit_personId_role_idx" ON "MovieCredit"("personId", "role");

-- CreateIndex
CREATE INDEX "MovieCredit_movieId_role_idx" ON "MovieCredit"("movieId", "role");

-- AddForeignKey
ALTER TABLE "MovieCredit" ADD CONSTRAINT "MovieCredit_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movie"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovieCredit" ADD CONSTRAINT "MovieCredit_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
