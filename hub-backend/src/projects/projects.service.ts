import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  ActorRole,
  Prisma,
  Project,
  ProjectPhase,
  ProjectSource,
  ProjectStatus,
  ReportContentKind,
  UserRole,
} from '../generated/prisma/client';

import { PrismaService } from '../prisma.service';
import { AuthorizationService } from '../auth/authorization.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { EvaluationsService } from '../evaluations/evaluations.service';
import { paginationToSkipTake } from '../common/pagination.dto';
import { ProjectListQueryDto, ProjectSort } from './dto/project-list-query.dto';
import {
  AssignableUserResponse,
  MyProjectInterestResponse,
  MyProjectResponse,
  ProjectActorAssignmentResponse,
  ProjectDetailResponse,
  ProjectInterestResponse,
  ProjectListResponse,
  ProjectWithRelations,
  mapProjectDetailResponse,
  mapProjectListResponse,
  projectInclude,
} from './projects.select';
import {
  formatPendingApprovers,
  nextProjectPhase,
  requiredPhaseApprovers,
  RequiredPhaseApprover,
} from './projects.phase';

export * from './projects.select';
export * from './projects.phase';

export function isValidProjectStatusTransition(
  previousStatus: ProjectStatus,
  nextStatus: ProjectStatus,
): boolean {
  const transitions: Record<ProjectStatus, ProjectStatus[]> = {
    [ProjectStatus.proposed]: [ProjectStatus.approved, ProjectStatus.rejected],
    // `under_review` es legado: los proyectos que quedaron ahí pueden salir,
    // pero ya no se entra en él.
    [ProjectStatus.under_review]: [
      ProjectStatus.approved,
      ProjectStatus.rejected,
    ],
    [ProjectStatus.approved]: [
      ProjectStatus.in_progress,
      ProjectStatus.rejected,
    ],
    [ProjectStatus.in_progress]: [
      ProjectStatus.paused,
      ProjectStatus.closed,
      ProjectStatus.cancelled,
    ],
    [ProjectStatus.paused]: [
      ProjectStatus.in_progress,
      ProjectStatus.cancelled,
    ],
    [ProjectStatus.closed]: [],
    [ProjectStatus.cancelled]: [],
    [ProjectStatus.rejected]: [],
  };
  return transitions[previousStatus].includes(nextStatus);
}

type PendingMinimumMilestone = { id: number; title: string };

function formatPendingMilestones(
  milestones: PendingMinimumMilestone[],
): string {
  return milestones.map((milestone) => milestone.title).join(', ');
}

/** Aprobadores de la siguiente fase que todavía no dieron su visto bueno. */
function pendingPhaseApprovers(
  project: {
    proposerUserId: number | null;
    proposer: { fullName: string } | null;
    actorAssignments: { userId: number; user: { fullName: string } }[];
    phaseApprovals: { phase: ProjectPhase; approverUserId: number }[];
  },
  nextPhase: ProjectPhase,
): RequiredPhaseApprover[] {
  const approved = new Set(
    project.phaseApprovals
      .filter((approval) => approval.phase === nextPhase)
      .map((approval) => approval.approverUserId),
  );

  return requiredPhaseApprovers({
    proposerUserId: project.proposerUserId,
    proposerFullName: project.proposer?.fullName ?? null,
    evaluators: project.actorAssignments.map((assignment) => ({
      userId: assignment.userId,
      fullName: assignment.user.fullName,
    })),
  }).filter((approver) => !approved.has(approver.userId));
}

export const DEFAULT_FINAL_MILESTONE_TITLE = 'Documento final';

export const DEFAULT_FINAL_REPORT_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export const DEFAULT_FINAL_REPORT_MAX_FILES = 1;

/**
 * Fecha por defecto del hito "Documento final": ocho meses después del inicio
 * del proyecto o desde hoy si no hay fecha de inicio.
 */
export function defaultFinalMilestoneDueDate(
  startDate: Date | string | null | undefined,
): Date {
  const parsed = startDate ? new Date(startDate) : new Date();
  const base = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  const dueDate = new Date(base);
  dueDate.setMonth(dueDate.getMonth() + 8);
  return dueDate;
}

