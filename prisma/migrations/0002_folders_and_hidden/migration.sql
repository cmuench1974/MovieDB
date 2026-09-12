-- AlterTable
ALTER TABLE "Movie" ADD COLUMN "hidden" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Movie_hidden_idx" ON "Movie"("hidden");

-- CreateEnum
CREATE TYPE "FolderKind" AS ENUM ('local', 'smb');

-- CreateTable
CREATE TABLE "ScanFolder" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "kind" "FolderKind" NOT NULL,
    "path" TEXT,
    "smbHost" TEXT,
    "smbShare" TEXT,
    "smbFolder" TEXT,
    "smbDomain" TEXT,
    "smbUsername" TEXT,
    "smbPassword" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScanFolder_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "VideoFile" ADD COLUMN "folderId" TEXT;

-- CreateIndex
CREATE INDEX "VideoFile_folderId_idx" ON "VideoFile"("folderId");

-- AddForeignKey
ALTER TABLE "VideoFile" ADD CONSTRAINT "VideoFile_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "ScanFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
