import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActorRole,
  Prisma,
  UserRole,
  ProjectStatus,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma.service';
import { AuthenticatedUser } from './auth.types';
import { ACTOR_ROLE_LICENSES, hasActorRoleLicense } from './actor-role-license';
import { PhaseApprovalKind } from '../projects/projects.phase';

/**
 * Estados en los que un proyecto no privado es visible para usuarios
 * autenticados. Los visitantes anónimos solo ven los `closed`; `rejected`,
 * `cancelled` y las propuestas (`proposed`/`under_review` legado) nunca se
 * publican.
 */
export const PUBLIC_PROJECT_STATUSES: ProjectStatus[] = [
  ProjectStatus.approved,
  ProjectStatus.in_progress,
  ProjectStatus.paused,
  ProjectStatus.closed,
];

@Injectable()
export class AuthorizationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Acceso de LECTURA sensible (observaciones, hitos, anexos y entregas):
   * reservado al proponente, los actores asignados y los revisores. Los
   * proyectos públicos solo exponen su información base en el listado y el
   * detalle; no autoriza mutaciones (ver {@link assertCanWriteProjectData}).
   */
  async assertProjectMember(
    user: AuthenticatedUser,
    projectId: number,
  ): Promise<void> {
    if (await this.canViewProject(user, projectId)) {
      return;
    }

    throw new ForbiddenException('You do not have access to this project');
  }

  /**
   * Acceso de ESCRITURA: solo administradores, el proponente o un actor
   * asignado al proyecto. A diferencia de la lectura, un revisor global
   * (directivo) sin asignación NO puede escribir en proyectos ajenos, y los
   * proyectos públicos no otorgan escritura a extraños.
   */
  async assertCanWriteProjectData(
    user: AuthenticatedUser,
    projectId: number,
  ): Promise<void> {
    if (user.roles.includes(UserRole.admin)) {
      return;
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        proposerUserId: true,
        actorAssignments: { select: { userId: true } },
      },
    });

    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }

    if (project.proposerUserId === user.id) {
      return;
    }

    if (
      project.actorAssignments.some(
        (assignment) => assignment.userId === user.id,
      )
    ) {
      return;
    }

    throw new ForbiddenException(
      'You do not have permission to modify this project',
    );
  }

  /**
   * Los directivos revisan cualquier proyecto sin asignarse y los
   * administradores pasan siempre. El resto de roles solo ve proyectos en los
   * que participa (proponente o actor asignado).
   */
  canReviewAnyProject(user: AuthenticatedUser): boolean {
    return (
      user.roles.includes(UserRole.admin) ||
      user.roles.includes(UserRole.directivo)
    );
  }

  /**
   * Los miembros son usuarios con una relación sensible con el proyecto: su
   * proponente, sus actores asignados o un directivo/admin.
   */
  async canViewProject(
    user: AuthenticatedUser,
    projectId: number,
  ): Promise<boolean> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        proposerUserId: true,
        actorAssignments: { select: { userId: true } },
      },
    });

    if (!project) {
      return false;
    }

    return this.canViewProjectData(user, project);
  }

  /**
   * Variante pura para quien ya tiene el proyecto cargado (por ejemplo los
   * listados), de modo que no se dispare una consulta por proyecto.
   */
  canViewProjectData(
    user: AuthenticatedUser,
    project: {
      proposerUserId: number | null;
      actorAssignments: readonly { userId: number }[];
    },
  ): boolean {
    if (this.canReviewAnyProject(user)) {
      return true;
    }

    if (project.proposerUserId === user.id) {
      return true;
    }

    return project.actorAssignments.some(
      (assignment) => assignment.userId === user.id,
    );
  }

  /**
   * Construye la cláusula `where` que limita los listados de proyectos a los
   * que el espectador puede ver. Sin sesión solo son públicos los finalizados;
   * con sesión, además, los no privados ya aprobados o en ejecución. Los
   * estudiantes también ven los privados aprobados en modo de vista previa y
   * los proyectos privados donde ya expresaron interés.
   */
  projectVisibilityWhere(
    user: AuthenticatedUser | undefined,
  ): Prisma.ProjectWhereInput {
    if (!user) {
      return {
        isPrivate: false,
        status: ProjectStatus.closed,
      };
    }

    if (this.canReviewAnyProject(user)) {
      return {};
    }

    const conditions: Prisma.ProjectWhereInput[] = [
      { isPrivate: false, status: { in: PUBLIC_PROJECT_STATUSES } },
      { proposerUserId: user.id },
      { actorAssignments: { some: { userId: user.id } } },
      // Mantiene visible el privado para el estudiante que ya se interesó,
      // aunque el proyecto haya salido de `approved`.
      { interests: { some: { userId: user.id } } },
    ];

    if (user.roles.includes(UserRole.student)) {
      conditions.push({
        isPrivate: true,
        status: ProjectStatus.approved,
      });
    }

    return { OR: conditions };
  }

  /**
   * Un estudiante puede interesarse en un proyecto aprobado si no es el
   * proponente ni ya forma parte del equipo. Los revisores globales no usan
   * este flujo. El interés duplicado y el estado del proyecto se validan en el
   * servicio, que conoce el registro existente.
   */
  canExpressInterest(
    user: AuthenticatedUser,
    project: {
      status: ProjectStatus;
      proposerUserId: number | null;
      actorAssignments: readonly { userId: number }[];
    },
  ): boolean {
    if (
      !user.roles.includes(UserRole.student) ||
      this.canReviewAnyProject(user)
    ) {
      return false;
    }

    if (project.status !== ProjectStatus.approved) {
      return false;
    }

    if (project.proposerUserId === user.id) {
      return false;
    }

    return !project.actorAssignments.some(
      (assignment) => assignment.userId === user.id,
    );
  }

  /**
   * Comentar/observar está abierto a administradores y directivos (aunque no
   * estén asignados) y a cualquier actor asignado al proyecto.
   */
  async assertCanComment(
    user: AuthenticatedUser,
    projectId: number,
  ): Promise<void> {
    if (user.roles.includes(UserRole.admin)) {
      return;
    }

    if (user.roles.includes(UserRole.directivo)) {
      return;
    }

    const assignment = await this.prisma.projectActorAssignment.findFirst({
      where: { projectId, userId: user.id },
      select: { id: true },
    });

    if (!assignment) {
      throw new ForbiddenException(
        'A project assignment is required to comment',
      );
    }
  }

  /**
   * Enviar entregas (y preparar su contenido) está reservado a
   * administradores y estudiantes asignados al proyecto. Docentes,
   * evaluadores y proponentes solo configuran y revisan la entrega.
   */
  async assertCanSubmitReports(
    user: AuthenticatedUser,
    projectId: number,
  ): Promise<void> {
    if (user.roles.includes(UserRole.admin)) {
      return;
    }

    const assignment = await this.prisma.projectActorAssignment.findFirst({
      where: { projectId, userId: user.id, role: ActorRole.student },
      select: { id: true },
    });

    if (!assignment) {
      throw new ForbiddenException(
        'A project student assignment is required to submit reports',
      );
    }
  }

  assertCanCreateProject(user: AuthenticatedUser): void {
    if (user.roles.length === 0) {
      throw new ForbiddenException('A role is required to create projects');
    }
  }

  /**
   * El panel de indicadores está disponible para administradores, docentes,
   * evaluadores y directivos. Los evaluadores y docentes solo ven el alcance
   * de sus proyectos asignados.
   */
  assertCanViewKpis(user: AuthenticatedUser): void {
    const allowed = [
      UserRole.admin,
      UserRole.directivo,
      UserRole.teacher,
      UserRole.evaluator,
    ] as const;

    if (allowed.some((role) => user.roles.includes(role))) {
      return;
    }

    throw new ForbiddenException(
      'A teacher, evaluator, directivo or admin role is required to view the KPIs',
    );
  }

  /**
   * El panorama por semestre agrega datos de todos los proyectos (incluidos
   * los privados), así que solo lo ven quienes ya pueden consultar cualquier
   * proyecto: administradores y directivos.
   */
  assertCanViewAllProjectsStats(user: AuthenticatedUser): void {
    if (this.canReviewAnyProject(user)) {
      return;
    }

    throw new ForbiddenException(
      'A directivo or admin role is required to view the semester statistics',
    );
  }

  async assertCanManageProject(
    user: AuthenticatedUser,
    projectId: number,
  ): Promise<void> {
    if (user.roles.includes(UserRole.admin)) {
      return;
    }

    await this.assertProjectAssignment(user, projectId, ActorRole.teacher);
  }

  /**
   * Crear y administrar plantillas de rúbricas está reservado a directivos y
   * administradores.
   */
  assertCanManageRubrics(user: AuthenticatedUser): void {
    if (
      user.roles.includes(UserRole.admin) ||
      user.roles.includes(UserRole.directivo)
    ) {
      return;
    }

    throw new ForbiddenException(
      'A directivo or admin role is required to manage rubrics',
    );
  }

  /**
   * Consultar la pestaña de evaluación: admin y directivo ven cualquier
   * proyecto; el resto solo si está asignado como evaluador.
   */
  async assertCanViewProjectEvaluations(
    user: AuthenticatedUser,
    projectId: number,
  ): Promise<void> {
    if (
      user.roles.includes(UserRole.admin) ||
      user.roles.includes(UserRole.directivo)
    ) {
      return;
    }

    await this.assertProjectAssignment(user, projectId, ActorRole.evaluator);
  }

  /**
   * Enviar una evaluación: admin o evaluador asignado. Un directivo sin
   * asignación de evaluador solo puede consultar y asignar la rúbrica.
   */
  async assertCanSubmitProjectEvaluation(
    user: AuthenticatedUser,
    projectId: number,
  ): Promise<void> {
    if (user.roles.includes(UserRole.admin)) {
      return;
    }

    await this.assertProjectAssignment(user, projectId, ActorRole.evaluator);
  }

  /**
   * Exige que el usuario pueda dar su visto bueno para avanzar de fase: el
   * proponente del proyecto o un evaluador asignado. Devuelve el papel con el
   * que participa en la aprobación.
   */
  async assertCanApproveProjectPhase(
    user: AuthenticatedUser,
    project: { id: number; proposerUserId: number | null },
  ): Promise<PhaseApprovalKind> {
    if (project.proposerUserId === user.id) {
      return 'proposer';
    }

    const assignment = await this.prisma.projectActorAssignment.findFirst({
      where: {
        projectId: project.id,
        userId: user.id,
        role: ActorRole.evaluator,
      },
      select: { id: true },
    });

    if (assignment) {
      return 'evaluator';
    }

    throw new ForbiddenException(
      'Only the project proposer or an assigned evaluator can approve the phase',
    );
  }

  /**
   * Editar los datos del proyecto está disponible para administradores,
   * directivos, docentes/evaluadores asignados al proyecto y, mientras el
   * proyecto siga en propuesta o revisión, para su proponente (sea cual sea su
   * rol global).
   */
  async assertCanEditProjectDetails(
    user: AuthenticatedUser,
    project: {
      id: number;
      proposerUserId: number | null;
      status: ProjectStatus;
    },
  ): Promise<void> {
    if (user.roles.includes(UserRole.admin)) {
      return;
    }

    if (user.roles.includes(UserRole.directivo)) {
      return;
    }

    const assignment = await this.prisma.projectActorAssignment.findFirst({
      where: {
        projectId: project.id,
        userId: user.id,
        role: { in: [ActorRole.teacher, ActorRole.evaluator] },
      },
      select: { id: true },
    });

    if (assignment) {
      return;
    }

    const isEditableProposer =
      project.proposerUserId === user.id &&
      (project.status === ProjectStatus.proposed ||
        project.status === ProjectStatus.under_review);

    if (isEditableProposer) {
      return;
    }

    throw new ForbiddenException(
      'You do not have permission to edit this project',
    );
  }

  /**
   * Asignar actores está disponible para administradores, directivos (sin
   * necesidad de asignarse al proyecto) y docentes asignados.
   */
  async assertCanAssignActors(
    user: AuthenticatedUser,
    projectId: number,
  ): Promise<void> {
    if (user.roles.includes(UserRole.admin)) {
      return;
    }

    if (user.roles.includes(UserRole.directivo)) {
      return;
    }

    await this.assertProjectAssignment(user, projectId, ActorRole.teacher);
  }

  /**
   * Gestionar hitos exige administrador o una asignación docente/evaluadora.
   * El directivo global sí entra en {@link assertCanManageReports}, pero los
   * hitos quedan reservados a quien participa en el proyecto.
   */
  async assertCanManageMilestone(
    user: AuthenticatedUser,
    projectId: number,
  ): Promise<void> {
    if (user.roles.includes(UserRole.admin)) {
      return;
    }

    await this.assertProjectManagementAssignment(user, projectId);
  }

  /**
   * Gestionar y revisar entregas está abierto a administradores y directivos
   * (aunque no estén asignados) y a docentes/evaluadores asignados.
   */
  async assertCanManageReports(
    user: AuthenticatedUser,
    projectId: number,
  ): Promise<void> {
    if (user.roles.includes(UserRole.admin)) {
      return;
    }

    if (user.roles.includes(UserRole.directivo)) {
      return;
    }

    await this.assertProjectManagementAssignment(user, projectId);
  }

  private async assertProjectManagementAssignment(
    user: AuthenticatedUser,
    projectId: number,
  ): Promise<void> {
    const assignment = await this.prisma.projectActorAssignment.findFirst({
      where: {
        projectId,
        userId: user.id,
        role: { in: [ActorRole.teacher, ActorRole.evaluator] },
      },
      select: { id: true },
    });

    if (!assignment) {
      throw new ForbiddenException(
        'A project teacher or evaluator assignment is required for this action',
      );
    }
  }

  /**
   * Las transiciones de propuesta (`proposed → approved/rejected`, el legado
   * `under_review` y `approved → rejected`) las resuelve un directivo sin
   * asignación o un evaluador asignado al proyecto. El resto de transiciones
   * exigen una asignación docente.
   */
  async assertCanTransitionProject(
    user: AuthenticatedUser,
    projectId: number,
    previousStatus: ProjectStatus,
    nextStatus: ProjectStatus,
  ): Promise<void> {
    if (user.roles.includes(UserRole.admin)) {
      return;
    }

    const evaluatorTransitions =
      previousStatus === ProjectStatus.proposed ||
      previousStatus === ProjectStatus.under_review ||
      (previousStatus === ProjectStatus.approved &&
        nextStatus === ProjectStatus.rejected);

    if (evaluatorTransitions) {
      if (user.roles.includes(UserRole.directivo)) {
        return;
      }

      await this.assertProjectAssignment(user, projectId, ActorRole.evaluator);
      return;
    }

    await this.assertProjectAssignment(user, projectId, ActorRole.teacher);
  }

  async assertAssignableUser(userId: number, role: ActorRole): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        isActive: true,
        roleAssignments: { select: { role: true } },
      },
    });

    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    if (!user.isActive) {
      throw new ForbiddenException('Inactive users cannot be assigned');
    }

    const globalRoles = user.roleAssignments.map(({ role: r }) => r);

    if (!hasActorRoleLicense(globalRoles, role)) {
      const licenses = ACTOR_ROLE_LICENSES[role];
      throw new ForbiddenException(
        `User ${userId} needs a global ${licenses.join(' or ')} role to be assigned as ${role}`,
      );
    }
  }

  private async assertProjectAssignment(
    user: AuthenticatedUser,
    projectId: number,
    role: ActorRole,
  ): Promise<void> {
    const assignment = await this.prisma.projectActorAssignment.findFirst({
      where: { projectId, userId: user.id, role },
      select: { id: true },
    });

    if (!assignment) {
      throw new ForbiddenException(
        `A project ${role} assignment is required for this action`,
      );
    }
  }
}
