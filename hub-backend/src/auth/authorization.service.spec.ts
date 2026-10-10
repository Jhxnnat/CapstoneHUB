import { ForbiddenException } from '@nestjs/common';
import { ActorRole, ProjectStatus, UserRole } from '../generated/prisma/client';
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

  it('lets the project proposer approve the phase without an assignment', async () => {
    const findAssignment = jest.fn();
    const service = new AuthorizationService({
      projectActorAssignment: { findFirst: findAssignment },
    } as never);

    await expect(
      service.assertCanApproveProjectPhase(user([UserRole.student]), {
        id: 10,
        proposerUserId: 7,
      }),
    ).resolves.toBe('proposer');
    expect(findAssignment).not.toHaveBeenCalled();
  });

  it('lets an assigned evaluator approve the phase', async () => {
    const findAssignment = jest.fn().mockResolvedValue({ id: 3 });
    const service = new AuthorizationService({
      projectActorAssignment: { findFirst: findAssignment },
    } as never);

    await expect(
      service.assertCanApproveProjectPhase(user([UserRole.evaluator]), {
        id: 10,
        proposerUserId: null,
      }),
    ).resolves.toBe('evaluator');
    expect(findAssignment).toHaveBeenCalledWith({
      where: { projectId: 10, userId: 7, role: ActorRole.evaluator },
      select: { id: true },
    });
  });

  it('rejects phase approvals from users who are neither proposer nor assigned evaluator', async () => {
    const service = new AuthorizationService({
      projectActorAssignment: { findFirst: jest.fn().mockResolvedValue(null) },
    } as never);

    await expect(
      service.assertCanApproveProjectPhase(user([UserRole.admin]), {
        id: 10,
        proposerUserId: 999,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  const editableProject = (
    overrides: Partial<{
      id: number;
      proposerUserId: number | null;
      status: ProjectStatus;
    }> = {},
  ) => ({
    id: 10,
    proposerUserId: null,
    status: ProjectStatus.proposed,
    ...overrides,
  });

  it('allows admins to edit project details without an assignment', async () => {
    const findAssignment = jest.fn();
    const service = new AuthorizationService({
      projectActorAssignment: { findFirst: findAssignment },
    } as never);

    await expect(
      service.assertCanEditProjectDetails(
        user([UserRole.admin]),
        editableProject(),
      ),
    ).resolves.toBeUndefined();
    expect(findAssignment).not.toHaveBeenCalled();
  });

  it('allows a global evaluator to edit project details without an assignment', async () => {
    const findAssignment = jest.fn();
    const service = new AuthorizationService({
      projectActorAssignment: { findFirst: findAssignment },
    } as never);

    await expect(
      service.assertCanEditProjectDetails(
        user([UserRole.evaluator]),
        editableProject(),
      ),
    ).resolves.toBeUndefined();
    expect(findAssignment).not.toHaveBeenCalled();
  });

  it.each([UserRole.coordinator, UserRole.advisor])(
    'allows an assigned %s to edit project details',
    async (role) => {
      const findAssignment = jest.fn().mockResolvedValue({ id: 3 });
      const service = new AuthorizationService({
        projectActorAssignment: { findFirst: findAssignment },
      } as never);

      await expect(
        service.assertCanEditProjectDetails(user([role]), editableProject()),
      ).resolves.toBeUndefined();
      expect(findAssignment).toHaveBeenCalledWith({
        where: { projectId: 10, userId: 7, role: { in: [role] } },
        select: { id: true },
      });
    },
  );

  it.each([UserRole.coordinator, UserRole.advisor])(
    'rejects an unassigned %s',
    async (role) => {
      const findAssignment = jest.fn().mockResolvedValue(null);
      const service = new AuthorizationService({
        projectActorAssignment: { findFirst: findAssignment },
      } as never);

      await expect(
        service.assertCanEditProjectDetails(user([role]), editableProject()),
      ).rejects.toBeInstanceOf(ForbiddenException);
    },
  );

  it('rejects a student who is not the proposer', async () => {
    const service = new AuthorizationService({} as never);

    await expect(
      service.assertCanEditProjectDetails(
        user([UserRole.student]),
        editableProject(),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it.each([ProjectStatus.proposed, ProjectStatus.under_review])(
    'allows the proposer to edit while the project is %s',
    async (status) => {
      const service = new AuthorizationService({} as never);

      await expect(
        service.assertCanEditProjectDetails(
          user([UserRole.student]),
          editableProject({ proposerUserId: 7, status }),
        ),
      ).resolves.toBeUndefined();
    },
  );

  it('rejects the proposer once the project leaves the review window', async () => {
    const service = new AuthorizationService({} as never);

    await expect(
      service.assertCanEditProjectDetails(
        user([UserRole.student]),
        editableProject({
          proposerUserId: 7,
          status: ProjectStatus.approved,
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows any assigned project member to create observations', async () => {
    const findAssignment = jest.fn().mockResolvedValue({ id: 4 });
    const prisma = {
      projectActorAssignment: { findFirst: findAssignment },
    };
    const service = new AuthorizationService(prisma as never);

    await expect(
      service.assertAssignedProjectMember(user([UserRole.student]), 10),
    ).resolves.toBeUndefined();
    expect(findAssignment).toHaveBeenCalledWith({
      where: { projectId: 10, userId: 7 },
      select: { id: true },
    });
  });

  it('rejects creating observations without a project assignment, including admins', async () => {
    const findAssignment = jest.fn().mockResolvedValue(null);
    const prisma = {
      projectActorAssignment: { findFirst: findAssignment },
    };
    const service = new AuthorizationService(prisma as never);

    await expect(
      service.assertAssignedProjectMember(user([UserRole.admin]), 10),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(findAssignment).toHaveBeenCalledWith({
      where: { projectId: 10, userId: 7 },
      select: { id: true },
    });
  });

  describe('project visibility', () => {
    function visibilityPrisma(project: unknown) {
      return {
        project: { findUnique: jest.fn().mockResolvedValue(project) },
      };
    }

    it('grants reviewers access without a project assignment', async () => {
      const prisma = visibilityPrisma({
        proposerUserId: 999,
        actorAssignments: [],
      });
      const service = new AuthorizationService(prisma as never);

      await expect(
        service.assertProjectMember(user([UserRole.evaluator]), 10),
      ).resolves.toBeUndefined();
    });

    it('grants the proposer access to their own project', async () => {
      const prisma = visibilityPrisma({
        proposerUserId: 7,
        actorAssignments: [],
      });
      const service = new AuthorizationService(prisma as never);

      await expect(
        service.assertProjectMember(user([UserRole.student]), 10),
      ).resolves.toBeUndefined();
    });

    it('denies access to an unassigned user when the project is private', async () => {
      const prisma = {
        project: {
          findUnique: jest.fn().mockResolvedValue({
            proposerUserId: 999,
            actorAssignments: [],
            status: ProjectStatus.in_progress,
            isPrivate: true,
          }),
        },
      };
      const service = new AuthorizationService(prisma as never);

      await expect(
        service.assertProjectMember(user([UserRole.student]), 10),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('allows anonymous viewers when the project is closed and not private', async () => {
      const prisma = {
        project: {
          findUnique: jest.fn().mockResolvedValue({
            proposerUserId: 999,
            actorAssignments: [],
            status: ProjectStatus.closed,
            isPrivate: false,
          }),
        },
      };
      const service = new AuthorizationService(prisma as never);

      await expect(
        service.assertProjectMember(user([UserRole.student]), 10),
      ).resolves.toBeUndefined();
    });

    it('keeps a private closed project hidden from strangers', async () => {
      const prisma = {
        project: {
          findUnique: jest.fn().mockResolvedValue({
            proposerUserId: 999,
            actorAssignments: [],
            status: ProjectStatus.closed,
            isPrivate: true,
          }),
        },
      };
      const service = new AuthorizationService(prisma as never);

      await expect(
        service.assertProjectMember(user([UserRole.student]), 10),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('limits anonymous listings to closed, non-private projects', () => {
      const service = new AuthorizationService({} as never);

      expect(service.projectVisibilityWhere(undefined)).toEqual({
        isPrivate: false,
        status: ProjectStatus.closed,
      });
    });

    it('lets reviewers list every project', () => {
      const service = new AuthorizationService({} as never);

      expect(service.projectVisibilityWhere(user([UserRole.admin]))).toEqual(
        {},
      );
    });

    it('scopes listings to public, proposed and assigned projects', () => {
      const service = new AuthorizationService({} as never);

      expect(service.projectVisibilityWhere(user([UserRole.student]))).toEqual({
        OR: [
          { isPrivate: false, status: ProjectStatus.closed },
          { proposerUserId: 7 },
          { actorAssignments: { some: { userId: 7 } } },
        ],
      });
    });
  });

  describe('assertCanCreateProject', () => {
    it('allows a self-registered proposer to create projects', () => {
      const service = new AuthorizationService({} as never);

      expect(() =>
        service.assertCanCreateProject(user([UserRole.proposer])),
      ).not.toThrow();
    });

    it('rejects users without any global role', () => {
      const service = new AuthorizationService({} as never);

      expect(() => service.assertCanCreateProject(user([]))).toThrow(
        ForbiddenException,
      );
    });
  });
});
