import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'node:crypto';

export type AuthUser = {
  id: number;
  fullName: string;
  email: string;
  roles: string[];
};

export type AuthSession = {
  user: AuthUser;
  accessToken: string;
};

/** Contraseña de fixture para los tests e2e (no es un secreto real). */
export const TEST_PASSWORD = 'password123'; // NOSONAR

/** Correo único por ejecución, para no colisionar entre corridas. */
export function uniqueEmail(prefix = 'e2e'): string {
  return `${prefix}-${Date.now()}-${randomUUID().slice(0, 8)}@example.com`;
}

export async function registerUser(
  app: INestApplication<App>,
  email: string,
  password = TEST_PASSWORD,
): Promise<AuthSession> {
  const response = await request(app.getHttpServer())
    .post('/auth/register')
    .send({ fullName: 'E2E User', email, password })
    .expect(201);

  return response.body as AuthSession;
}

export async function loginUser(
  app: INestApplication<App>,
  email: string,
  password: string,
): Promise<AuthSession> {
  const response = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password })
    .expect(201);

  return response.body as AuthSession;
}

/** Cabecera `Authorization: Bearer <token>`. */
export function bearer(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}
