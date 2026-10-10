import {
  DEFAULT_LOG_LEVEL,
  emitRequestLog,
  parseLogLevel,
  RequestLogEntry,
  severityForStatus,
  shouldEmit,
} from './request-log';

describe('parseLogLevel', () => {
  it('acepta los niveles soportados y el alias info', () => {
    expect(parseLogLevel('error')).toBe('error');
    expect(parseLogLevel('WARN')).toBe('warn');
    expect(parseLogLevel('log')).toBe('log');
    expect(parseLogLevel('debug')).toBe('debug');
    expect(parseLogLevel('info')).toBe('log');
  });

  it('usa el default cuando falta o es inválido', () => {
    expect(parseLogLevel(undefined)).toBe(DEFAULT_LOG_LEVEL);
    expect(parseLogLevel('')).toBe(DEFAULT_LOG_LEVEL);
    expect(parseLogLevel('verbose')).toBe(DEFAULT_LOG_LEVEL);
    expect(parseLogLevel('toString')).toBe(DEFAULT_LOG_LEVEL);
  });
});

describe('severityForStatus', () => {
  it('mapea 5xx a error, 4xx a warn y el resto a log', () => {
    expect(severityForStatus(500)).toBe('error');
    expect(severityForStatus(503)).toBe('error');
    expect(severityForStatus(400)).toBe('warn');
    expect(severityForStatus(404)).toBe('warn');
    expect(severityForStatus(201)).toBe('log');
    expect(severityForStatus(304)).toBe('log');
  });
});

describe('shouldEmit', () => {
  it('emite el nivel del umbral y los más severos', () => {
    expect(shouldEmit('error', 'warn')).toBe(true);
    expect(shouldEmit('warn', 'warn')).toBe(true);
    expect(shouldEmit('log', 'warn')).toBe(false);
    expect(shouldEmit('log', 'log')).toBe(true);
    expect(shouldEmit('debug', 'log')).toBe(false);
  });
});

describe('emitRequestLog', () => {
  const entry: RequestLogEntry = {
    timestamp: '2026-01-01T00:00:00.000Z',
    level: 'log',
    context: 'HTTP',
    requestId: 'req-1',
    method: 'GET',
    path: '/projects',
    status: 200,
    durationMs: 12.5,
    userId: 7,
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each(['log', 'debug'] as const)(
    'escribe una línea JSON en stdout para el nivel %s',
    (level) => {
      const stdout = jest.spyOn(process.stdout, 'write').mockReturnValue(true);
      const stderr = jest.spyOn(process.stderr, 'write').mockReturnValue(true);

      emitRequestLog({ ...entry, level });

      expect(stderr).not.toHaveBeenCalled();
      expect(stdout).toHaveBeenCalledWith(
        `${JSON.stringify({ ...entry, level })}\n`,
      );
    },
  );

  it.each(['warn', 'error'] as const)(
    'escribe una línea JSON en stderr para el nivel %s',
    (level) => {
      const stdout = jest.spyOn(process.stdout, 'write').mockReturnValue(true);
      const stderr = jest.spyOn(process.stderr, 'write').mockReturnValue(true);

      emitRequestLog({ ...entry, level });

      expect(stdout).not.toHaveBeenCalled();
      expect(stderr).toHaveBeenCalledWith(
        `${JSON.stringify({ ...entry, level })}\n`,
      );
    },
  );
});
