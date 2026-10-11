import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  Put,
  BadRequestException,
  NotFoundException,
  ParseIntPipe,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { OptionalCurrentUser } from '../auth/optional-current-user.decorator';
import { Public } from '../auth/public.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  Project as ProjectModel,
  ProjectSource,
  ProjectStatus,
} from '../generated/prisma/client';
import {
  AssignableUserResponse,
  ProjectActorAssignmentResponse,
  ProjectDetailResponse,
  ProjectListResponse,
  MyProjectResponse,
  ProjectUpdateFields,
  ProjectsService,
} from './projects.service';
import { CreateProjectActorAssignmentDTO } from './dto/create-project-actor-assignment.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDTO } from './dto/update-project.dto';

function parseProjectDate(value: string | null): Date | null {
  if (value === null || value.trim().length === 0) {
    return null;
  }

  const parsed = new Date(`${value}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(`Invalid date: ${value}`);
  }

  return parsed;
}

function normalizeOptionalText(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectService: ProjectsService) {}

  @Get('mine')
  async getMyProjects(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MyProjectResponse[]> {
    return this.projectService.projectsForUser(user);
  }

  @Public()
  @Get(':id')
  async getProjectById(
    @Param('id', ParseIntPipe) id: number,
    @OptionalCurrentUser() user?: AuthenticatedUser,
  ): Promise<ProjectDetailResponse> {
    const project = await this.projectService.project({ id }, user);

    if (!project) {
      throw new NotFoundException(`Project ${id} not found`);
    }

    return project;
  }

  @Public()
  @Get()
  async getProjects(
    @OptionalCurrentUser() user?: AuthenticatedUser,
  ): Promise<ProjectListResponse[]> {
    return this.projectService.projects({}, user);
  }

  @Post()
  async createProject(
    @CurrentUser() user: AuthenticatedUser,
    @Body() projectData: CreateProjectDto,
  ): Promise<ProjectDetailResponse> {
    const {
      name,
      description,
      context,
      namep,
      ncedua,
      correo,
      estimatedCost,
      location,
      startDate,
      requiresLegalization,
      isPrivate,
      source,
      sourceDetails,
      facultyAdvisor,
      teamRequirements,
      expectedOutcomes,
      deliverables,
      submissionConsentAt,
    } = projectData;

    const parsedStartDate = startDate
      ? new Date(`${startDate}T00:00:00`)
      : null;

    if (parsedStartDate && Number.isNaN(parsedStartDate.getTime())) {
      throw new BadRequestException('Invalid start date');
    }

    if (!submissionConsentAt) {
      throw new BadRequestException('Submission consent is required');
    }

    const parsedSubmissionConsentAt = new Date(submissionConsentAt);

    if (Number.isNaN(parsedSubmissionConsentAt.getTime())) {
      throw new BadRequestException('Invalid submission consent date');
    }

    if (source === ProjectSource.external_entity && !sourceDetails?.trim()) {
      throw new BadRequestException(
        'Source details are required for external projects',
      );
    }

    const deliverableDescriptions = (deliverables ?? [])
      .map((deliverable) => deliverable.trim())
      .filter((deliverable) => deliverable.length > 0);

    return this.projectService.createProject(user, {
      name,
      description,
      context,
      startDate: parsedStartDate,
      estimatedCost,
      location,
      requiresLegalization: requiresLegalization ?? false,
      isPrivate: isPrivate ?? true,
      source: source ?? ProjectSource.external_entity,
      sourceDetails: sourceDetails?.trim() || null,
      facultyAdvisor: facultyAdvisor?.trim() || null,
      teamRequirements: teamRequirements?.trim() || null,
      expectedOutcomes: expectedOutcomes?.trim() || null,
      submissionConsentAt: parsedSubmissionConsentAt,
      deliverables: deliverableDescriptions.length
        ? {
            create: deliverableDescriptions.map((description) => ({
              description,
            })),
          }
        : undefined,
      naturalProposer: {
        create: {
          fullName: namep,
          idNumber: ncedua?.trim() || null,
          email: correo,
        },
      },
    });
  }

  @Get(':id/assignable-users')
  async getAssignableUsers(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AssignableUserResponse[]> {
    return this.projectService.assignableUsers(user, id);
  }

  @Post(':id/actors')
  async addProjectActorAssignment(
    @Param('id', ParseIntPipe) id: number,
    @Body() assignmentData: CreateProjectActorAssignmentDTO,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProjectActorAssignmentResponse> {
    return this.projectService.addProjectActorAssignment({
      user,
      projectId: id,
      userId: assignmentData.userId,
      role: assignmentData.role,
    });
  }

  @Put(':id')
  async projectUpdate(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdateProjectDTO,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProjectDetailResponse> {
    const fields: ProjectUpdateFields = {};

    if (data.name !== undefined) {
      fields.name = data.name.trim();
    }

    if (data.description !== undefined) {
      fields.description = data.description.trim();
    }

    if (data.context !== undefined) {
      fields.context = data.context.trim();
    }

    if (data.location !== undefined) {
      fields.location = normalizeOptionalText(data.location);
    }

    if (data.source !== undefined) {
      fields.source = data.source;
    }

    if (data.startDate !== undefined) {
      fields.startDate = parseProjectDate(data.startDate);
    }

    if (data.endDate !== undefined) {
      fields.endDate = parseProjectDate(data.endDate);
    }

    if (data.estimatedCost !== undefined) {
      fields.estimatedCost = data.estimatedCost;
    }

    if (data.requiresLegalization !== undefined) {
      fields.requiresLegalization = data.requiresLegalization;
    }

    if (data.isPrivate !== undefined) {
      fields.isPrivate = data.isPrivate;
    }

    if (data.facultyAdvisor !== undefined) {
      fields.facultyAdvisor = normalizeOptionalText(data.facultyAdvisor);
    }

    if (data.teamRequirements !== undefined) {
      fields.teamRequirements = normalizeOptionalText(data.teamRequirements);
    }

    if (data.expectedOutcomes !== undefined) {
      fields.expectedOutcomes = normalizeOptionalText(data.expectedOutcomes);
    }

    if (data.deliverables !== undefined) {
      fields.deliverables = data.deliverables
        .map((deliverable) => deliverable.trim())
        .filter((deliverable) => deliverable.length > 0);
    }

    if (Object.keys(fields).length === 0) {
      throw new BadRequestException('No update fields provided');
    }

    return this.projectService.updateProject({
      user,
      projectId: id,
      fields,
    });
  }

  @Patch(':id/status')
  async transitionProjectStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: { status: ProjectStatus; description?: string },
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProjectDetailResponse> {
    if (!data.status) {
      throw new BadRequestException('A target status is required');
    }

    return this.projectService.transitionProjectStatus({
      user,
      projectId: id,
      nextStatus: data.status,
      description: data.description,
    });
  }

  @Post(':id/phase/advance')
  async advanceProjectPhase(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProjectDetailResponse> {
    return this.projectService.advanceProjectPhase({
      user,
      projectId: id,
    });
  }

  @Post(':id/phase/approvals')
  async approveProjectPhase(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProjectDetailResponse> {
    return this.projectService.approveProjectPhase({
      user,
      projectId: id,
    });
  }

  @Delete(':id/phase/approvals')
  async revokeProjectPhaseApproval(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProjectDetailResponse> {
    return this.projectService.revokeProjectPhaseApproval({
      user,
      projectId: id,
    });
  }

  @Delete(':id')
  async deleteProject(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProjectModel> {
    return this.projectService.deleteProject(user, { id });
  }
}
