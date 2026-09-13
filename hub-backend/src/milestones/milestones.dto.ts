import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from '@nestjs/class-transformer';
import {
  IsBoolean,
  IsDate,
  IsNotEmpty,
  IsOptional,
  IsString,
} from '@nestjs/class-validator';

export class CreateMilestoneDto {
  @ApiProperty({ description: 'Milestone title' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiPropertyOptional({ description: 'Milestone description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Milestone due date',
    type: String,
    format: 'date-time',
  })
  @Type(() => Date)
  @IsDate()
  dueDate!: Date;

  @ApiPropertyOptional({ description: 'Whether the milestone is completed' })
  @IsBoolean()
  @IsOptional()
  completed?: boolean;
}

export class UpdateMilestoneDto {
  @ApiPropertyOptional({ description: 'Milestone title' })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ description: 'Milestone description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Milestone due date',
    type: String,
    format: 'date-time',
  })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  dueDate?: Date;

  @ApiPropertyOptional({ description: 'Whether the milestone is completed' })
  @IsBoolean()
  @IsOptional()
  completed?: boolean;
}
