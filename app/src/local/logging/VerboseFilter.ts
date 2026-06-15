// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ILogFilter from "../../core/logging/ILogFilter";
import { LogLevel, maskOf } from "../../core/logging/LogLevel";

const nonVerboseMask = maskOf(LogLevel.debug, LogLevel.message, LogLevel.warn, LogLevel.error, LogLevel.critical);

/*
 * Log filter that allows verbose logging to be toggled on and off.
 */
export default class VerboseFilter implements ILogFilter {
  constructor(public verbose: boolean = false) {}

  shouldLog(level: LogLevel): boolean {
    return this.verbose ? true : (nonVerboseMask & level) !== 0;
  }
}
