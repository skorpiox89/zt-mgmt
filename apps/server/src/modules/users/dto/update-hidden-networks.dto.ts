import { Type } from 'class-transformer';
import { IsArray, IsInt, IsString, MinLength, ValidateNested } from 'class-validator';

export class HiddenNetworkDto {
  @IsInt()
  controllerId!: number;

  @IsString()
  @MinLength(1)
  networkId!: string;
}

export class UpdateHiddenNetworksDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HiddenNetworkDto)
  items!: HiddenNetworkDto[];
}
