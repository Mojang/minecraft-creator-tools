import { LogLevel } from "./LogLevel";

export default interface ILogger {
  //args parameter allows for inclusion of additional data and compatibility with console.log-style usage
  log(message: string, level: LogLevel, ...args: unknown[]): void;
}
