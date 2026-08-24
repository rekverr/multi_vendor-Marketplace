import { jest } from '@jest/globals';
import { Readable } from 'node:stream';
import { ROLES_KEY } from '../auth/roles.decorator.js';
import { UserRole } from '../generated/prisma/client.js';
import { AdminAnalyticsController } from './admin-analytics.controller.js';

describe('AdminAnalyticsController authorization', () => {
  it('requires the persisted Admin role', () => {
    expect(Reflect.getMetadata(ROLES_KEY, AdminAnalyticsController)).toEqual([
      UserRole.ADMIN,
    ]);
  });

  it('returns the JSON export with download headers', () => {
    const analytics = {
      createSalesJson: jest.fn().mockReturnValue({
        filename: 'marketplace-sales-2026-08-01-2026-08-21.json',
        stream: Readable.from(['{"range":{},"items":[]}']),
      }),
    };
    const controller = new AdminAnalyticsController(analytics as never);

    const file = controller.exportSalesJson({
      from: '2026-08-01T00:00:00.000Z',
      to: '2026-08-21T00:00:00.000Z',
    });

    expect(file.getHeaders()).toEqual({
      type: 'application/json; charset=utf-8',
      disposition:
        'attachment; filename="marketplace-sales-2026-08-01-2026-08-21.json"',
      length: undefined,
    });
  });
});
