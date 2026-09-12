import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEnum } from '@nestjs/class-validator';
import { UserRole } from '../../generated/prisma/client';

export class UpdateUserRolesDto {
  @ApiProperty({ enum: UserRole, isArray: true })
  @IsArray()
  @IsEnum(UserRole, { each: true })
  roles!: UserRole[];
}
