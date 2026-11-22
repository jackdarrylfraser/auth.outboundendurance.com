import pino, { type DestinationStream, type Logger } from "pino";

type LogLevel =
  | "fatal"
  | "error"
  | "warn"
  | "info"
  | "debug"
  | "trace"
  | "silent";

const globalForLogger = globalThis as typeof globalThis & {
  outboundEnduranceLogger?: Logger;
};

function consoleDestination(write: (message: string) => void): DestinationStream {
  return {
    write(message) {
      write(message.trimEnd());
    },
  };
}

function getLogLevel(): LogLevel {
  const configuredLevel = process.env.LOG_LEVEL?.trim();
  if (!configuredLevel) {
    return process.env.NODE_ENV === "production" ? "warn" : "debug";
  }

  switch (configuredLevel) {
    case "fatal":
    case "error":
    case "warn":
    case "info":
    case "debug":
    case "trace":
    case "silent":
      return configuredLevel;
    default:
      throw new Error(`Unsupported LOG_LEVEL: ${configuredLevel}`);
  }
}

function createLogger(): Logger {
  const destination = pino.multistream(
    [
      { level: "trace", stream: consoleDestination((line) => console.log(line)) },
      { level: "warn", stream: consoleDestination((line) => console.warn(line)) },
      { level: "error", stream: consoleDestination((line) => console.error(line)) },
    ],
    { dedupe: true },
  );

  return pino(
    {
      base: { service: "auth.outboundendurance.com" },
      level: getLogLevel(),
    },
    destination,
  );
}

export function getLogger(): Logger {
  if (!globalForLogger.outboundEnduranceLogger) {
    globalForLogger.outboundEnduranceLogger = createLogger();
  }

  return globalForLogger.outboundEnduranceLogger;
}
