import type { UserRole } from '@prisma/client';

export interface JwtPayload {
  role: UserRole;
  sub: number;
  updatedAt: string;
  username: string;
}

export interface AuthenticatedUser {
  id: number;
  role: UserRole;
  username: string;
}
