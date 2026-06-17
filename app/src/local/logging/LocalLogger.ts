// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { threadId } from "worker_threads";
import ILogFilter from "../../core/logging/ILogFilter";
import ILogger from "../../core/logging/ILogger";
import { LogLevel, LogMask } from "../../core/logging/LogLevel";
import LocalLogFormatter from "./LocalLogFormatter";
import LogFilter from "../../core/logging/LogFilter";

const consoles: Record<LogLevel, (...args: unknown[]) => void> = {
  [LogLevel.critical]: console.error,
  [LogLevel.error]: console.error,
  [LogLevel.warn]: console.warn,
  [LogLevel.message]: console.log,
  [LogLevel.verbose]: console.log,
  [LogLevel.debug]: console.debug,
  [LogLevel.trace]: console.trace,
} as const;

export default class LocalLogger implements ILogger {
  mcpMode: boolean = false;
  showThreadId: boolean = false;

  constructor(
    private readonly filter: ILogFilter,
    private readonly stdFilter: ILogFilter = new LogFilter(LogMask.important),
    private readonly formatter: LocalLogFormatter = new LocalLogFormatter()
  ) {}

  log(message: string, level: LogLevel, ...args: unknown[]): void {
    if (this.mcpMode) {
      this.mcpLog(message, level, ...args);
    } else {
      this.defaultLog(message, level, ...args);
    }
  }

  private defaultLog(message: string, level: LogLevel, ...args: unknown[]) {
    if (!this.filter.shouldLog(level)) {
      return;
    }

    if (this.showThreadId) {
      // prepend to args
      args.unshift(`[threadId:${threadId}]`);
    }
    const formatted = this.formatter.format(message, level, ...args);

    const consoleMethod = consoles[level] ?? console.log;
    consoleMethod(formatted);
  }

  private mcpLog(message: string, level: LogLevel, ...args: unknown[]) {
    // In MCP/stdio mode, only route errors and warnings to stderr.
    // All other levels would appear as noise in VS Code's MCP output panel.
    if (this.stdFilter.shouldLog(level)) {
      const consoleMethod = consoles[level] || console.log;
      consoleMethod(this.formatter.format(message, level, ...args));
    }
  }
}
