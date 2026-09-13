import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  MinLength,
} from '@nestjs/class-validator';
import { UserRole } from '../../generated/prisma/client';

export class CreateUserDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ enum: UserRole, isArray: true })
  @IsArray()
  @IsEnum(UserRole, { each: true })
  roles!: UserRole[];
}
