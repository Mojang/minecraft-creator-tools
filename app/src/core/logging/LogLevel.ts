// "branded" types allow for more enforceable type safety while still being compatible with the underlying primitive type
export type LogLevel = number & { readonly __brand: "LogLevel" };
export type LogMask = number & { readonly __brand: "LogMask" };

// essentially an enum but compatible with branded types
// using bit flag values to allow for masking
export const LogLevel = {
  trace: (1 << 0) as LogLevel,
  debug: (1 << 1) as LogLevel,
  verbose: (1 << 2) as LogLevel,
  message: (1 << 3) as LogLevel,
  warn: (1 << 4) as LogLevel,
  error: (1 << 5) as LogLevel,
  critical: (1 << 6) as LogLevel,
} as const;

export function levelName(level: LogLevel): string {
  return (Object.entries(LogLevel) as [string, LogLevel][]).find(([, v]) => v === level)?.[0] ?? level.toString();
}

export function maskOf(...levels: readonly LogLevel[]): LogMask {
  let v = 0;
  for (const l of levels) v |= l;
  return v as LogMask;
}

export const LogMask = {
  debug: maskOf(LogLevel.debug),
  verbose: maskOf(LogLevel.verbose),
  message: maskOf(LogLevel.message),
  error: maskOf(LogLevel.error),
  warn: maskOf(LogLevel.warn),
  critical: maskOf(LogLevel.critical),
  none: 0 as LogMask,
  all: ~0 as LogMask,
  /* errors, warnings, or critical messages */
  important: maskOf(LogLevel.warn, LogLevel.error, LogLevel.critical),
  /* all errors */
  errorsOnly: maskOf(LogLevel.error, LogLevel.critical),
  /* all messages not considered verbose, including regulars messages and errors */
  nonVerbose: maskOf(LogLevel.message, LogLevel.warn, LogLevel.error, LogLevel.critical),
} as const;
