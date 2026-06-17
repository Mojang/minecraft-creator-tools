import { LogLevel } from "./LogLevel";

export default interface ILogFormatter {
  format(message: string, level: LogLevel, ...args: unknown[]): string;
}
