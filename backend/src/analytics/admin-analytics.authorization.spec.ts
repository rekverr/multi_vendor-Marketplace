import { ROLES_KEY } from '../auth/roles.decorator.js';
import { UserRole } from '../generated/prisma/client.js';
import { AdminAnalyticsController } from './admin-analytics.controller.js';

describe('AdminAnalyticsController authorization', () => {
  it('requires the persisted Admin role', () => {
    expect(Reflect.getMetadata(ROLES_KEY, AdminAnalyticsController)).toEqual([
      UserRole.ADMIN,
    ]);
  });
});
