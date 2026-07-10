import { Type } from 'class-transformer';
import {
  IsArray,
  IsBase64,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { MAX_PLANET_FILE_SIZE_BYTES } from '../controller-migration.constants';
import { CreateControllerDto } from './create-controller.dto';

const MAX_PLANET_FILE_BASE64_LENGTH = Math.ceil(MAX_PLANET_FILE_SIZE_BYTES / 3) * 4;

export class ImportedControllerDto extends CreateControllerDto {
  @IsOptional()
  @IsString()
  @IsBase64()
  @MaxLength(MAX_PLANET_FILE_BASE64_LENGTH)
  planetFileContent?: string;
}

export class ControllerMigrationDataDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportedControllerDto)
  controllers!: ImportedControllerDto[];

  @IsISO8601()
  exportedAt!: string;
}
