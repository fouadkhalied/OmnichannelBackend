import { env } from "../../config/env";

type LogLevel = "debug" | "info" | "warn" | "error";

const levelOrder: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const currentLevel = levelOrder[env.LOG_LEVEL as LogLevel];

type LogMeta = Record<string, unknown>;

const sanitizeMeta = (meta: LogMeta = {}) => {
  const sensitiveKeys = ["password", "token", "authorization", "cookie", "apiKey"];
  const output: LogMeta = {};

  Object.entries(meta).forEach(([key, value]) => {
    if (sensitiveKeys.some((sensitiveKey) => key.toLowerCase().includes(sensitiveKey))) {
      output[key] = "[REDACTED]";
      return;
    }
    output[key] = value;
  });

  return output;
};

const writeLog = (level: LogLevel, message: string, meta?: LogMeta) => {
  if (levelOrder[level] < currentLevel) return;

  const payload = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...sanitizeMeta(meta),
  };

  if (env.LOG_PRETTY) {
    const rest = { ...payload } as Record<string, unknown>;
    delete rest.timestamp;
    delete rest.level;
    delete rest.message;
    const serialized = JSON.stringify(rest);
    console.log(`${payload.timestamp} [${payload.level}] ${payload.message}${serialized === "{}" ? "" : ` ${serialized}`}`);
    return;
  }

  console.log(JSON.stringify(payload));
};

export const logger = {
  debug: (message: string, meta?: LogMeta) => writeLog("debug", message, meta),
  info: (message: string, meta?: LogMeta) => writeLog("info", message, meta),
  warn: (message: string, meta?: LogMeta) => writeLog("warn", message, meta),
  error: (message: string, meta?: LogMeta) => writeLog("error", message, meta),
};

export const formatErrorEnvelope = (
  message: string,
  requestId: string | undefined,
  code = "internal_error",
) => ({
  error: {
    message,
    code,
    requestId: requestId ?? null,
  },
});
