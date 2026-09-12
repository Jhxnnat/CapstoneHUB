import { Test, TestingModule } from '@nestjs/testing';
import {
  isValidProjectStatusTransition,
  ProjectsService,
} from './projects.service';
import { AuthorizationService } from '../auth/authorization.service';
import { PrismaService } from '../prisma.service';
import { ProjectStatus } from '../generated/prisma/client';
import { ActorRole, UserRole } from '../generated/prisma/client';

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
    [ProjectStatus.approved, ProjectStatus.assigned],
    [ProjectStatus.approved, ProjectStatus.rejected],
    [ProjectStatus.assigned, ProjectStatus.in_progress],
    [ProjectStatus.assigned, ProjectStatus.rejected],
    [ProjectStatus.in_progress, ProjectStatus.closed],
    [ProjectStatus.in_progress, ProjectStatus.rejected],
  ])('accepts valid transition %s -> %s', (previousStatus, nextStatus) => {
    expect(isValidProjectStatusTransition(previousStatus, nextStatus)).toBe(
      true,
    );
  });

  it.each([
    [ProjectStatus.proposed, ProjectStatus.approved],
    [ProjectStatus.under_review, ProjectStatus.in_progress],
    [ProjectStatus.closed, ProjectStatus.rejected],
    [ProjectStatus.rejected, ProjectStatus.proposed],
  ])('rejects invalid transition %s -> %s', (previousStatus, nextStatus) => {
    expect(isValidProjectStatusTransition(previousStatus, nextStatus)).toBe(
      false,
    );
  });

  it('updates status and history in the same transaction', async () => {
    const transactionProjectUpdate = jest.fn().mockResolvedValue(undefined);
    const transactionHistoryCreate = jest.fn().mockResolvedValue(undefined);
    const prisma = {
      project: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({ id: 10, status: ProjectStatus.proposed }),
      },
      $transaction: jest.fn(
        (
          callback: (transactionClient: {
            project: { update: typeof transactionProjectUpdate };
            projectStatusHistory: {
              create: typeof transactionHistoryCreate;
            };
          }) => Promise<unknown>,
        ) =>
          callback({
            project: { update: transactionProjectUpdate },
            projectStatusHistory: { create: transactionHistoryCreate },
          }),
      ),
    };
    const authorization = {
      assertCanTransitionProject: jest.fn().mockResolvedValue(undefined),
    } as never;
    const transitionUser = {
      id: 4,
      fullName: 'Evaluator',
      email: 'evaluator@example.com',
      roles: [UserRole.evaluator],
    };
    const service = new ProjectsService(prisma as never, authorization);
    jest.spyOn(service, 'project').mockResolvedValue({
      id: 10,
      name: 'Project',
      status: ProjectStatus.under_review,
      proposer: null,
      actors: [],
      description: 'Description',
      context: 'Context',
      startDate: new Date(),
      endDate: null,
      estimatedCost: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      observations: [],
      actorAssignments: [],
      milestones: [],
    });

    await service.transitionProjectStatus({
      user: transitionUser,
      projectId: 10,
      nextStatus: ProjectStatus.under_review,
      description: 'Initial review',
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(transactionProjectUpdate).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { status: ProjectStatus.under_review },
    });
    expect(transactionHistoryCreate).toHaveBeenCalledWith({
      data: {
        projectId: 10,
        previousStatus: ProjectStatus.proposed,
        nextStatus: ProjectStatus.under_review,
        description: 'Initial review',
        authorUserId: 4,
      },
    });
  });

  it('rejects invalid transitions before authorization checks', async () => {
    const prisma = {
      project: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 10, status: ProjectStatus.proposed }),
      },
    };
    const authorization = {
      assertCanTransitionProject: jest.fn().mockResolvedValue(undefined),
    };
    const service = new ProjectsService(
      prisma as never,
      authorization as never,
    );

    await expect(
      service.transitionProjectStatus({
        user: {
          id: 1,
          fullName: 'Admin',
          email: 'admin@example.com',
          roles: [UserRole.admin],
        },
        projectId: 10,
        nextStatus: ProjectStatus.approved,
      }),
    ).rejects.toThrow('Invalid project status transition');
    expect(authorization.assertCanTransitionProject).not.toHaveBeenCalled();
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
    } as never;
    const authorization = {
      assertCanAssignActors: jest.fn().mockResolvedValue(undefined),
      assertAssignableUser: jest.fn().mockResolvedValue(undefined),
    } as never;
    const service = new ProjectsService(prisma, authorization);

    await expect(
      service.addProjectActorAssignment({
        user: {
          id: 1,
          fullName: 'Admin',
          email: 'admin@example.com',
          roles: [UserRole.admin],
        },
        projectId: 10,
        userId: 4,
        role: ActorRole.student,
      }),
    ).rejects.toThrow('already assigned');
    expect(createAssignment).not.toHaveBeenCalled();
  });
});
