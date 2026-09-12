import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { AuthorizationService } from '../auth/authorization.service';
import { PrismaService } from '../prisma.service';
import { CreateMilestoneDto, UpdateMilestoneDto } from './milestones.dto';

const milestoneSelect = {
  id: true,
  projectId: true,
  title: true,
  description: true,
  dueDate: true,
  completed: true,
  createdAt: true,
} as const;

type SelectedMilestone = Prisma.ProjectMilestonesGetPayload<{
  select: typeof milestoneSelect;
}>;

export type ProjectMilestoneResponse = SelectedMilestone;

function mapMilestone(milestone: SelectedMilestone): ProjectMilestoneResponse {
  return milestone;
}

@Injectable()
export class MilestonesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
  ) {}

  async milestonesByProject(
    projectId: number,
    user: AuthenticatedUser,
  ): Promise<ProjectMilestoneResponse[]> {
    await this.assertProjectExists(projectId);
    await this.authorization.assertProjectMember(user, projectId);

    const projectMilestones = this.prisma.projectMilestones as unknown as {
      findMany: (args: {
        where: { projectId: number };
        orderBy: Array<
          | {
              dueDate: 'asc' | 'desc';
              id?: never;
            }
          | {
              id: 'asc' | 'desc';
              dueDate?: never;
            }
        >;
        select: typeof milestoneSelect;
      }) => Promise<SelectedMilestone[]>;
    };
    const milestones = await projectMilestones.findMany({
      where: { projectId },
      orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
      select: milestoneSelect,
    });

    return milestones.map(mapMilestone);
  }

  async createMilestone(params: {
    projectId: number;
    data: CreateMilestoneDto;
    user: AuthenticatedUser;
  }): Promise<ProjectMilestoneResponse> {
    await this.assertProjectExists(params.projectId);
    await this.authorization.assertCanManageMilestone(
      params.user,
      params.projectId,
    );

    const title = params.data.title.trim();
    if (!title) {
      throw new BadRequestException('Milestone title is required');
    }

    const projectMilestones = this.prisma.projectMilestones as unknown as {
      create: (args: {
        data: Prisma.ProjectMilestonesUncheckedCreateInput;
        select: typeof milestoneSelect;
      }) => Promise<SelectedMilestone>;
    };
    const createArgs: {
      data: Prisma.ProjectMilestonesUncheckedCreateInput;
      select: typeof milestoneSelect;
    } = {
      data: {
        projectId: params.projectId,
        title,
        description: params.data.description?.trim() || null,
        dueDate: params.data.dueDate,
        completed: params.data.completed ?? false,
      },
      select: milestoneSelect,
    };
    return mapMilestone(await projectMilestones.create(createArgs));
  }

  async updateMilestone(params: {
    projectId: number;
    milestoneId: number;
    data: UpdateMilestoneDto;
    user: AuthenticatedUser;
  }): Promise<ProjectMilestoneResponse> {
    await this.assertProjectExists(params.projectId);
    await this.authorization.assertCanManageMilestone(
      params.user,
      params.projectId,
    );
    await this.assertMilestoneBelongsToProject(
      params.projectId,
      params.milestoneId,
    );

    const updateData: Prisma.ProjectMilestonesUpdateInput = {};

    if (params.data.title !== undefined) {
      const title = params.data.title.trim();
      if (!title) {
        throw new BadRequestException('Milestone title is required');
      }
      Object.assign(updateData, { title });
    }

    if (params.data.description !== undefined) {
      updateData.description = params.data.description.trim() || null;
    }
    if (params.data.dueDate !== undefined) {
      updateData.dueDate = params.data.dueDate;
    }
    if (params.data.completed !== undefined) {
      updateData.completed = params.data.completed;
    }

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('No update fields provided');
    }

    const milestone = await this.prisma.projectMilestones.update({
      where: { id: params.milestoneId },
      data: updateData,
      select: milestoneSelect,
    });

    return mapMilestone(milestone);
  }

  async deleteMilestone(params: {
    projectId: number;
    milestoneId: number;
    user: AuthenticatedUser;
  }): Promise<ProjectMilestoneResponse> {
    await this.assertProjectExists(params.projectId);
    await this.authorization.assertCanManageMilestone(
      params.user,
      params.projectId,
    );
    await this.assertMilestoneBelongsToProject(
      params.projectId,
      params.milestoneId,
    );

    const milestone = await this.prisma.projectMilestones.delete({
      where: { id: params.milestoneId },
      select: milestoneSelect,
    });

    return mapMilestone(milestone);
  }

  private async assertProjectExists(projectId: number): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });

    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }
  }

  private async assertMilestoneBelongsToProject(
    projectId: number,
    milestoneId: number,
  ): Promise<void> {
    const milestone = await this.prisma.projectMilestones.findFirst({
      where: { id: milestoneId, projectId },
      select: { id: true },
    });

    if (!milestone) {
      throw new NotFoundException(
        `Milestone ${milestoneId} not found in project ${projectId}`,
      );
    }
  }
}
