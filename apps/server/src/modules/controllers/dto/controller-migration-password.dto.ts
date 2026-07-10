import { IsString, MinLength } from 'class-validator';

export class ControllerMigrationPasswordDto {
  @IsString()
  @MinLength(12)
  migrationPassword!: string;
}
