import { EventEmitter } from 'node:events';
import { NextFunction, Request, Response } from 'express';
import { LoggerMiddleware } from './logger.middleware';

class FakeResponse extends EventEmitter {
  statusCode = 200;
  readonly headers: Record<string, string> = {};

  setHeader(name: string, value: string): this {
    this.headers[name] = value;
    return this;
  }
}

type RunOptions = {
  headers?: Record<string, string>;
  user?: { id: number };
  status?: number;
};

function runMiddleware(options: RunOptions = {}) {
  const middleware = new LoggerMiddleware();
  const res = new FakeResponse();
  if (options.status !== undefined) {
    res.statusCode = options.status;
  }

  const req = {
    method: 'GET',
    originalUrl: '/projects/1?tab=files',
    headers: options.headers ?? {},
    user: options.user,
  };

  const next = jest.fn();
  middleware.use(
    req as unknown as Request,
    res as unknown as Response,
    next as unknown as NextFunction,
  );

  return { res, next, req };
}

function parseEntries(spy: jest.SpiedFunction<typeof process.stdout.write>) {
  return spy.mock.calls.map(
    (call) => JSON.parse(String(call[0])) as Record<string, unknown>,
  );
}

describe('LoggerMiddleware', () => {
  const originalLogLevel = process.env.LOG_LEVEL;
  let stdout: jest.SpiedFunction<typeof process.stdout.write>;
  let stderr: jest.SpiedFunction<typeof process.stderr.write>;

  beforeEach(() => {
    stdout = jest.spyOn(process.stdout, 'write').mockReturnValue(true);
    stderr = jest.spyOn(process.stderr, 'write').mockReturnValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalLogLevel === undefined) {
      delete process.env.LOG_LEVEL;
    } else {
      process.env.LOG_LEVEL = originalLogLevel;
    }
  });

  it('registra una línea JSON al terminar la respuesta', () => {
    const { res } = runMiddleware({
      headers: { 'x-request-id': 'req-abc' },
      user: { id: 42 },
      status: 201,
    });

    res.emit('finish');

    expect(res.headers['x-request-id']).toBe('req-abc');
    expect(stderr).not.toHaveBeenCalled();
    expect(stdout).toHaveBeenCalledTimes(1);

    const [entry] = parseEntries(stdout);
    expect(entry).toEqual(
      expect.objectContaining({
        level: 'log',
        context: 'HTTP',
        requestId: 'req-abc',
        method: 'GET',
        path: '/projects/1?tab=files',
        status: 201,
        userId: 42,
      }),
    );
    expect(typeof entry.timestamp).toBe('string');
    expect(entry.durationMs).toEqual(expect.any(Number));
    expect(entry.durationMs as number).toBeGreaterThanOrEqual(0);
  });

  it('genera un request-id propio si falta o no es válido', () => {
    const { res, req } = runMiddleware({
      headers: { 'x-request-id': 'no vale\n' },
    });

    const header = res.headers['x-request-id'];
    expect(header).toMatch(/^[\w-]+$/);
    expect((req as { requestId?: string }).requestId).toBe(header);

    res.emit('finish');
    expect(parseEntries(stdout)[0].requestId).toBe(header);
  });

  it('registra userId null en peticiones anónimas', () => {
    const { res } = runMiddleware();

    res.emit('finish');

    expect(parseEntries(stdout)[0].userId).toBeNull();
  });

  it.each([
    [404, 'warn'],
    [500, 'error'],
  ] as const)(
    'clasifica el status %i como %s y lo escribe en stderr',
    (status, level) => {
      const { res } = runMiddleware({ status });

      res.emit('finish');

      expect(stdout).not.toHaveBeenCalled();
      const [entry] = parseEntries(stderr);
      expect(entry).toEqual(expect.objectContaining({ level, status }));
    },
  );

  it('respeta el umbral mínimo de LOG_LEVEL', () => {
    process.env.LOG_LEVEL = 'warn';

    const ok = runMiddleware({ status: 200 });
    ok.res.emit('finish');
    expect(stdout).not.toHaveBeenCalled();
    expect(stderr).not.toHaveBeenCalled();

    const notFound = runMiddleware({ status: 404 });
    notFound.res.emit('finish');
    expect(parseEntries(stderr)).toHaveLength(1);
  });

  it('continúa la cadena de middleware', () => {
    const { next } = runMiddleware();

    expect(next).toHaveBeenCalledTimes(1);
  });
});
