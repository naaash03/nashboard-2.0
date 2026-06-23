-- AlterTable: add optional password hash for email/password credentials auth
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;
