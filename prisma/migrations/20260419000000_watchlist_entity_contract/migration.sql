-- Add entityType column to WatchlistTeam for multi-sport entity contract
ALTER TABLE "WatchlistTeam" ADD COLUMN "entityType" TEXT NOT NULL DEFAULT 'team';

-- Drop old unique constraint (sport + teamKey per user)
ALTER TABLE "WatchlistTeam" DROP CONSTRAINT "WatchlistTeam_userId_sport_teamKey_key";

-- New unique constraint includes entityType so teams and players share the same
-- storage table without key collisions across entity types
ALTER TABLE "WatchlistTeam" ADD CONSTRAINT "WatchlistTeam_userId_sport_entityType_teamKey_key"
  UNIQUE ("userId", "sport", "entityType", "teamKey");
