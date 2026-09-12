import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma.service';
import { AuthorizationService } from '../auth/authorization.service';
import { AuthenticatedUser } from '../auth/auth.types';

export type ProjectObservationResponse = {
  id: number;
  projectId: number;
  content: string;
  createdAt: Date;
  author: {
    id: number;
    fullName: string;
    email: string;
  } | null;
};

const observationSelect = {
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
} as const satisfies Prisma.ProjectObservationSelect;

type SelectedObservation = Prisma.ProjectObservationGetPayload<{
  select: typeof observationSelect;
}>;

function mapObservation(
  observation: SelectedObservation,
): ProjectObservationResponse {
  return {
    id: observation.id,
    projectId: observation.projectId,
    content: observation.content,
    createdAt: observation.createdAt,
    author: observation.authorUser,
  };
}

@Injectable()
export class ObservationsService {
  constructor(
    private prisma: PrismaService,
    private readonly authorization: AuthorizationService,
  ) {}

  async observationsByProject(
    projectId: number,
    user: AuthenticatedUser,
  ): Promise<ProjectObservationResponse[]> {
    await this.assertProjectExists(projectId);
    await this.authorization.assertProjectMember(user, projectId);

    const observations = await this.prisma.projectObservation.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      select: observationSelect,
    });

    return observations.map(mapObservation);
  }

  async createObservation(params: {
    projectId: number;
    content?: string;
    user: AuthenticatedUser;
  }): Promise<ProjectObservationResponse> {
    await this.assertProjectExists(params.projectId);
    await this.authorization.assertProjectMember(params.user, params.projectId);

    const content = params.content?.trim();

    if (!content) {
      throw new BadRequestException('Observation content is required');
    }

    const observation = await this.prisma.projectObservation.create({
      data: {
        content,
        authorUser: {
          connect: { id: params.user.id },
        },
        project: {
          connect: { id: params.projectId },
        },
      },
      select: observationSelect,
    });

    return mapObservation(observation);
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
}
