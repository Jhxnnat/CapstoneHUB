import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ProjectSource } from '../../generated/prisma/client';

export class CreateProjectDto {
  @ApiProperty({ description: 'nombre del proyecto' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ description: 'descripción del proyecto' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  description!: string;

  @ApiProperty({ description: 'contexto o justificación del proyecto' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  context!: string;

  @ApiProperty({ description: 'nombre del proponente' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  namep!: string;

  @ApiPropertyOptional({
    description: 'número de identificación del proponente',
  })
  @IsOptional()
  @IsString()
  ncedua?: string;

  @ApiProperty({ description: 'correo del proponente' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  correo!: string;

  @ApiPropertyOptional({ description: 'costo estimado' })
  @IsOptional()
  @IsNumber()
  estimatedCost?: number;

  @ApiPropertyOptional({ description: 'ubicación' })
  @IsOptional()
  @IsString()
  @MaxLength(250)
  location?: string;

  @ApiPropertyOptional({ description: 'fecha de inicio (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'requiere legalización' })
  @IsOptional()
  @IsBoolean()
  requiresLegalization?: boolean;

  @ApiPropertyOptional({ description: 'proyecto privado' })
  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;

  @ApiPropertyOptional({
    enum: ProjectSource,
    description: 'origen del proyecto',
  })
  @IsOptional()
  @IsEnum(ProjectSource)
  source?: ProjectSource;

  @ApiPropertyOptional({ description: 'asesor de facultad' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  facultyAdvisor?: string;

  @ApiPropertyOptional({ description: 'requerimientos de equipo' })
  @IsOptional()
  @IsString()
  @MaxLength(250)
  teamRequirements?: string;

  @ApiPropertyOptional({ description: 'resultados esperados' })
  @IsOptional()
  @IsString()
  @MaxLength(250)
  expectedOutcomes?: string;

  @ApiPropertyOptional({ type: [String], description: 'entregables' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(250, { each: true })
  deliverables?: string[];

  @ApiPropertyOptional({ description: 'detalle del origen del proyecto' })
  @IsOptional()
  @IsString()
  @MaxLength(250)
  sourceDetails?: string;

  @ApiPropertyOptional({ description: 'fecha de consentimiento de duración' })
  @IsOptional()
  @IsString()
  submissionConsentAt?: string;

  @ApiPropertyOptional({ description: 'área o ingeniería del proyecto' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  engineeringArea?: string;

  @ApiPropertyOptional({ description: 'nombre del asesor externo' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  externalAdvisorName?: string;

  @ApiPropertyOptional({ description: 'correo del asesor externo' })
  @IsOptional()
  @IsString()
  @MaxLength(250)
  externalAdvisorEmail?: string;

  @ApiPropertyOptional({ description: 'NIT de la entidad, cuando aplique' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  nit?: string;

  @ApiPropertyOptional({ description: 'grupo de investigación' })
  @IsOptional()
  @IsString()
  @MaxLength(250)
  researchGroup?: string;

  @ApiPropertyOptional({ description: 'Junta de Acción Comunal' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  socialOrganization?: string;

  @ApiPropertyOptional({ description: 'localización del proyecto social' })
  @IsOptional()
  @IsString()
  @MaxLength(250)
  socialLocation?: string;

  @ApiPropertyOptional({ description: 'alcance específico del proyecto' })
  @IsOptional()
  @IsString()
  @MaxLength(250)
  projectScope?: string;

  @ApiPropertyOptional({
    description: 'disponibilidad de recursos monetarios: yes, no o na',
  })
  @IsOptional()
  @IsString()
  monetaryResources?: string;

  @ApiPropertyOptional({
    description: 'descripción de los recursos monetarios disponibles',
  })
  @IsOptional()
  @IsString()
  @MaxLength(250)
  monetaryResourcesDescription?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'profesores de contacto',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  facultyAdvisors?: string[];
}
