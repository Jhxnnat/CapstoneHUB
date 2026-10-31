# Arquitectura del Frontend

Aplicación web construida con **Next.js 16 (App Router)**, **React 19** y
**TypeScript**. Los estilos usan **Tailwind CSS v4** y los componentes provienen
de **shadcn/ui** (Base UI + lucide-react). Las tablas se construyen con
**TanStack Table**.

La identidad visual (paleta UTB, tokens, utilidades y convenciones de pantalla)
está en el [Sistema de diseño](./frontend_design_system.md).

Ver también: [Arquitectura del backend](./backend_arch.md),
[Esquema de base de datos](./database_arch.md) y el
[plan de SSO](./sso-plan.md).

## Organización

- `app/` — rutas del App Router.
- `app/api/` — route handlers que actúan como BFF/proxy hacia el backend.
- `app/services/` — acceso a datos y sesión.
- `app/components/` — componentes propios (navbar, auth, formularios).
- `components/ui/` — componentes base de shadcn/ui.
- `lib/utils.ts` — utilidades (por ejemplo `cn`).
- `app/globals.css` — tokens de diseño y utilidades propias.

## Rutas

| Ruta | Pantalla |
| --- | --- |
| `/` | Inicio. |
| `/login` | Inicio de sesión. |
| `/register` | Registro de proponentes (auto-login). |
| `/projects` | Lista de proyectos. |
| `/projects/[id]` | Detalle por pestañas (general, equipo, hitos, entregas, evaluación, anexos, historial). |
| `/projects/[id]/edit` | Edición de los datos del proyecto (admin, directivo o actor asignado). |
| `/profile` | Mi perfil: datos de la cuenta, proyectos propios/asignados y proyectos de interés. |
| `/submit`, `/submit/natural` | Propuesta de proyecto. |
| `/profile/kpis` | Panel de indicadores y panorama por semestre (docentes, evaluadores, directivos y admin; el panorama es solo para admin/directivo). |
| `/admin/users` | Administración de usuarios y roles. |
| `/admin/rubrics` | Plantillas de rúbricas para directivos y administradores. |
| `/admin/rubrics/new`, `/admin/rubrics/[id]` | Crear y editar una plantilla de rúbrica. |

## Patrón BFF (Backend For Frontend)

El navegador nunca llama al backend directamente. Cada `app/api/.../route.ts`
recibe la petición, reenvía el header `Authorization` y hace `fetch` a
`BACKEND_URL` (por defecto `http://localhost:3001`), devolviendo la respuesta
tal cual. Esto evita CORS y oculta la URL del backend.

Los binarios de las entregas también pasan por el proxy: se suben como multipart
(`.../contents/files`) con `XMLHttpRequest` (para mostrar progreso) y el BFF los
reenvía por streaming al backend, que los guarda en el almacenamiento. La
descarga/reproducción sigue pasando por el proxy `stream`, que reenvía `Range`.

`app/api/auth/proxy.ts` es un helper reutilizable para login y usuarios.
`app/api/rubrics/[...path]/route.ts` hace lo mismo para las plantillas de
rúbricas; las evaluaciones y asignaciones cuelgan de `/api/projects/...` y usan
el proxy de proyectos.

## Capa de servicios

`app/services/` concentra toda la comunicación con la API:

- `auth.ts` — sesión en `localStorage` (`capstonehub.auth.session`) y funciones
  de login, registro y usuarios.
- `projects.ts` — proyectos, hitos, observaciones, anexos, contenido de las
  entregas (texto, enlaces y archivos) e intereses de los estudiantes, incluida
  la configuración de tipo, MIME permitidos y máximo de archivos, y la edición
  de los datos del proyecto.
- `schemas.ts` — tipos TypeScript compartidos (`ProjectDetails`, etc.).
- `roles.ts` — vocabulario de roles globales (`UserRole`) y de proyecto
  (`ActorRole`), y qué roles de proyecto habilita cada rol global.
- `project-permissions.ts` — reglas de permisos del cliente (editar, gestionar,
  hitos, estados), espejo de `AuthorizationService`.
- `rubrics.ts` — plantillas de rúbricas y su administración.
- `evaluations.ts` — evaluación semestral, notas, rúbrica asignada y asignación
  de plantillas desde la pestaña Evaluación.
- `stats.ts` — KPIs del panel y panorama global por semestre.
- `utils.ts` — helpers de formato (estados, fechas, roles, notas).

Cada petición autenticada lee el token de `auth.ts` y agrega
`Authorization: Bearer <token>`.

