import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { randomBytes, scrypt as scryptCallback } from 'crypto';
import { promisify } from 'util';
import { Prisma, UserRole } from '../generated/prisma/client';
import { AuthService } from './auth.service';

const scrypt = promisify(scryptCallback);

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
    const service = new AuthService(prisma as never);

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
    const service = new AuthService(prisma as never);

    const result = await service.replaceUserRoles(1, [UserRole.evaluator]);

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(result.roles).toEqual([UserRole.evaluator]);
  });

  it('does not revoke the last admin role', async () => {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(adminUser) },
      userRoleAssignment: { count: jest.fn().mockResolvedValue(1) },
    };
    const service = new AuthService(prisma as never);

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
    const service = new AuthService(prisma as never);

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
    const service = new AuthService(prisma as never);

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
    const service = new AuthService(prisma as never);

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
    const service = new AuthService(prisma as never);

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
    const service = new AuthService(prisma as never);

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
    const service = new AuthService(prisma as never);

    await expect(
      service.changePassword(7, {
        currentPassword: CURRENT_PASSWORD,
        newPassword: CURRENT_PASSWORD,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects inactive or missing users', async () => {
    const service = new AuthService({
      user: { findUnique: jest.fn().mockResolvedValue(null) },
    } as never);

    await expect(
      service.changePassword(99, {
        currentPassword: CURRENT_PASSWORD,
        newPassword: NEW_PASSWORD,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
