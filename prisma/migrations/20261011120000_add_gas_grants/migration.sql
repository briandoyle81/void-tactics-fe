-- CreateEnum
CREATE TYPE "GasGrantStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "GasGrant" (
    "id" SERIAL NOT NULL,
    "address" TEXT NOT NULL,
    "dynamicUserId" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "amountWei" TEXT NOT NULL,
    "status" "GasGrantStatus" NOT NULL DEFAULT 'PENDING',
    "txHash" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GasGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GasGrant_address_key" ON "GasGrant"("address");

-- CreateIndex
CREATE UNIQUE INDEX "GasGrant_dynamicUserId_key" ON "GasGrant"("dynamicUserId");

-- CreateIndex
CREATE INDEX "GasGrant_createdAt_idx" ON "GasGrant"("createdAt");
