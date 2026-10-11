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
| `/projects/[id]` | Detalle por pestañas (general, equipo, hitos, entregas, anexos, historial). |
| `/projects/[id]/edit` | Edición de los datos del proyecto (admin o evaluador). |
| `/submit`, `/submit/natural` | Propuesta de proyecto. |
| `/admin/users` | Administración de usuarios y roles. |

## Patrón BFF (Backend For Frontend)

El navegador nunca llama al backend directamente. Cada `app/api/.../route.ts`
recibe la petición, reenvía el header `Authorization` y hace `fetch` a
`BACKEND_URL` (por defecto `http://localhost:3001`), devolviendo la respuesta
tal cual. Esto evita CORS y oculta la URL del backend.

La excepción son los binarios de las entregas: el frontend pide una URL
prefirmada (`.../contents/files/presign`), sube el archivo **directo a
MinIO/S3** con `XMLHttpRequest` (para mostrar progreso) y confirma
(`.../contents/files/confirm`). La descarga/reproducción sigue pasando por el
proxy `stream`, que reenvía `Range`.

`app/api/auth/proxy.ts` es un helper reutilizable para login y usuarios.

## Capa de servicios

`app/services/` concentra toda la comunicación con la API:

- `auth.ts` — sesión en `localStorage` (`capstonehub.auth.session`) y funciones
  de login, registro y usuarios.
- `projects.ts` — proyectos, hitos, observaciones, anexos y contenido de las
  entregas (texto, enlaces y archivos), incluida la configuración de tipo, MIME
  permitidos y máximo de archivos, y la edición de los datos del proyecto.
- `schemas.ts` — tipos TypeScript compartidos (`ProjectDetails`, etc.).
- `utils.ts` — helpers de formato (estados, fechas).

Cada petición autenticada lee el token de `auth.ts` y agrega
`Authorization: Bearer <token>`.

En el detalle del proyecto, debajo de las pestañas, hay una barra persistente
visible desde cualquier pestaña. A la izquierda, los administradores y
coordinadores asignados ven el control compacto **Fase** con el botón para
avanzar de semestre; se habilita cuando los hitos mínimos de la fase actual
están completos (al pulsarlo con pendientes, avisa cuáles faltan). A la derecha,
quienes pueden editar (administradores, evaluadores, coordinadores/asesores
asignados al proyecto y el proponente mientras esté en revisión) ven el botón
**Editar proyecto** que abre la pantalla dedicada `/projects/[id]/edit` (los
mismos campos de la propuesta, salvo el proponente). Los cambios se envían por
`PUT` y la pestaña **Historial** muestra, junto al historial de estados, una
entrada por cada campo modificado con su valor anterior y nuevo. Al desmarcar
«Proyecto privado» se muestra una advertencia y una confirmación antes de
publicarlo.

La pestaña **Hitos** permite marcar hitos como **mínimos**, asignarles una fase
(semestre) y vincularles entregas del proyecto; un hito con entregas vinculadas
no se puede completar hasta que todas estén aceptadas. Al elegir el estado
«Finalizado» se avisa si aún quedan hitos mínimos pendientes. En las entregas se
muestra a qué hitos están vinculadas y se advierte antes de eliminar hitos o
entregas que tienen vínculos.

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
- Build Docker multi-etapa con salida *standalone*, expuesto en el puerto
  `3000`.
