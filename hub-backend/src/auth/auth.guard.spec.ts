import { UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from './auth.guard';

describe('AuthGuard', () => {
  it('returns 401 behavior when the bearer token is missing', async () => {
    const authService = { verifyAccessToken: jest.fn() } as never;
    const guard = new AuthGuard(authService);
    const request = { headers: {} };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as never;

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('loads the authenticated user from a bearer token', async () => {
    const authenticatedUser = {
      id: 1,
      fullName: 'Admin',
      email: 'admin@example.com',
      roles: ['admin'],
    };
    const authService = {
      verifyAccessToken: jest.fn().mockResolvedValue(authenticatedUser),
      renewAccessTokenIfStale: jest.fn().mockReturnValue(null),
    } as never;
    const guard = new AuthGuard(authService);
    const request = { headers: { authorization: 'Bearer token' } };
    const response = { setHeader: jest.fn() };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as never;

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request).toHaveProperty('user', authenticatedUser);
    expect(response.setHeader).not.toHaveBeenCalled();
  });

  it('returns a renewed token header when the token is stale', async () => {
    const authenticatedUser = {
      id: 1,
      fullName: 'Admin',
      email: 'admin@example.com',
      roles: ['admin'],
    };
    const authService = {
      verifyAccessToken: jest.fn().mockResolvedValue(authenticatedUser),
      renewAccessTokenIfStale: jest.fn().mockReturnValue('renewed-token'),
    } as never;
    const guard = new AuthGuard(authService);
    const request = { headers: { authorization: 'Bearer token' } };
    const response = { setHeader: jest.fn() };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as never;

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(response.setHeader).toHaveBeenCalledWith(
      'x-access-token',
      'renewed-token',
    );
  });

  it('allows anonymous access on public routes', async () => {
    const authService = { verifyAccessToken: jest.fn() };
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(true),
    } as never;
    const guard = new AuthGuard(authService as never, reflector);
    const request = { headers: {} };
    const context = {
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => request }),
    } as never;

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(authService.verifyAccessToken).not.toHaveBeenCalled();
  });

  it('still rejects an invalid token on public routes', async () => {
    const authService = {
      verifyAccessToken: jest
        .fn()
        .mockRejectedValue(new UnauthorizedException('Access token expired')),
    } as never;
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(true),
    } as never;
    const guard = new AuthGuard(authService, reflector);
    const request = { headers: { authorization: 'Bearer expired' } };
    const context = {
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => request }),
    } as never;

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
