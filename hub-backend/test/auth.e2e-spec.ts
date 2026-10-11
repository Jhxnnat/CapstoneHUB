import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { closeTestApp, createTestApp } from './helpers/e2e';
import {
  bearer,
  loginUser,
  registerUser,
  TEST_NEW_PASSWORD,
  TEST_PASSWORD,
  uniqueEmail,
} from './helpers/auth';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  it('registra un proponente y lee su perfil en /auth/me', async () => {
    const email = uniqueEmail();
    const { user, accessToken } = await registerUser(app, email);

    expect(user.email).toBe(email);
    expect(user.roles).toContain('proposer');

    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set(bearer(accessToken))
      .expect(200);

    expect(me.body).toMatchObject({ id: user.id, email });
  });

  it('exige token en /auth/me', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);
  });

  it('rechaza una contraseña incorrecta en el login', async () => {
    const email = uniqueEmail();
    await registerUser(app, email);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'incorrecta' })
      .expect(401);
  });

  it('cambia la contraseña y entra con la nueva', async () => {
    const email = uniqueEmail();
    const { accessToken } = await registerUser(app, email);

    await request(app.getHttpServer())
      .patch('/auth/me/password')
      .set(bearer(accessToken))
      .send({
        currentPassword: 'incorrecta',
        newPassword: TEST_NEW_PASSWORD,
      })
      .expect(400);

    await request(app.getHttpServer())
      .patch('/auth/me/password')
      .set(bearer(accessToken))
      .send({
        currentPassword: TEST_PASSWORD,
        newPassword: TEST_NEW_PASSWORD,
      })
      .expect(200);

    await loginUser(app, email, TEST_NEW_PASSWORD);
  });
});
