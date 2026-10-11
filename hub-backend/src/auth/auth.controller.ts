import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { AdminGuard } from './admin.guard';
import { Public } from './public.decorator';
import { CurrentUser } from './current-user.decorator';
import type { AuthenticatedUser } from './auth.types';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { RegisterUserDto } from './dto/register-user.dto';
import { UpdateUserRolesDto } from './dto/update-user-roles.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() payload: RegisterUserDto) {
    return this.authService.register(payload);
  }

  @Public()
  @Post('login')
  login(@Body() payload: LoginUserDto) {
    return this.authService.login(payload);
  }

  @Get('users')
  @UseGuards(AdminGuard)
  users() {
    return this.authService.users();
  }

  @Post('users')
  @UseGuards(AdminGuard)
  createUser(@Body() payload: CreateUserDto) {
    return this.authService.createUser(payload);
  }

  @Patch('users/:id/roles')
  @UseGuards(AdminGuard)
  replaceUserRoles(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateUserRolesDto,
  ) {
    return this.authService.replaceUserRoles(id, payload.roles);
  }

  @Patch('me/password')
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() payload: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user.id, payload);
  }
}
