/**
 * Identificador de cliente para keys locales (filas de formularios, listas en
 * memoria, etc.). `crypto.randomUUID` solo existe en contextos seguros (HTTPS o
 * localhost), así que en HTTP por LAN se genera con `getRandomValues` y, como
 * último recurso, con tiempo + un contador local. El valor nunca sale del
 * navegador.
 */

let fallbackCounter = 0;

export function createClientId(): string {
  if (typeof crypto !== "undefined") {
    if (typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }

    if (typeof crypto.getRandomValues === "function") {
      const bytes = crypto.getRandomValues(new Uint8Array(16));

      return Array.from(bytes, (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("");
    }
  }

  fallbackCounter += 1;

  return `id-${Date.now().toString(36)}-${fallbackCounter.toString(36)}`;
}
