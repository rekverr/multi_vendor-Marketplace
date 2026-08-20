import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { GoogleOAuthClient } from './google-oauth.client.js';
import { GoogleOAuthStateService } from './google-oauth-state.service.js';
import { JwtAccessGuard } from './jwt-access.guard.js';
import { PasswordHasherService } from './password-hasher.service.js';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    GoogleOAuthClient,
    GoogleOAuthStateService,
    JwtAccessGuard,
    PasswordHasherService,
  ],
  exports: [JwtAccessGuard],
})
export class AuthModule {}
