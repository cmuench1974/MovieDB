-- AlterTable
ALTER TABLE "VideoFile" ADD COLUMN "title" TEXT;
ALTER TABLE "VideoFile" ADD COLUMN "year" INTEGER;
ALTER TABLE "VideoFile" ADD COLUMN "overview" TEXT;
ALTER TABLE "VideoFile" ADD COLUMN "width" INTEGER;
ALTER TABLE "VideoFile" ADD COLUMN "height" INTEGER;
ALTER TABLE "VideoFile" ADD COLUMN "resolutionClass" TEXT;
ALTER TABLE "VideoFile" ADD COLUMN "hdrFormat" TEXT;
ALTER TABLE "VideoFile" ADD COLUMN "durationSec" INTEGER;
ALTER TABLE "VideoFile" ADD COLUMN "videoCodec" TEXT;
ALTER TABLE "VideoFile" ADD COLUMN "audioTracks" JSONB;
ALTER TABLE "VideoFile" ADD COLUMN "subtitleTracks" JSONB;
ALTER TABLE "VideoFile" ADD COLUMN "probeError" TEXT;
ALTER TABLE "VideoFile" ADD COLUMN "probedAt" TIMESTAMP(3);
