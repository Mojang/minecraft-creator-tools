// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Tests for running tool commands through the server API (/api/commands), without a server:
 *
 * - Which commands each scope offers. serverApi is opt-in, so only the commands that list it run
 *   there. Every other scope, including the ui scope of the web and Electron command bar, offers
 *   the same commands as before.
 * - ToolCommandRequestGuard, which HttpServer runs on each request before the command: the types
 *   in the request body, and inputs that would let a client choose where the server writes.
 *
 * CliServeCommandsApiTest sends the same kinds of requests to `mct serve`.
 */

import { expect } from "chai";
import "mocha";
// Load CreatorToolsHost first. It loads the storage modules in an order that avoids a circular
// import failing ("Class extends value undefined") when this file runs on its own.
import "../app/CreatorToolsHost";
import { addCommand, allToolCommands, createCommand, removeCommand, scriptCommand } from "../app/toolcommands/commands";
import { serverCommand } from "../app/toolcommands/commands/ServerCommand";
import { IToolCommand, ToolCommandBase, ToolCommandScope } from "../app/toolcommands/IToolCommand";
import type {
  IToolCommandContext,
  IToolCommandOutput,
  IToolCommandSession,
} from "../app/toolcommands/IToolCommandContext";
import { ToolCommandRegistry } from "../app/toolcommands/ToolCommandRegistry";
import ToolCommandRequestGuard, { IToolCommandRequest } from "../local/ToolCommandRequestGuard";

const BUILT_IN_COMMANDS: IToolCommand[] = [...allToolCommands, serverCommand];

/** The commands that opt in to the serverApi scope. */
const SERVER_API_COMMANDS = ["add", "create", "script", "server"];

const OTHER_SCOPES = Object.values(ToolCommandScope).filter((scope) => scope !== ToolCommandScope.serverApi);

const SILENT_OUTPUT: IToolCommandOutput = {
  info: () => {},
  success: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
  progress: () => {},
};

/** A command that declares no scopes, like most built-in commands. */
class UnscopedCommand extends ToolCommandBase {
  readonly metadata = { name: "unscoped", description: "Test command", category: "General" as const };

  async execute() {
    return this.success("ran");
  }
}

function contextIn(scope: IToolCommandContext["scope"]): IToolCommandContext {
  return { output: SILENT_OUTPUT, scope };
}

function names(commands: IToolCommand[]) {
  return commands.map((command) => command.metadata.name).sort();
}

describe("Tool command scopes", () => {
  it("offers only the commands that opt in through the server API", () => {
    const offered = BUILT_IN_COMMANDS.filter((command) =>
      ToolCommandRegistry.isAvailableIn(command, ToolCommandScope.serverApi)
    );

    expect(names(offered)).to.deep.equal(SERVER_API_COMMANDS);
  });

  // Before serverApi became opt-in, a command was available in every scope its scopes didn't leave out.
  for (const scope of OTHER_SCOPES) {
    it(`offers the same commands as before in the ${scope} scope`, () => {
      for (const command of BUILT_IN_COMMANDS) {
        const scopes = command.metadata.scopes;

        expect(ToolCommandRegistry.isAvailableIn(command, scope), command.metadata.name).to.equal(
          !scopes || scopes.includes(scope)
        );
      }
    });
  }

  it("keeps create and add in every scope", () => {
    for (const command of [createCommand, addCommand]) {
      for (const scope of Object.values(ToolCommandScope)) {
        expect(ToolCommandRegistry.isAvailableIn(command, scope), `${command.metadata.name} in ${scope}`).to.equal(
          true
        );
      }
    }
  });

  describe("in a registry", () => {
    let registry: ToolCommandRegistry;

    beforeEach(() => {
      registry = new ToolCommandRegistry();
      registry.registerAll([...BUILT_IN_COMMANDS, new UnscopedCommand()]);
    });

    it("lists every command for the web and Electron command bar", () => {
      expect(names(registry.getAll(ToolCommandScope.ui))).to.deep.equal(
        names([...BUILT_IN_COMMANDS, new UnscopedCommand()])
      );
    });

    it("lists only opted-in commands for the server API", () => {
      expect(names(registry.getAll(ToolCommandScope.serverApi))).to.deep.equal(SERVER_API_COMMANDS);
    });

    it("runs a command without scopes from the command bar, but not through the server API", async () => {
      const fromCommandBar = await registry.execute("/unscoped", contextIn("ui"));
      const fromServerApi = await registry.execute("/unscoped", contextIn("serverApi"));

      expect(fromCommandBar?.success).to.equal(true);
      expect(fromServerApi?.error?.code).to.equal("SCOPE_RESTRICTED");
    });

    // The command bar's context has no EULA check: create and add run, and stop only because this
    // context has no CreatorTools, before they change anything.
    for (const commandText of ["/create addonstarter my-project", "/add entity my_mob"]) {
      it(`runs ${commandText.split(" ")[0]} from the command bar as before`, async () => {
        const result = await registry.execute(commandText, contextIn("ui"));

        expect(result?.error?.code).to.equal("NO_CREATOR_TOOLS");
      });
    }
  });
});

