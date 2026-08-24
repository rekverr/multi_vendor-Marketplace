import { jest } from '@jest/globals';
import { ConfigService } from '@nestjs/config';

import { GoogleOAuthStateService } from './google-oauth-state.service.js';

describe('GoogleOAuthStateService', () => {
  it('allows an explicit non-secure cookie for local production containers', () => {
    const service = new GoogleOAuthStateService(
      new ConfigService({
        NODE_ENV: 'production',
        GOOGLE_OAUTH_COOKIE_SECURE: false,
        GOOGLE_OAUTH_STATE_TTL_SECONDS: 600,
      }),
    );
    const response = { cookie: jest.fn() };

    service.issue(response as never);

    expect(response.cookie).toHaveBeenCalledWith(
      'google_oauth_state',
      expect.any(String),
      expect.objectContaining({ secure: false }),
    );
  });

  it('defaults to secure cookies in production', () => {
    const service = new GoogleOAuthStateService(
      new ConfigService({
        NODE_ENV: 'production',
        GOOGLE_OAUTH_STATE_TTL_SECONDS: 600,
      }),
    );
    const response = { cookie: jest.fn() };

    service.issue(response as never);

    expect(response.cookie).toHaveBeenCalledWith(
      'google_oauth_state',
      expect.any(String),
      expect.objectContaining({ secure: true }),
    );
  });
});
