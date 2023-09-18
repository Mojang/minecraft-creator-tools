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

  static alertFunction: ((message: string) => void) | undefined;

  constructor(message: string, level: LogItemLevel, category?: string) {
    this.level = level;
    this.message = message;
    this.created = new Date();
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

  static message(message: string, category?: string) {
    this.log(message, LogItemLevel.message);
  }

  static important(message: string, category?: string) {
    this.log(message, LogItemLevel.important);
  }

  static verbose(message: string, category?: string) {
    this.log(message, LogItemLevel.verbose, category);
  }

  static error(message: string, category?: string) {
    this.log(message, LogItemLevel.error);
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

  static log(message: string, level: LogItemLevel, category?: string) {
    const logItem = new LogItem(message, level, category);

    this._log.push(logItem);

    Log._onItemAdded.dispatch(this, logItem);

    return logItem.operId;
  }

  static debug(message: string) {
    this.log(message, LogItemLevel.debug);
  }

  static assertIsInt(number: number) {
    if (number !== Math.round(number)) {
      Log.debugAlert("Unexpectedly found number " + number + " is not an integer.");
    }
  }

  static assert(condition: boolean, message?: string) {
    if (!condition) {
      if (!message) {
        Log.debugAlert("Assertion failed.");
      } else {
        Log.debugAlert("Assertion failed: " + message);
      }
    }
  }

  static assertDefined(obj: any) {
    if (!obj) {
      Log.unexpectedUndefined("LAD");
    }
  }

  static fail(message: string) {
    Log.debugAlert("Failure case: " + message);
  }

  static unexpectedError(errorMessage: string) {
    if (Utilities.isDebug) {
      this.debugAlert(errorMessage);
    }

    throw new Error(errorMessage);
  }

  static debugAlert(message: string) {
    if (Log._suppressedLogs["all"] === true) {
      return;
    }

    Log.debug(message);

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
    } else if (AppServiceProxy.hasAppService) {
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
