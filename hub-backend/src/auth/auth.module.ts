import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { AdminGuard } from './admin.guard';
import { AuthorizationService } from './authorization.service';
import { AUTH_TOKEN_TTL_SECONDS, getAuthSecret } from './auth.token';

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: getAuthSecret(),
        signOptions: {
          algorithm: 'HS256',
          expiresIn: AUTH_TOKEN_TTL_SECONDS,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthGuard,
    AdminGuard,
    AuthorizationService,
    // Autenticación global: toda ruta exige un token Bearer salvo que se marque
    // explícitamente con @Public(). Las rutas públicas pueden recibir un token
    // igualmente, para que los handlers adapten la respuesta al espectador.
    { provide: APP_GUARD, useExisting: AuthGuard },
  ],
  exports: [AuthService, AuthGuard, AdminGuard, AuthorizationService],
})
export class AuthModule {}
