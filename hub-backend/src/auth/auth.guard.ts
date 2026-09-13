import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthenticatedRequest } from './auth.types';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = Reflect.get(request.headers, 'authorization');

    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Authentication required');
    }

    const token = authorization.slice('Bearer '.length).trim();
    if (!token) {
      throw new UnauthorizedException('Authentication required');
    }

    request.user = await this.authService.verifyAccessToken(token);
    return true;
  }
}
