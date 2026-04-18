import { IsString, IsNotEmpty, IsOptional, IsArray } from 'class-validator';

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
  sections?: Array<{ name: string; content: string }>;
}
