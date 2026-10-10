import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';
import { AuthenticatedUser } from '../../auth/auth.types';
import {
  emitRequestLog,
  parseLogLevel,
  severityForStatus,
  shouldEmit,
} from '../logging/request-log';

/** Petición con los datos que agregan el middleware y el `AuthGuard`. */
type LoggedRequest = Request & {
  requestId: string;
  user?: AuthenticatedUser;
};

/** Longitud máxima aceptada para un `x-request-id` entrante. */
const MAX_REQUEST_ID_LENGTH = 128;

/** Solo ids simples: evita valores gigantes o saltos de línea en el log. */
const REQUEST_ID_PATTERN = /^[\w.-]+$/;

/**
 * Reutiliza el `x-request-id` entrante (útil para correlacionar con proxies o
 * clientes) y, si falta o no es seguro, genera uno nuevo.
 */
function resolveRequestId(header: string | string[] | undefined): string {
  const candidate = Array.isArray(header) ? header[0] : header;
  if (
    candidate &&
    candidate.length <= MAX_REQUEST_ID_LENGTH &&
    REQUEST_ID_PATTERN.test(candidate)
  ) {
    return candidate;
  }
  return randomUUID();
}

/**
 * Registra una línea JSON por petición cuando termina la respuesta, con
 * método, ruta, status, duración, request-id y usuario. El nivel se deriva del
 * status (5xx `error`, 4xx `warn`, resto `log`) y se emite si alcanza
 * `LOG_LEVEL` (por defecto `log`).
 */
@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const request = req as LoggedRequest;
    const requestId = resolveRequestId(request.headers['x-request-id']);
    request.requestId = requestId;
    res.setHeader('x-request-id', requestId);

    const startedAt = performance.now();

    res.on('finish', () => {
      const level = severityForStatus(res.statusCode);
      if (!shouldEmit(level, parseLogLevel(process.env.LOG_LEVEL))) {
        return;
      }

      emitRequestLog({
        timestamp: new Date().toISOString(),
        level,
        context: 'HTTP',
        requestId,
        method: request.method,
        path: request.originalUrl,
        status: res.statusCode,
        durationMs: Math.round((performance.now() - startedAt) * 10) / 10,
        userId: request.user?.id ?? null,
      });
    });

    next();
  }
}
