import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActorRole,
  Prisma,
  Project,
  ProjectStatus,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma.service';
import { AuthorizationService } from '../auth/authorization.service';
import { AuthenticatedUser } from '../auth/auth.types';

type ProjectWithRelations = Prisma.ProjectGetPayload<{
  include: {
    naturalProposer: true;
    legalProposer: true;
    observations: {
      select: {
        id: true;
        projectId: true;
        content: true;
        createdAt: true;
        authorUser: {
          select: {
            id: true;
            fullName: true;
            email: true;
          };
        };
      };
    };
    actorAssignments: {
      include: {
        user: true;
      };
    };
    milestones: true;
  };
}>;

export type ProjectProposerResponse =
  | {
      type: 'natural_person';
      fullName: string;
      idNumber: string;
      email: string;
    }
  | {
      type: 'legal_person';
      legalName: string;
      nit: string;
      email: string;
      phone: string;
      contactUrl: string | null;
    };

export type ProjectListResponse = {
  id: number;
  name: string;
  status: ProjectStatus;
  proposer: ProjectProposerResponse | null;
  actors: ProjectActorResponse[];
};

export type ProjectActorResponse = {
  id: number;
  userId: number;
  role: ActorRole;
  assignedAt: Date;
  user: {
    id: number;
    fullName: string;
    email: string;
  };
};

export type ProjectDetailResponse = ProjectListResponse & {
  description: string;
  context: string;
  startDate: Date;
  endDate: Date | null;
  estimatedCost: Prisma.Decimal | null;
  createdAt: Date;
  updatedAt: Date;
  observations: {
    id: number;
    projectId: number;
    content: string;
    createdAt: Date;
    author: {
      id: number;
      fullName: string;
      email: string;
    } | null;
  }[];
  actorAssignments: {
    id: number;
    projectId: number;
    userId: number;
    role: ActorRole;
    assignedAt: Date;
    user: {
      id: number;
      fullName: string;
      email: string;
    };
  }[];
  milestones: {
    id: number;
    projectId: number;
    title: string;
    description: string | null;
    dueDate: Date;
    completed: boolean;
    createdAt: Date;
  }[];
};

export type ProjectActorAssignmentResponse = {
  id: number;
  projectId: number;
  userId: number;
  role: ActorRole;
  assignedAt: Date;
  project: {
    id: number;
    name: string;
  };
  user: {
    id: number;
    fullName: string;
    email: string;
  };
};

function mapProjectProposer(
  project: Pick<ProjectWithRelations, 'naturalProposer' | 'legalProposer'>,
): ProjectProposerResponse | null {
  if (project.naturalProposer) {
    return {
      type: 'natural_person',
      fullName: project.naturalProposer.fullName,
      idNumber: project.naturalProposer.idNumber,
      email: project.naturalProposer.email,
    };
  }

  if (project.legalProposer) {
    return {
      type: 'legal_person',
      legalName: project.legalProposer.legalName,
      nit: project.legalProposer.nit,
      email: project.legalProposer.email,
      phone: project.legalProposer.phone,
      contactUrl: project.legalProposer.contactUrl,
    };
  }

  return null;
}

export function isValidProjectStatusTransition(
  previousStatus: ProjectStatus,
  nextStatus: ProjectStatus,
): boolean {
  const transitions: Record<ProjectStatus, ProjectStatus[]> = {
    [ProjectStatus.proposed]: [
      ProjectStatus.under_review,
      ProjectStatus.rejected,
    ],
    [ProjectStatus.under_review]: [
      ProjectStatus.approved,
      ProjectStatus.rejected,
    ],
    [ProjectStatus.approved]: [ProjectStatus.assigned, ProjectStatus.rejected],
    [ProjectStatus.assigned]: [
      ProjectStatus.in_progress,
      ProjectStatus.rejected,
    ],
    [ProjectStatus.in_progress]: [ProjectStatus.closed, ProjectStatus.rejected],
    [ProjectStatus.closed]: [],
    [ProjectStatus.rejected]: [],
  };

  return transitions[previousStatus].includes(nextStatus);
}

