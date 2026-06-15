import { levelName, LogLevel } from "./LogLevel";

export function extractString(arg: unknown): string {
  if (typeof arg === "string") {
    return arg;
  } else if (arg instanceof Error) {
    return arg.stack || arg.message || String(arg);
  } else {
    try {
      return JSON.stringify(arg);
    } catch {
      return String(arg);
    }
  }
}

export function getLogData(level: LogLevel) {
  const timestamp = new Date().toISOString();
  const levelStr = levelName(level).toUpperCase().padEnd(8, " ");

  return { timestamp, levelStr };
}

export function getArgsStrings(args: unknown[]): string {
  return args.length > 0 ? ` ${args.map((arg) => extractString(arg)).join(" ")}` : "";
}
