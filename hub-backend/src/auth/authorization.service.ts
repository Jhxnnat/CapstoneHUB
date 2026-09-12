import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActorRole, UserRole, ProjectStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma.service';
import { AuthenticatedUser } from './auth.types';

@Injectable()
export class AuthorizationService {
  constructor(private readonly prisma: PrismaService) {}

  assertRole(user: AuthenticatedUser, role: UserRole): void {
    if (!user.roles.includes(role)) {
      throw new ForbiddenException(`The ${role} role is required`);
    }
  }

  async assertProjectMember(
    user: AuthenticatedUser,
    projectId: number,
  ): Promise<void> {
    if (user.roles.includes(UserRole.admin)) {
      return;
    }

    const assignment = await this.prisma.projectActorAssignment.findFirst({
      where: { projectId, userId: user.id },
      select: { id: true },
    });

    if (!assignment) {
      throw new ForbiddenException('Project assignment is required');
    }
  }

  assertCanCreateProject(user: AuthenticatedUser): void {
    if (user.roles.length === 0) {
      throw new ForbiddenException('A role is required to create projects');
    }
  }

  async assertCanManageProject(
    user: AuthenticatedUser,
    projectId: number,
  ): Promise<void> {
    if (user.roles.includes(UserRole.admin)) {
      return;
    }

    this.assertRole(user, UserRole.coordinator);
    await this.assertProjectAssignment(user, projectId, ActorRole.coordinator);
  }

  async assertCanAssignActors(
    user: AuthenticatedUser,
    projectId: number,
  ): Promise<void> {
    if (user.roles.includes(UserRole.admin)) {
      return;
    }

    this.assertRole(user, UserRole.coordinator);
    await this.assertProjectAssignment(user, projectId, ActorRole.coordinator);
  }

  async assertCanManageMilestone(
    user: AuthenticatedUser,
    projectId: number,
  ): Promise<void> {
    if (user.roles.includes(UserRole.admin)) {
      return;
    }

    const roles: ActorRole[] = [];
    if (user.roles.includes(UserRole.coordinator)) {
      roles.push(ActorRole.coordinator);
    }
    if (user.roles.includes(UserRole.evaluator)) {
      roles.push(ActorRole.evaluator);
    }

    if (roles.length === 0) {
      throw new ForbiddenException(
        'A coordinator or evaluator role is required',
      );
    }

    const assignment = await this.prisma.projectActorAssignment.findFirst({
      where: { projectId, userId: user.id, role: { in: roles } },
      select: { id: true },
    });

    if (!assignment) {
      throw new ForbiddenException(
        'A project coordinator or evaluator assignment is required for this action',
      );
    }
  }

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
      nextStatus === ProjectStatus.rejected ||
      previousStatus === ProjectStatus.proposed ||
      previousStatus === ProjectStatus.under_review;

    if (evaluatorTransitions) {
      this.assertRole(user, UserRole.evaluator);
      await this.assertProjectAssignment(user, projectId, ActorRole.evaluator);
      return;
    }

    this.assertRole(user, UserRole.coordinator);
    await this.assertProjectAssignment(user, projectId, ActorRole.coordinator);
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

    if (!user.roleAssignments.some((assignment) => assignment.role === role)) {
      throw new ForbiddenException(
        `User ${userId} does not have the global ${role} role`,
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
