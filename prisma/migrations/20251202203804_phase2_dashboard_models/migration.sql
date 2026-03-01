/*
  Warnings:

  - You are about to drop the column `displayName` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `favoriteSports` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `favoriteTeams` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `modePreference` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `WatchlistItem` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "Sport" AS ENUM ('NFL', 'NBA', 'MLB');

-- CreateEnum
CREATE TYPE "DashboardMode" AS ENUM ('BEGINNER', 'ADVANCED');

-- DropForeignKey
ALTER TABLE "WatchlistItem" DROP CONSTRAINT "WatchlistItem_userId_fkey";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "displayName",
DROP COLUMN "favoriteSports",
DROP COLUMN "favoriteTeams",
DROP COLUMN "modePreference",
ADD COLUMN     "name" TEXT;

-- DropTable
DROP TABLE "WatchlistItem";

-- DropEnum
DROP TYPE "ViewMode";

-- CreateTable
CREATE TABLE "Dashboard" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sport" "Sport" NOT NULL,
    "mode" "DashboardMode" NOT NULL DEFAULT 'BEGINNER',
    "title" TEXT NOT NULL DEFAULT 'My NashBoard',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dashboard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DashboardWidget" (
    "id" TEXT NOT NULL,
    "dashboardId" TEXT NOT NULL,
    "widgetKey" TEXT NOT NULL,
    "x" INTEGER NOT NULL DEFAULT 0,
    "y" INTEGER NOT NULL DEFAULT 0,
    "w" INTEGER NOT NULL DEFAULT 4,
    "h" INTEGER NOT NULL DEFAULT 3,
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DashboardWidget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Favorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "sport" "Sport" NOT NULL,
    "name" TEXT NOT NULL,
    "shortCode" TEXT NOT NULL,
    "apiId" TEXT,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "sport" "Sport" NOT NULL,
    "teamId" TEXT,
    "name" TEXT NOT NULL,
    "position" TEXT,
    "apiId" TEXT,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "sport" "Sport" NOT NULL,
    "homeTeamId" TEXT NOT NULL,
    "awayTeamId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "apiId" TEXT,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Team_apiId_key" ON "Team"("apiId");

-- CreateIndex
CREATE UNIQUE INDEX "Player_apiId_key" ON "Player"("apiId");

-- CreateIndex
CREATE UNIQUE INDEX "Game_apiId_key" ON "Game"("apiId");

-- AddForeignKey
ALTER TABLE "Dashboard" ADD CONSTRAINT "Dashboard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DashboardWidget" ADD CONSTRAINT "DashboardWidget_dashboardId_fkey" FOREIGN KEY ("dashboardId") REFERENCES "Dashboard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
