import { ROLES_KEY } from '../auth/roles.decorator.js';
import { UserRole } from '../generated/prisma/client.js';
import { AdminDisputesController } from './admin-disputes.controller.js';
import { CustomerDisputesController } from './customer-disputes.controller.js';
import { SellerDisputesController } from './seller-disputes.controller.js';

describe('Dispute controller authorization', () => {
  it.each([
    [CustomerDisputesController, UserRole.CUSTOMER],
    [SellerDisputesController, UserRole.SELLER],
    [AdminDisputesController, UserRole.ADMIN],
  ])('restricts %p to %s', (controller, role) => {
    expect(Reflect.getMetadata(ROLES_KEY, controller)).toEqual([role]);
  });
});
