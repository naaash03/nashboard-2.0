-- AlterTable
ALTER TABLE "Dashboard" ADD COLUMN     "description" TEXT;

-- AlterTable
ALTER TABLE "Favorite" ADD COLUMN     "sport" "Sport" NOT NULL DEFAULT 'NFL';
