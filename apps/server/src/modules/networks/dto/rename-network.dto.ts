import { IsString, MinLength } from 'class-validator';

export class RenameNetworkDto {
  @IsString()
  @MinLength(1)
  networkName!: string;
}
