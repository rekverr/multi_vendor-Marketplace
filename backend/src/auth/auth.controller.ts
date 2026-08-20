import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { AuthService } from './auth.service.js';
import { CurrentUser } from './current-user.decorator.js';
import { GoogleCallbackDto } from './dto/google-callback.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { GoogleOAuthClient } from './google-oauth.client.js';
import { GoogleOAuthStateService } from './google-oauth-state.service.js';
import { JwtAccessGuard } from './jwt-access.guard.js';
import type { AuthenticatedUser } from './types/authenticated-user.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly googleOAuthClient: GoogleOAuthClient,
    private readonly googleOAuthState: GoogleOAuthStateService,
  ) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a customer account' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in with email and password' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate a refresh session' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke a refresh session' })
  async logout(@Body() dto: RefreshTokenDto): Promise<void> {
    await this.authService.logout(dto.refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the authenticated user' })
  me(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }

  @Get('google')
  @ApiOperation({ summary: 'Start Google OAuth2 authentication' })
  google(@Res() response: Response): void {
    const state = this.googleOAuthState.issue(response);
    response.redirect(this.googleOAuthClient.createAuthorizationUrl(state));
  }

  @Get('google/callback')
  @ApiOperation({ summary: 'Complete Google OAuth2 authentication' })
  async googleCallback(
    @Query() query: GoogleCallbackDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (!this.googleOAuthState.consume(request, response, query.state)) {
      throw new UnauthorizedException('Invalid OAuth state');
    }

    const identity = await this.googleOAuthClient.verifyAuthorizationCode(
      query.code,
    );

    return this.authService.authenticateWithGoogle(identity);
  }
}
