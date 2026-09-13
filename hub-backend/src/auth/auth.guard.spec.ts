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
    } as never;
    const guard = new AuthGuard(authService);
    const request = { headers: { authorization: 'Bearer token' } };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as never;

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request).toHaveProperty('user', authenticatedUser);
  });
});
