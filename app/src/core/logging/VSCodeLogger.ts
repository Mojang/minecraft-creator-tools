import ILogFilter from "./ILogFilter";
import ILogFormatter from "./ILogFormatter";
import ILogger from "./ILogger";
import SimpleLogFormatter from "./SimpleLogFormatter";
import { LogLevel } from "./LogLevel";
import * as vscode from "vscode";

export default class VSCodeLogger implements ILogger {
  constructor(
    private readonly application: typeof vscode,
    private readonly filter: ILogFilter,
    private readonly formatter: ILogFormatter = new SimpleLogFormatter()
  ) {}

  log(message: string, level: LogLevel, ...args: unknown[]): void {
    if (!this.filter.shouldLog(level)) {
      return;
    }

    const formattedMessage = this.formatter.format(message, level, ...args);

    this.application.window.showInformationMessage(formattedMessage);
  }
}
