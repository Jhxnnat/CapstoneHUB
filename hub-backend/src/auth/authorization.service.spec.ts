import { ForbiddenException } from '@nestjs/common';
import { ActorRole, UserRole } from '../generated/prisma/client';
import { AuthorizationService } from './authorization.service';

describe('AuthorizationService', () => {
  const user = (roles: UserRole[]) => ({
    id: 7,
    fullName: 'Test User',
    email: 'test@example.com',
    roles,
  });

  it('allows admins to manage projects without a project assignment', async () => {
    const findAssignment = jest.fn();
    const prisma = { projectActorAssignment: { findFirst: findAssignment } };
    const service = new AuthorizationService(prisma as never);

    await expect(
      service.assertCanManageProject(user([UserRole.admin]), 10),
    ).resolves.toBeUndefined();
    expect(findAssignment).not.toHaveBeenCalled();
  });

  it('requires an evaluator assignment for evaluator transitions', async () => {
    const findAssignment = jest.fn().mockResolvedValue(null);
    const prisma = {
      projectActorAssignment: { findFirst: findAssignment },
    };
    const service = new AuthorizationService(prisma as never);

    await expect(
      service.assertCanTransitionProject(
        user([UserRole.evaluator]),
        10,
        'proposed',
        'under_review',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(findAssignment).toHaveBeenCalledWith({
      where: { projectId: 10, userId: 7, role: ActorRole.evaluator },
      select: { id: true },
    });
  });

  it('rejects inactive or globally incompatible assignees', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 8,
          isActive: false,
          roleAssignments: [{ role: UserRole.student }],
        }),
      },
    };
    const service = new AuthorizationService(prisma as never);

    await expect(
      service.assertAssignableUser(8, ActorRole.coordinator),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('requires a matching coordinator or evaluator assignment for milestones', async () => {
    const findAssignment = jest.fn().mockResolvedValue({ id: 3 });
    const prisma = {
      projectActorAssignment: { findFirst: findAssignment },
    };
    const service = new AuthorizationService(prisma as never);

    await expect(
      service.assertCanManageMilestone(user([UserRole.evaluator]), 10),
    ).resolves.toBeUndefined();
    expect(findAssignment).toHaveBeenCalledWith({
      where: {
        projectId: 10,
        userId: 7,
        role: { in: [ActorRole.evaluator] },
      },
      select: { id: true },
    });
  });

  it('allows admins to manage milestones without a project assignment', async () => {
    const findAssignment = jest.fn();
    const prisma = {
      projectActorAssignment: { findFirst: findAssignment },
    };
    const service = new AuthorizationService(prisma as never);

    await expect(
      service.assertCanManageMilestone(user([UserRole.admin]), 10),
    ).resolves.toBeUndefined();
    expect(findAssignment).not.toHaveBeenCalled();
  });
});