function rethrowProjectCreateError(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    const target = Array.isArray(error.meta?.target)
      ? error.meta.target.join(', ')
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
/** Campos editables del proyecto, ya normalizados por el controlador. */

export type ProjectUpdateFields = {
  name?: string;
  description?: string;
  context?: string;
  location?: string | null;
  source?: ProjectSource;
  sourceDetails?: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
  estimatedCost?: Prisma.Decimal | number | string | null;
  requiresLegalization?: boolean;
  isPrivate?: boolean;
  facultyAdvisor?: string | null;
  teamRequirements?: string | null;
  expectedOutcomes?: string | null;
  deliverables?: string[];
};
/** Valores actuales o resultantes de los campos auditables. */

type ProjectEditableValues = {
  name: string;
  description: string;
  context: string;
  location: string | null;
  source: ProjectSource;
  sourceDetails: string | null;
  startDate: Date | null;
  endDate: Date | null;
  estimatedCost: Prisma.Decimal | number | string | null;
  requiresLegalization: boolean;
  isPrivate: boolean;
  facultyAdvisor: string | null;
  teamRequirements: string | null;
  expectedOutcomes: string | null;
  deliverables: string[];
};
/** Campos auditables, en el orden en que se registran en el historial. */

const EDITABLE_PROJECT_FIELDS = [
  'name',
  'description',
  'context',
  'location',
  'source',
  'sourceDetails',
  'startDate',
  'endDate',
  'estimatedCost',
  'requiresLegalization',
  'isPrivate',
  'facultyAdvisor',
  'teamRequirements',
  'expectedOutcomes',
  'deliverables',
] as const;

type EditableProjectField = (typeof EDITABLE_PROJECT_FIELDS)[number];

export type ProjectChangeRow = {
  field: string;
  previousValue: string | null;
  newValue: string | null;
};

function serializeProjectChangeValue(
  field: EditableProjectField,
  value: unknown,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (field === 'deliverables') {
    const list = Array.isArray(value) ? value : [];
    return JSON.stringify(
      list
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean),
    );
  }
  if (field === 'estimatedCost') {
    return new Prisma.Decimal(value as string | number).toString();
  }
  if (field === 'startDate' || field === 'endDate') {
    return new Date(value as string).toISOString();
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number') {
    return String(value);
  }
  return null;
}
/** Compara los valores previos y nuevos y devuelve una fila por campo cambiado. */

export function diffProjectUpdate(
  previous: ProjectEditableValues,
  next: ProjectEditableValues,
): ProjectChangeRow[] {
  const rows: ProjectChangeRow[] = [];
  for (const field of EDITABLE_PROJECT_FIELDS) {
    const previousValue = serializeProjectChangeValue(field, previous[field]);
    const newValue = serializeProjectChangeValue(field, next[field]);
    if (previousValue !== newValue) {
      rows.push({ field, previousValue, newValue });
    }
  }
  return rows;
}

@Injectable()
export class ProjectsService {
  constructor(
    readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
    private readonly evaluations: EvaluationsService,
  ) {}
  async project(
    projectWhereUniqueInput: Prisma.ProjectWhereUniqueInput,
    viewer?: AuthenticatedUser,
  ): Promise<ProjectDetailResponse | null> {
    const project = await this.prisma.project.findFirst({
      where: {
        ...projectWhereUniqueInput,
        ...this.authorization.projectVisibilityWhere(viewer),
      },
      include: projectInclude,
    });

    if (!project) {
      return null;
    }

    const canViewSensitiveData = this.canViewSensitiveData(project, viewer);
    const viewerInterest = viewer
      ? await this.prisma.projectInterest.findUnique({
          where: {
            projectId_userId: {
              projectId: project.id,
              userId: viewer.id,
            },
          },
          select: {
            id: true,
            message: true,
            createdAt: true,
          },
        })
      : null;

    const response = mapProjectDetailResponse(
      project,
      canViewSensitiveData,
      viewer,
      {
        canExpressInterest:
          viewer != null &&
          viewerInterest == null &&
          this.authorization.canExpressInterest(viewer, project),
        viewerInterest,
      },
    );

    if (response.canViewSensitiveData) {
      response.evaluationGate = await this.evaluations.phaseGate(
        project.id,
        project.phase,
      );
    }

    return response;
  }
  async projects(
    params: {
      skip?: number;
      take?: number;
      cursor?: Prisma.ProjectWhereUniqueInput;
      where?: Prisma.ProjectWhereInput;
      orderBy?:
        | Prisma.ProjectOrderByWithRelationInput
        | Prisma.ProjectOrderByWithRelationInput[];
    },
    viewer?: AuthenticatedUser,
  ): Promise<ProjectListResponse[]> {
    const { skip, take, cursor, where, orderBy } = params;
    const visibilityWhere = this.authorization.projectVisibilityWhere(viewer);
    const projects = await this.prisma.project.findMany({
      skip,
      take,
      cursor,
      where: {
        AND: where ? [where, visibilityWhere] : [visibilityWhere],
      },
      orderBy,
      include: projectInclude,
    });
    return projects.map((project) =>
      mapProjectListResponse(
        project,
        this.canViewSensitiveData(project, viewer),
      ),
    );
  }

