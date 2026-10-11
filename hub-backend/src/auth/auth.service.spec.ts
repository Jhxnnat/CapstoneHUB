import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'util';
import { Prisma, UserRole } from '../generated/prisma/client';
import { AuthService } from './auth.service';

const scrypt = promisify(scryptCallback);
const TEST_AUTH_SECRET = 'test-secret-that-is-at-least-32-characters';

/** `AuthService` con un `JwtService` real firmado con el secreto de test. */
function createService(prisma: unknown): AuthService {
  return new AuthService(
    prisma as never,
    new JwtService({
      secret: TEST_AUTH_SECRET,
      signOptions: { algorithm: 'HS256', expiresIn: 60 * 60 },
    }),
  );
}

/** Genera un hash con el mismo formato que `AuthService.hashPassword`. */
async function hashPasswordForTest(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;

  return `scrypt$${salt}$${derivedKey.toString('hex')}`;
}

type CreateUserArgs = {
  data: {
    roleAssignments: {
      create: Array<{ role: UserRole }>;
    };
  };
};

describe('AuthService role management', () => {
  const adminUser = {
    id: 1,
    fullName: 'Admin User',
    email: 'admin@example.com',
    passwordHash: 'hash',
    isActive: true,
  };

  beforeEach(() => {
    process.env.AUTH_SECRET = 'test-secret-that-is-at-least-32-characters';
  });

  it('creates users with the requested global roles without returning a password', async () => {
    const createUser = jest
      .fn<
        Promise<{
          id: number;
          fullName: string;
          email: string;
          roleAssignments: Array<{ role: UserRole }>;
        }>,
        [CreateUserArgs]
      >()
      .mockResolvedValue({
        id: 2,
        fullName: 'Coordinator',
        email: 'coordinator@example.com',
        roleAssignments: [{ role: UserRole.coordinator }],
      });
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: createUser,
      },
    };
    const service = createService(prisma);

    const result = await service.createUser({
      fullName: 'Coordinator',
      email: 'COORDINATOR@example.com',
      password: 'password123',
      roles: [UserRole.coordinator],
    });

    expect(result).toEqual({
      id: 2,
      fullName: 'Coordinator',
      email: 'coordinator@example.com',
      roles: [UserRole.coordinator],
    });
    expect(result).not.toHaveProperty('passwordHash');
    expect(createUser).toHaveBeenCalledTimes(1);
    const createCall = createUser.mock.calls[0];
    expect(createCall).toBeDefined();
    if (!createCall) {
      throw new Error('Expected the user create mock to be called');
    }
    expect(createCall[0].data.roleAssignments.create).toEqual([
      { role: UserRole.coordinator },
    ]);
  });

  it('replaces roles transactionally', async () => {
    const transaction = jest.fn().mockResolvedValue(undefined);
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(adminUser),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 1,
            fullName: 'Admin User',
            email: 'admin@example.com',
            roleAssignments: [{ role: UserRole.evaluator }],
          },
        ]),
      },
      userRoleAssignment: {
        count: jest.fn().mockResolvedValue(2),
        deleteMany: jest.fn().mockResolvedValue(undefined),
        createMany: jest.fn().mockResolvedValue(undefined),
      },
      $transaction: transaction,
    };
    const service = createService(prisma);

    const result = await service.replaceUserRoles(1, [UserRole.evaluator]);

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(result.roles).toEqual([UserRole.evaluator]);
  });

  it('does not revoke the last admin role', async () => {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(adminUser) },
      userRoleAssignment: { count: jest.fn().mockResolvedValue(1) },
    };
    const service = createService(prisma);

    await expect(service.replaceUserRoles(1, [])).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe('AuthService registration', () => {
  const registeredAt = new Date('2026-09-30T12:00:00.000Z');

  const createdUser = {
    id: 7,
    fullName: 'External Proposer',
    email: 'proposer@example.com',
    isActive: true,
    emailVerifiedAt: null,
    lastLoginAt: registeredAt,
    createdAt: registeredAt,
    updatedAt: registeredAt,
    roleAssignments: [{ role: UserRole.proposer }],
  };

  beforeEach(() => {
    process.env.AUTH_SECRET = 'test-secret-that-is-at-least-32-characters';
  });

  it('registers a proposer with a hashed password and a token', async () => {
    const createUser = jest.fn().mockResolvedValue(createdUser);
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: createUser,
      },
    };
    const service = createService(prisma);

    const result = await service.register({
      fullName: '  External Proposer  ',
      email: '  PROPOSER@example.com ',
      password: 'password123',
    });

    expect(result.user).toEqual({
      id: 7,
      fullName: 'External Proposer',
      email: 'proposer@example.com',
      roles: [UserRole.proposer],
    });
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(result.accessToken.split('.')).toHaveLength(3);

    const [callArguments] = createUser.mock.calls as unknown as [
      [
        {
          data: {
            email: string;
            passwordHash: string;
            roleAssignments: { create: Array<{ role: UserRole }> };
          };
        },
      ],
    ];
    expect(callArguments[0].data.email).toBe('proposer@example.com');
    expect(callArguments[0].data.roleAssignments.create).toEqual([
      { role: UserRole.proposer },
    ]);
    expect(callArguments[0].data.passwordHash).toMatch(
      /^scrypt\$[0-9a-f]+\$[0-9a-f]+$/,
    );
    expect(callArguments[0].data.passwordHash).not.toContain('password123');
  });

  it('rejects an already registered email without creating a user', async () => {
    const createUser = jest.fn();
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 1 }),
        create: createUser,
      },
    };
    const service = createService(prisma);

    await expect(
      service.register({
        fullName: 'Duplicate',
        email: 'admin@example.com',
        password: 'password123',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(createUser).not.toHaveBeenCalled();
  });

  it('maps a unique-constraint race to a clear error', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockRejectedValue(
          new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
            code: 'P2002',
            clientVersion: 'test',
          }),
        ),
      },
    };
    const service = createService(prisma);

    await expect(
      service.register({
        fullName: 'Race',
        email: 'race@example.com',
        password: 'password123',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('AuthService password change', () => {
  const CURRENT_PASSWORD = 'current-password';
  const NEW_PASSWORD = 'new-password-123';

  beforeEach(() => {
    process.env.AUTH_SECRET = 'test-secret-that-is-at-least-32-characters';
  });

  async function createPrismaMock(password: string) {
    const passwordHash = await hashPasswordForTest(password);
    const update = jest.fn().mockResolvedValue(undefined);
    const prisma = {
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 7, isActive: true, passwordHash }),
        update,
      },
    };

    return { prisma, update, passwordHash };
  }

  it('updates the password when the current one matches', async () => {
    const { prisma, update, passwordHash } =
      await createPrismaMock(CURRENT_PASSWORD);
    const service = createService(prisma);

    const result = await service.changePassword(7, {
      currentPassword: CURRENT_PASSWORD,
      newPassword: NEW_PASSWORD,
    });

    expect(result).toEqual({ message: 'Password updated' });
    expect(update).toHaveBeenCalledTimes(1);

    const [callArguments] = update.mock.calls as unknown as [
      [{ data: { passwordHash: string } }],
    ];
    expect(callArguments[0].data.passwordHash).toMatch(
      /^scrypt\$[0-9a-f]+\$[0-9a-f]+$/,
    );
    expect(callArguments[0].data.passwordHash).not.toBe(passwordHash);
    expect(callArguments[0].data.passwordHash).not.toContain(NEW_PASSWORD);
  });

  it('rejects a wrong current password without updating', async () => {
    const { prisma, update } = await createPrismaMock(CURRENT_PASSWORD);
    const service = createService(prisma);

    await expect(
      service.changePassword(7, {
        currentPassword: 'wrong-password',
        newPassword: NEW_PASSWORD,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects a new password equal to the current one', async () => {
    const { prisma, update } = await createPrismaMock(CURRENT_PASSWORD);
    const service = createService(prisma);

    await expect(
      service.changePassword(7, {
        currentPassword: CURRENT_PASSWORD,
        newPassword: CURRENT_PASSWORD,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects inactive or missing users', async () => {
    const service = createService({
      user: { findUnique: jest.fn().mockResolvedValue(null) },
    });

    await expect(
      service.changePassword(99, {
        currentPassword: CURRENT_PASSWORD,
        newPassword: NEW_PASSWORD,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('AuthService tokens', () => {
  const userRecord = {
    id: 7,
    fullName: 'Token User',
    email: 'token@example.com',
    isActive: true,
    emailVerifiedAt: null,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    roleAssignments: [{ role: UserRole.student }],
  };

  function createServiceWithUser() {
    return createService({
      user: { findUnique: jest.fn().mockResolvedValue(userRecord) },
    });
  }

  function createJwt() {
    return new JwtService({
      secret: TEST_AUTH_SECRET,
      signOptions: { algorithm: 'HS256', expiresIn: 60 * 60 },
    });
  }

  it('verifies a token signed with the shared secret', async () => {
    const service = createServiceWithUser();
    const token = createJwt().sign({
      sub: 7,
      email: 'token@example.com',
      fullName: 'Token User',
    });

    await expect(service.verifyAccessToken(token)).resolves.toEqual({
      id: 7,
      fullName: 'Token User',
      email: 'token@example.com',
      roles: [UserRole.student],
    });
  });

  it('rejects an expired token', async () => {
    const service = createServiceWithUser();
    const token = createJwt().sign({ sub: 7 }, { expiresIn: '-1s' });

    await expect(service.verifyAccessToken(token)).rejects.toThrow(
      'Access token expired',
    );
  });

  it('rejects a tampered token', async () => {
    const service = createServiceWithUser();
    const token = createJwt().sign({ sub: 7 });
    const tampered = `${token.slice(0, -2)}${token.endsWith('aa') ? 'bb' : 'aa'}`;

    await expect(service.verifyAccessToken(tampered)).rejects.toThrow(
      'Invalid access token',
    );
  });

  it('does not renew a fresh token', () => {
    const service = createServiceWithUser();
    const token = createJwt().sign({
      sub: 7,
      email: 'token@example.com',
      fullName: 'Token User',
    });

    expect(service.renewAccessTokenIfStale(token, userRecord)).toBeNull();
  });

  it('renews a token past the renewal threshold', () => {
    const service = createServiceWithUser();
    // Sin `expiresIn` por defecto para poder fijar `iat`/`exp` a mano.
    const jwt = new JwtService({ secret: TEST_AUTH_SECRET });
    const now = Math.floor(Date.now() / 1000);
    const staleToken = jwt.sign({
      sub: 7,
      email: 'token@example.com',
      fullName: 'Token User',
      iat: now - 60 * 60 * 13,
      exp: now + 60 * 60 * 11,
    });

    const renewed = service.renewAccessTokenIfStale(staleToken, userRecord);

    expect(renewed).not.toBeNull();
    expect(renewed).not.toBe(staleToken);
    expect(jwt.decode<{ sub?: number }>(renewed!)?.sub).toBe(7);
  });
});
