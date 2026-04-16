import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.usersService.validateCredentials(dto.username, dto.password);
    return this.createAuthResponse(user);
  }

  async changePassword(userId: number, dto: ChangePasswordDto) {
    const user = await this.usersService.changePassword(
      userId,
      dto.oldPassword,
      dto.newPassword,
    );

    return this.createAuthResponse(user);
  }

  private createAuthResponse(user: Awaited<ReturnType<UsersService['validateCredentials']>>) {
    const token = this.jwtService.sign({
      role: user.role,
      sub: user.id,
      updatedAt: user.updatedAt.toISOString(),
      username: user.username,
    });

    return {
      token,
      user: this.usersService.toAuthenticatedUser(user),
    };
  }
}
