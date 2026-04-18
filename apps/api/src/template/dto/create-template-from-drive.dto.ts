import { IsString, IsNotEmpty, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateTemplateSectionDto } from './create-template-section.dto';

export class CreateTemplateFromDriveDto {
  @IsString()
  @IsNotEmpty()
  fileId!: string;

  @IsString()
  @IsNotEmpty()
  sourceId!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  docType?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateTemplateSectionDto)
  sections?: CreateTemplateSectionDto[];
}
