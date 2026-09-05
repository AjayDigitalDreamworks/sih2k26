/**
 * Structured Logger for Raahi Core Backend.
 * Provides consistent, machine-readable log output for production monitoring.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
  context?: Record<string, any>;
  error?: string;
  stack?: string;
}

const SERVICE_NAME = 'ner-core-backend';

function formatEntry(entry: LogEntry): string {
  const base = `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.service}] ${entry.message}`;
  if (entry.context) {
    return `${base} ${JSON.stringify(entry.context)}`;
  }
  return base;
}

function log(level: LogLevel, message: string, context?: Record<string, any>, error?: Error) {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    service: SERVICE_NAME,
    message,
    context,
  };

  if (error) {
    entry.error = error.message;
    entry.stack = error.stack;
  }

  const formatted = formatEntry(entry);

  switch (level) {
    case 'error':
      console.error(formatted);
      break;
    case 'warn':
      console.warn(formatted);
      break;
    default:
      console.log(formatted);
  }
}

export const logger = {
  debug: (message: string, context?: Record<string, any>) => log('debug', message, context),
  info: (message: string, context?: Record<string, any>) => log('info', message, context),
  warn: (message: string, context?: Record<string, any>) => log('warn', message, context),
  error: (message: string, error?: Error, context?: Record<string, any>) => log('error', message, context, error),

  // Specialized loggers
  api: (method: string, path: string, statusCode: number, durationMs: number, userId?: string) => {
    log('info', `${method} ${path} ${statusCode}`, {
      method,
      path,
      statusCode,
      durationMs,
      userId,
    });
  },

  auth: (action: string, userId: string, success: boolean, meta?: Record<string, any>) => {
    log(success ? 'info' : 'warn', `Auth: ${action}`, {
      userId,
      success,
      ...meta,
    });
  },

  ml: (action: string, durationMs: number, meta?: Record<string, any>) => {
    log('info', `ML: ${action}`, {
      durationMs,
      ...meta,
    });
  },

  realtime: (event: string, meta?: Record<string, any>) => {
    log('info', `Realtime: ${event}`, meta);
  },

  database: (operation: string, table: string, durationMs: number, meta?: Record<string, any>) => {
    log('debug', `DB: ${operation} on ${table}`, {
      durationMs,
      ...meta,
    });
  },
};
