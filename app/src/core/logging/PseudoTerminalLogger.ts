import { LogLevel } from "./LogLevel";
import SimpleLogFormatter from "./SimpleLogFormatter";
import ILogFormatter from "./ILogFormatter";
import ILogFilter from "./ILogFilter";
import ILogger from "./ILogger";

type PseudoTerminal = {
  printLine: (message: string) => void;
};

export default class PseudoTerminalLogger implements ILogger {
  constructor(
    private readonly terminal: PseudoTerminal,
    private readonly filter: ILogFilter,
    private readonly formatter: ILogFormatter = new SimpleLogFormatter()
  ) {}

  log(message: string, level: LogLevel, ...args: unknown[]): void {
    if (!this.filter.shouldLog(level)) {
      return;
    }

    const formattedMessage = this.formatter.format(message, level, ...args);

    this.terminal.printLine(formattedMessage);
  }
}
