import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { MilestonesService, SelectedMilestone } from './milestones.service';
import { CreateMilestoneDto, UpdateMilestoneDto } from './milestones.dto';

@Controller('projects/:projectId/milestones')
@UseGuards(AuthGuard)
export class MilestonesController {
  constructor(private readonly milestonesService: MilestonesService) {}

  @Get()
  getProjectMilestones(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SelectedMilestone[]> {
    return this.milestonesService.milestonesByProject(Number(projectId), user);
  }

  @Post()
  createProjectMilestone(
    @Param('projectId') projectId: string,
    @Body() data: CreateMilestoneDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SelectedMilestone> {
    return this.milestonesService.createMilestone({
      projectId: Number(projectId),
      data,
      user,
    });
  }

  @Patch(':milestoneId')
  updateProjectMilestone(
    @Param('projectId') projectId: string,
    @Param('milestoneId') milestoneId: string,
    @Body() data: UpdateMilestoneDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SelectedMilestone> {
    return this.milestonesService.updateMilestone({
      projectId: Number(projectId),
      milestoneId: Number(milestoneId),
      data,
      user,
    });
  }

  @Delete(':milestoneId')
  deleteProjectMilestone(
    @Param('projectId') projectId: string,
    @Param('milestoneId') milestoneId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SelectedMilestone> {
    return this.milestonesService.deleteMilestone({
      projectId: Number(projectId),
      milestoneId: Number(milestoneId),
      user,
    });
  }
}
