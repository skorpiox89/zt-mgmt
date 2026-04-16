import { IsString, Matches, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @Matches(/^[A-Za-z0-9._-]+$/)
  username!: string;

  @IsString()
  @MinLength(4)
  password!: string;
}
