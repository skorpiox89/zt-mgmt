import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../users/users.service';
import type { JwtPayload } from './auth.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly usersService: UsersService) {
    super({
      ignoreExpiration: false,
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET || 'local-dev-jwt-secret',
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.usersService.findSessionUserById(payload.sub);
    if (
      user.role !== payload.role ||
      user.updatedAt.toISOString() !== payload.updatedAt
    ) {
      throw new UnauthorizedException('登录状态已失效，请重新登录');
    }

    return this.usersService.toAuthenticatedUser(user);
  }
}
