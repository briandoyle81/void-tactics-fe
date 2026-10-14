-- Roguelike edges are forward-only, matching RoguelikeNodeMap (2026-10-13).
ALTER TABLE "RoguelikeEdge" DROP COLUMN "twoWay";
