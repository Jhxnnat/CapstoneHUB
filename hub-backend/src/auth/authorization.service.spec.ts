import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ActorRole, ProjectStatus, UserRole } from '../generated/prisma/client';
import { AuthorizationService } from './authorization.service';

describe('AuthorizationService', () => {
  const user = (roles: UserRole[]) => ({
    id: 7,
    fullName: 'Test User',
    email: 'test@example.com',
    roles,
  });

  /**
   * Construye el servicio con la búsqueda de asignaciones mockeada; `findFirst`
   * resuelve la asignación indicada (`null` por defecto).
   */
  function createService(assignment: { id: number } | null = null) {
    const findAssignment = jest.fn().mockResolvedValue(assignment);
    const service = new AuthorizationService({
      projectActorAssignment: { findFirst: findAssignment },
    } as never);

    return { service, findAssignment };
  }

  it('allows admins to manage projects without a project assignment', async () => {
    const { service, findAssignment } = createService();

    await expect(
      service.assertCanManageProject(user([UserRole.admin]), 10),
    ).resolves.toBeUndefined();
    expect(findAssignment).not.toHaveBeenCalled();
  });

  it('requires a teacher assignment to manage a project', async () => {
    const { service, findAssignment } = createService({ id: 3 });

    await expect(
      service.assertCanManageProject(user([UserRole.teacher]), 10),
    ).resolves.toBeUndefined();
    expect(findAssignment).toHaveBeenCalledWith({
      where: { projectId: 10, userId: 7, role: ActorRole.teacher },
      select: { id: true },
    });
  });

  it('rejects an unassigned teacher from managing a project', async () => {
    const { service } = createService();

    await expect(
      service.assertCanManageProject(user([UserRole.teacher]), 10),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('requires an evaluator assignment for proposal transitions without a directivo role', async () => {
    const { service, findAssignment } = createService({ id: 3 });

    await expect(
      service.assertCanTransitionProject(
        user([UserRole.teacher]),
        10,
        'proposed',
        'approved',
      ),
    ).resolves.toBeUndefined();
    expect(findAssignment).toHaveBeenCalledWith({
      where: { projectId: 10, userId: 7, role: ActorRole.evaluator },
      select: { id: true },
    });
  });

  it('lets a directivo approve a proposal without a project assignment', async () => {
    const { service, findAssignment } = createService();

    await expect(
      service.assertCanTransitionProject(
        user([UserRole.directivo]),
        10,
        'proposed',
        'approved',
      ),
    ).resolves.toBeUndefined();
    expect(findAssignment).not.toHaveBeenCalled();
  });

  it('lets a directivo move a legacy under_review project forward', async () => {
    const { service, findAssignment } = createService();

    await expect(
      service.assertCanTransitionProject(
        user([UserRole.directivo]),
        10,
        'under_review',
        'approved',
      ),
    ).resolves.toBeUndefined();
    expect(findAssignment).not.toHaveBeenCalled();
  });

  it('rejects proposal transitions without an evaluator assignment', async () => {
    const { service, findAssignment } = createService();

    await expect(
      service.assertCanTransitionProject(
        user([UserRole.teacher]),
        10,
        'proposed',
        'approved',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(findAssignment).toHaveBeenCalledWith({
      where: { projectId: 10, userId: 7, role: ActorRole.evaluator },
      select: { id: true },
    });
  });

  it('rejects an unassigned evaluator from resolving proposal transitions', async () => {
    const { service, findAssignment } = createService();

    await expect(
      service.assertCanTransitionProject(
        user([UserRole.evaluator]),
        10,
        'proposed',
        'approved',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(findAssignment).toHaveBeenCalledWith({
      where: { projectId: 10, userId: 7, role: ActorRole.evaluator },
      select: { id: true },
    });
  });

  it('lets an assigned evaluator resolve proposal transitions', async () => {
    const { service, findAssignment } = createService({ id: 3 });

    await expect(
      service.assertCanTransitionProject(
        user([UserRole.evaluator]),
        10,
        'proposed',
        'approved',
      ),
    ).resolves.toBeUndefined();
    expect(findAssignment).toHaveBeenCalledWith({
      where: { projectId: 10, userId: 7, role: ActorRole.evaluator },
      select: { id: true },
    });
  });

  it('requires a teacher assignment for post-approval transitions', async () => {
    const { service, findAssignment } = createService({ id: 3 });

    await expect(
      service.assertCanTransitionProject(
        user([UserRole.teacher]),
        10,
        'approved',
        'in_progress',
      ),
    ).resolves.toBeUndefined();
    expect(findAssignment).toHaveBeenCalledWith({
      where: { projectId: 10, userId: 7, role: ActorRole.teacher },
      select: { id: true },
    });
  });

  describe('assertAssignableUser', () => {
    const userWith = (overrides: Record<string, unknown>) =>
      ({
        id: 8,
        isActive: true,
        roleAssignments: [{ role: UserRole.student }],
        ...overrides,
      }) as never;

    /** Servicio con la búsqueda de usuarios de `assertAssignableUser` mockeada. */
    function userService(candidate: unknown) {
      const prisma = {
        user: { findUnique: jest.fn().mockResolvedValue(candidate) },
      };

      return new AuthorizationService(prisma as never);
    }

    it('rejects inactive users', async () => {
      const service = userService(userWith({ isActive: false }));

      await expect(
        service.assertAssignableUser(8, ActorRole.teacher),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects users whose global role does not license the actor role', async () => {
      const service = userService(userWith({}));

      await expect(
        service.assertAssignableUser(8, ActorRole.teacher),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('allows teachers to be assigned as project evaluators', async () => {
      const service = userService(
        userWith({ roleAssignments: [{ role: UserRole.teacher }] }),
      );

      await expect(
        service.assertAssignableUser(8, ActorRole.evaluator),
      ).resolves.toBeUndefined();
    });

    it.each([UserRole.evaluator, UserRole.directivo])(
      'allows %s users to be assigned as project evaluators',
      async (role) => {
        const service = userService(userWith({ roleAssignments: [{ role }] }));

        await expect(
          service.assertAssignableUser(8, ActorRole.evaluator),
        ).resolves.toBeUndefined();
      },
    );

    it('allows students to be assigned as students', async () => {
      const service = userService(userWith({}));

      await expect(
        service.assertAssignableUser(8, ActorRole.student),
      ).resolves.toBeUndefined();
    });

    it('rejects missing users', async () => {
      const service = userService(null);

      await expect(
        service.assertAssignableUser(999, ActorRole.student),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  it('requires an assigned teacher or evaluator for milestones', async () => {
    const { service, findAssignment } = createService({ id: 3 });

    await expect(
      service.assertCanManageMilestone(user([UserRole.teacher]), 10),
    ).resolves.toBeUndefined();
    expect(findAssignment).toHaveBeenCalledWith({
      where: {
        projectId: 10,
        userId: 7,
        role: { in: [ActorRole.teacher, ActorRole.evaluator] },
      },
      select: { id: true },
    });
  });

  it('allows admins to manage milestones without a project assignment', async () => {
    const { service, findAssignment } = createService();

    await expect(
      service.assertCanManageMilestone(user([UserRole.admin]), 10),
    ).resolves.toBeUndefined();
    expect(findAssignment).not.toHaveBeenCalled();
  });

  it('rejects an unassigned directivo for milestones', async () => {
    const { service } = createService();

    await expect(
      service.assertCanManageMilestone(user([UserRole.directivo]), 10),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows admins to manage reports without a project assignment', async () => {
    const { service, findAssignment } = createService();

    await expect(
      service.assertCanManageReports(user([UserRole.admin]), 10),
    ).resolves.toBeUndefined();
    expect(findAssignment).not.toHaveBeenCalled();
  });

  it('allows directivos to manage reports without a project assignment', async () => {
    const { service, findAssignment } = createService();

    await expect(
      service.assertCanManageReports(user([UserRole.directivo]), 10),
    ).resolves.toBeUndefined();
    expect(findAssignment).not.toHaveBeenCalled();
  });

  it('rejects an unassigned evaluator from managing reports', async () => {
    const { service, findAssignment } = createService();

    await expect(
      service.assertCanManageReports(user([UserRole.evaluator]), 10),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(findAssignment).toHaveBeenCalledWith({
      where: {
        projectId: 10,
        userId: 7,
        role: { in: [ActorRole.teacher, ActorRole.evaluator] },
      },
      select: { id: true },
    });
  });

  it('lets an assigned evaluator manage reports', async () => {
    const { service } = createService({ id: 3 });

    await expect(
      service.assertCanManageReports(user([UserRole.evaluator]), 10),
    ).resolves.toBeUndefined();
  });

  it('requires an assigned teacher or evaluator to manage reports', async () => {
    const { service, findAssignment } = createService({ id: 3 });

    await expect(
      service.assertCanManageReports(user([UserRole.teacher]), 10),
    ).resolves.toBeUndefined();
    expect(findAssignment).toHaveBeenCalledWith({
      where: {
        projectId: 10,
        userId: 7,
        role: { in: [ActorRole.teacher, ActorRole.evaluator] },
      },
      select: { id: true },
    });
  });

  it('rejects an unassigned teacher from managing reports', async () => {
    const { service } = createService();

    await expect(
      service.assertCanManageReports(user([UserRole.teacher]), 10),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows admins to assign actors without a project assignment', async () => {
    const { service, findAssignment } = createService();

    await expect(
      service.assertCanAssignActors(user([UserRole.admin]), 10),
    ).resolves.toBeUndefined();
    expect(findAssignment).not.toHaveBeenCalled();
  });

  it('allows directivos to assign actors without a project assignment', async () => {
    const { service, findAssignment } = createService();

    await expect(
      service.assertCanAssignActors(user([UserRole.directivo]), 10),
    ).resolves.toBeUndefined();
    expect(findAssignment).not.toHaveBeenCalled();
  });

  it('rejects an unassigned evaluator from assigning actors', async () => {
    const { service } = createService();

    await expect(
      service.assertCanAssignActors(user([UserRole.evaluator]), 10),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('requires a teacher assignment for other users to assign actors', async () => {
    const { service, findAssignment } = createService({ id: 3 });

    await expect(
      service.assertCanAssignActors(user([UserRole.teacher]), 10),
    ).resolves.toBeUndefined();
    expect(findAssignment).toHaveBeenCalledWith({
      where: { projectId: 10, userId: 7, role: ActorRole.teacher },
      select: { id: true },
    });
  });

  it('rejects an unassigned teacher from assigning actors', async () => {
    const { service } = createService();

    await expect(
      service.assertCanAssignActors(user([UserRole.teacher]), 10),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lets the project proposer approve the phase without an assignment', async () => {
    const { service, findAssignment } = createService();

    await expect(
      service.assertCanApproveProjectPhase(user([UserRole.student]), {
        id: 10,
        proposerUserId: 7,
      }),
    ).resolves.toBe('proposer');
    expect(findAssignment).not.toHaveBeenCalled();
  });

  it('lets an assigned evaluator approve the phase', async () => {
    const { service, findAssignment } = createService({ id: 3 });

    await expect(
      service.assertCanApproveProjectPhase(user([UserRole.teacher]), {
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
    const { service } = createService();

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
    const { service, findAssignment } = createService();

    await expect(
      service.assertCanEditProjectDetails(
        user([UserRole.admin]),
        editableProject(),
      ),
    ).resolves.toBeUndefined();
    expect(findAssignment).not.toHaveBeenCalled();
  });

  it('allows a directivo to edit project details without an assignment', async () => {
    const { service, findAssignment } = createService();

    await expect(
      service.assertCanEditProjectDetails(
        user([UserRole.directivo]),
        editableProject(),
      ),
    ).resolves.toBeUndefined();
    expect(findAssignment).not.toHaveBeenCalled();
  });

  it('allows an assigned teacher to edit project details', async () => {
    const { service, findAssignment } = createService({ id: 3 });

    await expect(
      service.assertCanEditProjectDetails(
        user([UserRole.teacher]),
        editableProject(),
      ),
    ).resolves.toBeUndefined();
    expect(findAssignment).toHaveBeenCalledWith({
      where: {
        projectId: 10,
        userId: 7,
        role: { in: [ActorRole.teacher, ActorRole.evaluator] },
      },
      select: { id: true },
    });
  });

  it('allows a teacher assigned as evaluator to edit project details', async () => {
    const { service } = createService({ id: 3 });

    await expect(
      service.assertCanEditProjectDetails(
        user([UserRole.teacher]),
        editableProject(),
      ),
    ).resolves.toBeUndefined();
  });

  it('rejects an unassigned teacher', async () => {
    const { service } = createService();

    await expect(
      service.assertCanEditProjectDetails(
        user([UserRole.teacher]),
        editableProject(),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a student who is not the proposer', async () => {
    const { service } = createService();

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
      const { service } = createService();

      await expect(
        service.assertCanEditProjectDetails(
          user([UserRole.student]),
          editableProject({ proposerUserId: 7, status }),
        ),
      ).resolves.toBeUndefined();
    },
  );

  it('rejects the proposer once the project leaves the review window', async () => {
    const { service } = createService();

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

  it('allows any assigned project member to comment', async () => {
    const { service, findAssignment } = createService({ id: 4 });

    await expect(
      service.assertCanComment(user([UserRole.student]), 10),
    ).resolves.toBeUndefined();
    expect(findAssignment).toHaveBeenCalledWith({
      where: { projectId: 10, userId: 7 },
      select: { id: true },
    });
  });

  it('allows admins to comment without a project assignment', async () => {
    const { service, findAssignment } = createService();

    await expect(
      service.assertCanComment(user([UserRole.admin]), 10),
    ).resolves.toBeUndefined();
    expect(findAssignment).not.toHaveBeenCalled();
  });

  it('allows directivos to comment without a project assignment', async () => {
    const { service, findAssignment } = createService();

    await expect(
      service.assertCanComment(user([UserRole.directivo]), 10),
    ).resolves.toBeUndefined();
    expect(findAssignment).not.toHaveBeenCalled();
  });

  it('rejects an unassigned evaluator from commenting', async () => {
    const { service, findAssignment } = createService();

    await expect(
      service.assertCanComment(user([UserRole.evaluator]), 10),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(findAssignment).toHaveBeenCalledWith({
      where: { projectId: 10, userId: 7 },
      select: { id: true },
    });
  });

  it('rejects commenting without a project assignment', async () => {
    const { service, findAssignment } = createService();

    await expect(
      service.assertCanComment(user([UserRole.teacher]), 10),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(findAssignment).toHaveBeenCalledWith({
      where: { projectId: 10, userId: 7 },
      select: { id: true },
    });
  });

  it('allows admins to submit reports without a project assignment', async () => {
    const { service, findAssignment } = createService();

    await expect(
      service.assertCanSubmitReports(user([UserRole.admin]), 10),
    ).resolves.toBeUndefined();
    expect(findAssignment).not.toHaveBeenCalled();
  });

  it('allows assigned students to submit reports', async () => {
    const { service, findAssignment } = createService({ id: 5 });

    await expect(
      service.assertCanSubmitReports(user([UserRole.student]), 10),
    ).resolves.toBeUndefined();
    expect(findAssignment).toHaveBeenCalledWith({
      where: { projectId: 10, userId: 7, role: ActorRole.student },
      select: { id: true },
    });
  });

  it('rejects reports from users without a student assignment', async () => {
    const { service, findAssignment } = createService();

    await expect(
      service.assertCanSubmitReports(user([UserRole.teacher]), 10),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(findAssignment).toHaveBeenCalledWith({
      where: { projectId: 10, userId: 7, role: ActorRole.student },
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
      const service = new AuthorizationService(
        visibilityPrisma({
          proposerUserId: 999,
          actorAssignments: [],
        }) as never,
      );

      await expect(
        service.assertProjectMember(user([UserRole.directivo]), 10),
      ).resolves.toBeUndefined();
    });

    it('keeps evaluators scoped to their own or assigned projects', async () => {
      const service = new AuthorizationService(
        visibilityPrisma({
          proposerUserId: 999,
          actorAssignments: [],
          status: ProjectStatus.in_progress,
          isPrivate: true,
        }) as never,
      );

      await expect(
        service.assertProjectMember(user([UserRole.evaluator]), 10),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('keeps teachers scoped to their own or assigned projects', async () => {
      const service = new AuthorizationService(
        visibilityPrisma({
          proposerUserId: 999,
          actorAssignments: [],
          status: ProjectStatus.in_progress,
          isPrivate: true,
        }) as never,
      );

      await expect(
        service.assertProjectMember(user([UserRole.teacher]), 10),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('grants the proposer access to their own project', async () => {
      const service = new AuthorizationService(
        visibilityPrisma({
          proposerUserId: 7,
          actorAssignments: [],
        }) as never,
      );

      await expect(
        service.assertProjectMember(user([UserRole.student]), 10),
      ).resolves.toBeUndefined();
    });

    it('denies access to an unassigned user when the project is private', async () => {
      const service = new AuthorizationService(
        visibilityPrisma({
          proposerUserId: 999,
          actorAssignments: [],
          status: ProjectStatus.in_progress,
          isPrivate: true,
        }) as never,
      );

      await expect(
        service.assertProjectMember(user([UserRole.student]), 10),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects non-members even when the project is public', async () => {
      const service = new AuthorizationService(
        visibilityPrisma({
          proposerUserId: 999,
          actorAssignments: [],
          status: ProjectStatus.closed,
          isPrivate: false,
        }) as never,
      );

      await expect(
        service.assertProjectMember(user([UserRole.student]), 10),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('keeps a private closed project hidden from strangers', async () => {
      const service = new AuthorizationService(
        visibilityPrisma({
          proposerUserId: 999,
          actorAssignments: [],
          status: ProjectStatus.closed,
          isPrivate: true,
        }) as never,
      );

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

    it('scopes teacher listings to public, own and assigned projects', () => {
      const service = new AuthorizationService({} as never);

      expect(service.projectVisibilityWhere(user([UserRole.teacher]))).toEqual({
        OR: [
          {
            isPrivate: false,
            status: {
              in: [
                ProjectStatus.approved,
                ProjectStatus.in_progress,
                ProjectStatus.paused,
                ProjectStatus.closed,
              ],
            },
          },
          { proposerUserId: 7 },
          { actorAssignments: { some: { userId: 7 } } },
          { interests: { some: { userId: 7 } } },
        ],
      });
    });

    it('adds approved private projects to student listings', () => {
      const service = new AuthorizationService({} as never);

      expect(service.projectVisibilityWhere(user([UserRole.student]))).toEqual({
        OR: [
          {
            isPrivate: false,
            status: {
              in: [
                ProjectStatus.approved,
                ProjectStatus.in_progress,
                ProjectStatus.paused,
                ProjectStatus.closed,
              ],
            },
          },
          { proposerUserId: 7 },
          { actorAssignments: { some: { userId: 7 } } },
          { interests: { some: { userId: 7 } } },
          { isPrivate: true, status: ProjectStatus.approved },
        ],
      });
    });

    it('does not add the private-approved condition for teachers', () => {
      const service = new AuthorizationService({} as never);

      const where = service.projectVisibilityWhere(
        user([UserRole.teacher]),
      ) as { OR: unknown[] };

      expect(where.OR).not.toContainEqual({
        isPrivate: true,
        status: ProjectStatus.approved,
      });
    });

    it('lets students express interest in approved projects they do not own', () => {
      const service = new AuthorizationService({} as never);

      expect(
        service.canExpressInterest(user([UserRole.student]), {
          status: ProjectStatus.approved,
          proposerUserId: 999,
          actorAssignments: [],
        }),
      ).toBe(true);
    });

    it('rejects interest from non-students, reviewers and project members', () => {
      const service = new AuthorizationService({} as never);
      const project = {
        status: ProjectStatus.approved,
        proposerUserId: 999,
        actorAssignments: [],
      };

      expect(
        service.canExpressInterest(user([UserRole.teacher]), project),
      ).toBe(false);
      expect(
        service.canExpressInterest(
          user([UserRole.student, UserRole.directivo]),
          project,
        ),
      ).toBe(false);
      expect(
        service.canExpressInterest(user([UserRole.student]), {
          ...project,
          proposerUserId: 7,
        }),
      ).toBe(false);
      expect(
        service.canExpressInterest(user([UserRole.student]), {
          ...project,
          actorAssignments: [{ userId: 7 }],
        }),
      ).toBe(false);
    });

    it('rejects interest when the project is not approved', () => {
      const service = new AuthorizationService({} as never);

      expect(
        service.canExpressInterest(user([UserRole.student]), {
          status: ProjectStatus.in_progress,
          proposerUserId: 999,
          actorAssignments: [],
        }),
      ).toBe(false);
    });

    it('exposes the pure membership check for loaded projects', () => {
      const service = new AuthorizationService({} as never);
      const project = {
        proposerUserId: 999,
        actorAssignments: [{ userId: 7 }],
      };

      expect(
        service.canViewProjectData(user([UserRole.teacher]), project),
      ).toBe(true);
      expect(
        service.canViewProjectData(user([UserRole.student]), project),
      ).toBe(true);
      expect(
        service.canViewProjectData(user([UserRole.student]), {
          proposerUserId: 999,
          actorAssignments: [],
        }),
      ).toBe(false);
    });
  });

  describe('assertCanWriteProjectData', () => {
    function writePrisma(project: unknown) {
      return {
        project: { findUnique: jest.fn().mockResolvedValue(project) },
      };
    }

    it('allows admins without a project assignment', async () => {
      const service = new AuthorizationService(writePrisma(null) as never);

      await expect(
        service.assertCanWriteProjectData(user([UserRole.admin]), 10),
      ).resolves.toBeUndefined();
    });

    it('allows the project proposer', async () => {
      const service = new AuthorizationService(
        writePrisma({ proposerUserId: 7, actorAssignments: [] }) as never,
      );

      await expect(
        service.assertCanWriteProjectData(user([UserRole.student]), 10),
      ).resolves.toBeUndefined();
    });

    it('allows an assigned actor', async () => {
      const service = new AuthorizationService(
        writePrisma({
          proposerUserId: 999,
          actorAssignments: [{ userId: 7 }],
        }) as never,
      );

      await expect(
        service.assertCanWriteProjectData(user([UserRole.student]), 10),
      ).resolves.toBeUndefined();
    });

    it('rejects an unassigned directivo', async () => {
      const service = new AuthorizationService(
        writePrisma({ proposerUserId: 999, actorAssignments: [] }) as never,
      );

      await expect(
        service.assertCanWriteProjectData(user([UserRole.directivo]), 10),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects an unassigned user even when the project is public', async () => {
      const service = new AuthorizationService(
        writePrisma({ proposerUserId: 999, actorAssignments: [] }) as never,
      );

      await expect(
        service.assertCanWriteProjectData(user([UserRole.student]), 10),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects writes to a missing project', async () => {
      const service = new AuthorizationService(writePrisma(null) as never);

      await expect(
        service.assertCanWriteProjectData(user([UserRole.student]), 10),
      ).rejects.toBeInstanceOf(NotFoundException);
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

  describe('rubric and evaluation permissions', () => {
    it.each([UserRole.admin, UserRole.directivo])(
      'allows %s users to manage rubrics',
      (role) => {
        const service = new AuthorizationService({} as never);

        expect(() =>
          service.assertCanManageRubrics(user([role])),
        ).not.toThrow();
      },
    );

    it('rejects evaluators and teachers from managing rubrics', () => {
      const service = new AuthorizationService({} as never);

      expect(() =>
        service.assertCanManageRubrics(user([UserRole.evaluator])),
      ).toThrow(ForbiddenException);
      expect(() =>
        service.assertCanManageRubrics(user([UserRole.teacher])),
      ).toThrow(ForbiddenException);
    });

    it('lets directivos view evaluations without a project assignment', async () => {
      const { service, findAssignment } = createService();

      await expect(
        service.assertCanViewProjectEvaluations(user([UserRole.directivo]), 10),
      ).resolves.toBeUndefined();
      expect(findAssignment).not.toHaveBeenCalled();
    });

    it('requires an evaluator assignment to view evaluations', async () => {
      const { service, findAssignment } = createService({ id: 3 });

      await expect(
        service.assertCanViewProjectEvaluations(user([UserRole.evaluator]), 10),
      ).resolves.toBeUndefined();
      expect(findAssignment).toHaveBeenCalledWith({
        where: { projectId: 10, userId: 7, role: ActorRole.evaluator },
        select: { id: true },
      });
    });

    it('rejects teachers from viewing project evaluations', async () => {
      const { service } = createService();

      await expect(
        service.assertCanViewProjectEvaluations(user([UserRole.teacher]), 10),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('does not let an unassigned directivo submit an evaluation', async () => {
      const { service } = createService();

      await expect(
        service.assertCanSubmitProjectEvaluation(
          user([UserRole.directivo]),
          10,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('lets an admin or assigned evaluator submit an evaluation', async () => {
      const adminService = createService().service;
      await expect(
        adminService.assertCanSubmitProjectEvaluation(
          user([UserRole.admin]),
          10,
        ),
      ).resolves.toBeUndefined();

      const evaluatorService = createService({ id: 3 }).service;
      await expect(
        evaluatorService.assertCanSubmitProjectEvaluation(
          user([UserRole.evaluator]),
          10,
        ),
      ).resolves.toBeUndefined();
    });
  });

  describe('assertCanViewKpis', () => {
    it.each([
      UserRole.admin,
      UserRole.teacher,
      UserRole.evaluator,
      UserRole.directivo,
    ])('allows %s users', (role) => {
      const service = new AuthorizationService({} as never);

      expect(() => service.assertCanViewKpis(user([role]))).not.toThrow();
    });

    it('rejects users without an authorized role', () => {
      const service = new AuthorizationService({} as never);

      expect(() => service.assertCanViewKpis(user([UserRole.student]))).toThrow(
        ForbiddenException,
      );
    });
  });
});
