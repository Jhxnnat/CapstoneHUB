import { BadRequestException } from '@nestjs/common';
import { UserRole } from '../generated/prisma/client';
import { AuthService } from './auth.service';

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
