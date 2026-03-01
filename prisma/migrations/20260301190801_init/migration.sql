/*
  Warnings:

  - You are about to drop the column `description` on the `Dashboard` table. All the data in the column will be lost.
  - You are about to drop the column `mode` on the `Dashboard` table. All the data in the column will be lost.
  - You are about to drop the `DashboardWidget` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Favorite` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Game` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Player` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Team` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[userId]` on the table `Dashboard` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[shareToken]` on the table `Dashboard` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "WidgetMode" AS ENUM ('BEGINNER', 'ADVANCED');

-- CreateEnum
CREATE TYPE "DataSource" AS ENUM ('ESPN', 'FIXTURE', 'DEMO', 'CACHE');

-- CreateEnum
CREATE TYPE "ShareScope" AS ENUM ('PRIVATE', 'LINK_VIEW', 'INVITED_EMAILS');

-- AlterEnum
ALTER TYPE "Sport" ADD VALUE 'UTILITIES';

-- DropForeignKey
ALTER TABLE "DashboardWidget" DROP CONSTRAINT "DashboardWidget_dashboardId_fkey";

-- DropForeignKey
ALTER TABLE "Favorite" DROP CONSTRAINT "Favorite_userId_fkey";

-- DropForeignKey
ALTER TABLE "Game" DROP CONSTRAINT "Game_awayTeamId_fkey";

-- DropForeignKey
ALTER TABLE "Game" DROP CONSTRAINT "Game_homeTeamId_fkey";

-- DropForeignKey
ALTER TABLE "Player" DROP CONSTRAINT "Player_teamId_fkey";

-- AlterTable
ALTER TABLE "Dashboard" DROP COLUMN "description",
DROP COLUMN "mode",
ADD COLUMN     "invitedEmails" JSONB,
ADD COLUMN     "isPrivate" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "layoutLocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "shareScope" "ShareScope" NOT NULL DEFAULT 'PRIVATE',
ADD COLUMN     "shareToken" TEXT,
ALTER COLUMN "sport" SET DEFAULT 'NFL',
ALTER COLUMN "title" DROP DEFAULT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerified" TIMESTAMP(3),
ADD COLUMN     "image" TEXT,
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'USER',
ALTER COLUMN "email" DROP NOT NULL;

-- DropTable
DROP TABLE "DashboardWidget";

-- DropTable
DROP TABLE "Favorite";

-- DropTable
DROP TABLE "Game";

-- DropTable
DROP TABLE "Player";

-- DropTable
DROP TABLE "Team";

-- DropEnum
DROP TYPE "DashboardMode";

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "WidgetInstance" (
    "id" TEXT NOT NULL,
    "dashboardId" TEXT NOT NULL,
    "widgetType" TEXT NOT NULL,
    "sport" "Sport" NOT NULL,
    "mode" "WidgetMode" NOT NULL DEFAULT 'BEGINNER',
    "x" INTEGER NOT NULL DEFAULT 0,
    "y" INTEGER NOT NULL DEFAULT 0,
    "w" INTEGER NOT NULL DEFAULT 1,
    "h" INTEGER NOT NULL DEFAULT 1,
    "playerId" TEXT,
    "config" JSONB,
    "sourceUsed" "DataSource",
    "lastUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WidgetInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchlistTeam" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sport" "Sport" NOT NULL DEFAULT 'NFL',
    "teamKey" TEXT NOT NULL,
    "teamName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WatchlistTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FavoritePlayer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sport" "Sport" NOT NULL DEFAULT 'NFL',
    "playerId" TEXT NOT NULL,
    "playerName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FavoritePlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlossaryTerm" (
    "id" TEXT NOT NULL,
    "sport" "Sport" NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "plainDefinition" TEXT NOT NULL,
    "whyItMatters" TEXT NOT NULL,
    "advancedNotes" TEXT,
    "learnMoreUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlossaryTerm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CachedResponse" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "paramsHash" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "sourceUsed" "DataSource" NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "requestId" TEXT,
    "warning" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CachedResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "WidgetInstance_dashboardId_idx" ON "WidgetInstance"("dashboardId");

-- CreateIndex
CREATE UNIQUE INDEX "WidgetInstance_dashboardId_widgetType_playerId_key" ON "WidgetInstance"("dashboardId", "widgetType", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "WatchlistTeam_userId_sport_teamKey_key" ON "WatchlistTeam"("userId", "sport", "teamKey");

-- CreateIndex
CREATE INDEX "FavoritePlayer_userId_sport_idx" ON "FavoritePlayer"("userId", "sport");

-- CreateIndex
CREATE UNIQUE INDEX "GlossaryTerm_key_key" ON "GlossaryTerm"("key");

-- CreateIndex
CREATE INDEX "CachedResponse_provider_endpoint_idx" ON "CachedResponse"("provider", "endpoint");

-- CreateIndex
CREATE UNIQUE INDEX "CachedResponse_provider_endpoint_paramsHash_key" ON "CachedResponse"("provider", "endpoint", "paramsHash");

-- CreateIndex
CREATE UNIQUE INDEX "Dashboard_userId_key" ON "Dashboard"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Dashboard_shareToken_key" ON "Dashboard"("shareToken");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WidgetInstance" ADD CONSTRAINT "WidgetInstance_dashboardId_fkey" FOREIGN KEY ("dashboardId") REFERENCES "Dashboard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchlistTeam" ADD CONSTRAINT "WatchlistTeam_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoritePlayer" ADD CONSTRAINT "FavoritePlayer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
