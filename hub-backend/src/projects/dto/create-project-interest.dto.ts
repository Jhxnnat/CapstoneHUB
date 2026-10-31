import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Mensaje opcional con el que el estudiante acompaña su interés. */
export class CreateProjectInterestDTO {
  @ApiPropertyOptional({
    description: 'Motivación breve del estudiante (opcional)',
    maxLength: 1000,
  })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  message?: string;
}
