# AGENTS.md

CapstoneHUB manages university capstone projects end to end: proposals, team
assignment, milestones, observations, status transitions and attachments. This
repository is a monorepo with a NestJS API and a Next.js web app sharing one
PostgreSQL database and a MinIO/S3 bucket for files.

## Layout

| Path | What it is |
| --- | --- |
| `hub-backend/` | REST API — NestJS 11, Prisma 7 (pg adapter), PostgreSQL 15, MinIO/S3. |
| `hub-frontend/` | Web app — Next.js 16 (App Router), React 19, Tailwind v4, shadcn/ui. |
| `docs/` | Architecture and product documentation (see below). |
| `compose.yml` | Full stack: `db`, `backend`, `frontend`, `minio`, `minio-init`. |
| `.devcontainer/` | Recommended development environment. |
| `BUILD.md` | Setup, Prisma seeds, storage and deployment details. |
| `data/` | Local Postgres data volume (git-ignored; do not edit). |

## Documentation map

Read the relevant document before changing an area:

- [docs/backend_arch.md](docs/backend_arch.md) — API layers, auth, permissions, state machine.
- [docs/database_arch.md](docs/database_arch.md) — Prisma schema and data model.
- [docs/frontend_arch.md](docs/frontend_arch.md) — routes, BFF proxy, services, server/client split.
- [docs/frontend_design_system.md](docs/frontend_design_system.md) — **UI source of truth**: tokens, utilities, components.
- [docs/deployment.md](docs/deployment.md) — CI (GitHub Actions) and Dokploy deployment.
- [docs/sso-plan.md](docs/sso-plan.md) — SSO plan.

`hub-frontend/AGENTS.md` holds frontend-specific agent rules (the pinned Next.js
version caveat, shadcn/ui, and the UTB design system). Follow it for anything
under `hub-frontend/`.

## Running locally

The recommended workflow is the devcontainer (see [BUILD.md](BUILD.md)):

```bash
docker compose -f .devcontainer/docker-compose.yml up --build
```

Inside the container, install dependencies once:

```bash
cd /workspace/hub-backend && npm ci
cd /workspace/hub-frontend && npm ci
```

Then:

```bash
# Backend (http://localhost:3001, Swagger at /api)
cd hub-backend
npx prisma generate
npx prisma migrate dev --name <name>
npm run start:dev

# Frontend (http://localhost:3000)
cd hub-frontend
npm run dev
```

Seed sample data from `hub-backend` (Postgres must be up and migrated):
`npm run seed`, or per domain with `npm run seed:users`, `seed:projects`,
`seed:reset`, etc. See [BUILD.md](BUILD.md) for fixtures and credentials.

## Tests

| Command | Where | What |
| --- | --- | --- |
| `npm run lint` | `hub-backend` | ESLint sobre `src` y `test`. |
| `npm test` | `hub-backend` | Jest unitario (specs junto al código). |
| `npm run test:e2e` | `hub-backend` | Supertest (auth + proyectos); requiere BD `capstonehub_test`. |
| `npm run lint` / `npm run build` | `hub-frontend` | ESLint y build de Next. |
| `npm run test:e2e` | `hub-frontend` | Playwright (escritorio + móvil); requiere backend compilado y `npx playwright install chromium`. |

Setup y comandos exactos (BD de test, `DATABASE_URL`, Playwright) en
[BUILD.md](BUILD.md#tests).

## Commit messages — Conventional Commits (required)

Every commit must follow [Conventional Commits](https://www.conventionalcommits.org):

```
<type>(<optional scope>): <description>
```

**Allowed types**

| Type | Use for |
| --- | --- |
| `feat` | A new user-facing feature. |
| `fix` | A bug fix. |
| `refactor` | Code change that neither fixes a bug nor adds a feature. |
| `perf` | Performance improvement. |
| `docs` | Documentation only. |
| `style` | Formatting/whitespace, no behavior change. |
| `test` | Adding or fixing tests. |
| `build` | Build system, dependencies, Docker. |
| `ci` | CI configuration and scripts. |
| `chore` | Maintenance that fits nowhere else. |
| `revert` | Reverting a previous commit. |

**Scope** is optional and names the area touched — `backend`, `frontend`,
`auth`, `projects`, `prisma`, `ui`, `docs`.

**Rules**

- Description in the imperative mood, lowercase, no trailing period:
  `feat(projects): add privacy flag to project detail`.
- Keep the subject under ~72 characters; put the "why" in the body if needed.
- Reference issues in the body (`Refs #92`), not in the subject.
- Breaking changes: add `!` after the type/scope and explain in a
  `BREAKING CHANGE:` footer, e.g. `refactor(auth)!: drop legacy session cookie`.
- One logical change per commit; don't mix a refactor with a feature.
- PR titles should follow the same convention, since merges keep the history.

Examples:

```
feat(frontend): open every module with ModuleHeader
fix(backend): return 404 for private projects to non-members
refactor(prisma): extract project visibility into AuthorizationService
docs: document the UTB design system
```

## General guidelines

- Never commit secrets or real credentials; `.env` files are local only. Update
  the matching `.env.example` when a variable is added.
- Match the style and patterns of the surrounding code; keep diffs scoped to the
  task.
- **Backend**: keep controllers thin, put business rules in services, validate
  input with DTOs (`class-validator`) and return purpose-built response types
  instead of raw Prisma models. Tests live next to the code as `*.spec.ts`.
- **Frontend**: use shadcn/ui instead of hand-rolled components and follow
  `hub-frontend/AGENTS.md` plus the design system doc.
- Before finishing, run the checks for the area you touched
  (`npm run lint`, `npm test` in `hub-backend`; `npm run lint` in
  `hub-frontend`). For end-to-end coverage add `npm run test:e2e` in
  `hub-backend` (supertest) and `hub-frontend` (Playwright) — see the Tests
  section above and [BUILD.md](BUILD.md#tests).
