import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { closeTestApp, createTestApp } from './helpers/e2e';
import { bearer, registerUser, uniqueEmail } from './helpers/auth';

function projectPayload() {
  return {
    name: 'Proyecto E2E',
    description: 'Descripción del proyecto de pruebas',
    context: 'Contexto del proyecto de pruebas',
    namep: 'Proponente E2E',
    correo: uniqueEmail('proponente'),
    isPrivate: true,
    submissionConsentAt: new Date().toISOString(),
  };
}

describe('Projects (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  it('crea un proyecto privado, lo lista y lee su detalle', async () => {
    const { accessToken } = await registerUser(app, uniqueEmail('owner'));

    const created = await request(app.getHttpServer())
      .post('/projects')
      .set(bearer(accessToken))
      .send(projectPayload())
      .expect(201);

    const { id } = created.body as { id: number };
    expect(id).toBeGreaterThan(0);

    const list = await request(app.getHttpServer())
      .get('/projects')
      .set(bearer(accessToken))
      .expect(200);

    expect(
      (list.body as { id: number }[]).some((project) => project.id === id),
    ).toBe(true);

    const detail = await request(app.getHttpServer())
      .get(`/projects/${id}`)
      .set(bearer(accessToken))
      .expect(200);

    expect(detail.body).toMatchObject({ id, name: 'Proyecto E2E' });
  });

  it('oculta un proyecto privado a visitantes anónimos', async () => {
    const { accessToken } = await registerUser(app, uniqueEmail('owner'));

    const created = await request(app.getHttpServer())
      .post('/projects')
      .set(bearer(accessToken))
      .send(projectPayload())
      .expect(201);

    const { id } = created.body as { id: number };

    await request(app.getHttpServer()).get(`/projects/${id}`).expect(404);
  });
});
