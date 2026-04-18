import { IsString, IsNotEmpty, IsOptional, IsArray } from 'class-validator';

export class CreateTemplateFromUploadDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  docType?: string;

  @IsString()
  @IsOptional()
  description?: string;
}