  /** Listado paginado con los filtros y el orden que llegan por query string. */
  async listProjects(
    query: ProjectListQueryDto,
    viewer?: AuthenticatedUser,
  ): Promise<ProjectListResponse[]> {
    const { skip, take } = paginationToSkipTake(query);
    const where = this.buildProjectFiltersWhere(query, viewer);

    return this.projects(
      {
        skip,
        take,
        where,
        orderBy: this.buildProjectOrderBy(query.sort),
      },
      viewer,
    );
  }

  private buildProjectFiltersWhere(
    query: ProjectListQueryDto,
    viewer?: AuthenticatedUser,
  ): Prisma.ProjectWhereInput | undefined {
    const conditions: Prisma.ProjectWhereInput[] = [];
    const search = query.search?.trim();

    conditions.push(...this.buildParticipationWhere(query, viewer));

    if (query.hasTeam !== undefined) {
      conditions.push({
        actorAssignments: query.hasTeam ? { some: {} } : { none: {} },
      });
    }

    if (query.isPrivate !== undefined) {
      conditions.push({ isPrivate: query.isPrivate });
    }

    if (search) {
      conditions.push({
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { context: { contains: search, mode: 'insensitive' } },
          { location: { contains: search, mode: 'insensitive' } },
          {
            naturalProposer: {
              is: {
                fullName: { contains: search, mode: 'insensitive' },
              },
            },
          },
          {
            proposer: {
              is: { fullName: { contains: search, mode: 'insensitive' } },
            },
          },
        ],
      });
    }

    if (query.status?.length) {
      conditions.push({ status: { in: query.status } });
    }

    if (query.proposer?.length) {
      conditions.push({
        OR: query.proposer.flatMap((fullName) => [
          { naturalProposer: { is: { fullName } } },
          { proposer: { is: { fullName } } },
        ]),
      });
    }

    if (query.source?.length) {
      conditions.push({ source: { in: query.source } });
    }

    if (query.requiresLegalization !== undefined) {
      conditions.push({
        requiresLegalization: query.requiresLegalization,
      });
    }

    conditions.push(...this.buildYearWhere(query));

