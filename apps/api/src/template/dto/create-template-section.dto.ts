import { IsString, IsNotEmpty, MinLength, IsOptional, IsInt, Min } from 'class-validator';

export class CreateTemplateSectionDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(50)
  content!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sectionIndex?: number = 0;
}
