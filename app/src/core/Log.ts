// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import CartoApp from "../app/CartoApp";
import AppServiceProxy from "./AppServiceProxy";
import Utilities from "./Utilities";
import { EventDispatcher } from "ste-events";

export enum LogItemLevel {
  debug = 0,
  verbose = 1,
  message = 2,
  error = 3,
  important = 4,
  operationStarted = 10,
  operationEnded = 11,
}

export class LogItem {
  level: LogItemLevel;
  message: string;
  created: Date;
  operId?: number;
  category?: string;
  context?: string;

  static alertFunction: ((message: string) => void) | undefined;

  constructor(message: string, level: LogItemLevel, context?: string, category?: string) {
    this.level = level;
    this.message = message;
    this.created = new Date();
    this.context = context;
    this.category = category;

    if (this.level === LogItemLevel.operationStarted) {
      this.operId = Log.items.length;
    }
  }
}

export default class Log {
  static _suppressedLogs: { [id: string]: boolean } = {};
  static _log: LogItem[] = [];
  static _onItemAdded = new EventDispatcher<Log, LogItem>();

  static get items() {
    return Log._log;
  }

  public static get onItemAdded() {
    return this._onItemAdded.asEvent();
  }

  static message(message: string, context?: string, category?: string) {
    this.log(message, LogItemLevel.message, context, category);
  }

  static important(message: string, context?: string, category?: string) {
    this.log(message, LogItemLevel.important, context, category);
  }

  static verbose(message: string, context?: string, category?: string) {
    this.log(message, LogItemLevel.verbose, context, category);
  }

  static error(message: string, context?: string, category?: string) {
    this.log(message, LogItemLevel.error, context, category);
  }

  static unexpectedUndefined(token?: string) {
    Log.fail("Unexpected undefined condition found." + (token ? " (" + token + ")" : ""));
  }

  static unexpectedIsDisposed(token?: string) {
    Log.fail("Unexpected usage of a disposed object." + (token ? " (" + token + ")" : ""));
  }

  static throwIsDisposed(token?: string) {
    this.unexpectedIsDisposed(token);
    throw new Error("Unexpected usage of a disposed object." + (token ? " (" + token + ")" : ""));
  }

  static throwUnexpectedUndefined(token?: string) {
    this.unexpectedUndefined(token);
    throw new Error("Unexpected undefined condition found." + (token ? " (" + token + ")" : ""));
  }

  static unexpectedNull(token?: string) {
    Log.fail("Unexpected null condition found." + (token ? " (" + token + ")" : ""));
  }

  static unexpectedContentState(token?: string) {
    Log.fail("Unexpected state of content." + (token ? " (" + token + ")" : ""));
  }

  static unexpectedState(token?: string) {
    Log.fail("Unexpected state of internal variables." + (token ? " (" + token + ")" : ""));
  }

  static unexpectedArguments(token?: string) {
    Log.fail("Unexpected arguments found." + (token ? " (" + token + ")" : ""));
  }

  static log(message: string, level: LogItemLevel, context?: string, category?: string) {
    const logItem = new LogItem(message, level, context, category);

    this._log.push(logItem);

    Log._onItemAdded.dispatch(this, logItem);

    return logItem.operId;
  }

  static debug(message: string, context?: string) {
    this.log(message, LogItemLevel.debug, context);
  }

  static assertIsInt(number: number, message?: string) {
    if (number !== Math.round(number)) {
      Log.debugAlert("Unexpectedly found number " + number + " is not an integer. " + (message ? message : ""));
    }
  }

  static assert(condition: boolean, message?: string, context?: string) {
    if (!condition) {
      if (!message) {
        Log.debugAlert("Assertion failed.", context);
      } else {
        Log.debugAlert("Assertion failed: " + message, context);
      }
    }
  }

  static assertDefined(obj: any, message?: string) {
    if (!obj) {
      Log.unexpectedUndefined("LAD." + (message ? message : ""));
    }
  }

  static fail(message: string, context?: string) {
    Log.debugAlert("Failure case: " + message, context);
  }

  static unexpectedError(errorMessage: string, context?: string) {
    if (Utilities.isDebug) {
      Log.debugAlert(errorMessage, context);
    }

    throw new Error(errorMessage);
  }

  static debugAlert(message: string, context?: string) {
    if (Log._suppressedLogs["all"] === true) {
      return;
    }

    Log.debug(message, context);

    if (!Utilities.isDebug) {
      return;
    }

    let stack: string = "";
    let header: string = "";

    const err = new Error();

    if (err.stack !== undefined) {
      stack = err.stack;
    }

    let i = stack.lastIndexOf("at Function.");

    if (i >= 0) {
      i = stack.indexOf("at ", i + 1);

      if (i >= 4) {
        // i -= 4;
        stack = stack.substring(i, stack.length);

        const nextSpace = stack.indexOf(" ", 8);

        if (nextSpace >= 0) {
          header = "=== " + stack.substring(7, nextSpace) + " ===\r\n\r\n";
        }
      }
    }

    const wholeMessage = header + message + "\r\n" + stack;

    if (LogItem.alertFunction) {
      let stackTrim = stack;

      if (stackTrim.length > 80) {
        stackTrim = stackTrim.substring(0, 80);
      }

      LogItem.alertFunction(message + "\r\n\r\n" + stackTrim);
      // debugger;
      return;
    } else if (AppServiceProxy.hasAppService && CartoApp.isWeb) {
      // @ts-ignore
      alert(header + message + "\r\n\r\n" + stack);
      debugger;
      return;
      // @ts-ignore
    } else if (typeof window === "undefined") {
      console.log(header + message + "\r\n\r\n" + stack);
      return;
    }

    // @ts-ignore
    const val = prompt(wholeMessage, "b to break, s to suppress, a to suppress all");

    if (val === "s") {
      Log._suppressedLogs[message] = true;
      return;
    } else if (val === "b") {
      debugger;
    } else if (val === "a") {
      Log._suppressedLogs["all"] = true;
    }
  }
}
