/**
 * Configuración del token de acceso: secreto compartido y ventanas de vida y
 * renovación. Se leen al importar el módulo, como el resto de variables de
 * entorno del proyecto.
 */

const DEFAULT_TTL_SECONDS = 60 * 60 * 24;

function parseSeconds(value: string | undefined, fallback: number): number {
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

/** Vida del token de acceso (24 h por defecto). */
export const AUTH_TOKEN_TTL_SECONDS = parseSeconds(
  process.env.AUTH_TOKEN_TTL_SECONDS,
  DEFAULT_TTL_SECONDS,
);

/**
 * Antigüedad a partir de la cual se reemite el token en cada petición válida
 * (la mitad de la vida por defecto).
 */
export const AUTH_TOKEN_RENEW_AFTER_SECONDS = parseSeconds(
  process.env.AUTH_TOKEN_RENEW_AFTER_SECONDS,
  Math.floor(AUTH_TOKEN_TTL_SECONDS / 2),
);

/** Secreto HMAC para firmar los tokens; falla al arrancar si no es seguro. */
export function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET?.trim();

  if (!secret || secret.length < 32) {
    throw new Error(
      'AUTH_SECRET must be configured with at least 32 characters',
    );
  }

  return secret;
}
