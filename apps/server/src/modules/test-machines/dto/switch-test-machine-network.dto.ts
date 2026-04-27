import { Type } from 'class-transformer';
import { IsInt, IsString, MinLength } from 'class-validator';

export class SwitchTestMachineNetworkDto {
  @Type(() => Number)
  @IsInt()
  controllerId!: number;

  @IsString()
  @MinLength(1)
  networkId!: string;
}
