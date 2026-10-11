import { cookies } from "next/headers";

/**
 * Sesión en cookie httpOnly gestionada por el BFF. El navegador nunca ve el
 * token; los proxies lo leen de aquí y lo reenvían como `Authorization`.
 */
export const SESSION_COOKIE_NAME = "capstonehub.session";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24;

function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

/** Token de la cookie de sesión, o `null` si no hay sesión. */
export async function getSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();

  return cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
}

/** Guarda el token de acceso en la cookie httpOnly (login y renovación). */
export async function setSessionCookie(accessToken: string): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, accessToken, sessionCookieOptions());
}

/** Limpia la cookie de sesión (logout o 401 del backend). */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, "", {
    ...sessionCookieOptions(),
    maxAge: 0,
  });
}
