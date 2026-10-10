import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  DEFAULT_FINAL_MILESTONE_TITLE,
  diffProjectUpdate,
  isValidProjectStatusTransition,
  ProjectsService,
} from './projects.service';
import { AuthorizationService } from '../auth/authorization.service';
import { PrismaService } from '../prisma.service';
import { ProjectStatus } from '../generated/prisma/client';
import {
  ActorRole,
  ProjectPhase,
  ProjectSource,
  ReportContentKind,
  UserRole,
} from '../generated/prisma/client';

const ADMIN_USER = {
  id: 1,
  fullName: 'Admin',
  email: 'admin@example.com',
  roles: [UserRole.admin],
};

const EVALUATOR_USER = {
  id: 4,
  fullName: 'Evaluator',
  email: 'evaluator@example.com',
  roles: [UserRole.evaluator],
};

function createProjectDetail() {
  return {
    id: 10,
    name: 'Project',
    status: ProjectStatus.under_review,
    phase: ProjectPhase.semester_1,
    proposer: null,
    actors: [],
    description: 'Description',
    context: 'Context',
    location: null,
    requiresLegalization: false,
    isPrivate: true,
    canViewSensitiveData: true,
    source: ProjectSource.external_entity,
    sourceDetails: null,
    facultyAdvisor: null,
    teamRequirements: null,
    expectedOutcomes: null,
    isProposer: false,
    phaseApprovals: { nextPhase: ProjectPhase.semester_2, required: [] },
    deliverables: [],
    startDate: new Date(),
    endDate: null,
    estimatedCost: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    observations: [],
    actorAssignments: [],
    milestones: [],
    statusHistory: [],
    changeHistory: [],
    attachments: [],
    reports: [],
  };
}

function createPrismaMock() {
  const projectUpdate = jest.fn().mockResolvedValue(undefined);
  const historyCreate = jest.fn().mockResolvedValue(undefined);
  type Transaction = {
    project: { update: typeof projectUpdate };
    projectStatusHistory: { create: typeof historyCreate };
  };
  const transaction: Transaction = {
    project: { update: projectUpdate },
    projectStatusHistory: { create: historyCreate },
  };

  const findUnique = jest
    .fn()
    .mockResolvedValue({ id: 10, status: ProjectStatus.proposed });
  const milestoneFindMany = jest.fn().mockResolvedValue([]);

  const prisma = {
    project: { findUnique },
    projectMilestones: { findMany: milestoneFindMany },
    $transaction: jest.fn((callback: (transaction: Transaction) => unknown) =>
      callback(transaction),
    ),
  };

  return { prisma, projectUpdate, historyCreate, milestoneFindMany };
}

function createAuthorizationMock() {
  return {
    assertCanTransitionProject: jest.fn().mockResolvedValue(undefined),
    assertCanManageProject: jest.fn().mockResolvedValue(undefined),
    assertCanAssignActors: jest.fn().mockResolvedValue(undefined),
    assertAssignableUser: jest.fn().mockResolvedValue(undefined),
    assertCanEditProjectDetails: jest.fn().mockResolvedValue(undefined),
    assertCanApproveProjectPhase: jest.fn().mockResolvedValue('proposer'),
    projectVisibilityWhere: jest.fn().mockReturnValue({}),
  };
}

function createService(
  prisma: unknown,
  authorization: unknown,
): ProjectsService {
  return new ProjectsService(prisma as never, authorization as never);
}

