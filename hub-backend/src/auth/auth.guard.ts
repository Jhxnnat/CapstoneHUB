import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { AuthenticatedRequest } from './auth.types';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly reflector?: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic =
      this.reflector?.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? false;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = Reflect.get(request.headers, 'authorization');
    const token = authorization?.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length).trim()
      : '';

    // Acceso anónimo: solo se permite en rutas marcadas explícitamente como
    // públicas.
    if (!token) {
      if (isPublic) {
        return true;
      }

      throw new UnauthorizedException('Authentication required');
    }

    // Los tokens inválidos se rechazan incluso en rutas públicas, para que el
    // cliente detecte una sesión expirada en lugar de degradar en silencio a
    // anónimo.
    request.user = await this.authService.verifyAccessToken(token);

    // Renovación deslizante: si al token ya le pasó el umbral, se emite uno
    // nuevo y viaja en un header para que el BFF lo guarde en el navegador.
    const renewedToken = this.authService.renewAccessTokenIfStale(
      token,
      request.user,
    );

    if (renewedToken) {
      context
        .switchToHttp()
        .getResponse<Response>()
        .setHeader('x-access-token', renewedToken);
    }

    return true;
  }
}
