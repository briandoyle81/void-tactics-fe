-- CreateEnum
CREATE TYPE "FlowFulfillmentStatus" AS ENUM ('PENDING', 'SENT', 'MINTED', 'FAILED');

-- CreateTable
CREATE TABLE "FlowFulfillment" (
    "id" SERIAL NOT NULL,
    "transactionId" TEXT NOT NULL,
    "buyerAddress" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,
    "chainId" INTEGER NOT NULL,
    "variant" INTEGER NOT NULL,
    "status" "FlowFulfillmentStatus" NOT NULL DEFAULT 'PENDING',
    "mintTxHash" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlowFulfillment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FlowFulfillment_transactionId_key" ON "FlowFulfillment"("transactionId");

-- CreateIndex
CREATE INDEX "FlowFulfillment_status_idx" ON "FlowFulfillment"("status");
