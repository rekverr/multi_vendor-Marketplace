-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED', 'CLOSED');

-- CreateTable
CREATE TABLE "Dispute" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "sellerOrderId" UUID NOT NULL,
    "orderItemId" UUID,
    "scopeKey" VARCHAR(80) NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "reason" VARCHAR(2000) NOT NULL,
    "resolutionNote" VARCHAR(2000),
    "reviewedById" UUID,
    "reviewedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Dispute_customerId_createdAt_idx" ON "Dispute"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "Dispute_sellerOrderId_createdAt_idx" ON "Dispute"("sellerOrderId", "createdAt");

-- CreateIndex
CREATE INDEX "Dispute_status_createdAt_idx" ON "Dispute"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Dispute_customerId_scopeKey_key" ON "Dispute"("customerId", "scopeKey");

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_sellerOrderId_fkey" FOREIGN KEY ("sellerOrderId") REFERENCES "SellerOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
