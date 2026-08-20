-- CreateTable
CREATE TABLE "Refund" (
    "id" UUID NOT NULL,
    "initiatedById" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "sellerOrderId" UUID NOT NULL,
    "orderItemId" UUID NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "amount" DECIMAL(19,2) NOT NULL,
    "commissionAmount" DECIMAL(19,2) NOT NULL,
    "sellerNetAmount" DECIMAL(19,2) NOT NULL,
    "reason" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Refund_orderId_createdAt_idx" ON "Refund"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "Refund_sellerOrderId_createdAt_idx" ON "Refund"("sellerOrderId", "createdAt");

-- CreateIndex
CREATE INDEX "Refund_orderItemId_createdAt_idx" ON "Refund"("orderItemId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_initiatedById_idempotencyKey_key" ON "Refund"("initiatedById", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_sellerOrderId_fkey" FOREIGN KEY ("sellerOrderId") REFERENCES "SellerOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
