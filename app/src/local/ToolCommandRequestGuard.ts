// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Checks for requests that run a tool command through the server API (POST /api/commands/<name>).
 *
 * HttpServer runs these after it has found the command, checked that the command opts in to the
 * serverApi scope, and, for write commands, checked that the Minecraft EULA is accepted. They run
 * before the command does, so a rejected request changes nothing:
 *
 * - parse() reads the JSON body and checks it against the command's metadata. args must be
 *   strings. Each flag must be one the command declares, by name or short name, with a value of
 *   the flag's type: text for string, choice, identifier, and path flags; true or false for boolean
 *   flags; an array of strings for stringArray flags; and a number, or text that holds one, for
 *   number flags, which become text, as when the command is typed. A null flag counts as left out.
 *   Commands read flags by name, so a value given by short name (such as create's c) is passed
 *   under the name (creator), and giving both is an error.
 *   Commands use flag values as the types their metadata declares, and some write files before
 *   they'd notice another type (create with creator: true creates its project, then fails), so
 *   the types are checked first. That also keeps the path checks below from being bypassed: an
 *   args entry of ["../folder"] would become "../folder" when a command uses it as text.
 * - findPathInput() keeps clients from choosing where the server reads or writes. A client may be
 *   on another machine, and the server's folders aren't its to pick:
 *   - Inputs of type "path", such as create's output flag and server's project flag, aren't
 *     accepted. create then writes only to the server's projects folder.
 *   - Write commands turn their inputs into folder and file names, such as create's project name
 *     and creator and add's item name. So their arguments and flag values, except flags marked
 *     freeText, such as create's description, must be plain names:
 *     - no / or \, which would reach outside the projects folder (for example, ../../folder), and
 *       no :, which on Windows starts a drive-relative path (C:temp) or an alternate data stream
 *     - no < or >: create expands <pt_…> placeholders in names, so <pt_..> would become .. after
 *       this check
 *     - no control characters (U+0000-U+001F and U+007F); file systems reject them, NUL included
 *     - not only dots or spaces, such as . and .., which name a folder itself or its parent
 *     - not a device name Windows reserves, such as CON, NUL, COM1, or LPT1, with or without an
 *       extension (NUL.txt is NUL too), following Microsoft's file naming rules
 *     Most of these would otherwise fail later, inside the command, with an unclear file system
 *     error, so they're refused up front with a clear one.
 *
 * The web and Electron command bar runs tool commands in the app, not through this API, so these
 * checks don't apply there.
 */

import type { IToolCommand } from "../app/toolcommands/IToolCommand";
import type { IToolCommandFlag } from "../app/toolcommands/IToolCommandArgument";

/** Characters that make a name a path: separators, a drive's :, and the < and > of <pt_…> placeholders. */
const PATH_CHARACTERS = /[/\\:<>]/;

/** Names made only of dots and spaces, such as . and .., which name a folder itself or its parent. */
const DOTS_AND_SPACES = /^[.\s]+$/;

/**
 * Device names Windows reserves, which name a device instead of a file or folder. The ¹, ², and ³
 * forms are reserved too.
 */
const DEVICE_NAMES = /^(con|prn|aux|nul|com[0-9\u00b9\u00b2\u00b3]|lpt[0-9\u00b9\u00b2\u00b3])$/i;

type FlagValue = string | boolean | string[];

/** A tool command request that parse() accepted. */
export interface IToolCommandRequest {
  args: string[];
  flags: Record<string, FlagValue>;
  /** The session to run in: the body's sessionName, or else the session flag. */
  sessionName?: string;
}

export default class ToolCommandRequestGuard {
  /**
   * Reads the JSON body of a request for a command. Returns an error message when the body isn't a
   * JSON object, or its args or flags aren't what the command takes. See the file header.
   */
  static parse(command: IToolCommand, body: string): IToolCommandRequest | string {
    if (!body) {
      return { args: [], flags: {} };
    }

    let data: unknown;

    try {
      data = JSON.parse(body);
    } catch {
      return "The request body isn't valid JSON.";
    }

    if (typeof data !== "object" || data === null || Array.isArray(data)) {
      return 'The request body must be a JSON object, such as {"args": [], "flags": {}}.';
    }

    const request = data as { args?: unknown; flags?: unknown; sessionName?: unknown };
    const args = request.args ?? [];
    const rawFlags = request.flags ?? {};

    if (!Array.isArray(args) || !args.every((arg) => typeof arg === "string")) {
      return '"args" must be an array of strings.';
    }

    if (typeof rawFlags !== "object" || Array.isArray(rawFlags)) {
      return '"flags" must be an object.';
    }

    const flagEntries: [string, FlagValue][] = [];

    for (const [key, value] of Object.entries(rawFlags)) {
      if (value === null) {
        continue;
      }

      const flag = ToolCommandRequestGuard._findFlag(command, key);

      if (!flag) {
        return `The ${command.metadata.name} command doesn't have a "${key}" flag.`;
      }

      if (flagEntries.some(([name]) => name === flag.name)) {
        return `Give the "${flag.name}" flag once, as "${flag.name}" or "${flag.shortName}", not both.`;
      }

      const checked = ToolCommandRequestGuard._checkFlagValue(flag, value);

      if ("error" in checked) {
        return `The "${key}" flag must be ${checked.error}.`;
      }

      // Commands read flags by name, so a value given by short name is passed under the name.
      flagEntries.push([flag.name, checked.value]);
    }

    // fromEntries defines each key as its own property, so a "__proto__" key can't change the prototype.
    const flags: Record<string, FlagValue> = Object.fromEntries(flagEntries);
    const sessionFlag = ToolCommandRequestGuard._ownValue(flags, "session");
    let sessionName: string | undefined;

    if (typeof request.sessionName === "string" && request.sessionName) {
      sessionName = request.sessionName;
    } else if (typeof sessionFlag === "string" && sessionFlag) {
      sessionName = sessionFlag;
    }

    return sessionName ? { args, flags, sessionName } : { args, flags };
  }

  /**
   * Finds an input that would let the client choose where the server reads or writes, and returns
   * the error to send, or undefined when there's none. See the file header.
   */
  static findPathInput(command: IToolCommand, request: IToolCommandRequest): string | undefined {
    const argDefinitions = command.metadata.arguments ?? [];
    const isWriteCommand = command.metadata.isWriteCommand === true;

    for (let i = 0; i < request.args.length; i++) {
      const name = argDefinitions[i]?.name ?? "argument " + (i + 1);

      if (argDefinitions[i]?.type === "path") {
        return `The server API doesn't accept file or folder paths. Leave out the "${name}" argument.`;
      }

      const problem = isWriteCommand ? ToolCommandRequestGuard._nameProblem(request.args[i]) : undefined;

      if (problem) {
        return ToolCommandRequestGuard._nameError(`"${name}"`, problem);
      }
    }

    for (const flag of command.metadata.flags ?? []) {
      const keys = flag.shortName ? [flag.name, flag.shortName] : [flag.name];

      for (const key of keys) {
        const value = ToolCommandRequestGuard._ownValue(request.flags, key);

        if (value === undefined) {
          continue;
        }

        if (flag.type === "path") {
          return `The server API doesn't accept file or folder paths. Leave out the "${flag.name}" flag.`;
        }

        if (!isWriteCommand || flag.freeText) {
          continue;
        }

        const texts = typeof value === "string" ? [value] : Array.isArray(value) ? value : [];

        for (const text of texts) {
          const problem = ToolCommandRequestGuard._nameProblem(text);

          if (problem) {
            return ToolCommandRequestGuard._nameError(`the "${flag.name}" flag`, problem);
          }
        }
      }
    }

    return undefined;
  }

  /** Why text can't be a file or folder name (see the file header), or undefined when it can. */
  private static _nameProblem(text: string): string | undefined {
    if (PATH_CHARACTERS.test(text)) {
      return "contain /, \\, :, <, or >";
    }

    if (ToolCommandRequestGuard._hasControlCharacter(text)) {
      return "contain control characters";
    }

    if (DOTS_AND_SPACES.test(text)) {
      return "be only dots or spaces";
    }

    // Windows ignores an extension and spaces before it, so NUL.txt and "CON .json" are devices too.
    if (DEVICE_NAMES.test(text.split(".")[0].replace(/ +$/, ""))) {
      return "be a device name that Windows reserves, such as CON, NUL, or COM1";
    }

    return undefined;
  }

  private static _nameError(input: string, problem: string) {
    return `The server API doesn't accept file or folder paths, so ${input} can't ${problem}.`;
  }

  /** Whether text has a control character: U+0000 to U+001F, such as NUL or a line break, or U+007F. */
  private static _hasControlCharacter(text: string) {
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);

      if (code <= 0x1f || code === 0x7f) {
        return true;
      }
    }

    return false;
  }

  /** The flag a request key names: the flag with that name or short name. */
  private static _findFlag(command: IToolCommand, key: string): IToolCommandFlag | undefined {
    return command.metadata.flags?.find((flag) => flag.name === key || flag.shortName === key);
  }

  /** The value as the flag's type, or what the value must be instead. */
  private static _checkFlagValue(flag: IToolCommandFlag, value: unknown): { value: FlagValue } | { error: string } {
    if (flag.type === "boolean" || flag.isBoolean) {
      return typeof value === "boolean" ? { value } : { error: "true or false" };
    }

    if (flag.type === "stringArray") {
      return Array.isArray(value) && value.every((item) => typeof item === "string")
        ? { value }
        : { error: "an array of strings" };
    }

    if (flag.type === "number") {
      if (typeof value === "number" && Number.isFinite(value)) {
        return { value: String(value) };
      }

      return typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))
        ? { value }
        : { error: "a number" };
    }

    return typeof value === "string" ? { value } : { error: "text" };
  }

  /** A flag's value, ignoring properties that objects inherit, such as toString. */
  private static _ownValue(flags: IToolCommandRequest["flags"], key: string) {
    return Object.prototype.hasOwnProperty.call(flags, key) ? flags[key] : undefined;
  }
}
