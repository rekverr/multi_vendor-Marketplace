ALTER TABLE "SellerOrder" DROP CONSTRAINT "SellerOrder_reviewId_fkey";
ALTER TABLE "SellerOrder" DROP COLUMN "reviewId";

ALTER TABLE "Review"
ADD CONSTRAINT "Review_rating_check"
CHECK ("rating" BETWEEN 1 AND 5),
ADD CONSTRAINT "Review_text_check"
CHECK (char_length("text") BETWEEN 1 AND 2000);

ALTER TABLE "Product"
ADD CONSTRAINT "Product_rating_aggregate_check"
CHECK (
  "ratingCount" >= 0
  AND "ratingAverage" BETWEEN 0 AND 5
  AND (("ratingCount" = 0 AND "ratingAverage" = 0) OR "ratingCount" > 0)
);
