import { LogLevel } from "./LogLevel";

export default interface ILogFilter {
  shouldLog(level: LogLevel): boolean;
}