function createAdvancePrismaMock(options?: {
  status?: ProjectStatus;
  phase?: ProjectPhase;
  proposerUserId?: number | null;
  proposerFullName?: string;
  evaluators?: { userId: number; fullName: string }[];
  approvedUserIds?: number[];
}) {
  const projectUpdate = jest.fn().mockResolvedValue(undefined);
  const changeCreate = jest.fn().mockResolvedValue(undefined);
  const approvalUpsert = jest.fn().mockResolvedValue(undefined);
  const approvalDeleteMany = jest.fn().mockResolvedValue({ count: 1 });
  const transaction = {
    project: { update: projectUpdate },
    projectChangeHistory: { create: changeCreate },
  };
  const findUnique = jest.fn().mockResolvedValue({
    id: 10,
    status: options?.status ?? ProjectStatus.in_progress,
    phase: options?.phase ?? ProjectPhase.semester_1,
    proposerUserId: options?.proposerUserId ?? null,
    proposer:
      options?.proposerFullName != null
        ? { fullName: options.proposerFullName }
        : null,
    actorAssignments: (options?.evaluators ?? []).map((evaluator) => ({
      userId: evaluator.userId,
      user: { fullName: evaluator.fullName },
    })),
    phaseApprovals: (options?.approvedUserIds ?? []).map((userId) => ({
      phase: ProjectPhase.semester_2,
      approverUserId: userId,
    })),
  });
  const milestoneFindMany = jest.fn().mockResolvedValue([]);
  const prisma = {
    project: { findUnique },
    projectMilestones: { findMany: milestoneFindMany },
    projectPhaseApproval: {
      upsert: approvalUpsert,
      deleteMany: approvalDeleteMany,
    },
    $transaction: jest.fn((callback: (value: unknown) => unknown) =>
      callback(transaction),
    ),
  };

  return {
    prisma,
    projectUpdate,
    changeCreate,
    milestoneFindMany,
    approvalUpsert,
    approvalDeleteMany,
  };
}

