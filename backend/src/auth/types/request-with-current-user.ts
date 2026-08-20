import type { Request } from 'express';

import type { AuthenticatedUser } from './authenticated-user.js';

export interface RequestWithCurrentUser extends Request {
  user: AuthenticatedUser;
}
