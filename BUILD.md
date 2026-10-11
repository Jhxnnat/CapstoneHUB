# Con Devcontainers

La manera recomendada de trabajar en el proyecto es por medio de devcontainers:

```bash
docker compose -f .devcontainer/docker-compose.yml up --build
```

> Para CI/CD y el despliegue en un servidor con Dokploy, ver
> [docs/deployment.md](docs/deployment.md).

Si se utiliza VS Code, el workflow es:

- abrir el proyecto en VS Code
- instalar la extensión **Dev Containers**
- ejecutar el comando "Dev Containers: Reopen in Container"
- luego las terminales de VS Code serán en el contenedor

Luego instalar las dependencias dentro del contenedor:

```bash
cd /workspace/hub-backend && npm ci
cd /workspace/hub-frontend && npm ci
```

Postgresql se ejecuta automáticamente

# ejecutar backend y generar esquemas de prisma orm

```bash
npx prisma generate
npx prisma migrate dev --name [name]
npm start dev
```

ir a [http://localhost:3001/api](http://localhost:3001/api)

# ejecutar el frontend

```bash
npm run dev
```

ir a [http://localhost:3000](http://localhost:3000)

# Admin bootstrap

Estas variables de entorno son necesarias para el primer setup:

```
INITIAL_ADMIN_EMAIL
INITIAL_ADMIN_PASSWORD
INITIAL_ADMIN_NAME
```

# para generar datos de prueba

Prisma seeds genera usuarios, proyectos, actores, hitos, observaciones, historial de
estados y anexos de ejemplo. Todo en `hub-backend/prisma`:

```
prisma/seed.ts          # CLI principal
prisma/seed/            # una sección por dominio + utilidades
prisma/fixtures/        # datos mock en JSON y archivos de anexos
prisma/register.cjs     # hook de ts-node para el cliente generado
```

Se ejecuta desde `hub-backend` y requiere Postgres levantado y migrado:

```bash
cd hub-backend

npm run seed                 # todas las secciones
npm run seed:users           # solo usuarios
npm run seed:projects        # solo proyectos
npm run seed:actors          # solo asignaciones de actores
npm run seed:milestones      # solo hitos
npm run seed:observations    # solo observaciones
npm run seed:status          # solo transiciones de estado
npm run seed:attachments     # solo anexos
npm run seed:reset           # borra los datos sembrados y los vuelve a crear
```

También se puede ejecutar con flags:

```bash
npm run seed -- --only=users
npm run seed -- --only=projects,actors,status   # agrega dependencias automáticamente
npm run seed -- --dry-run                        # no escribe en la base
npm run seed -- --strict                         # falla si MinIO no está disponible
npm run seed -- --help
```

Y a través de Prisma CLI:

```bash
npx prisma db seed
```

si se corre varias veces no duplica registros, solo
actualiza lo que ya existe. `npm run seed:reset` elimina únicamente los datos
sembrados (por nombre de proyecto y email del fixture) antes de recrearlos.

## Tests

### Backend (unit + lint)

```bash
cd hub-backend
npm run lint
npm test          # Jest; los tests unitarios viven junto al código (*.spec.ts)
```

### Backend e2e (supertest)

Usa una base de datos de test **dedicada** (`capstonehub_test`), no la de
desarrollo. Prepararla una vez:

```bash
docker exec postgres psql -U postgres -c "CREATE DATABASE capstonehub_test;"
```

Migrar y ejecutar. `AUTH_SECRET` se toma de `hub-backend/.env` (vía
`dotenv/config`); `test:e2e` ya incluye
`NODE_OPTIONS=--experimental-vm-modules` por el `import()` dinámico de Prisma 7:

```bash
cd hub-backend
DATABASE_URL="postgresql://<usuario>:<contraseña>@localhost:5432/capstonehub_test" \
  npx prisma migrate deploy
DATABASE_URL="postgresql://<usuario>:<contraseña>@localhost:5432/capstonehub_test" \
  npm run test:e2e
```

Los specs están en `test/` (`auth.e2e-spec.ts`, `projects.e2e-spec.ts`) y crean
sus propios datos con correos únicos, así que no dependen de seeds.

### Frontend e2e (Playwright)

Requiere el backend **compilado** y el navegador de Playwright. Los specs corren
en Chromium de escritorio y en un viewport móvil; `playwright.config.ts` levanta
solo el backend y `next start` (`webServer`):

```bash
cd hub-backend && npm run build
cd ../hub-frontend
npx playwright install chromium   # solo la primera vez
npm run build
DATABASE_URL="postgresql://<usuario>:<contraseña>@localhost:5432/capstonehub_test" \
  npm run test:e2e
```

Los specs están en `e2e/` (`auth.spec.ts`, `project-detail.spec.ts`).

En CI, el job `e2e` de `.github/workflows/ci.yml` levanta un Postgres efímero
(`capstonehub_test`), aplica las migraciones, compila backend y frontend y corre
las dos suites (supertest y Playwright).

## Fixtures

- `prisma/fixtures/users.json`: usuarios con sus roles. El campo
  `defaultPassword` `Capstone123!` se usa para todos, salvo que un usuario
  defina su propia contraseña.
- `prisma/fixtures/projects.json`: proyectos con proponente (natural o legal),
  escuelas, actores, estado objetivo y anexos.
- `prisma/fixtures/milestones.json` y `observations.json`: indexados por el
  nombre del proyecto.
- `prisma/fixtures/attachments/`: archivos de ejemplo que se suben a
  MinIO.

Credenciales de ejemplo (los emails de los fixtures terminan en
`@capstonehub.test`):

```
coord.ana@capstonehub.test   / Capstone123!   (coordinator)
eval.maria@capstonehub.test  / Capstone123!   (evaluator)
advisor.sofia@capstonehub.test / Capstone123! (advisor)
student.juan@capstonehub.test / Capstone123!  (student)
```

Notas:

- El hash de la contraseña solo se guarda en la base; la contraseña en claro
  está en `users.json`, por eso se puede iniciar sesión con esos valores.
- Los anexos requieren el MinIO configurado; sin eso el seed avisa y los omite
  (usar `--strict` para que falle en su lugar).
- Si corres el seed fuera de Docker, `DATABASE_URL` y `S3_ENDPOINT` en
  `hub-backend/.env` deben apuntar a `localhost` en vez del nombre del contenedor.

# Anexos de proyecto (storage)

Los anexos se guardan en MinIO/S3 a través de `StorageService`
(`hub-backend/src/storage`)

Endpoints (requieren autenticación y ser participante del proyecto o admin):
```
POST   /projects/:projectId/attachments             (multipart/form-data, campo "file")
GET    /projects/:projectId/attachments
GET    /projects/:projectId/attachments/:id/download
DELETE /projects/:projectId/attachments/:id
```

Límite de 10 MB por archivo, y se permite PDF, Word, Excel, PNG y JPEG

# Contenido de entregas

Cada entrega tiene un **tipo** fijo (`text`, `link` o `file`) definido al crearla
y, para el tipo Archivo, los **MIME permitidos** (documentos, imágenes y videos)
y el **máximo de archivos**; el estudiante solo aporta contenido que cumpla esa
configuración. Los binarios se guardan en el mismo bucket con **subida directa
desde el navegador** (URL prefirmada), de modo que el archivo no pasa por Nest ni
por el BFF:

```
POST   /projects/:projectId/reports/:reportId/contents                 (JSON: texto o enlace)
POST   /projects/:projectId/reports/:reportId/contents/files/presign   (JSON: metadatos → URL firmada)
PUT    <uploadUrl>                                                     (navegador → MinIO/S3)
POST   /projects/:projectId/reports/:reportId/contents/files/confirm   (JSON: storageKey → contenido)
PATCH  /projects/:projectId/reports/:reportId/contents/:id
DELETE /projects/:projectId/reports/:reportId/contents/:id
GET    /projects/:projectId/reports/:reportId/contents/:id/stream      (inline, soporta Range)
```

El flujo es: `presign` valida tipo/MIME/tamaño y devuelve una URL `PUT`; el
navegador sube el binario; `confirm` verifica el objeto con `HeadObject` y crea
el `ProjectAttachment` + `ProjectReportContent`. Todos los archivos de una
entrega pueden pesar hasta `MAX_REPORT_FILE_SIZE_BYTES` (100 MB por defecto). Si
el objeto real excede el límite, se borra y se rechaza. Los archivos de una
entrega no se listan en Anexos.

Requisitos de configuración para que funcione:

- `S3_PUBLIC_ENDPOINT`: la URL de MinIO/S3 que alcanza el navegador
  (`http://localhost:9000` en dev). La firma incluye el host, así que debe
  coincidir con el usado al subir.
- CORS: MinIO lo controla con la variable `MINIO_API_CORS_ALLOW_ORIGIN`
  (por defecto `*`; en los compose se toma de `S3_CORS_ORIGINS`). Con S3 real hay
  que configurar el CORS del bucket por separado (consola o `PutBucketCors`).

## Limpieza de objetos huérfanos (storage gc)

La subida directa es de dos pasos (`presign` → subir → `confirm`). Si el usuario
cierra el navegador después de subir y antes de confirmar, el objeto queda en el
bucket sin fila en `project_attachment` (huérfano). El recolector recorre el
prefijo `projects/`, lo compara con los `storageKey` registrados y borra los
objetos sin fila que superan la antigüedad mínima (24 h por defecto).

```bash
npm run storage:gc                    # borra huérfanos de más de 24 h
npm run storage:gc -- --dry-run       # solo lista lo que borraría
npm run storage:gc -- --max-age-hours=1
```

| Flag | Efecto |
| --- | --- |
| `--dry-run` | No borra; informa qué objetos eliminaría. |
| `--max-age-hours=N` | Antigüedad mínima en horas (default `24`). |

Imprime un JSON con `scanned` (objetos revisados), `deleted` (claves borradas) y
`kept`. Requiere la base de datos y las variables `S3_*` configuradas.

- Entrada CLI: `hub-backend/src/storage/gc-cli.ts` (arranca un contexto de Nest
  sin servidor HTTP, lee los flags y ejecuta el servicio).
- Lógica: `hub-backend/src/storage/storage-gc.service.ts`.

No hay scheduler interno; se ejecuta a mano o desde un cron externo, por ejemplo:

```cron
0 4 * * * cd /workspace/hub-backend && npm run storage:gc >> /var/log/capstonehub-gc.log 2>&1
```

## MinIO

`compose.yml` y `.devcontainer/docker-compose.yml` levantan `minio` en
`localhost:9000` (API) y `localhost:9001` (consola). Un contenedor de un solo
uso, `minio-init`, espera a MinIO y crea el bucket de forma idempotente antes de
que arranque el backend, así que no hay que crearlo a mano. El CORS para las
subidas directas se configura con `MINIO_API_CORS_ALLOW_ORIGIN` en el servicio
`minio` (toma `S3_CORS_ORIGINS`, por defecto `*`).

Credenciales y bucket por defecto (`.env` raíz y `hub-backend/.env`):

```
S3_ACCESS_KEY="minioadmin"
S3_SECRET_KEY="minioadmin"
S3_BUCKET="capstonehub"
```

El backend se conecta con (`hub-backend/.env`):

```
S3_ENDPOINT="http://minio:9000" # nombre del servicio dentro de Docker
S3_BUCKET="capstonehub"
S3_ACCESS_KEY="minioadmin"
S3_SECRET_KEY="minioadmin"
S3_REGION="us-east-1"
S3_FORCE_PATH_STYLE="true" # obligatorio para MinIO
```

Notas:

- Si corres el backend **fuera de Docker** (por ejemplo `npm start dev` en tu
  máquina), cambia `S3_ENDPOINT` a `http://localhost:9000`.
- Consola web: http://localhost:9001 (usuario y clave de arriba).
- El volumen `minio_data` conserva los objetos entre reinicios.
- Verificar el bucket desde el host:

  ```bash
  docker run --rm --entrypoint /bin/sh --network prisma-network quay.io/minio/mc \
    -c 'mc alias set local http://minio:9000 minioadmin minioadmin && mc ls local/capstonehub'
  ```

## en producción se debería usar S3, aunque no está  testeado:

`S3StorageService` usa el SDK de AWS, así que apuntar a S3 es solo cambiar el
entorno: credenciales reales, `S3_REGION`, `S3_BUCKET`, `S3_ENDPOINT` vacío y
`S3_FORCE_PATH_STYLE="false"`. Algunas alternativas compatibles son LocalStack,
SeaweedFS, Garage o `moto server`.

# Contraseñas de base de datos: usar valores URL-safe

`DATABASE_URL` es una URL, así que la contraseña debe ir **percent-encoded** si
contiene caracteres reservados (`@ : / ? # %`, espacio, etc.). En el compose de
producción (`compose.dokploy.yml`) `DB_PASSWORD` se usa a la vez como
`POSTGRES_PASSWORD` (contraseña cruda) y dentro de la `DATABASE_URL`, por lo que
un valor con esos caracteres rompe la conexión aunque la codifiques.

Por eso, la forma sencilla es **usar una contraseña URL-safe**: solo
`A-Z a-z 0-9 - . _ ~`, sin caracteres reservados. Por ejemplo:

```bash
openssl rand -base64 24 | tr '+/' '-_'
```

Si necesitas caracteres especiales, no los metas en `DB_PASSWORD`: define una
variable `DATABASE_URL` aparte (con la contraseña percent-encoded) para el
backend y deja `DB_PASSWORD` crudo para Postgres. Para codificar:

```bash
node -e "process.stdout.write(encodeURIComponent('p@ss:word/#') + '\n')"
# p%40ss%3Aword%2F%23
```
