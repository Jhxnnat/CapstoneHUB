import { apiErrorMessage, ensureOk } from "@/lib/http";

export type AuthUser = {
  id: number;
  fullName: string;
  email: string;
  roles: string[];
};

/**
 * Sesión del cliente. El token de acceso vive en una cookie httpOnly que
 * gestiona el BFF, así que aquí solo queda el usuario.
 */
export type AuthSession = {
  user: AuthUser;
};

async function requestSessionUser(
  path: string,
  payload: unknown,
): Promise<AuthUser> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await apiErrorMessage(response));
  }

  const data = (await response.json()) as { user: AuthUser };

  return data.user;
}

export async function loginUser(payload: {
  email: string;
  password: string;
}): Promise<AuthUser> {
  return requestSessionUser("/api/auth/login", payload);
}

export async function registerUser(payload: {
  fullName: string;
  email: string;
  password: string;
}): Promise<AuthUser> {
  return requestSessionUser("/api/auth/register", payload);
}

/** Usuario de la sesión actual, o `null` si la cookie no es válida. */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const response = await fetch("/api/auth/me", { cache: "no-store" });

  if (response.status === 401) {
    return null;
  }

  await ensureOk(response, { action: "consultar la sesión" });

  return (await response.json()) as AuthUser;
}

/** Cierra la sesión: el BFF limpia la cookie httpOnly. */
export async function logoutUser(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" });
}

export async function getUsers(): Promise<AuthUser[]> {
  const response = await fetch("/api/auth/users", {
    method: "GET",
    cache: "no-store",
  });

  await ensureOk(response, { action: "consultar los usuarios" });

  return (await response.json()) as AuthUser[];
}

export async function createUser(payload: {
  fullName: string;
  email: string;
  password: string;
  roles: string[];
}): Promise<AuthUser> {
  const response = await fetch("/api/auth/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  await ensureOk(response, { action: "crear el usuario" });

  return (await response.json()) as AuthUser;
}

export async function updateUserRoles(
  userId: number,
  roles: string[],
): Promise<AuthUser> {
  const response = await fetch(`/api/auth/users/${userId}/roles`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roles }),
  });

  await ensureOk(response, { action: "actualizar los roles del usuario" });

  return (await response.json()) as AuthUser;
}

export async function changePassword(payload: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  const response = await fetch("/api/auth/me/password", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  await ensureOk(response, { action: "cambiar la contraseña" });
}
