/**
 * Validaciones de formularios en cliente. El backend vuelve a validar cada
 * campo; aquí solo se busca mostrar mensajes localizados antes de enviar.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}
