/**
 * Structured JSON logger for production error tracking.
 *
 * Logs are written to stderr as single-line JSON objects so they can be
 * ingested by any log aggregator (Datadog, Loki, CloudWatch, etc.).
 *
 * Never log prompt content, secrets, or PII. Only metadata: timestamp,
 * route, userId, error code, error message.
 */

type LogLevel = "error" | "warn" | "info";

type LogFields = {
  route?: string;
  userId?: string;
  uploadId?: string;
  code?: string;
  message: string;
  [key: string]: unknown;
};

function emit(level: LogLevel, fields: LogFields): void {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    ...fields,
  };
  const line = JSON.stringify(payload);
  if (level === "error") {
    process.stderr.write(`${line}\n`);
  } else if (level === "warn") {
    process.stderr.write(`${line}\n`);
  } else {
    process.stdout.write(`${line}\n`);
  }
}

export function logError(fields: LogFields): void {
  emit("error", fields);
}

export function logWarn(fields: LogFields): void {
  emit("warn", fields);
}

export function logInfo(fields: LogFields): void {
  emit("info", fields);
}

/**
 * Wrap an async handler with structured error logging.
 * Returns the original result or rethrows after logging.
 */
export async function withErrorLogging<T>(
  fields: LogFields,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    emit("error", {
      ...fields,
      message: error instanceof Error ? error.message : "unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}
