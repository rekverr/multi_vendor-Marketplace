import { safeErrorMessage, structuredLog } from './structured-log.js';

describe('structuredLog', () => {
  it('creates a machine-readable event envelope', () => {
    expect(
      JSON.parse(
        structuredLog('ORDER_CREATED', {
          correlationId: 'correlation-id',
          orderId: 'order-id',
        }),
      ),
    ).toEqual({
      event: 'ORDER_CREATED',
      correlationId: 'correlation-id',
      orderId: 'order-id',
    });
  });

  it('redacts credentials and bearer tokens from infrastructure errors', () => {
    const message = safeErrorMessage(
      new Error('redis://user:secret@localhost failed Bearer raw-token'),
    );
    expect(message).toBe(
      'redis://[REDACTED]@localhost failed Bearer [REDACTED]',
    );
  });
});
