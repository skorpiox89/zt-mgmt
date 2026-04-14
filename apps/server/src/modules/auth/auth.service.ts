import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {}

  login(dto: LoginDto) {
    const user = this.usersService.validateAdmin(dto.username, dto.password);
    const token = this.jwtService.sign({
      sub: user.id,
      username: user.username,
    });

    return {
      token,
      user,
    };
  }
}
