import { WsException } from '@nestjs/websockets';
import { jest } from '@jest/globals';
import { UserRole } from '../generated/prisma/client.js';
import { RealtimeGateway } from './realtime.gateway.js';

const productId = '11111111-1111-4111-8111-111111111111';
const orderId = '22222222-2222-4222-8222-222222222222';
const sellerOrderId = '33333333-3333-4333-8333-333333333333';

describe('RealtimeGateway', () => {
  const auth = { authenticate: jest.fn() };
  const access = {
    canReadProduct: jest.fn(),
    canReadAuction: jest.fn(),
    canReadOrder: jest.fn(),
    canReadSellerOrder: jest.fn(),
  };
  let gateway: RealtimeGateway;

  beforeEach(() => {
    jest.clearAllMocks();
    gateway = new RealtimeGateway(auth as never, access as never);
  });

  it('allows an anonymous client to subscribe to a visible Product', async () => {
    access.canReadProduct.mockResolvedValue(true);
    const client = socket();

    const result = await gateway.subscribeProduct(client as never, {
      productId,
    });

    expect(client.join).toHaveBeenCalledWith(`product:${productId}`);
    expect(result.resync.path).toBe(`/products/${productId}`);
  });

  it('rejects an unauthenticated private Order subscription', async () => {
    await expect(
      gateway.subscribeOrder(socket() as never, { orderId }),
    ).rejects.toBeInstanceOf(WsException);
    expect(access.canReadOrder).not.toHaveBeenCalled();
  });

  it('joins only a Customer-owned Order room', async () => {
    const user = {
      id: 'customer',
      email: 'c@example.com',
      role: UserRole.CUSTOMER,
    };
    access.canReadOrder.mockResolvedValue({
      id: orderId,
      updatedAt: new Date(),
    });
    const client = socket(user);

    await gateway.subscribeOrder(client as never, { orderId });

    expect(access.canReadOrder).toHaveBeenCalledWith(user, orderId);
    expect(client.join).toHaveBeenCalledWith(`order:${orderId}`);
  });

  it('rejects a Seller subscription to another SellerOrder', async () => {
    const user = {
      id: 'seller-a',
      email: 's@example.com',
      role: UserRole.SELLER,
    };
    access.canReadSellerOrder.mockResolvedValue(null);
    const client = socket(user);

    await expect(
      gateway.subscribeSellerOrder(client as never, { sellerOrderId }),
    ).rejects.toBeInstanceOf(WsException);
    expect(client.join).not.toHaveBeenCalled();
  });
});

function socket(user?: unknown) {
  return {
    data: user ? { user } : {},
    handshake: { auth: {}, headers: {} },
    join: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn(),
  };
}
