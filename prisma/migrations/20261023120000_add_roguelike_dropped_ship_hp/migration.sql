-- Ships dropped from a roguelike roster at a resupply keep their damage for
-- the rest of the run (ship id -> damage taken), matching the chain's
-- RoguelikeRun.shipHPByGen (2026-10-23).
ALTER TABLE "RoguelikeRun" ADD COLUMN "droppedShipHp" JSONB NOT NULL DEFAULT '{}';
