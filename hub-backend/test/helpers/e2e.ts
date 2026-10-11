import 'dotenv/config';

import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma.service';

/**
 * Levanta la aplicación Nest completa (módulos reales + base de datos) para los
 * tests e2e. Se usa una vez por suite y se cierra en `afterAll`.
 */
export async function createTestApp(): Promise<INestApplication<App>> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication<INestApplication<App>>();
  await app.init();

  return app;
}

/** Cierra el pool de Prisma y la aplicación, sin dejar handles abiertos. */
export async function closeTestApp(app: INestApplication<App>): Promise<void> {
  const prisma = app.get(PrismaService);
  await prisma.$disconnect();
  await app.close();
}
