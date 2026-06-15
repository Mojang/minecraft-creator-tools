// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ILogFormatter from "../../core/logging/ILogFormatter";
import { LogLevel } from "../../core/logging/LogLevel";
import { getArgsStrings, getLogData } from "../../core/logging/LogUtilities";

const reset = "\x1b[0m";

type LevelFormat = { color: string };

const levelFormats: { [key: number]: LevelFormat | undefined } = {
  [LogLevel.verbose]: { color: "\x1b[90m" },
  [LogLevel.error]: { color: "\x1b[31m" },
  [LogLevel.warn]: { color: "\x1b[33m" },
};

export default class LocalLogFormatter implements ILogFormatter {
  format(message: string, level: LogLevel, ...args: unknown[]): string {
    const { timestamp, levelStr } = getLogData(level);
    const formattedMessage = `[${timestamp}] [${levelStr}] ${message}${getArgsStrings(args)}`;

    return this.applyColor(formattedMessage, level);
  }

  private applyColor(message: string, level: LogLevel): string {
    const cmdFormat = levelFormats[level];

    return cmdFormat !== undefined ? cmdFormat.color + message + reset : message;
  }
}
