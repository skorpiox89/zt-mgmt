import { IsString } from 'class-validator';

export class UpdateMemberNameDto {
  @IsString()
  memberName!: string;
}
