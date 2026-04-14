import { Injectable, UnauthorizedException } from '@nestjs/common';

export interface PlatformUser {
  id: number;
  username: string;
}

@Injectable()
export class UsersService {
  private readonly defaultUser: PlatformUser = {
    id: 1,
    username: process.env.ADMIN_USERNAME || 'admin',
  };

  validateAdmin(username: string, password: string) {
    const expectedUsername = process.env.ADMIN_USERNAME || 'admin';
    const expectedPassword = process.env.ADMIN_PASSWORD || '123456';

    if (username !== expectedUsername || password !== expectedPassword) {
      throw new UnauthorizedException('Invalid username or password');
    }

    return this.defaultUser;
  }

  getCurrentUser() {
    return this.defaultUser;
  }
}
