-- CreateEnum
CREATE TYPE "CheckoutAttemptStatus" AS ENUM ('PROCESSING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "CheckoutAttempt" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "status" "CheckoutAttemptStatus" NOT NULL DEFAULT 'PROCESSING',
    "orderId" UUID,
    "correlationId" UUID NOT NULL,
    "lastErrorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "CheckoutAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CheckoutAttempt_createdAt_status_idx" ON "CheckoutAttempt"("createdAt", "status");

-- CreateIndex
CREATE INDEX "CheckoutAttempt_orderId_idx" ON "CheckoutAttempt"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutAttempt_customerId_idempotencyKey_key" ON "CheckoutAttempt"("customerId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "CheckoutAttempt" ADD CONSTRAINT "CheckoutAttempt_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutAttempt" ADD CONSTRAINT "CheckoutAttempt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
