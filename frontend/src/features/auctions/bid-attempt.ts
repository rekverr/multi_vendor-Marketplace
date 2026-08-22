interface BidAttempt {
  auctionId: string;
  customerId: string;
  amount: string;
  idempotencyKey: string;
}
const KEY = "marketplace.bid-attempt";

export function getBidAttempt(
  auctionId: string,
  customerId: string,
  amount: string,
): BidAttempt {
  const existing = read();
  if (
    existing?.auctionId === auctionId &&
    existing.customerId === customerId &&
    existing.amount === amount
  )
    return existing;
  const attempt = {
    auctionId,
    customerId,
    amount,
    idempotencyKey: `bid:${crypto.randomUUID()}`,
  };
  sessionStorage.setItem(KEY, JSON.stringify(attempt));
  return attempt;
}
export function clearBidAttempt(): void {
  sessionStorage.removeItem(KEY);
}
function read(): BidAttempt | null {
  try {
    const value = sessionStorage.getItem(KEY);
    if (!value) return null;
    const parsed = JSON.parse(value) as Partial<BidAttempt>;
    return typeof parsed.auctionId === "string" &&
      typeof parsed.customerId === "string" &&
      typeof parsed.amount === "string" &&
      typeof parsed.idempotencyKey === "string"
      ? (parsed as BidAttempt)
      : null;
  } catch {
    return null;
  }
}
