import ILogFilter from "./ILogFilter";
import { LogLevel, LogMask } from "./LogLevel";

export default class LogFilter implements ILogFilter {
  static fromMask(mask: LogMask): ILogFilter {
    return new LogFilter(mask);
  }

  static createPermissiveFilter(): LogFilter {
    return new LogFilter(LogMask.all);
  }

  static createSilentFilter(): LogFilter {
    return new LogFilter(LogMask.none);
  }

  constructor(private filterMask: LogMask) {}

  shouldLog(level: LogLevel): boolean {
    return (this.filterMask & level) !== 0;
  }
}
