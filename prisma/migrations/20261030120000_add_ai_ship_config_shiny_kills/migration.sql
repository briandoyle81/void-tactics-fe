-- AI ship configs set whether their ships are shiny and their kill count
-- (rank), matching the chain's AIEncounters.AIShipConfig (2026-10-30).
ALTER TABLE "AIShipConfig" ADD COLUMN "shiny" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AIShipConfig" ADD COLUMN "shipsDestroyed" INTEGER NOT NULL DEFAULT 0;