En el detalle del proyecto, debajo de las pestañas, hay una barra persistente
visible desde cualquier pestaña. A la izquierda, los administradores y docentes
asignados ven el control compacto **Fase** con el botón para
avanzar de semestre; se habilita cuando los hitos mínimos de la fase actual
están completos (al pulsarlo con pendientes, avisa cuáles faltan). A la derecha,
quienes pueden editar (administradores, directivos, docentes y evaluadores
asignados al proyecto y el proponente mientras la propuesta siga en revisión)
ven
el botón **Editar proyecto** que abre la pantalla dedicada `/projects/[id]/edit`
(los mismos campos de la propuesta, salvo el proponente). Los cambios se envían
por `PUT` y la pestaña **Historial** muestra, junto al historial de estados, una
entrada por cada campo modificado con su valor anterior y nuevo. Al desmarcar
«Proyecto privado» se muestra una advertencia y una confirmación antes de
publicarlo.

La pestaña **Evaluación** es visible para administradores, directivos y
evaluadores asignados. Muestra la rúbrica de cada semestre, el estado de
evaluaciones y el promedio. Los evaluadores asignados y el admin llenan la
rúbrica criterio por criterio (nota 0.0–5.0 y comentario opcional); el directivo
solo consulta y asigna la plantilla de cada fase. La fase no se puede avanzar ni
el proyecto cerrar sin las evaluaciones exigidas.

La pestaña **Hitos** permite marcar hitos como **mínimos**, asignarles una fase
(semestre) y vincularles entregas del proyecto; un hito con entregas vinculadas
no se puede completar hasta que todas estén aceptadas. Al elegir el estado
«Finalizado» se avisa si aún quedan hitos mínimos pendientes o falta la
evaluación de la fase. En las entregas se muestra a qué hitos están vinculadas y
se advierte antes de eliminar hitos o entregas que tienen vínculos.

Los estudiantes ven los proyectos privados en `approved` mediante
`ProjectPrivatePreview`: una vista con aviso de información limitada, descripción,
requisitos de equipo, resultados esperados y la tarjeta `ProjectInterestCard`
para expresar o retirar su interés con un mensaje opcional. La misma tarjeta
aparece en el detalle de los proyectos públicos aprobados. En la pestaña
**Equipo**, quienes pueden asignar actores ven la tarjeta
`InterestedStudentsList` con los estudiantes interesados y acciones para
asignarlos o descartarlos, con confirmación. El perfil muestra una tarjeta
**Proyectos de interés** además de **Mis proyectos**.

## Statusbar y pestañas de usuario

La navegación principal vive en la navbar superior: Inicio, Proyectos y
Proponer. El widget de perfil de la navbar abre un dropdown con **Mi perfil** y
**Cerrar sesión**. Debajo de la navbar, `PageFrame` monta un **statusbar** con la
categoría y el título de la página (`Administración / Rúbricas`, `Proyecto #12 /
Nombre`). Inmediatamente debajo aparecen las **pestañas de acciones de usuario**:
Administración (solo admin), Rúbricas para admin/directivo, Indicadores para los
roles con acceso a KPIs y Mi perfil.

Solo la navbar es sticky; el statusbar y las pestañas acompañan al scroll. La
home, login y registro no muestran este chrome. Las pestañas son solo atajos: la
página de rúbricas vive en `/admin/rubrics` y el backend vuelve a validar los
permisos.

## Autenticación

`AuthProvider` (cliente) mantiene la sesión y la expone por contexto
(`useAuth`). La sesión vive en una **cookie httpOnly** que gestiona el BFF
(`app/api/auth/session.ts`): login y registro la setean y solo devuelven el
usuario; `GET /api/auth/me` hidrata la sesión al montar; `POST /api/auth/logout`
la limpia. Los services ya no envían `Authorization` (la cookie viaja sola en
peticiones same-origin) y el BFF la reenvía al backend como Bearer. El registro
(`POST /auth/register` vía el BFF) crea al usuario con rol `proposer`, lo deja
autenticado igual que el login y redirige a `/submit`. Si un usuario con sesión
abre `/register`, se le redirige a `/profile`.

La renovación deslizante ocurre en el BFF: cuando el backend devuelve
`x-access-token`, el proxy actualiza la cookie; ante un `401` la limpia y el
frontend redirige a `/login?next=…`. `logout` también navega al login.

## Server vs Client Components

- Las páginas cargan datos con Server Components (`getProjects`,
  `getProjectById`) usando `cache: "no-store"`.
- La interactividad (tabla de proyectos, paneles de detalle, diálogos de
  usuarios) vive en Client Components con `"use client"`.

## Configuración y despliegue

- Variable `BACKEND_URL` para el proxy.
- `NEXT_PUBLIC_SITE_URL` como base de la API cuando se llama desde el cliente.
- Build Docker multi-etapa con salida _standalone_, expuesto en el puerto
  `3000`.
