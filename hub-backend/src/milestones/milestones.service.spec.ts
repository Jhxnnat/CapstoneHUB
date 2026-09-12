import { MilestonesService } from './milestones.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('MilestonesService', () => {
  const user = {
    id: 7,
    fullName: 'Coordinator',
    email: 'coordinator@example.com',
    roles: ['coordinator'],
  } as never;

  function createService() {
    const prisma = {
      project: { findUnique: jest.fn() },
      projectMilestones: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    const authorization = {
      assertProjectMember: jest.fn(),
      assertCanManageMilestone: jest.fn(),
    };

    return {
      service: new MilestonesService(prisma as never, authorization as never),
      prisma,
      authorization,
    };
  }

  it('lists a project milestones in due-date order', async () => {
    const { service, prisma, authorization } = createService();
    const milestones = [
      {
        id: 1,
        projectId: 10,
        title: 'Plan',
        description: null,
        dueDate: new Date('2026-10-01'),
        completed: false,
        createdAt: new Date('2026-09-12'),
      },
    ];
    prisma.project.findUnique.mockResolvedValue({ id: 10 });
    prisma.projectMilestones.findMany.mockResolvedValue(milestones);

    await expect(service.milestonesByProject(10, user)).resolves.toEqual(
      milestones,
    );
    expect(authorization.assertProjectMember).toHaveBeenCalledWith(user, 10);
  });

  it('creates a trimmed milestone for an authorized project manager', async () => {
    const { service, prisma, authorization } = createService();
    const milestone = {
      id: 2,
      projectId: 10,
      title: 'Plan',
      description: 'Details',
      dueDate: new Date('2026-10-01'),
      completed: false,
      createdAt: new Date('2026-09-12'),
    };
    const createMilestone = jest
      .fn<
        Promise<typeof milestone>,
        [
          {
            data: {
              projectId: number;
              title: string;
              description: string | null;
              dueDate: Date;
              completed: boolean;
            };
            select: unknown;
          },
        ]
      >()
      .mockResolvedValue(milestone);
    prisma.project.findUnique.mockResolvedValue({ id: 10 });
    prisma.projectMilestones.create = createMilestone;

    await expect(
      service.createMilestone({
        projectId: 10,
        user,
        data: {
          title: ' Plan ',
          description: ' Details ',
          dueDate: milestone.dueDate,
        },
      }),
    ).resolves.toEqual(milestone);
    expect(authorization.assertCanManageMilestone).toHaveBeenCalledWith(
      user,
      10,
    );
    expect(createMilestone).toHaveBeenCalledTimes(1);
    const createCall = createMilestone.mock.calls[0];
    expect(createCall).toBeDefined();
    if (!createCall) {
      throw new Error('Expected the milestone create mock to be called');
    }
    expect(createCall[0].data).toMatchObject({
      title: 'Plan',
      description: 'Details',
      completed: false,
    });
  });

  it('rejects an empty update', async () => {
    const { service, prisma } = createService();
    prisma.project.findUnique.mockResolvedValue({ id: 10 });
    prisma.projectMilestones.findFirst.mockResolvedValue({ id: 2 });

    await expect(
      service.updateMilestone({
        projectId: 10,
        milestoneId: 2,
        user,
        data: {},
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a milestone from another project', async () => {
    const { service, prisma } = createService();
    prisma.project.findUnique.mockResolvedValue({ id: 10 });
    prisma.projectMilestones.findFirst.mockResolvedValue(null);

    await expect(
      service.deleteMilestone({ projectId: 10, milestoneId: 99, user }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
