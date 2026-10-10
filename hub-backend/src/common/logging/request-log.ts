/** Niveles del log de peticiones, de mayor a menor severidad. */
const LOG_LEVELS = ['error', 'warn', 'log', 'debug'] as const;

export type RequestLogLevel = (typeof LOG_LEVELS)[number];

/** `LOG_LEVEL` por defecto: registra peticiones y errores, oculta el detalle. */
export const DEFAULT_LOG_LEVEL: RequestLogLevel = 'log';

/** Prioridad numérica: se emite si el nivel alcanza el umbral configurado. */
const LEVEL_PRIORITY: Record<RequestLogLevel, number> = {
  error: 0,
  warn: 1,
  log: 2,
  debug: 3,
};

/** Una línea del log estructurado de peticiones. */
export type RequestLogEntry = {
  timestamp: string;
  level: RequestLogLevel;
  context: 'HTTP';
  requestId: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
  userId: number | null;
};

/**
 * Normaliza `LOG_LEVEL`. Acepta los niveles de Nest (`error`, `warn`, `log`,
 * `debug`) y el alias `info`. Sin valor (o con uno desconocido) usa el default.
 */
export function parseLogLevel(value: string | undefined): RequestLogLevel {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'info') {
    return 'log';
  }

  return LOG_LEVELS.find((level) => level === normalized) ?? DEFAULT_LOG_LEVEL;
}

/** Deriva el nivel del log a partir del status HTTP de la respuesta. */
export function severityForStatus(status: number): RequestLogLevel {
  if (status >= 500) {
    return 'error';
  }
  if (status >= 400) {
    return 'warn';
  }
  return 'log';
}

/** Indica si `level` alcanza el umbral mínimo (`threshold`) configurado. */
export function shouldEmit(
  level: RequestLogLevel,
  threshold: RequestLogLevel,
): boolean {
  return LEVEL_PRIORITY[level] <= LEVEL_PRIORITY[threshold];
}

/**
 * Escribe la entrada como una línea JSON. Los niveles `warn` y `error` van a
 * stderr para no mezclarse en stdout con la salida esperada del proceso.
 */
export function emitRequestLog(entry: RequestLogEntry): void {
  const line = `${JSON.stringify(entry)}\n`;
  if (entry.level === 'warn' || entry.level === 'error') {
    process.stderr.write(line);
    return;
  }
  process.stdout.write(line);
}
