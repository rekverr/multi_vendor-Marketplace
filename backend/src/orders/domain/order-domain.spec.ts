import { Prisma, SellerOrderStatus } from '../../generated/prisma/client.js';
import { calculateSellerOrderFinancials } from './commission.policy.js';
import {
  canTransitionSellerOrder,
  deriveOrderStatus,
} from './order-status.policy.js';

describe('Order domain policies', () => {
  it('calculates commission deterministically per SellerOrder', () => {
    const result = calculateSellerOrderFinancials(
      new Prisma.Decimal('100.05'),
      new Prisma.Decimal('0.075'),
    );

    expect(result.platformCommission.toFixed(2)).toBe('7.50');
    expect(result.sellerNet.toFixed(2)).toBe('92.55');
  });

  it('validates SellerOrder transitions', () => {
    expect(
      canTransitionSellerOrder(
        SellerOrderStatus.NEW,
        SellerOrderStatus.PROCESSING,
      ),
    ).toBe(true);
    expect(
      canTransitionSellerOrder(
        SellerOrderStatus.COMPLETED,
        SellerOrderStatus.PROCESSING,
      ),
    ).toBe(false);
  });

  it('derives parent status from independent SellerOrders', () => {
    expect(
      deriveOrderStatus([
        SellerOrderStatus.SHIPPED,
        SellerOrderStatus.PROCESSING,
      ]),
    ).toBe('PARTIALLY_SHIPPED');
    expect(
      deriveOrderStatus([
        SellerOrderStatus.COMPLETED,
        SellerOrderStatus.CANCELLED,
      ]),
    ).toBe('PARTIALLY_CANCELLED');
  });
});
