import { IsString, IsNotEmpty, IsOptional, IsArray } from 'class-validator';

export class AddTemplateDocumentDto {
  @IsString()
  @IsNotEmpty()
  documentId!: string;
}
