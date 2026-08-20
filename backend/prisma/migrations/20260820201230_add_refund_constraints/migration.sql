ALTER TABLE "Refund"
ADD CONSTRAINT "Refund_amounts_check"
CHECK (
  "quantity" > 0
  AND "amount" > 0
  AND "commissionAmount" >= 0
  AND "sellerNetAmount" >= 0
  AND "commissionAmount" + "sellerNetAmount" = "amount"
);

ALTER TABLE "OrderItem"
DROP CONSTRAINT "OrderItem_quantities_check",
ADD CONSTRAINT "OrderItem_quantities_check"
CHECK (
  "quantity" > 0
  AND "cancelledQuantity" >= 0
  AND "refundedQuantity" >= 0
  AND "cancelledQuantity" + "refundedQuantity" <= "quantity"
);
