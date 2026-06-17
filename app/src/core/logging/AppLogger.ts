import AppServiceProxy, { AppServiceProxyCommands } from "../AppServiceProxy";
import ILogFilter from "./ILogFilter";
import ILogFormatter from "./ILogFormatter";
import ILogger from "./ILogger";
import SimpleLogFormatter from "./SimpleLogFormatter";
import { LogLevel } from "./LogLevel";

export default class AppLogger implements ILogger {
  constructor(
    private logFilter: ILogFilter,
    private formatter: ILogFormatter = new SimpleLogFormatter()
  ) {}

  log(message: string, level: LogLevel, ...args: unknown[]): void {
    if (!this.logFilter.shouldLog(level)) {
      return;
    }

    const formattedMessage = this.formatter.format(message, level, ...args);

    AppServiceProxy.send(AppServiceProxyCommands.logToConsole, formattedMessage);
  }
}
