import ILogFilter from "./ILogFilter";
import ILogFormatter from "./ILogFormatter";
import ILogger from "./ILogger";
import SimpleLogFormatter from "./SimpleLogFormatter";
import { LogLevel } from "./LogLevel";

const consoles: Record<LogLevel, (...args: unknown[]) => void> = {
  [LogLevel.trace]: console.trace,
  [LogLevel.debug]: console.debug,
  [LogLevel.verbose]: console.log,
  [LogLevel.message]: console.log,
  [LogLevel.warn]: console.warn,
  [LogLevel.error]: console.error,
  [LogLevel.critical]: console.error,
} as const;

export default class WebLogger implements ILogger {
  constructor(
    private readonly filter: ILogFilter,
    private readonly formatter: ILogFormatter = new SimpleLogFormatter()
  ) {}

  log(message: string, level: LogLevel, ...args: unknown[]): void {
    if (!this.filter.shouldLog(level)) {
      return;
    }

    // exclude args from formatted message since console.log can handle them natively
    const formattedMessage = this.formatter.format(message, level);

    const logFunc = consoles[level] ?? console.log;
    logFunc(formattedMessage, ...args);
  }
}