describe('ProjectsService', () => {
  let service: ProjectsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: PrismaService, useValue: {} },
        { provide: AuthorizationService, useValue: {} },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it.each([
    [ProjectStatus.proposed, ProjectStatus.under_review],
    [ProjectStatus.proposed, ProjectStatus.rejected],
    [ProjectStatus.under_review, ProjectStatus.approved],
    [ProjectStatus.under_review, ProjectStatus.rejected],
    [ProjectStatus.approved, ProjectStatus.in_progress],
    [ProjectStatus.approved, ProjectStatus.rejected],
    [ProjectStatus.in_progress, ProjectStatus.paused],
    [ProjectStatus.in_progress, ProjectStatus.closed],
    [ProjectStatus.in_progress, ProjectStatus.cancelled],
    [ProjectStatus.paused, ProjectStatus.in_progress],
    [ProjectStatus.paused, ProjectStatus.cancelled],
  ])('accepts valid transition %s -> %s', (previousStatus, nextStatus) => {
    expect(isValidProjectStatusTransition(previousStatus, nextStatus)).toBe(
      true,
    );
  });

  it.each([
    [ProjectStatus.proposed, ProjectStatus.approved],
    [ProjectStatus.under_review, ProjectStatus.in_progress],
    [ProjectStatus.approved, ProjectStatus.closed],
    [ProjectStatus.in_progress, ProjectStatus.rejected],
    [ProjectStatus.paused, ProjectStatus.closed],
    [ProjectStatus.paused, ProjectStatus.rejected],
    [ProjectStatus.closed, ProjectStatus.rejected],
    [ProjectStatus.cancelled, ProjectStatus.in_progress],
    [ProjectStatus.rejected, ProjectStatus.proposed],
  ])('rejects invalid transition %s -> %s', (previousStatus, nextStatus) => {
    expect(isValidProjectStatusTransition(previousStatus, nextStatus)).toBe(
      false,
    );
  });

  it('updates status and history in the same transaction', async () => {
    const { prisma, projectUpdate, historyCreate } = createPrismaMock();
    const authorization = createAuthorizationMock();
    const service = createService(prisma, authorization);
    jest.spyOn(service, 'project').mockResolvedValue(createProjectDetail());

    await service.transitionProjectStatus({
      user: EVALUATOR_USER,
      projectId: 10,
      nextStatus: ProjectStatus.under_review,
      description: 'Initial review',
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(projectUpdate).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { status: ProjectStatus.under_review },
    });
    expect(historyCreate).toHaveBeenCalledWith({
      data: {
        projectId: 10,
        previousStatus: ProjectStatus.proposed,
        nextStatus: ProjectStatus.under_review,
        description: 'Initial review',
        authorUserId: 4,
      },
    });
  });

  it('requires a reason for non-admin status changes', async () => {
    const { prisma } = createPrismaMock();
    const authorization = createAuthorizationMock();
    const service = createService(prisma, authorization);

    await expect(
      service.transitionProjectStatus({
        user: EVALUATOR_USER,
        projectId: 10,
        nextStatus: ProjectStatus.under_review,
      }),
    ).rejects.toThrow('A reason is required');
  });

  it('allows admin status changes without a reason', async () => {
    const { prisma, historyCreate } = createPrismaMock();
    const authorization = createAuthorizationMock();
    const service = createService(prisma, authorization);
    jest.spyOn(service, 'project').mockResolvedValue(createProjectDetail());

    await service.transitionProjectStatus({
      user: ADMIN_USER,
      projectId: 10,
      nextStatus: ProjectStatus.under_review,
    });

    expect(historyCreate).toHaveBeenCalledWith({
      data: {
        projectId: 10,
        previousStatus: ProjectStatus.proposed,
        nextStatus: ProjectStatus.under_review,
        description: null,
        authorUserId: 1,
      },
    });
  });

  it('rejects invalid transitions before authorization checks', async () => {
    const { prisma } = createPrismaMock();
    const authorization = createAuthorizationMock();
    const service = createService(prisma, authorization);

    await expect(
      service.transitionProjectStatus({
        user: ADMIN_USER,
        projectId: 10,
        nextStatus: ProjectStatus.approved,
      }),
    ).rejects.toThrow('Invalid project status transition');
    expect(authorization.assertCanTransitionProject).not.toHaveBeenCalled();
  });

  it('blocks closing a project while minimum milestones are incomplete', async () => {
    const { prisma, projectUpdate, milestoneFindMany } = createPrismaMock();
    prisma.project.findUnique.mockResolvedValue({
      id: 10,
      status: ProjectStatus.in_progress,
    });
    milestoneFindMany.mockResolvedValue([{ id: 1, title: 'Informe final' }]);
    const service = createService(prisma, createAuthorizationMock());

    await expect(
      service.transitionProjectStatus({
        user: EVALUATOR_USER,
        projectId: 10,
        nextStatus: ProjectStatus.closed,
        description: 'Cerrar el proyecto',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(projectUpdate).not.toHaveBeenCalled();
  });

  it('closes a project when its minimum milestones are complete', async () => {
    const { prisma, projectUpdate } = createPrismaMock();
    prisma.project.findUnique.mockResolvedValue({
      id: 10,
      status: ProjectStatus.in_progress,
    });
    const service = createService(prisma, createAuthorizationMock());
    jest.spyOn(service, 'project').mockResolvedValue(createProjectDetail());

    await service.transitionProjectStatus({
      user: EVALUATOR_USER,
      projectId: 10,
      nextStatus: ProjectStatus.closed,
      description: 'Cerrar el proyecto',
    });

    expect(projectUpdate).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { status: ProjectStatus.closed },
    });
  });

  it('advances the project phase and records it in the change history', async () => {
    const { prisma, projectUpdate, changeCreate } = createAdvancePrismaMock();
    const authorization = createAuthorizationMock();
    const service = createService(prisma, authorization);
    jest.spyOn(service, 'project').mockResolvedValue(createProjectDetail());

    await service.advanceProjectPhase({ user: ADMIN_USER, projectId: 10 });

    expect(authorization.assertCanManageProject).toHaveBeenCalledWith(
      ADMIN_USER,
      10,
    );
    expect(projectUpdate).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { phase: ProjectPhase.semester_2 },
    });
    expect(changeCreate).toHaveBeenCalledWith({
      data: {
        projectId: 10,
        authorUserId: ADMIN_USER.id,
        field: 'phase',
        previousValue: ProjectPhase.semester_1,
        newValue: ProjectPhase.semester_2,
      },
    });
  });

  it('blocks advancing the phase while the current phase minimums are incomplete', async () => {
    const { prisma, projectUpdate, milestoneFindMany } =
      createAdvancePrismaMock();
    milestoneFindMany.mockResolvedValue([{ id: 1, title: 'Prototipo' }]);
    const service = createService(prisma, createAuthorizationMock());

    await expect(
      service.advanceProjectPhase({ user: ADMIN_USER, projectId: 10 }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(projectUpdate).not.toHaveBeenCalled();
  });

  it('rejects advancing the phase when the project is not in progress', async () => {
    const { prisma } = createAdvancePrismaMock({
      status: ProjectStatus.approved,
    });
    const service = createService(prisma, createAuthorizationMock());

    await expect(
      service.advanceProjectPhase({ user: ADMIN_USER, projectId: 10 }),
    ).rejects.toThrow('must be in progress');
  });

  it('rejects advancing the phase from the final phase', async () => {
    const { prisma } = createAdvancePrismaMock({
      phase: ProjectPhase.semester_2,
    });
    const service = createService(prisma, createAuthorizationMock());

    await expect(
      service.advanceProjectPhase({ user: ADMIN_USER, projectId: 10 }),
    ).rejects.toThrow('final phase');
  });

  it('blocks advancing the phase until the proposer and evaluators approve', async () => {
    const { prisma, projectUpdate } = createAdvancePrismaMock({
      proposerUserId: 7,
      proposerFullName: 'Prop',
      evaluators: [{ userId: 4, fullName: 'Eva' }],
    });
    const service = createService(prisma, createAuthorizationMock());

    await expect(
      service.advanceProjectPhase({ user: ADMIN_USER, projectId: 10 }),
    ).rejects.toThrow('Prop (proposer), Eva (evaluator)');
    expect(projectUpdate).not.toHaveBeenCalled();
  });

  it('advances the phase once every required approval is registered', async () => {
    const { prisma, projectUpdate } = createAdvancePrismaMock({
      proposerUserId: 7,
      proposerFullName: 'Prop',
      evaluators: [{ userId: 4, fullName: 'Eva' }],
      approvedUserIds: [7, 4],
    });
    const service = createService(prisma, createAuthorizationMock());
    jest.spyOn(service, 'project').mockResolvedValue(createProjectDetail());

    await service.advanceProjectPhase({ user: ADMIN_USER, projectId: 10 });

    expect(projectUpdate).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { phase: ProjectPhase.semester_2 },
    });
  });

  it('registers the phase approval of the current approver', async () => {
    const { prisma, approvalUpsert } = createAdvancePrismaMock({
      proposerUserId: EVALUATOR_USER.id,
    });
    const authorization = createAuthorizationMock();
    const service = createService(prisma, authorization);
    jest.spyOn(service, 'project').mockResolvedValue(createProjectDetail());

    await service.approveProjectPhase({
      user: EVALUATOR_USER,
      projectId: 10,
    });

    expect(authorization.assertCanApproveProjectPhase).toHaveBeenCalledWith(
      EVALUATOR_USER,
      expect.objectContaining({ id: 10, proposerUserId: EVALUATOR_USER.id }),
    );
    expect(approvalUpsert).toHaveBeenCalledWith({
      where: {
        projectId_phase_approverUserId: {
          projectId: 10,
          phase: ProjectPhase.semester_2,
          approverUserId: EVALUATOR_USER.id,
        },
      },
      create: {
        projectId: 10,
        phase: ProjectPhase.semester_2,
        approverUserId: EVALUATOR_USER.id,
      },
      update: {},
    });
  });

  it('revokes the phase approval of the current approver', async () => {
    const { prisma, approvalDeleteMany } = createAdvancePrismaMock({
      proposerUserId: EVALUATOR_USER.id,
    });
    const service = createService(prisma, createAuthorizationMock());
    jest.spyOn(service, 'project').mockResolvedValue(createProjectDetail());

    await service.revokeProjectPhaseApproval({
      user: EVALUATOR_USER,
      projectId: 10,
    });

    expect(approvalDeleteMany).toHaveBeenCalledWith({
      where: {
        projectId: 10,
        phase: ProjectPhase.semester_2,
        approverUserId: EVALUATOR_USER.id,
      },
    });
  });

  it('rejects approving the phase when the project is not in progress', async () => {
    const { prisma } = createAdvancePrismaMock({
      status: ProjectStatus.approved,
    });
    const service = createService(prisma, createAuthorizationMock());

    await expect(
      service.approveProjectPhase({ user: EVALUATOR_USER, projectId: 10 }),
    ).rejects.toThrow('must be in progress');
  });

  it('rejects approving the phase from the final phase', async () => {
    const { prisma } = createAdvancePrismaMock({
      phase: ProjectPhase.semester_2,
    });
    const service = createService(prisma, createAuthorizationMock());

    await expect(
      service.approveProjectPhase({ user: EVALUATOR_USER, projectId: 10 }),
    ).rejects.toThrow('final phase');
  });

  it('preserves duplicate-assignment protection', async () => {
    const createAssignment = jest.fn();
    const prisma = {
      project: {
        findUnique: jest.fn().mockResolvedValue({ id: 10, name: 'Project' }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 4,
          fullName: 'Student',
          email: 'student@example.com',
          isActive: true,
        }),
      },
      projectActorAssignment: {
        findUnique: jest.fn().mockResolvedValue({ id: 1 }),
        create: createAssignment,
      },
    };
    const authorization = createAuthorizationMock();
    const service = createService(prisma, authorization);

    await expect(
      service.addProjectActorAssignment({
        user: ADMIN_USER,
        projectId: 10,
        userId: 4,
        role: ActorRole.student,
      }),
    ).rejects.toThrow('already assigned');
    expect(createAssignment).not.toHaveBeenCalled();
  });

  it('returns the current user projects with their role', async () => {
    const startDate = new Date('2026-01-05T00:00:00.000Z');
    const assignmentFindMany = jest.fn().mockResolvedValue([
      {
        id: 1,
        projectId: 10,
        userId: 4,
        role: ActorRole.evaluator,
        assignedAt: new Date(),
        project: {
          id: 10,
          name: 'Project',
          status: ProjectStatus.under_review,
          startDate,
          location: 'Bogotá',
          isPrivate: true,
        },
      },
    ]);
    const projectFindMany = jest.fn().mockResolvedValue([]);
    const prisma = {
      projectActorAssignment: { findMany: assignmentFindMany },
      project: { findMany: projectFindMany },
    };
    const authorization = createAuthorizationMock();
    const service = createService(prisma, authorization);

    const result = await service.projectsForUser(EVALUATOR_USER);

    expect(assignmentFindMany).toHaveBeenCalledWith({
      where: { userId: 4 },
      include: { project: true },
      orderBy: { assignedAt: 'desc' },
    });
    expect(projectFindMany).toHaveBeenCalledWith({
      where: { proposerUserId: 4 },
      orderBy: { createdAt: 'desc' },
    });
    expect(result).toEqual([
      {
        id: 10,
        name: 'Project',
        status: ProjectStatus.under_review,
        startDate,
        location: 'Bogotá',
        isPrivate: true,
        myRole: ActorRole.evaluator,
        isProposer: false,
      },
    ]);
  });

  it('merges proposed and assigned projects without duplicates', async () => {
    const startDate = new Date('2026-01-05T00:00:00.000Z');
    const makeproject = (id: number, name: string, isPrivate: boolean) => ({
      id,
      name,
      status: ProjectStatus.proposed,
      startDate,
      location: null,
      isPrivate,
    });
    const prisma = {
      projectActorAssignment: {
        findMany: jest.fn().mockResolvedValue([
          {
            projectId: 1,
            role: ActorRole.student,
            assignedAt: new Date(),
            project: makeproject(1, 'Proposed and assigned', true),
          },
        ]),
      },
      project: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            makeproject(1, 'Proposed and assigned', true),
            makeproject(2, 'Only proposed', false),
          ]),
      },
    };
    const service = createService(prisma, createAuthorizationMock());

    const result = await service.projectsForUser(EVALUATOR_USER);

    expect(result).toHaveLength(2);
    expect(result.find((project) => project.id === 1)).toMatchObject({
      isProposer: true,
      myRole: ActorRole.student,
    });
    expect(result.find((project) => project.id === 2)).toMatchObject({
      isProposer: true,
      myRole: null,
    });
  });

  it('lists assignable users after authorizing the acting user', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 4,
        fullName: 'Coordinator',
        email: 'coordinator@example.com',
        roleAssignments: [{ role: UserRole.coordinator }],
      },
    ]);
    const prisma = { user: { findMany } };
    const authorization = createAuthorizationMock();
    const service = createService(prisma, authorization);

    const result = await service.assignableUsers(
      { id: 2, fullName: 'Coordinator', email: 'c@example.com', roles: [] },
      10,
    );

    expect(authorization.assertCanAssignActors).toHaveBeenCalledWith(
      expect.anything(),
      10,
    );
    expect(result).toEqual([
      {
        id: 4,
        fullName: 'Coordinator',
        email: 'coordinator@example.com',
        roles: [UserRole.coordinator],
      },
    ]);
  });

  it('creates the project with the default final milestone and report', async () => {
    const createdProject = {
      id: 11,
      name: 'New project',
      status: ProjectStatus.proposed,
      phase: ProjectPhase.semester_1,
      startDate: null,
      location: null,
      requiresLegalization: false,
      isPrivate: true,
      source: ProjectSource.external_entity,
      naturalProposer: null,
      actorAssignments: [],
      deliverables: [],
      observations: [],
      milestones: [],
      statusHistory: [],
      changeHistory: [],
      attachments: [],
      reports: [],
      phaseApprovals: [],
      description: 'Description',
      context: 'Context',
      endDate: null,
      estimatedCost: null,
      facultyAdvisor: null,
      teamRequirements: null,
      expectedOutcomes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const projectCreate = jest
      .fn<
        Promise<{ id: number; milestones: { id: number }[] }>,
        [{ data: unknown }]
      >()
      .mockResolvedValue({ id: 11, milestones: [{ id: 100 }] });
    const reportCreate = jest
      .fn<Promise<{ id: number }>, [{ data: Record<string, unknown> }]>()
      .mockResolvedValue({ id: 200 });
    const linkCreate = jest
      .fn<Promise<unknown>, [{ data: Record<string, unknown> }]>()
      .mockResolvedValue({});
    const findUniqueOrThrow = jest.fn().mockResolvedValue(createdProject);
    const transaction = {
      project: { create: projectCreate, findUniqueOrThrow },
      projectReport: { create: reportCreate },
      milestoneReportLink: { create: linkCreate },
    };
    const prisma = {
      $transaction: jest.fn((callback: (value: unknown) => unknown) =>
        callback(transaction),
      ),
    };
    const authorization = {
      ...createAuthorizationMock(),
      assertCanCreateProject: jest.fn(),
    };
    const service = createService(prisma, authorization);

    await service.createProject(EVALUATOR_USER, {
      name: 'New project',
      description: 'Description',
      context: 'Context',
      startDate: new Date('2026-01-15T00:00:00.000Z'),
    });

    const data = projectCreate.mock.calls[0][0].data as {
      proposer: unknown;
      milestones: {
        create: {
          title: string;
          phase: ProjectPhase;
          isMinimum: boolean;
          completed: boolean;
          dueDate: Date;
        }[];
      };
    };
    expect(data).toEqual(
      expect.objectContaining({
        proposer: { connect: { id: EVALUATOR_USER.id } },
      }),
    );
    const milestone = data.milestones.create[0];
    expect(milestone).toEqual(
      expect.objectContaining({
        title: DEFAULT_FINAL_MILESTONE_TITLE,
        phase: ProjectPhase.semester_2,
        isMinimum: true,
        completed: false,
      }),
    );
    expect(milestone.dueDate).toBeInstanceOf(Date);
    expect(
      (milestone.dueDate.getFullYear() - 2026) * 12 +
        (milestone.dueDate.getMonth() - 0),
    ).toBe(12);

    expect(reportCreate).toHaveBeenCalledTimes(1);
    expect(reportCreate.mock.calls[0][0].data).toMatchObject({
      projectId: 11,
      title: DEFAULT_FINAL_MILESTONE_TITLE,
      type: ReportContentKind.file,
      maxFiles: 1,
    });
    expect(linkCreate).toHaveBeenCalledWith({
      data: { milestoneId: 100, reportId: 200 },
    });
    expect(findUniqueOrThrow).toHaveBeenCalled();
  });

  it('applies the viewer visibility filter to project listings', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = { project: { findMany } };
    const visibilityWhere = { isPrivate: false };
    const authorization = {
      ...createAuthorizationMock(),
      projectVisibilityWhere: jest.fn().mockReturnValue(visibilityWhere),
    };
    const service = createService(prisma, authorization);

    await service.projects(
      { where: { status: ProjectStatus.closed } },
      undefined,
    );

    expect(authorization.projectVisibilityWhere).toHaveBeenCalledWith(
      undefined,
    );
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: ProjectStatus.closed, isPrivate: false },
      }),
    );
  });

  it('redacts sensitive relations for anonymous viewers of a public project', async () => {
    const project = {
      ...createProjectDetail(),
      id: 33,
      status: ProjectStatus.closed,
      isPrivate: false,
      proposerUserId: 999,
      actorAssignments: [
        {
          id: 1,
          projectId: 33,
          userId: 555,
          role: ActorRole.student,
          assignedAt: new Date(),
          user: { id: 555, fullName: 'Secret', email: 'secret@example.com' },
        },
      ],
      observations: [
        {
          id: 1,
          projectId: 33,
          content: 'internal note',
          createdAt: new Date(),
          authorUser: {
            id: 555,
            fullName: 'Secret',
            email: 'secret@example.com',
          },
        },
      ],
    };
    const prisma = {
      project: { findFirst: jest.fn().mockResolvedValue(project) },
    };
    const authorization = {
      ...createAuthorizationMock(),
      projectVisibilityWhere: jest.fn().mockReturnValue({}),
    };
    const service = createService(prisma, authorization);

    const result = await service.project({ id: 33 }, undefined);

    expect(result).not.toBeNull();
    expect(result?.canViewSensitiveData).toBe(false);
    expect(result?.actors).toEqual([]);
    expect(result?.observations).toEqual([]);
  });

  it('keeps sensitive relations for the project proposer', async () => {
    const project = {
      ...createProjectDetail(),
      id: 33,
      status: ProjectStatus.in_progress,
      isPrivate: true,
      proposerUserId: EVALUATOR_USER.id,
      actorAssignments: [],
      observations: [],
      phaseApprovals: [],
    };
    const prisma = {
      project: { findFirst: jest.fn().mockResolvedValue(project) },
    };
    const authorization = {
      ...createAuthorizationMock(),
      projectVisibilityWhere: jest.fn().mockReturnValue({}),
    };
    const service = createService(prisma, authorization);

    const result = await service.project({ id: 33 }, EVALUATOR_USER);

    expect(result?.canViewSensitiveData).toBe(true);
  });

  describe('diffProjectUpdate', () => {
    const base = {
      name: 'Project',
      description: 'Description',
      context: 'Context',
      location: null,
      source: ProjectSource.external_entity,
      sourceDetails: null,
      startDate: null,
      endDate: null,
      estimatedCost: null,
      requiresLegalization: false,
      isPrivate: true,
      facultyAdvisor: null,
      teamRequirements: null,
      expectedOutcomes: null,
      deliverables: ['One'],
    };

    it('returns one row per changed field, in field order', () => {
      const rows = diffProjectUpdate(base, {
        ...base,
        name: 'Renamed',
        isPrivate: false,
        deliverables: ['One', 'Two'],
      });

      expect(rows).toEqual([
        { field: 'name', previousValue: 'Project', newValue: 'Renamed' },
        { field: 'isPrivate', previousValue: 'true', newValue: 'false' },
        {
          field: 'deliverables',
          previousValue: JSON.stringify(['One']),
          newValue: JSON.stringify(['One', 'Two']),
        },
      ]);
    });

    it('returns no rows when nothing changed', () => {
      expect(diffProjectUpdate(base, { ...base })).toEqual([]);
    });

    it('treats equivalent decimals and dates as unchanged', () => {
      const rows = diffProjectUpdate(
        {
          ...base,
          estimatedCost: '1500.00',
          startDate: new Date('2026-01-05T00:00:00.000Z'),
        },
        {
          ...base,
          estimatedCost: 1500,
          startDate: new Date('2026-01-05T00:00:00.000Z'),
        },
      );

      expect(rows).toEqual([]);
    });
  });

  describe('updateProject', () => {
    function createUpdatePrismaMock(
      status: ProjectStatus = ProjectStatus.under_review,
    ) {
      const currentProject = {
        id: 10,
        status,
        proposerUserId: 999,
        name: 'Project',
        description: 'Description',
        context: 'Context',
        location: null,
        source: ProjectSource.external_entity,
        startDate: null,
        endDate: null,
        estimatedCost: null,
        requiresLegalization: false,
        isPrivate: true,
        facultyAdvisor: null,
        teamRequirements: null,
        expectedOutcomes: null,
        deliverables: [{ description: 'One' }],
      };
      const update = jest
        .fn()
        .mockResolvedValue({ ...createProjectDetail(), phaseApprovals: [] });
      const createMany = jest.fn().mockResolvedValue({ count: 1 });
      const transaction = {
        project: { update },
        projectChangeHistory: { createMany },
      };
      const prisma = {
        project: { findUnique: jest.fn().mockResolvedValue(currentProject) },
        $transaction: jest.fn((callback: (value: unknown) => unknown) =>
          callback(transaction),
        ),
      };

      return { prisma, update, createMany };
    }

    it('records one history row per changed field in the same transaction', async () => {
      const { prisma, update, createMany } = createUpdatePrismaMock();
      const authorization = createAuthorizationMock();
      const service = createService(prisma, authorization);

      await service.updateProject({
        user: EVALUATOR_USER,
        projectId: 10,
        fields: { name: 'Renamed', isPrivate: false },
      });

      expect(authorization.assertCanEditProjectDetails).toHaveBeenCalledWith(
        EVALUATOR_USER,
        {
          id: 10,
          proposerUserId: 999,
          status: ProjectStatus.under_review,
        },
      );
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 10 },
          data: { name: 'Renamed', isPrivate: false },
        }),
      );
      expect(createMany).toHaveBeenCalledWith({
        data: [
          {
            projectId: 10,
            authorUserId: EVALUATOR_USER.id,
            field: 'name',
            previousValue: 'Project',
            newValue: 'Renamed',
          },
          {
            projectId: 10,
            authorUserId: EVALUATOR_USER.id,
            field: 'isPrivate',
            previousValue: 'true',
            newValue: 'false',
          },
        ],
      });
    });

    it('does not write history when nothing changed', async () => {
      const { prisma, createMany } = createUpdatePrismaMock();
      const service = createService(prisma, createAuthorizationMock());

      await service.updateProject({
        user: EVALUATOR_USER,
        projectId: 10,
        fields: { name: 'Project' },
      });

      expect(createMany).not.toHaveBeenCalled();
    });

    it.each([ProjectStatus.closed, ProjectStatus.rejected])(
      'rejects editing a project in %s',
      async (status) => {
        const { prisma, update } = createUpdatePrismaMock(status);
        const authorization = createAuthorizationMock();
        const service = createService(prisma, authorization);

        await expect(
          service.updateProject({
            user: EVALUATOR_USER,
            projectId: 10,
            fields: { name: 'Renamed' },
          }),
        ).rejects.toBeInstanceOf(ConflictException);
        expect(update).not.toHaveBeenCalled();
      },
    );

    it('returns 404 when the project does not exist', async () => {
      const prisma = {
        project: { findUnique: jest.fn().mockResolvedValue(null) },
      };
      const service = createService(prisma, createAuthorizationMock());

      await expect(
        service.updateProject({
          user: EVALUATOR_USER,
          projectId: 10,
          fields: { name: 'Renamed' },
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
