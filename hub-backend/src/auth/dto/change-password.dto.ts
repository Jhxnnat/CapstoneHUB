import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from '@nestjs/class-validator';

export class ChangePasswordDto {
  @ApiProperty({ description: 'current password of the user' })
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @ApiProperty({ description: 'new password for the user', minLength: 8 })
  @IsString()
  @MinLength(8)
  @IsNotEmpty()
  newPassword!: string;
}
