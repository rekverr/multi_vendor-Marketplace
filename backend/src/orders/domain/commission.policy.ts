import { Prisma } from '../../generated/prisma/client.js';
import { SellerOrderFinancials } from './order.types.js';

export function calculateSellerOrderFinancials(
  grossAmount: Prisma.Decimal,
  commissionRate: Prisma.Decimal,
): SellerOrderFinancials {
  if (grossAmount.isNegative()) {
    throw new RangeError('Gross amount cannot be negative');
  }
  if (commissionRate.isNegative() || commissionRate.greaterThan(1)) {
    throw new RangeError('Commission rate must be between 0 and 1');
  }

  const gross = grossAmount.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  const commission = gross
    .mul(commissionRate)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

  return {
    grossAmount: gross,
    commissionRate,
    platformCommission: commission,
    sellerNet: gross.sub(commission),
  };
}
