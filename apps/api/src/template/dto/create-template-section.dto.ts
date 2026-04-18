import { IsString, IsNotEmpty, IsOptional, IsInt, Min } from 'class-validator';

export class CreateTemplateSectionDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number = 0;

  @IsOptional()
  @IsString()
  sampleContent?: string;

  @IsOptional()
  @IsString()
  clauseType?: string;
}
