-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('NEW', 'PROCESSING', 'PARTIALLY_SHIPPED', 'SHIPPED', 'PARTIALLY_COMPLETED', 'COMPLETED', 'PARTIALLY_CANCELLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SellerOrderStatus" AS ENUM ('NEW', 'PROCESSING', 'SHIPPED', 'COMPLETED', 'PARTIALLY_CANCELLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LedgerAccount" AS ENUM ('PLATFORM', 'SELLER');

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('COMMISSION', 'SELLER_EARNING', 'REFUND_REVERSAL', 'CANCELLATION_REVERSAL');

-- CreateEnum
CREATE TYPE "LedgerDirection" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "CheckoutIdempotencyStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "Order" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'NEW',
    "currency" VARCHAR(3) NOT NULL,
    "totalAmount" DECIMAL(19,2) NOT NULL,
    "refundedAmount" DECIMAL(19,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SellerOrder" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "sellerId" UUID NOT NULL,
    "status" "SellerOrderStatus" NOT NULL DEFAULT 'NEW',
    "currency" VARCHAR(3) NOT NULL,
    "grossAmount" DECIMAL(19,2) NOT NULL,
    "commissionRate" DECIMAL(7,6) NOT NULL,
    "platformCommission" DECIMAL(19,2) NOT NULL,
    "sellerNet" DECIMAL(19,2) NOT NULL,
    "refundedGross" DECIMAL(19,2) NOT NULL DEFAULT 0,
    "refundedCommission" DECIMAL(19,2) NOT NULL DEFAULT 0,
    "refundedSellerNet" DECIMAL(19,2) NOT NULL DEFAULT 0,
    "cancelledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SellerOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" UUID NOT NULL,
    "sellerOrderId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "productTitle" TEXT NOT NULL,
    "productImageUrl" TEXT,
    "productType" "ProductType" NOT NULL,
    "sellerIdSnapshot" UUID NOT NULL,
    "sellerNameSnapshot" TEXT NOT NULL,
    "unitPrice" DECIMAL(19,2) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "lineTotal" DECIMAL(19,2) NOT NULL,
    "cancelledQuantity" INTEGER NOT NULL DEFAULT 0,
    "refundedQuantity" INTEGER NOT NULL DEFAULT 0,
    "refundedAmount" DECIMAL(19,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialLedgerEntry" (
    "id" UUID NOT NULL,
    "sellerOrderId" UUID NOT NULL,
    "orderItemId" UUID,
    "account" "LedgerAccount" NOT NULL,
    "entryType" "LedgerEntryType" NOT NULL,
    "direction" "LedgerDirection" NOT NULL,
    "amount" DECIMAL(19,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckoutIdempotency" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "status" "CheckoutIdempotencyStatus" NOT NULL DEFAULT 'PROCESSING',
    "orderId" UUID,
    "lastErrorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "CheckoutIdempotency_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Order"
ADD CONSTRAINT "Order_amounts_check"
CHECK ("totalAmount" >= 0 AND "refundedAmount" >= 0 AND "refundedAmount" <= "totalAmount"),
ADD CONSTRAINT "Order_currency_check"
CHECK ("currency" ~ '^[A-Z]{3}$');

ALTER TABLE "SellerOrder"
ADD CONSTRAINT "SellerOrder_financials_check"
CHECK (
  "grossAmount" >= 0
  AND "commissionRate" >= 0
  AND "commissionRate" <= 1
  AND "platformCommission" >= 0
  AND "sellerNet" >= 0
  AND "platformCommission" + "sellerNet" = "grossAmount"
  AND "refundedGross" >= 0
  AND "refundedGross" <= "grossAmount"
  AND "refundedCommission" >= 0
  AND "refundedCommission" <= "platformCommission"
  AND "refundedSellerNet" >= 0
  AND "refundedSellerNet" <= "sellerNet"
  AND "refundedCommission" + "refundedSellerNet" = "refundedGross"
),
ADD CONSTRAINT "SellerOrder_currency_check"
CHECK ("currency" ~ '^[A-Z]{3}$');

ALTER TABLE "OrderItem"
ADD CONSTRAINT "OrderItem_quantities_check"
CHECK (
  "quantity" > 0
  AND "cancelledQuantity" >= 0
  AND "cancelledQuantity" <= "quantity"
  AND "refundedQuantity" >= 0
  AND "refundedQuantity" <= "quantity"
),
ADD CONSTRAINT "OrderItem_amounts_check"
CHECK (
  "unitPrice" >= 0
  AND "lineTotal" = "unitPrice" * "quantity"
  AND "refundedAmount" >= 0
  AND "refundedAmount" <= "lineTotal"
);

ALTER TABLE "FinancialLedgerEntry"
ADD CONSTRAINT "FinancialLedgerEntry_amount_check"
CHECK ("amount" > 0),
ADD CONSTRAINT "FinancialLedgerEntry_currency_check"
CHECK ("currency" ~ '^[A-Z]{3}$');

ALTER TABLE "CheckoutIdempotency"
ADD CONSTRAINT "CheckoutIdempotency_completed_check"
CHECK (
  "status" <> 'COMPLETED'
  OR ("orderId" IS NOT NULL AND "completedAt" IS NOT NULL)
);

-- CreateIndex
CREATE INDEX "Order_customerId_createdAt_idx" ON "Order"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SellerOrder_sellerId_status_createdAt_idx" ON "SellerOrder"("sellerId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "SellerOrder_orderId_status_idx" ON "SellerOrder"("orderId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SellerOrder_orderId_sellerId_key" ON "SellerOrder"("orderId", "sellerId");

-- CreateIndex
CREATE INDEX "OrderItem_sellerOrderId_idx" ON "OrderItem"("sellerOrderId");

-- CreateIndex
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialLedgerEntry_idempotencyKey_key" ON "FinancialLedgerEntry"("idempotencyKey");

-- CreateIndex
CREATE INDEX "FinancialLedgerEntry_sellerOrderId_occurredAt_idx" ON "FinancialLedgerEntry"("sellerOrderId", "occurredAt");

-- CreateIndex
CREATE INDEX "FinancialLedgerEntry_entryType_occurredAt_idx" ON "FinancialLedgerEntry"("entryType", "occurredAt");

-- CreateIndex
CREATE INDEX "FinancialLedgerEntry_orderItemId_idx" ON "FinancialLedgerEntry"("orderItemId");

-- CreateIndex
CREATE INDEX "CheckoutIdempotency_status_createdAt_idx" ON "CheckoutIdempotency"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutIdempotency_customerId_idempotencyKey_key" ON "CheckoutIdempotency"("customerId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutIdempotency_orderId_key" ON "CheckoutIdempotency"("orderId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerOrder" ADD CONSTRAINT "SellerOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerOrder" ADD CONSTRAINT "SellerOrder_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "SellerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_sellerOrderId_fkey" FOREIGN KEY ("sellerOrderId") REFERENCES "SellerOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialLedgerEntry" ADD CONSTRAINT "FinancialLedgerEntry_sellerOrderId_fkey" FOREIGN KEY ("sellerOrderId") REFERENCES "SellerOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialLedgerEntry" ADD CONSTRAINT "FinancialLedgerEntry_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutIdempotency" ADD CONSTRAINT "CheckoutIdempotency_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutIdempotency" ADD CONSTRAINT "CheckoutIdempotency_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