function mapProjectListResponse(
  project: ProjectWithRelations,
): ProjectListResponse {
  return {
    id: project.id,
    name: project.name,
    status: project.status,
    proposer: mapProjectProposer(project),
    actors: project.actorAssignments.map((assignment) => ({
      id: assignment.id,
      userId: assignment.userId,
      role: assignment.role,
      assignedAt: assignment.assignedAt,
      user: {
        id: assignment.user.id,
        fullName: assignment.user.fullName,
        email: assignment.user.email,
      },
    })),
  };
}

function mapProjectDetailResponse(
  project: ProjectWithRelations,
): ProjectDetailResponse {
  return {
    ...mapProjectListResponse(project),
    description: project.description,
    context: project.context,
    startDate: project.startDate,
    endDate: project.endDate,
    estimatedCost: project.estimatedCost,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    observations: project.observations.map((observation) => ({
      id: observation.id,
      projectId: observation.projectId,
      content: observation.content,
      createdAt: observation.createdAt,
      author: observation.authorUser
        ? {
            id: observation.authorUser.id,
            fullName: observation.authorUser.fullName,
            email: observation.authorUser.email,
          }
        : null,
    })),
    actorAssignments: project.actorAssignments.map((assignment) => ({
      id: assignment.id,
      projectId: assignment.projectId,
      userId: assignment.userId,
      role: assignment.role,
      assignedAt: assignment.assignedAt,
      user: {
        id: assignment.user.id,
        fullName: assignment.user.fullName,
        email: assignment.user.email,
      },
    })),
    milestones: (
      project as unknown as Pick<ProjectDetailResponse, 'milestones'>
    ).milestones
      .slice()
      .sort(
        (left, right) =>
          left.dueDate.getTime() - right.dueDate.getTime() ||
          left.id - right.id,
      ),
  };
}

@Injectable()
export class ProjectsService {
  constructor(
    readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
  ) {}

  async project(
    projectWhereUniqueInput: Prisma.ProjectWhereUniqueInput,
  ): Promise<ProjectDetailResponse | null> {
    const project = await this.prisma.project.findUnique({
      where: projectWhereUniqueInput,
      include: {
        naturalProposer: true,
        legalProposer: true,
        observations: {
          select: {
            id: true,
            projectId: true,
            content: true,
            createdAt: true,
            authorUser: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
          },
        },
        actorAssignments: {
          include: {
            user: true,
          },
        },
        milestones: true,
      },
    });

    return project ? mapProjectDetailResponse(project) : null;
  }

  async projects(params: {
    skip?: number;
    take?: number;
    cursor?: Prisma.ProjectWhereUniqueInput;
    where?: Prisma.ProjectWhereInput;
    orderBy?: Prisma.ProjectOrderByWithRelationInput;
  }): Promise<ProjectListResponse[]> {
    const { skip, take, cursor, where, orderBy } = params;
    const projects = await this.prisma.project.findMany({
      skip,
      take,
      cursor,
      where,
      orderBy,
      include: {
        naturalProposer: true,
        legalProposer: true,
        observations: {
          select: {
            id: true,
            projectId: true,
            content: true,
            createdAt: true,
            authorUser: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
          },
        },
        actorAssignments: {
          include: {
            user: true,
          },
        },
        milestones: true,
      },
    });

    return projects.map((project) => mapProjectListResponse(project));
  }

  async createProject(
    user: AuthenticatedUser,
    data: Prisma.ProjectCreateInput,
  ): Promise<ProjectDetailResponse> {
    this.authorization.assertCanCreateProject(user);
    try {
      const project = await this.prisma.project.create({
        data,
        include: {
          naturalProposer: true,
          legalProposer: true,
          observations: {
            select: {
              id: true,
              projectId: true,
              content: true,
              createdAt: true,
              authorUser: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                },
              },
            },
          },
          actorAssignments: {
            include: {
              user: true,
            },
          },
          milestones: true,
        },
      });

