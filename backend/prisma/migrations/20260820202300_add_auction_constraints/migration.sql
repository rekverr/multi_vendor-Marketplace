ALTER TABLE "Auction"
ADD CONSTRAINT "Auction_values_check"
CHECK (
  "startingPrice" > 0
  AND "minimumIncrement" > 0
  AND "startsAt" < "endsAt"
  AND "version" >= 0
),
ADD CONSTRAINT "Auction_winner_check"
CHECK (
  ("status" = 'SOLD' AND "winnerId" IS NOT NULL AND "winningPrice" IS NOT NULL)
  OR ("status" <> 'SOLD')
),
ADD CONSTRAINT "Auction_winning_price_check"
CHECK ("winningPrice" IS NULL OR "winningPrice" > 0);

ALTER TABLE "Bid"
ADD CONSTRAINT "Bid_amount_check"
CHECK ("amount" > 0);