describe("ToolCommandRequestGuard.parse", () => {
  const accepted: { name: string; command: IToolCommand; body: string; expected: IToolCommandRequest }[] = [
    { name: "an empty body", command: createCommand, body: "", expected: { args: [], flags: {} } },
    { name: "an empty object", command: createCommand, body: "{}", expected: { args: [], flags: {} } },
    {
      name: "null args and flags",
      command: createCommand,
      body: '{"args": null, "flags": null}',
      expected: { args: [], flags: {} },
    },
    {
      name: "add's flags of every type, with numbers as text",
      command: addCommand,
      body: '{"args": ["entity", "my_mob"], "flags": {"traits": ["hostile"], "health": 30, "damage": "5", "template": "allay"}}',
      expected: {
        args: ["entity", "my_mob"],
        flags: { traits: ["hostile"], health: "30", damage: "5", template: "allay" },
      },
    },
    {
      name: "a null flag, which counts as left out",
      command: createCommand,
      body: '{"flags": {"creator": "Me", "unknown": null}}',
      expected: { args: [], flags: { creator: "Me" } },
    },
    // Commands read flags by name, so values given by short name are passed under the name.
    {
      name: "create's short flag names, as their names",
      command: createCommand,
      body: '{"flags": {"c": "Alice", "d": "A description"}}',
      expected: { args: [], flags: { creator: "Alice", description: "A description" } },
    },
    {
      name: "add's short flag names, as their names",
      command: addCommand,
      body: '{"args": ["entity", "my_mob"], "flags": {"t": ["hostile"], "n": "demo"}}',
      expected: { args: ["entity", "my_mob"], flags: { traits: ["hostile"], namespace: "demo" } },
    },
    {
      name: "script's short flag names, as their names",
      command: scriptCommand,
      body: '{"args": ["say", "hi"], "flags": {"s": "s1", "r": true, "e": false, "t": "5"}}',
      expected: {
        args: ["say", "hi"],
        flags: { session: "s1", raw: true, eval: false, timeout: "5" },
        sessionName: "s1",
      },
    },
    {
      name: "server's short flag names, as their names",
      command: serverCommand,
      body: '{"args": ["start"], "flags": {"l": "1", "s": "s1", "f": true, "j": true, "w": true, "t": "30", "e": true}}',
      expected: {
        args: ["start"],
        flags: { slot: "1", session: "s1", fresh: true, json: true, "wait-ready": true, timeout: "30", editor: true },
        sessionName: "s1",
      },
    },
    {
      name: "a boolean flag",
      command: serverCommand,
      body: '{"args": ["start"], "flags": {"fresh": true}}',
      expected: { args: ["start"], flags: { fresh: true } },
    },
    {
      name: "sessionName before the session flag",
      command: serverCommand,
      body: '{"sessionName": "s1", "flags": {"session": "s2"}}',
      expected: { args: [], flags: { session: "s2" }, sessionName: "s1" },
    },
    {
      name: "the session flag",
      command: scriptCommand,
      body: '{"flags": {"session": "s2"}}',
      expected: { args: [], flags: { session: "s2" }, sessionName: "s2" },
    },
  ];

  for (const testCase of accepted) {
    it(`accepts ${testCase.name}`, () => {
      expect(ToolCommandRequestGuard.parse(testCase.command, testCase.body)).to.deep.equal(testCase.expected);
    });
  }

  const rejected: { name: string; command: IToolCommand; body: string; error: RegExp }[] = [
    { name: "a body that isn't JSON", command: createCommand, body: "create pwned", error: /isn't valid JSON/ },
    { name: "a JSON array", command: createCommand, body: '["create"]', error: /must be a JSON object/ },
    { name: "JSON null", command: createCommand, body: "null", error: /must be a JSON object/ },
    {
      name: "args that aren't an array",
      command: createCommand,
      body: '{"args": "pwned"}',
      error: /"args" must be an array of strings/,
    },
    { name: "a number in args", command: createCommand, body: '{"args": [1]}', error: /"args" must be an array/ },
    // A command would use ["../escaped"] as the string "../escaped", so it must not get past the path checks.
    {
      name: "an array in args",
      command: createCommand,
      body: '{"args": ["addonstarter", ["../escaped"]]}',
      error: /"args" must be an array of strings/,
    },
    { name: "flags that are an array", command: createCommand, body: '{"flags": ["c"]}', error: /"flags" must be/ },
    { name: "flags that are text", command: createCommand, body: '{"flags": "c"}', error: /"flags" must be/ },
    {
      name: "a flag the command doesn't have",
      command: createCommand,
      body: '{"flags": {"session": "s1"}}',
      error: /create command doesn't have a "session" flag/,
    },
    {
      name: "a __proto__ flag",
      command: createCommand,
      body: '{"flags": {"__proto__": ["x"]}}',
      error: /doesn't have a "__proto__" flag/,
    },
    // create would write the project before it noticed these, then fail.
    { name: "a boolean creator", command: createCommand, body: '{"flags": {"creator": true}}', error: /be text/ },
    { name: "a list creator", command: createCommand, body: '{"flags": {"creator": ["x"]}}', error: /be text/ },
    { name: "a number creator", command: createCommand, body: '{"flags": {"creator": 5}}', error: /be text/ },
    { name: "an object output", command: createCommand, body: '{"flags": {"output": {"a": 1}}}', error: /be text/ },
    {
      name: "a single trait as text",
      command: addCommand,
      body: '{"flags": {"traits": "hostile"}}',
      error: /"traits" flag must be an array of strings/,
    },
    {
      name: "a list with a number",
      command: addCommand,
      body: '{"flags": {"traits": ["a", 1]}}',
      error: /"traits" flag must be an array of strings/,
    },
    { name: "a number flag of words", command: addCommand, body: '{"flags": {"health": "lots"}}', error: /a number/ },
    { name: "an empty number flag", command: addCommand, body: '{"flags": {"health": ""}}', error: /a number/ },
    { name: "a boolean number flag", command: addCommand, body: '{"flags": {"health": true}}', error: /a number/ },
    {
      name: "a boolean flag as text",
      command: serverCommand,
      body: '{"flags": {"fresh": "true"}}',
      error: /"fresh" flag must be true or false/,
    },
    {
      name: "a flag given by both its name and its short name",
      command: createCommand,
      body: '{"flags": {"creator": "A", "c": "B"}}',
      error: /Give the "creator" flag once, as "creator" or "c", not both/,
    },
  ];

  for (const testCase of rejected) {
    it(`rejects ${testCase.name}`, () => {
      expect(ToolCommandRequestGuard.parse(testCase.command, testCase.body))
        .to.be.a("string")
        .that.matches(testCase.error);
    });
  }
});

describe("Tool commands run with flags from the server API", () => {
  /** Runs script the way HttpServer does, against a server that records the commands it gets. */
  async function runScript(body: string) {
    const request = ToolCommandRequestGuard.parse(scriptCommand, body) as IToolCommandRequest;
    const commands: string[] = [];
    const session = {
      sessionName: request.sessionName ?? "api",
      slot: 0,
      serverManager: {
        getActiveServer: () => ({
          runCommandImmediate: async (command: string) => {
            commands.push(command);
            return "";
          },
        }),
      },
    } as unknown as IToolCommandSession;

    const result = await scriptCommand.execute({ ...contextIn("serverApi"), session }, request.args, request.flags);

    expect(result.success, JSON.stringify(result)).to.equal(true);

    return commands;
  }

  it("runs script's r flag as raw", async () => {
    const short = await runScript('{"args": ["tp", "@s", "0", "64", "0"], "flags": {"r": true, "s": "api"}}');
    const long = await runScript('{"args": ["tp", "@s", "0", "64", "0"], "flags": {"raw": true, "session": "api"}}');
    const neither = await runScript('{"args": ["tp", "@s", "0", "64", "0"], "flags": {"session": "api"}}');

    expect(short).to.deep.equal(["/tp @s 0 64 0"]);
    expect(long).to.deep.equal(short);
    expect(neither).to.deep.equal(["/say tp @s 0 64 0"]);
  });
});

describe("ToolCommandRequestGuard.findPathInput", () => {
  const cases: {
    name: string;
    command: IToolCommand;
    args?: string[];
    flags?: IToolCommandRequest["flags"];
    error?: RegExp;
  }[] = [
    { name: "create with a template and name", command: createCommand, args: ["addonstarter", "my-addon"] },
    { name: "create with dots inside the name", command: createCommand, args: ["addonstarter", "my..addon"] },
    {
      name: "create with a creator and description",
      command: createCommand,
      args: ["addonstarter", "my-addon"],
      flags: { creator: "Me", description: "A/B testing add-on" },
    },
    {
      name: "create's output flag",
      command: createCommand,
      flags: { output: "/tmp/elsewhere" },
      error: /"output" flag/,
    },
    { name: "create's o flag", command: createCommand, flags: { o: "elsewhere" }, error: /"output" flag/ },
    { name: "an empty output flag", command: createCommand, flags: { output: "" }, error: /"output" flag/ },
    { name: "a name with /", command: createCommand, args: ["addonstarter", "../../escaped"], error: /"name"/ },
    { name: "a name with \\", command: createCommand, args: ["addonstarter", "..\\escaped"], error: /"name"/ },
    { name: "an absolute path as the name", command: createCommand, args: ["addonstarter", "/tmp/x"], error: /"name"/ },
    { name: "the name ..", command: createCommand, args: ["addonstarter", ".."], error: /"name"/ },
    { name: "the name .", command: createCommand, args: ["addonstarter", "."], error: /"name"/ },
    { name: "the name ...", command: createCommand, args: ["addonstarter", "..."], error: /"name"/ },
    { name: "a name of spaces", command: createCommand, args: ["addonstarter", "  "], error: /"name"/ },
    // create expands <pt_…> placeholders in project names, so these would become .. and . after the check.
    { name: "the name <pt_..>", command: createCommand, args: ["addonstarter", "<pt_..>"], error: /"name"/ },
    { name: "the name .<pt_>.", command: createCommand, args: ["addonstarter", ".<pt_>."], error: /"name"/ },
    { name: "the name <pt_.>", command: createCommand, args: ["addonstarter", "<pt_.>"], error: /"name"/ },
    { name: "an empty name, which create replaces", command: createCommand, args: ["addonstarter", ""] },
    // create turns its creator into the pack folders' names.
    { name: "a creator with /", command: createCommand, flags: { creator: "../../evil" }, error: /"creator" flag/ },
    { name: "a creator with \\", command: createCommand, flags: { creator: "..\\..\\evil" }, error: /"creator"/ },
    { name: "a creator of <pt_..>", command: createCommand, flags: { c: "<pt_..>" }, error: /"creator" flag/ },
    { name: "a creator with punctuation", command: createCommand, flags: { creator: "Jane O'Neil-Smith, Ltd." } },
    // Free text, such as descriptions and display names, isn't used in names.
    { name: "a description with /", command: createCommand, flags: { d: "A/B test <beta>" } },
    { name: "add's display name with /", command: addCommand, flags: { "display-name": "Mob/Variant" } },
    { name: "a trait with /", command: addCommand, flags: { traits: ["hostile", "../x"] }, error: /"traits" flag/ },
    { name: "add's namespace with /", command: addCommand, flags: { namespace: "../ns" }, error: /"namespace"/ },
    { name: "add's template of ..", command: addCommand, flags: { template: ".." }, error: /"template" flag/ },
    // On Windows, a colon starts a drive-relative path or an alternate data stream.
    {
      name: "a drive-relative name",
      command: createCommand,
      args: ["addonstarter", "C:temp"],
      error: /"name" can't contain \/, \\, :, <, or >/,
    },
    { name: "a drive as the name", command: createCommand, args: ["addonstarter", "C:"], error: /"name"/ },
    { name: "a name with a data stream", command: addCommand, args: ["entity", "mob:stream"], error: /"name"/ },
    {
      name: "a creator with a colon",
      command: createCommand,
      flags: { creator: "Studio: Blocks" },
      error: /"creator"/,
    },
    { name: "a namespace with a colon", command: addCommand, flags: { namespace: "demo:x" }, error: /"namespace"/ },
    // File systems reject control characters, including NUL, which makes Node's fs throw.
    {
      name: "a name with NUL",
      command: createCommand,
      args: ["addonstarter", "evil\u0000"],
      error: /"name" can't contain control characters/,
    },
    {
      name: "a name with a line break",
      command: createCommand,
      args: ["addonstarter", "two\nlines"],
      error: /control characters/,
    },
    { name: "a name with a tab", command: addCommand, args: ["entity", "my\tmob"], error: /control characters/ },
    { name: "a name with DEL", command: addCommand, args: ["entity", "mob\u007f"], error: /control characters/ },
    {
      name: "a trait with a control character",
      command: addCommand,
      flags: { traits: ["hostile", "melee\u001f"] },
      error: /"traits" flag can't contain control characters/,
    },
    // Windows reserves these device names, in flags too.
    {
      name: "a creator of NUL",
      command: createCommand,
      flags: { creator: "NUL" },
      error: /"creator" flag can't be a device/,
    },
    { name: "a namespace of aux", command: addCommand, flags: { namespace: "aux" }, error: /"namespace" flag/ },
    { name: "a template of LPT1", command: addCommand, flags: { template: "LPT1" }, error: /"template" flag/ },
    // Free text isn't used in names, so it can have colons, line breaks, and device names.
    { name: "a description with a colon and a line break", command: createCommand, flags: { d: "Part 2: CON\nnotes" } },
    { name: "add's display name with a colon", command: addCommand, flags: { "display-name": "Mob: The Return" } },
    { name: "a template with /", command: createCommand, args: ["../addonstarter"], error: /"template"/ },
    { name: "an extra argument with /", command: createCommand, args: ["a", "b", "../c"], error: /"argument 3"/ },
    {
      name: "add with a type and name",
      command: addCommand,
      args: ["entity", "my_mob"],
      flags: { traits: ["hostile"] },
    },
    { name: "add with a name with /", command: addCommand, args: ["entity", "../../escaped"], error: /"name"/ },
    // script isn't a write command: its code is sent to the server, not used as a name.
    { name: "script code with /", command: scriptCommand, args: ["say a/b // c"] },
    { name: "a path argument", command: removeCommand, args: ["entities/x.json"], error: /"path" argument/ },
    // server would deploy the folder into Bedrock Dedicated Server.
    {
      name: "server's project flag",
      command: serverCommand,
      args: ["start"],
      flags: { project: "/home/someone" },
      error: /"project" flag/,
    },
    { name: "server's p flag", command: serverCommand, args: ["start"], flags: { p: "x" }, error: /"project" flag/ },
    { name: "server with a session", command: serverCommand, args: ["status"], flags: { session: "a/b" } },
  ];

  for (const testCase of cases) {
    it(`${testCase.error ? "refuses" : "allows"} ${testCase.name}`, () => {
      const error = ToolCommandRequestGuard.findPathInput(testCase.command, {
        args: testCase.args ?? [],
        flags: testCase.flags ?? {},
      });

      if (testCase.error) {
        expect(error).to.be.a("string").that.matches(testCase.error);
        expect(error).to.contain("The server API doesn't accept file or folder paths");
      } else {
        expect(error).to.equal(undefined);
      }
    });
  }

  // Device names Windows reserves, in any case, with or without an extension. Windows ignores the
  // extension and the spaces before it.
  const deviceNames = ["CON", "con", "Prn", "AUX", "nul", "COM1", "com9", "COM0", "LPT1", "lpt9", "LPT\u00b9"];
  const deviceFileNames = ["NUL.txt", "con.tar.gz", "CON .json", "aux."];

  for (const deviceName of [...deviceNames, ...deviceFileNames]) {
    it(`refuses the device name ${JSON.stringify(deviceName)}`, () => {
      const error = ToolCommandRequestGuard.findPathInput(createCommand, {
        args: ["addonstarter", deviceName],
        flags: {},
      });

      expect(error)
        .to.be.a("string")
        .that.matches(/"name" can't be a device name that Windows reserves/);
    });
  }

  for (const name of ["console", "com10", "lpt", "conference.txt", "nullable", "auxiliary", "my-con"]) {
    it(`allows the name ${JSON.stringify(name)}, which isn't a device name`, () => {
      expect(
        ToolCommandRequestGuard.findPathInput(createCommand, { args: ["addonstarter", name], flags: {} })
      ).to.equal(undefined);
    });
  }
});
