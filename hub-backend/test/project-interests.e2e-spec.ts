import request from 'supertest';
import { useTestApp } from './helpers/e2e';
import { adminSession, bearer, userWithRole } from './helpers/auth';
import {
  assignProjectActor,
  createProject,
  createProjectWithProposer,
  transitionProjectStatus,
} from './helpers/projects';
import {
  ActorRole,
  ProjectStatus,
  UserRole,
} from '../src/generated/prisma/client';

type ProjectResponse = {
  id: number;
  isPrivatePreview: boolean;
  proposer: unknown;
  startDate: string | null;
  sourceDetails: string | null;
  requiresLegalization: boolean;
  context: string;
  estimatedCost: string | null;
  facultyAdvisors: string[];
  deliverables: unknown[];
  observations: unknown[];
  actorAssignments: unknown[];
  canExpressInterest: boolean;
  viewerInterest: { message: string | null } | null;
};

type InterestResponse = {
  id: number;
  projectId: number;
  message: string | null;
  user: { id: number; email: string };
};

type MyInterestResponse = {
  id: number;
  name: string;
  interestMessage: string | null;
  interestedAt: string;
};

describe('Project interests (e2e)', () => {
  const getApp = useTestApp();

  async function createApprovedProject(
    isPrivate: boolean,
  ): Promise<{ projectId: number; proposerToken: string }> {
    const app = getApp();
    const admin = await adminSession(app);
    const project = await createProjectWithProposer(app, isPrivate);

    await transitionProjectStatus(
      app,
      project.projectId,
      admin.accessToken,
      ProjectStatus.approved,
    );

    return project;
  }

  it('shows approved private projects to students with limited information', async () => {
    const app = getApp();
    const { projectId } = await createApprovedProject(true);
    const student = await userWithRole(app, UserRole.student);
    const teacher = await userWithRole(app, UserRole.teacher);

    const list = await request(app.getHttpServer())
      .get('/projects')
      .set(bearer(student.accessToken))
      .expect(200);

    const listed = (list.body as ProjectResponse[]).find(
      (project) => project.id === projectId,
    );
    expect(listed).toMatchObject({
      id: projectId,
      isPrivatePreview: true,
      proposer: null,
      startDate: null,
      sourceDetails: null,
      requiresLegalization: false,
    });

    const detail = await request(app.getHttpServer())
      .get(`/projects/${projectId}`)
      .set(bearer(student.accessToken))
      .expect(200);

    expect(detail.body).toMatchObject({
      id: projectId,
      isPrivatePreview: true,
      canExpressInterest: true,
      viewerInterest: null,
      context: '',
      estimatedCost: null,
      facultyAdvisors: [],
      deliverables: [],
      observations: [],
      actorAssignments: [],
    });

    await request(app.getHttpServer())
      .get(`/projects/${projectId}`)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/projects/${projectId}`)
      .set(bearer(teacher.accessToken))
      .expect(404);
  });

  it('lets a student express and withdraw interest', async () => {
    const app = getApp();
    const { projectId } = await createApprovedProject(true);
    const student = await userWithRole(app, UserRole.student);

    const created = await request(app.getHttpServer())
      .post(`/projects/${projectId}/interests`)
      .set(bearer(student.accessToken))
      .send({ message: '  Quiero participar  ' })
      .expect(201);

    expect(created.body).toMatchObject({
      id: projectId,
      canExpressInterest: false,
      viewerInterest: { message: 'Quiero participar' },
    });

    await request(app.getHttpServer())
      .post(`/projects/${projectId}/interests`)
      .set(bearer(student.accessToken))
      .send({ message: 'Otra vez' })
      .expect(409);

    const mine = await request(app.getHttpServer())
      .get('/projects/mine/interests')
      .set(bearer(student.accessToken))
      .expect(200);

    const interest = (mine.body as MyInterestResponse[]).find(
      (project) => project.id === projectId,
    );
    expect(interest).toMatchObject({
      id: projectId,
      interestMessage: 'Quiero participar',
    });
    expect(interest?.interestedAt).toBeTruthy();

    await request(app.getHttpServer())
      .delete(`/projects/${projectId}/interests/me`)
      .set(bearer(student.accessToken))
      .expect(204);

    const afterWithdraw = await request(app.getHttpServer())
      .get('/projects/mine/interests')
      .set(bearer(student.accessToken))
      .expect(200);

    expect(
      (afterWithdraw.body as MyInterestResponse[]).some(
        (project) => project.id === projectId,
      ),
    ).toBe(false);

    const detail = await request(app.getHttpServer())
      .get(`/projects/${projectId}`)
      .set(bearer(student.accessToken))
      .expect(200);

    expect(detail.body).toMatchObject({
      canExpressInterest: true,
      viewerInterest: null,
    });
  });

  it('only allows students to express interest in approved projects', async () => {
    const app = getApp();
    const admin = await adminSession(app);
    const student = await userWithRole(app, UserRole.student);
    const teacher = await userWithRole(app, UserRole.teacher);
    const { projectId } = await createApprovedProject(false);

    await request(app.getHttpServer())
      .post(`/projects/${projectId}/interests`)
      .set(bearer(teacher.accessToken))
      .send({})
      .expect(403);

    await request(app.getHttpServer())
      .post(`/projects/${projectId}/interests`)
      .set(bearer(student.accessToken))
      .send({})
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/projects/${projectId}/interests/me`)
      .set(bearer(student.accessToken))
      .expect(204);

    await transitionProjectStatus(
      app,
      projectId,
      admin.accessToken,
      ProjectStatus.in_progress,
    );

    await request(app.getHttpServer())
      .post(`/projects/${projectId}/interests`)
      .set(bearer(student.accessToken))
      .send({})
      .expect(409);

    const ownProject = await createProject(app, student.accessToken, {
      isPrivate: false,
    });
    await transitionProjectStatus(
      app,
      ownProject.id,
      admin.accessToken,
      ProjectStatus.approved,
    );

    await request(app.getHttpServer())
      .post(`/projects/${ownProject.id}/interests`)
      .set(bearer(student.accessToken))
      .send({})
      .expect(409);
  });

  it('lets managers review interests, assign the student and dismiss another interest', async () => {
    const app = getApp();
    const admin = await adminSession(app);
    const assignedStudent = await userWithRole(app, UserRole.student);
    const dismissedStudent = await userWithRole(app, UserRole.student);
    const teacher = await userWithRole(app, UserRole.teacher);
    const { projectId } = await createApprovedProject(true);

    for (const student of [assignedStudent, dismissedStudent]) {
      await request(app.getHttpServer())
        .post(`/projects/${projectId}/interests`)
        .set(bearer(student.accessToken))
        .send({ message: `Interés de ${student.user.fullName}` })
        .expect(201);
    }

    await request(app.getHttpServer())
      .get(`/projects/${projectId}/interests`)
      .set(bearer(assignedStudent.accessToken))
      .expect(403);

    await request(app.getHttpServer())
      .get(`/projects/${projectId}/interests`)
      .set(bearer(teacher.accessToken))
      .expect(403);

    const interests = await request(app.getHttpServer())
      .get(`/projects/${projectId}/interests`)
      .set(bearer(admin.accessToken))
      .expect(200);

    const assignedInterest = (interests.body as InterestResponse[]).find(
      (interest) => interest.user.id === assignedStudent.user.id,
    );
    const dismissedInterest = (interests.body as InterestResponse[]).find(
      (interest) => interest.user.id === dismissedStudent.user.id,
    );

    expect(assignedInterest).toMatchObject({
      projectId,
      user: { id: assignedStudent.user.id },
    });
    expect(dismissedInterest).toMatchObject({
      projectId,
      user: { id: dismissedStudent.user.id },
    });
    expect(dismissedInterest).toBeDefined();

    await assignProjectActor(
      app,
      projectId,
      admin.accessToken,
      assignedStudent.user.id,
      ActorRole.student,
    );

    const afterAssign = await request(app.getHttpServer())
      .get(`/projects/${projectId}/interests`)
      .set(bearer(admin.accessToken))
      .expect(200);

    expect(
      (afterAssign.body as InterestResponse[]).some(
        (interest) => interest.user.id === assignedStudent.user.id,
      ),
    ).toBe(false);

    const mine = await request(app.getHttpServer())
      .get('/projects/mine')
      .set(bearer(assignedStudent.accessToken))
      .expect(200);

    expect(
      (mine.body as { id: number; myRole: string | null }[]).find(
        (project) => project.id === projectId,
      ),
    ).toMatchObject({ myRole: ActorRole.student });

    await request(app.getHttpServer())
      .delete(`/projects/${projectId}/interests/${dismissedInterest!.id}`)
      .set(bearer(admin.accessToken))
      .expect(204);

    const afterDismiss = await request(app.getHttpServer())
      .get(`/projects/${projectId}/interests`)
      .set(bearer(admin.accessToken))
      .expect(200);

    expect(afterDismiss.body).toEqual([]);
  });

  it('keeps a private project visible to the interested student after leaving approved', async () => {
    const app = getApp();
    const admin = await adminSession(app);
    const student = await userWithRole(app, UserRole.student);
    const { projectId } = await createApprovedProject(true);

    await request(app.getHttpServer())
      .post(`/projects/${projectId}/interests`)
      .set(bearer(student.accessToken))
      .send({})
      .expect(201);

    await transitionProjectStatus(
      app,
      projectId,
      admin.accessToken,
      ProjectStatus.in_progress,
    );

    const detail = await request(app.getHttpServer())
      .get(`/projects/${projectId}`)
      .set(bearer(student.accessToken))
      .expect(200);

    expect(detail.body).toMatchObject({
      id: projectId,
      status: ProjectStatus.in_progress,
      isPrivatePreview: true,
      canExpressInterest: false,
      viewerInterest: {},
    });
  });
});
