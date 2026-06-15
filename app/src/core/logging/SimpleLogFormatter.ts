import ILogFormatter from "./ILogFormatter";
import { LogLevel } from "./LogLevel";
import { getArgsStrings, getLogData } from "./LogUtilities";

export default class SimpleLogFormatter implements ILogFormatter {
  format(message: string, level: LogLevel, ...args: unknown[]): string {
    const { timestamp, levelStr } = getLogData(level);
    const formattedMessage = `[${timestamp}] [${levelStr}] ${message}${getArgsStrings(args)}`;

    return formattedMessage;
  }
}
