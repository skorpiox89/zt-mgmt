import { IsBoolean } from 'class-validator';

export class UpdateMemberAuthDto {
  @IsBoolean()
  authorized!: boolean;
}