    return conditions.length > 0 ? { AND: conditions } : undefined;
  }

  private buildParticipationWhere(
    query: ProjectListQueryDto,
    viewer?: AuthenticatedUser,
  ): Prisma.ProjectWhereInput[] {
    if (!query.assignedToMe && !query.proposedByMe) {
      return [];
    }

    if (!viewer) {
      return [{ id: -1 }];
    }

    const participationConditions: Prisma.ProjectWhereInput[] = [];

    if (query.assignedToMe) {
      participationConditions.push({
        actorAssignments: { some: { userId: viewer.id } },
      });
    }

    if (query.proposedByMe) {
      participationConditions.push({ proposerUserId: viewer.id });
    }

    return [{ OR: participationConditions }];
  }

  private buildYearWhere(
    query: ProjectListQueryDto,
  ): Prisma.ProjectWhereInput[] {
    const yearConditions: Prisma.ProjectWhereInput[] = [];

    for (const year of query.year ?? []) {
      yearConditions.push({
        startDate: {
          gte: new Date(Date.UTC(year, 0, 1)),
          lt: new Date(Date.UTC(year + 1, 0, 1)),
        },
      });
    }

    if (query.withoutYear) {
      yearConditions.push({ startDate: null });
    }

    return yearConditions.length > 0 ? [{ OR: yearConditions }] : [];
  }

  private buildProjectOrderBy(
    sort: ProjectSort = 'relevance',
  ): Prisma.ProjectOrderByWithRelationInput[] {
    switch (sort) {
      case 'name-asc':
        return [{ name: 'asc' }, { id: 'asc' }];
      case 'name-desc':
        return [{ name: 'desc' }, { id: 'desc' }];
      case 'year-desc':
        return [{ startDate: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }];
      case 'year-asc':
        return [{ startDate: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }];
      default:
        return [{ createdAt: 'desc' }, { id: 'desc' }];
    }
  }
  /**
   * Los miembros pueden leer los datos sensibles del proyecto: admins,
   * directivos, el proponente y los actores asignados.
   */
  private canViewSensitiveData(
    project: ProjectWithRelations,
    viewer?: AuthenticatedUser,
  ): boolean {
    if (!viewer) {
      return false;
    }

    return this.authorization.canViewProjectData(viewer, project);
  }
  /**
   * Proyectos que el usuario puede seguir desde su perfil: los que propuso y
   * los que tiene asignados. Los duplicados se fusionan, dando prioridad al rol
   * de asignación cuando aplican ambos.
   */
  async projectsForUser(user: AuthenticatedUser): Promise<MyProjectResponse[]> {
    const [assignments, proposed] = await Promise.all([
      this.prisma.projectActorAssignment.findMany({
        where: { userId: user.id },
        include: { project: true },
        orderBy: { assignedAt: 'desc' },
      }),
      this.prisma.project.findMany({
        where: { proposerUserId: user.id },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    const visible = new Map<number, MyProjectResponse>();
    for (const project of proposed) {
      visible.set(project.id, {
        id: project.id,
        name: project.name,
        status: project.status,
        startDate: project.startDate,
        location: project.location,
        isPrivate: project.isPrivate,
        myRole: null,
        isProposer: true,
      });
    }
    for (const { project, role } of assignments) {
      const existing = visible.get(project.id);
      visible.set(project.id, {
        id: project.id,
        name: project.name,
        status: project.status,
        startDate: project.startDate,
        location: project.location,
        isPrivate: project.isPrivate,
        myRole: role,
        isProposer: existing?.isProposer ?? false,
      });
    }
    return [...visible.values()];
  }
  /**
   * Registra el interés de un estudiante en un proyecto aprobado. Solo se
   * permite a estudiantes que no sean el proponente ni formen ya parte del
   * equipo; el mensaje es opcional.
   */
  async addProjectInterest(params: {
    user: AuthenticatedUser;
    projectId: number;
    message?: string;
  }): Promise<ProjectDetailResponse> {
    const { user, projectId, message } = params;

    if (
      !user.roles.includes(UserRole.student) ||
      this.authorization.canReviewAnyProject(user)
    ) {
      throw new ForbiddenException(
        'Only students can express interest in a project',
      );
    }

    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        ...this.authorization.projectVisibilityWhere(user),
      },
      select: {
        id: true,
        status: true,
        proposerUserId: true,
        actorAssignments: {
          where: { userId: user.id },
          select: { id: true },
        },
      },
    });

    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }

    if (project.status !== ProjectStatus.approved) {
      throw new ConflictException(
        'Only approved projects accept new interests',
      );
    }

    if (project.proposerUserId === user.id) {
      throw new ConflictException(
        'You cannot express interest in your own project',
      );
    }

    if (project.actorAssignments.length > 0) {
      throw new ConflictException('You are already assigned to this project');
    }

    const existing = await this.prisma.projectInterest.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: user.id,
        },
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException(
        'You have already expressed interest in this project',
      );
    }

    try {
      await this.prisma.projectInterest.create({
        data: {
          projectId,
          userId: user.id,
          message: message?.trim() || null,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'You have already expressed interest in this project',
        );
      }
      throw error;
    }

    return this.projectDetailOrThrow(projectId, user);
  }

  /** Retira el interés propio. Es idempotente. */
  async removeProjectInterest(
    user: AuthenticatedUser,
    projectId: number,
  ): Promise<void> {
    await this.prisma.projectInterest.deleteMany({
      where: { projectId, userId: user.id },
    });
  }

  /** Proyectos en los que el usuario expresó interés, del más reciente al más antiguo. */
  async projectsForUserInterests(
    user: AuthenticatedUser,
  ): Promise<MyProjectInterestResponse[]> {
    const interests = await this.prisma.projectInterest.findMany({
      where: { userId: user.id },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            status: true,
            startDate: true,
            location: true,
            isPrivate: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return interests.map(({ project, message, createdAt }) => ({
      id: project.id,
      name: project.name,
      status: project.status,
      startDate: project.startDate,
      location: project.location,
      isPrivate: project.isPrivate,
      interestMessage: message,
      interestedAt: createdAt,
    }));
  }

  /** Estudiantes interesados en el proyecto; solo para quien puede asignar actores. */
  async projectInterests(
    user: AuthenticatedUser,
    projectId: number,
  ): Promise<ProjectInterestResponse[]> {
    await this.authorization.assertCanAssignActors(user, projectId);

    const interests = await this.prisma.projectInterest.findMany({
      where: { projectId },
      include: {
        user: {
          select: { id: true, fullName: true, email: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return interests.map((interest) => ({
      id: interest.id,
      projectId: interest.projectId,
      message: interest.message,
      createdAt: interest.createdAt,
      user: {
        id: interest.user.id,
        fullName: interest.user.fullName,
        email: interest.user.email,
      },
    }));
  }

  /** Descarta un interés; solo para quien puede asignar actores. */
  async dismissProjectInterest(params: {
    user: AuthenticatedUser;
    projectId: number;
    interestId: number;
  }): Promise<void> {
    const { user, projectId, interestId } = params;
    await this.authorization.assertCanAssignActors(user, projectId);

    const result = await this.prisma.projectInterest.deleteMany({
      where: { id: interestId, projectId },
    });

    if (result.count === 0) {
      throw new NotFoundException(`Project interest ${interestId} not found`);
    }
  }
  async createProject(
    user: AuthenticatedUser,
    data: Prisma.ProjectCreateInput,
  ): Promise<ProjectDetailResponse> {
    this.authorization.assertCanCreateProject(user);
    try {
      const project = await this.createProjectRecord({
        ...data,
        proposer: { connect: { id: user.id } },
      });
      return mapProjectDetailResponse(project, true, user);
    } catch (error) {
      rethrowProjectCreateError(error);
    }
  }
  private createProjectRecord(
    data: Prisma.ProjectCreateInput,
  ): Promise<ProjectWithRelations> {
    const dueDate = defaultFinalMilestoneDueDate(data.startDate);

    return this.prisma.$transaction(async (transaction) => {
      // Todo proyecto nace con el hito mínimo "Documento final" del segundo
      // semestre y su entrega asociada para adjuntar el documento.
      const areaMilestones: Record<string, string[]> = {
        systems: [
          'Levantamiento de requisitos',
          'Diseño de la solución',
          'Desarrollo del prototipo',
          'Pruebas y validación',
        ],
        industrial: [
          'Diagnóstico del proceso',
          'Diseño de la propuesta de mejora',
          'Implementación o simulación',
          'Evaluación de resultados',
        ],
        civil: [
          'Diagnóstico y levantamiento de información',
          'Diseño preliminar',
          'Desarrollo de la propuesta técnica',
          'Validación de la solución',
        ],
        electrical: [
          'Levantamiento de requerimientos técnicos',
          'Diseño eléctrico o electrónico',
          'Implementación del prototipo',
          'Pruebas de funcionamiento',
        ],
        mechanical: [
          'Análisis de necesidades',
          'Diseño mecánico preliminar',
          'Construcción o simulación del prototipo',
          'Pruebas y ajustes',
        ],
        environmental: [
          'Diagnóstico ambiental',
          'Diseño de la estrategia de intervención',
          'Implementación o evaluación piloto',
          'Evaluación del impacto',
        ],
        other: [
          'Definición de requerimientos',
          'Diseño de la propuesta',
          'Desarrollo o implementación',
          'Validación de resultados',
        ],
      };
      const fallbackMilestones = [
        'Definición de requerimientos',
        'Diseño de la propuesta',
        'Desarrollo o implementación',
        'Validación de resultados',
      ];
      const selectedAreas = (data.engineeringArea ?? '')
        .split(',')
        .map((area) => area.trim())
        .filter(Boolean);
      const milestoneTitles = Array.from(
        new Set(
          selectedAreas.flatMap(
            (area) => areaMilestones[area] ?? fallbackMilestones,
          ),
        ),
      );
      const minimumMilestoneCount = milestoneTitles.length;
      const milestoneData = [
        ...milestoneTitles.map((title, index) => {
          const milestoneDueDate = data.startDate
            ? new Date(data.startDate)
            : new Date();
          const dueMonth = Math.max(
            1,
            Math.floor(((index + 1) * 7) / (minimumMilestoneCount + 1)),
          );
          milestoneDueDate.setMonth(milestoneDueDate.getMonth() + dueMonth);

          return {
            title,
            phase:
              index < Math.ceil(minimumMilestoneCount / 2)
                ? ProjectPhase.semester_1
                : ProjectPhase.semester_2,
            isMinimum: true,
            completed: false,
            dueDate: milestoneDueDate,
          };
        }),
        {
          title: DEFAULT_FINAL_MILESTONE_TITLE,
          phase: ProjectPhase.semester_2,
          isMinimum: true,
          completed: false,
          dueDate,
        },
      ];

      const project = await transaction.project.create({
        data: {
          ...data,
          milestones: { create: milestoneData },
        },
        select: { id: true, milestones: { select: { id: true, title: true } } },
      });

      const milestoneId = project.milestones.find(
        (milestone) => milestone.title === DEFAULT_FINAL_MILESTONE_TITLE,
      )?.id;

      if (milestoneId !== undefined) {
        const report = await transaction.projectReport.create({
          data: {
            projectId: project.id,
            title: DEFAULT_FINAL_MILESTONE_TITLE,
            dueDate,
            type: ReportContentKind.file,
            allowedMimeTypes: DEFAULT_FINAL_REPORT_MIME_TYPES,
            maxFiles: DEFAULT_FINAL_REPORT_MAX_FILES,
          },
          select: { id: true },
        });

        await transaction.milestoneReportLink.create({
          data: { milestoneId, reportId: report.id },
        });
      }

      return transaction.project.findUniqueOrThrow({
        where: { id: project.id },
        include: projectInclude,
      });
    });
  }
  /**
   * Edita los datos del proyecto y registra una fila de historial por cada
   * campo que cambió. Solo administradores, directivos y actores asignados; un
   * proyecto cerrado o rechazado es de solo lectura.
   */
  async updateProject(params: {
    user: AuthenticatedUser;
    projectId: number;
    fields: ProjectUpdateFields;
  }): Promise<ProjectDetailResponse> {
    const { user, projectId, fields } = params;
    const current = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        status: true,
        proposerUserId: true,
        name: true,
        description: true,
        context: true,
        location: true,
        source: true,
        sourceDetails: true,
        startDate: true,
        endDate: true,
        estimatedCost: true,
        requiresLegalization: true,
        isPrivate: true,
        facultyAdvisor: true,
        teamRequirements: true,
        expectedOutcomes: true,
        deliverables: {
          select: { description: true },
          orderBy: { id: 'asc' },
        },
      },
    });
    if (!current) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }
    await this.authorization.assertCanEditProjectDetails(user, {
      id: current.id,
      proposerUserId: current.proposerUserId,
      status: current.status,
    });
    if (
      current.status === ProjectStatus.closed ||
      current.status === ProjectStatus.rejected
    ) {
      throw new ConflictException(
        'Projects cannot be edited once closed or rejected',
      );
    }
    const currentValues: ProjectEditableValues = {
      name: current.name,
      description: current.description,
      context: current.context,
      location: current.location,
      source: current.source,
      sourceDetails: current.sourceDetails,
      startDate: current.startDate,
      endDate: current.endDate,
      estimatedCost: current.estimatedCost,
      requiresLegalization: current.requiresLegalization,
      isPrivate: current.isPrivate,
      facultyAdvisor: current.facultyAdvisor,
      teamRequirements: current.teamRequirements,
      expectedOutcomes: current.expectedOutcomes,
      deliverables: current.deliverables.map(
        (deliverable) => deliverable.description,
      ),
    };
    const changeRows = diffProjectUpdate(
      currentValues,
      this.mergeUpdateFields(currentValues, fields),
    );
    const data = this.buildProjectUpdateData(fields);
    const project = await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.project.update({
        where: { id: projectId },
        data,
        include: projectInclude,
      });
      if (changeRows.length > 0) {
        await transaction.projectChangeHistory.createMany({
          data: changeRows.map((row) => ({
            projectId,
            authorUserId: user.id,
            field: row.field,
            previousValue: row.previousValue,
            newValue: row.newValue,
          })),
        });
      }
      return updated;
    });
    return mapProjectDetailResponse(project, true, user);
  }
  /** Aplica los campos enviados sobre los valores actuales del proyecto. */
  private mergeUpdateFields(
    current: ProjectEditableValues,
    fields: ProjectUpdateFields,
  ): ProjectEditableValues {
    return {
      name: fields.name ?? current.name,
      description: fields.description ?? current.description,
      context: fields.context ?? current.context,
      location:
        fields.location !== undefined ? fields.location : current.location,
      source: fields.source ?? current.source,
      sourceDetails:
        fields.sourceDetails !== undefined
          ? fields.sourceDetails
          : current.sourceDetails,
      startDate:
        fields.startDate !== undefined ? fields.startDate : current.startDate,
      endDate: fields.endDate !== undefined ? fields.endDate : current.endDate,
      estimatedCost:
        fields.estimatedCost !== undefined
          ? fields.estimatedCost
          : current.estimatedCost,
      requiresLegalization:
        fields.requiresLegalization ?? current.requiresLegalization,
      isPrivate: fields.isPrivate ?? current.isPrivate,
      facultyAdvisor:
        fields.facultyAdvisor !== undefined
          ? fields.facultyAdvisor
          : current.facultyAdvisor,
      teamRequirements:
        fields.teamRequirements !== undefined
          ? fields.teamRequirements
          : current.teamRequirements,
      expectedOutcomes:
        fields.expectedOutcomes !== undefined
          ? fields.expectedOutcomes
          : current.expectedOutcomes,
      deliverables: fields.deliverables ?? current.deliverables,
    };
  }
  private buildProjectUpdateData(
    fields: ProjectUpdateFields,
  ): Prisma.ProjectUpdateInput {
    const data: Prisma.ProjectUpdateInput = {};
    if (fields.name !== undefined) data.name = fields.name;
    if (fields.description !== undefined) data.description = fields.description;
    if (fields.context !== undefined) data.context = fields.context;
    if (fields.location !== undefined) data.location = fields.location;
    if (fields.source !== undefined) data.source = fields.source;
    if (fields.sourceDetails !== undefined)
      data.sourceDetails = fields.sourceDetails;
    if (fields.startDate !== undefined) data.startDate = fields.startDate;
    if (fields.endDate !== undefined) data.endDate = fields.endDate;
    if (fields.estimatedCost !== undefined)
      data.estimatedCost = fields.estimatedCost;
    if (fields.requiresLegalization !== undefined)
      data.requiresLegalization = fields.requiresLegalization;
    if (fields.isPrivate !== undefined) data.isPrivate = fields.isPrivate;
    if (fields.facultyAdvisor !== undefined)
      data.facultyAdvisor = fields.facultyAdvisor;
    if (fields.teamRequirements !== undefined)
      data.teamRequirements = fields.teamRequirements;
    if (fields.expectedOutcomes !== undefined)
      data.expectedOutcomes = fields.expectedOutcomes;
    if (fields.deliverables !== undefined) {
      data.deliverables = {
        deleteMany: {},
        create: fields.deliverables.map((description) => ({ description })),
      };
    }
    return data;
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
      select: { id: true, status: true, phase: true },
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
    const trimmedDescription = description?.trim() || null;
    if (!trimmedDescription && !user.roles.includes(UserRole.admin)) {
      throw new BadRequestException(
        'A reason is required to change the project status',
      );
    }
    if (nextStatus === ProjectStatus.closed) {
      const pendingMinimums = await this.incompleteMinimumMilestones(projectId);
      if (pendingMinimums.length > 0) {
        throw new ConflictException(
          `Cannot close the project while minimum milestones are incomplete: ${formatPendingMilestones(pendingMinimums)}`,
        );
      }
      await this.evaluations.assertPhaseEvaluated(
        projectId,
        currentProject.phase,
        'close',
      );
    }
    await this.prisma.$transaction(async (transaction) => {
      // Actualización con concurrencia optimista: si el estado cambió desde la
      // lectura, `count` es 0 y se rechaza en lugar de sobrescribir una
      // transición concurrente.
      const result = await transaction.project.updateMany({
        where: { id: projectId, status: currentProject.status },
        data: { status: nextStatus },
      });

      if (result.count !== 1) {
        throw new ConflictException(
          'The project status changed concurrently; please retry',
        );
      }

      await transaction.projectStatusHistory.create({
        data: {
          projectId,
          previousStatus: currentProject.status,
          nextStatus,
          description: trimmedDescription,
          authorUserId: user.id,
        },
      });
    });
    const project = await this.project({ id: projectId }, user);
    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }
    return project;
  }
  /**
   * Avanza el proyecto al siguiente semestre (fase) cuando todos sus hitos
   * mínimos de la fase actual están completos y el proponente y los evaluadores
   * asignados ya dieron su visto bueno.
   */
  async advanceProjectPhase(params: {
    user: AuthenticatedUser;
    projectId: number;
  }): Promise<ProjectDetailResponse> {
    const { user, projectId } = params;
    const currentProject = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        status: true,
        phase: true,
        proposerUserId: true,
        proposer: { select: { fullName: true } },
        actorAssignments: {
          where: { role: ActorRole.evaluator },
          select: { userId: true, user: { select: { fullName: true } } },
        },
        phaseApprovals: {
          select: { phase: true, approverUserId: true },
        },
      },
    });
    if (!currentProject) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }
    if (currentProject.status !== ProjectStatus.in_progress) {
      throw new BadRequestException(
        'The project must be in progress to advance its phase',
      );
    }
    await this.authorization.assertCanManageProject(user, projectId);

    const nextPhase = nextProjectPhase(currentProject.phase);
    if (!nextPhase) {
      throw new BadRequestException(
        'The project is already in its final phase',
      );
    }

    await this.evaluations.assertPhaseEvaluated(
      projectId,
      currentProject.phase,
      'advance',
    );

    const pendingMinimums = await this.incompleteMinimumMilestones(projectId, [
      currentProject.phase,
    ]);
    if (pendingMinimums.length > 0) {
      throw new ConflictException(
        `Cannot advance to the next phase while minimum milestones are incomplete: ${formatPendingMilestones(pendingMinimums)}`,
      );
    }

    const pendingApprovers = pendingPhaseApprovers(currentProject, nextPhase);
    if (pendingApprovers.length > 0) {
      throw new ConflictException(
        `Cannot advance to the next phase until it is approved by: ${formatPendingApprovers(pendingApprovers)}`,
      );
    }

    await this.prisma.$transaction(async (transaction) => {
      await transaction.project.update({
        where: { id: projectId },
        data: { phase: nextPhase },
      });
      await transaction.projectChangeHistory.create({
        data: {
          projectId,
          authorUserId: user.id,
          field: 'phase',
          previousValue: currentProject.phase,
          newValue: nextPhase,
        },
      });
    });

    const project = await this.project({ id: projectId }, user);
    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }
    return project;
  }
  /**
   * Registra el visto bueno del usuario actual (proponente del proyecto o
   * evaluador asignado) para avanzar a la siguiente fase. Es idempotente.
   */
  async approveProjectPhase(params: {
    user: AuthenticatedUser;
    projectId: number;
  }): Promise<ProjectDetailResponse> {
    const { user, projectId } = params;
    const nextPhase = await this.loadApprovablePhaseProject(user, projectId);

    await this.prisma.projectPhaseApproval.upsert({
      where: {
        projectId_phase_approverUserId: {
          projectId,
          phase: nextPhase,
          approverUserId: user.id,
        },
      },
      create: { projectId, phase: nextPhase, approverUserId: user.id },
      update: {},
    });

    return this.projectDetailOrThrow(projectId, user);
  }
  /**
   * Retira el visto bueno del usuario actual para la siguiente fase. Es
   * idempotente: si no había aprobado, no falla.
   */
  async revokeProjectPhaseApproval(params: {
    user: AuthenticatedUser;
    projectId: number;
  }): Promise<ProjectDetailResponse> {
    const { user, projectId } = params;
    const nextPhase = await this.loadApprovablePhaseProject(user, projectId);

    await this.prisma.projectPhaseApproval.deleteMany({
      where: { projectId, phase: nextPhase, approverUserId: user.id },
    });

    return this.projectDetailOrThrow(projectId, user);
  }
  /**
   * Carga el proyecto y exige que el usuario pueda aprobar su siguiente fase;
   * devuelve la fase destino de la aprobación.
   */
  private async loadApprovablePhaseProject(
    user: AuthenticatedUser,
    projectId: number,
  ): Promise<ProjectPhase> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, status: true, phase: true, proposerUserId: true },
    });
    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }

    const nextPhase = this.assertPhaseApprovable(project);
    await this.authorization.assertCanApproveProjectPhase(user, project);
    return nextPhase;
  }
  /**
   * Valida que el proyecto admita aprobaciones de fase y devuelve la fase
   * destino de la aprobación.
   */
  private assertPhaseApprovable(project: {
    status: ProjectStatus;
    phase: ProjectPhase;
  }): ProjectPhase {
    if (project.status !== ProjectStatus.in_progress) {
      throw new BadRequestException(
        'The project must be in progress to approve its phase',
      );
    }

    const nextPhase = nextProjectPhase(project.phase);
    if (!nextPhase) {
      throw new BadRequestException(
        'The project is already in its final phase',
      );
    }
    return nextPhase;
  }
  /** Detalle del proyecto o 404, como el resto de mutaciones. */
  private async projectDetailOrThrow(
    projectId: number,
    user: AuthenticatedUser,
  ): Promise<ProjectDetailResponse> {
    const project = await this.project({ id: projectId }, user);
    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }
    return project;
  }
  /**
   * Hitos mínimos sin completar. Si se pasan fases, solo se consideran los de
   * esas fases más los que no tienen fase (globales).
   */
  private async incompleteMinimumMilestones(
    projectId: number,
    phases?: ProjectPhase[],
  ): Promise<PendingMinimumMilestone[]> {
    const phaseFilter =
      phases && phases.length > 0
        ? { OR: [{ phase: { in: phases } }, { phase: null }] }
        : {};
    return this.prisma.projectMilestones.findMany({
      where: {
        projectId,
        isMinimum: true,
        completed: false,
        ...phaseFilter,
      },
      select: { id: true, title: true },
      orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
    });
  }
  async deleteProject(
    user: AuthenticatedUser,
    where: Prisma.ProjectWhereUniqueInput,
  ): Promise<Project> {
    const projectId = this.projectIdFromWhere(where);
    await this.authorization.assertCanManageProject(user, projectId);
    return this.prisma.project.delete({ where });
  }
  async assignableUsers(
    user: AuthenticatedUser,
    projectId: number,
  ): Promise<AssignableUserResponse[]> {
    await this.authorization.assertCanAssignActors(user, projectId);
    const users = await this.prisma.user.findMany({
      orderBy: { fullName: 'asc' },
      select: {
        id: true,
        fullName: true,
        email: true,
        roleAssignments: { select: { role: true } },
      },
    });
    return users.map((candidate) => ({
      id: candidate.id,
      fullName: candidate.fullName,
      email: candidate.email,
      roles: candidate.roleAssignments.map(({ role }) => role),
    }));
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
    return this.prisma.$transaction(async (transaction) => {
      const assignment = await transaction.projectActorAssignment.create({
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

      // Al asignar al estudiante su interés deja de tener sentido: pasa a
      // formar parte del equipo y desaparece de la lista de interesados.
      await transaction.projectInterest.deleteMany({
        where: { projectId, userId },
      });

      return assignment;
    });
  }
  private projectIdFromWhere(where: Prisma.ProjectWhereUniqueInput): number {
    if (typeof where.id !== 'number') {
      throw new BadRequestException('A numeric project id is required');
    }
    return where.id;
  }
}
