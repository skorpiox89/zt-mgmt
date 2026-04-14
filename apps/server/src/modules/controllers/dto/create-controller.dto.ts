import { IsInt, IsString, Matches, Max, Min } from 'class-validator';

export class CreateControllerDto {
  @IsString()
  name!: string;

  @IsString()
  region!: string;

  @IsString()
  @Matches(/^https?:\/\/.+$/)
  baseUrl!: string;

  @IsString()
  username!: string;

  @IsString()
  password!: string;

  @IsString()
  subnetPoolCidr!: string;

  @IsInt()
  @Min(1)
  @Max(30)
  subnetPrefix!: number;
}