      return mapProjectDetailResponse(project);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const target = Array.isArray(error.meta?.target)
          ? error.meta?.target.join(', ')
          : typeof error.meta?.target === 'string'
            ? error.meta.target
            : error.meta?.target == null
              ? 'unique field'
              : JSON.stringify(error.meta.target);
        throw new ConflictException(
          `Duplicate value for a unique field: ${target}`,
        );
      }

      throw error;
    }
  }

  async updateProject(params: {
    user: AuthenticatedUser;
    where: Prisma.ProjectWhereUniqueInput;
    data: { name?: string };
  }): Promise<ProjectDetailResponse> {
    const { user, where, data } = params;
    const projectId = this.projectIdFromWhere(where);
    await this.authorization.assertCanManageProject(user, projectId);
    const project = await this.prisma.project.update({
      data,
      where,
      include: {
        naturalProposer: true,
        legalProposer: true,
        observations: {
          select: {
            id: true,
            projectId: true,
            content: true,
            createdAt: true,
            authorUser: {
              select: {
                id: true,
                email: true,
                fullName: true,
              },
            },
          },
        },
        actorAssignments: {
          include: {
            user: true,
          },
        },
        milestones: true,
      },
    });

    return mapProjectDetailResponse(project);
  }

  async transitionProjectStatus(params: {
    user: AuthenticatedUser;
    projectId: number;
    nextStatus: ProjectStatus;
    description?: string;
  }): Promise<ProjectDetailResponse> {
    const { user, projectId, nextStatus, description } = params;
    const currentProject = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, status: true },
    });

    if (!currentProject) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }

    if (!isValidProjectStatusTransition(currentProject.status, nextStatus)) {
      throw new BadRequestException(
        `Invalid project status transition: ${currentProject.status} -> ${nextStatus}`,
      );
    }

    await this.authorization.assertCanTransitionProject(
      user,
      projectId,
      currentProject.status,
      nextStatus,
    );

    await this.prisma.$transaction(async (transaction) => {
      await transaction.project.update({
        where: { id: projectId },
        data: { status: nextStatus },
      });

      await transaction.projectStatusHistory.create({
        data: {
          projectId,
          previousStatus: currentProject.status,
          nextStatus,
          description: description?.trim() || null,
          authorUserId: user.id,
        },
      });
    });

    const project = await this.project({ id: projectId });
    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }

    return project;
  }

  async deleteProject(
    user: AuthenticatedUser,
    where: Prisma.ProjectWhereUniqueInput,
  ): Promise<Project> {
    const projectId = this.projectIdFromWhere(where);
    await this.authorization.assertCanManageProject(user, projectId);
    return this.prisma.project.delete({ where });
  }

  async addProjectActorAssignment(params: {
    user: AuthenticatedUser;
    projectId: number;
    userId: number;
    role: ActorRole;
  }): Promise<ProjectActorAssignmentResponse> {
    const { user: actingUser, projectId, userId, role } = params;

    await this.authorization.assertCanAssignActors(actingUser, projectId);
    await this.authorization.assertAssignableUser(userId, role);

    const [project, user, existingAssignment] = await Promise.all([
      this.prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true, name: true },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, fullName: true, email: true, isActive: true },
      }),
      this.prisma.projectActorAssignment.findUnique({
        where: {
          projectId_userId: {
            projectId,
            userId,
          },
        },
      }),
    ]);

    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }

    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    if (existingAssignment) {
      throw new ConflictException('User is already assigned to this project');
    }

    const assignment = await this.prisma.projectActorAssignment.create({
      data: {
        role,
        project: {
          connect: { id: projectId },
        },
        user: {
          connect: { id: userId },
        },
      },
      select: {
        id: true,
        projectId: true,
        userId: true,
        role: true,
        assignedAt: true,
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    return assignment;
  }

  private projectIdFromWhere(where: Prisma.ProjectWhereUniqueInput): number {
    if (typeof where.id !== 'number') {
      throw new BadRequestException('A numeric project id is required');
    }

    return where.id;
  }
}
