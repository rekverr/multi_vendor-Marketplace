import { readE2eDatabaseState } from './e2e-database-state.ts';

const databaseState = readE2eDatabaseState();
if (databaseState) {
  process.env.DATABASE_URL = databaseState.databaseUrl;
  process.env.E2E_DATABASE_SCHEMA = databaseState.schema;
}

process.env.JWT_ACCESS_SECRET =
  'test-access-secret-with-at-least-32-characters';
process.env.JWT_ACCESS_TTL_SECONDS = '900';
process.env.JWT_REFRESH_TTL_SECONDS = '3600';
process.env.JWT_ISSUER = 'marketplace-api-test';
process.env.JWT_AUDIENCE = 'marketplace-client-test';
process.env.GOOGLE_OAUTH_CLIENT_ID = 'google-client-id-test';
process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'google-client-secret-test';
process.env.GOOGLE_OAUTH_REDIRECT_URI =
  'http://localhost:3000/auth/google/callback';
process.env.GOOGLE_OAUTH_STATE_TTL_SECONDS = '600';
process.env.OUTBOX_PUBLISHER_ENABLED = 'false';
process.env.PLATFORM_COMMISSION_RATE = '0.100000';
process.env.ORDER_CURRENCY = 'USD';
process.env.AUCTION_WINNER_CHECKOUT_WINDOW_SECONDS = '3600';
process.env.AUCTION_MAINTENANCE_ENABLED = 'false';
