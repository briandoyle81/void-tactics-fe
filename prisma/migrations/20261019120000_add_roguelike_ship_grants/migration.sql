-- CreateTable
CREATE TABLE "RoguelikeShipGrant" (
    "nodeId" INTEGER NOT NULL,
    "grant" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoguelikeShipGrant_pkey" PRIMARY KEY ("nodeId")
);

-- CreateTable
CREATE TABLE "RoguelikeShipGrantAward" (
    "id" SERIAL NOT NULL,
    "nodeId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "shipId" INTEGER NOT NULL,
    "lobbyId" INTEGER NOT NULL,
    "countsAsClaim" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoguelikeShipGrantAward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoguelikeShipGrantAward_nodeId_userId_idx" ON "RoguelikeShipGrantAward"("nodeId", "userId");

-- CreateIndex
CREATE INDEX "RoguelikeShipGrantAward_lobbyId_idx" ON "RoguelikeShipGrantAward"("lobbyId");

-- AddForeignKey
ALTER TABLE "RoguelikeShipGrant" ADD CONSTRAINT "RoguelikeShipGrant_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "RoguelikeNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoguelikeShipGrantAward" ADD CONSTRAINT "RoguelikeShipGrantAward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
