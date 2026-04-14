import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class UpdateControllerDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsString()
  @Matches(/^https?:\/\/.+$/)
  baseUrl?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  subnetPoolCidr?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  subnetPrefix?: number;
}
