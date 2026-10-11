import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';

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

/** Correo único por ejecución, para no colisionar entre corridas. */
export function uniqueEmail(prefix = 'e2e'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

export async function registerUser(
  app: INestApplication<App>,
  email: string,
  password = 'password123',
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
