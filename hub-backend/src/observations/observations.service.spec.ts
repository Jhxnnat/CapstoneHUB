import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ObservationsService } from './observations.service';

describe('ObservationsService', () => {
  const user = {
    id: 4,
    fullName: 'Student',
    email: 'student@example.com',
    roles: [],
  };

  it('stores and returns the authenticated author safely', async () => {
    const observation = {
      id: 1,
      projectId: 10,
      content: 'Weekly report',
      createdAt: new Date(),
      authorUser: {
        id: 4,
        fullName: 'Student',
        email: 'student@example.com',
      },
    };
    const createObservation = jest
      .fn<
        Promise<typeof observation>,
        [
          {
            data: {
              content: string;
              authorUser: { connect: { id: number } };
              project: { connect: { id: number } };
            };
            select: unknown;
          },
        ]
      >()
      .mockResolvedValue(observation);
    const prisma = {
      project: { findUnique: jest.fn().mockResolvedValue({ id: 10 }) },
      projectObservation: {
        create: createObservation,
      },
    };
    const authorization = {
      assertAssignedProjectMember: jest.fn().mockResolvedValue(undefined),
    };
    const service = new ObservationsService(
      prisma as never,
      authorization as never,
    );

    const result = await service.createObservation({
      projectId: 10,
      content: 'Weekly report',
      user,
    });

    expect(createObservation).toHaveBeenCalledTimes(1);
    expect(authorization.assertAssignedProjectMember).toHaveBeenCalledWith(
      user,
      10,
    );
    const createCall = createObservation.mock.calls[0];
    expect(createCall).toBeDefined();
    if (!createCall) {
      throw new Error('Expected the observation create mock to be called');
    }
    expect(createCall[0].data.authorUser).toEqual({ connect: { id: 4 } });
    expect(result.author).toEqual(observation.authorUser);
    expect(result).not.toHaveProperty('authorUser.passwordHash');
  });

  it('returns 404 for a missing project before authorization', async () => {
    const prisma = {
      project: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const assertProjectMember = jest.fn();
    const authorization = { assertProjectMember };
    const service = new ObservationsService(
      prisma as never,
      authorization as never,
    );

    await expect(
      service.observationsByProject(999, user),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(assertProjectMember).not.toHaveBeenCalled();
  });

  it('propagates forbidden project access', async () => {
    const prisma = {
      project: { findUnique: jest.fn().mockResolvedValue({ id: 10 }) },
    };
    const authorization = {
      assertProjectMember: jest
        .fn()
        .mockRejectedValue(new ForbiddenException()),
    };
    const service = new ObservationsService(
      prisma as never,
      authorization as never,
    );

    await expect(
      service.observationsByProject(10, user),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects observation creation for users without a project assignment', async () => {
    const prisma = {
      project: { findUnique: jest.fn().mockResolvedValue({ id: 10 }) },
    };
    const authorization = {
      assertAssignedProjectMember: jest
        .fn()
        .mockRejectedValue(new ForbiddenException()),
    };
    const service = new ObservationsService(
      prisma as never,
      authorization as never,
    );

    await expect(
      service.createObservation({ projectId: 10, content: 'Note', user }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(authorization.assertAssignedProjectMember).toHaveBeenCalledWith(
      user,
      10,
    );
  });
});
