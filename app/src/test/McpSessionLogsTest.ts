// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { expect } from "chai";
import "mocha";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import MinecraftMcpServer from "../local/MinecraftMcpServer";
import { DedicatedServerStatus, OutputLine } from "../local/DedicatedServer";
import ServerMessage from "../local/ServerMessage";
import {
  classifyServerLogLevel,
  IServerLogQueryOptions,
  queryServerLog,
  redactLocalPaths,
  REDACTED_PATH,
  SERVER_LOG_DEFAULT_MESSAGE_LENGTH,
  SERVER_LOG_MAX_INSPECTED_LENGTH,
  SERVER_LOG_MAX_LIMIT,
} from "../local/ServerLogQuery";

const HOME = "C:\\Users\\creator";

function lines(...messages: string[]): OutputLine[] {
  return messages.map((message, i) => ({ message, received: i }));
}

function bdsLine(level: "INFO" | "WARN" | "ERROR", message: string) {
  return `[2026-10-13 18:00:00:000 ${level}] ${message}`;
}

const SESSION_LOG = lines(
  bdsLine("INFO", "Starting Server"),
  bdsLine("ERROR", "[Scripting] Old error from a previous start"),
  bdsLine("INFO", "Server stop requested."),
  bdsLine("INFO", "Starting Server"),
  bdsLine("INFO", "Version: 1.26.0.1"),
  bdsLine(
    "ERROR",
    `[Scripting] Plugin [Test Pack - 1.0.0] - [main.js] ran with error: [ReferenceError: Import [world] not found at ${HOME}\\worlds\\test\\scripts\\main.js]`
  ),
  bdsLine(
    "ERROR",
    "[Json] | Failed to parse field ' -> components -> demo:glow': this component was found in the input, but is not present in the Schema"
  ),
  bdsLine("WARN", "[Actor] Entity 'demo:mob' uses a deprecated format version"),
  bdsLine("INFO", "Server started."),
  "Target data:"
);

function createServerWithSession(outputLines: OutputLine[], extraSlots: { [slot: number]: OutputLine[] } = {}) {
  const mcp = new MinecraftMcpServer() as any;
  const servers: { [slot: number]: { status: DedicatedServerStatus; outputLines: OutputLine[] } } = {
    0: { status: DedicatedServerStatus.started, outputLines },
  };
  for (const slot of Object.keys(extraSlots)) {
    servers[Number(slot)] = { status: DedicatedServerStatus.started, outputLines: extraSlots[Number(slot)] };
  }
  mcp._serverManager = {
    getActiveServer: (slot: number) => servers[slot],
    getActiveSlots: () => Object.keys(servers).map(Number),
  };
  mcp._logRedactionRoots = [HOME];
  return mcp;
}

async function connect(server: McpServer): Promise<Client> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "session-logs-test", version: "1.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

describe("MinecraftMcpServer session logs", () => {
  it("lets an agent read a session's recent server errors through MCP", async () => {
    const mcp = createServerWithSession(SESSION_LOG);
    mcp._registerSessionLogTools();

    const client = await connect(mcp._server);
    try {
      const tools = (await client.listTools()).tools.map((tool) => tool.name);
      expect(tools).to.include("getMinecraftSessionLogs");

      const result = (await client.callTool({ name: "getMinecraftSessionLogs", arguments: {} })) as any;
      const text: string = result.content[0].text;

      expect(result.isError).to.not.equal(true);
      expect(text).to.contain("untrusted");
      expect(text).to.contain("ReferenceError: Import [world] not found");
      expect(text).to.contain("is not present in the Schema");
      expect(text).to.contain("deprecated format version");
      expect(text).to.not.contain("Old error from a previous start");
      expect(text).to.not.contain(HOME);

      const payload = JSON.parse(text.substring(text.indexOf("{")));
      expect(payload.countsByLevel).to.deep.equal({ error: 2, warning: 1, info: 3, other: 0 });
      expect(payload.scope).to.equal("sinceLatestStart");
    } finally {
      await client.close();
    }
  });

  it("rejects a limit above the maximum", async () => {
    const mcp = createServerWithSession(SESSION_LOG);
    mcp._registerSessionLogTools();

    const client = await connect(mcp._server);
    try {
      const result = (await client.callTool({
        name: "getMinecraftSessionLogs",
        arguments: { limit: SERVER_LOG_MAX_LIMIT + 1 },
      })) as any;
      expect(result.isError).to.equal(true);
    } finally {
      await client.close();
    }
  });

  it("returns an error for an unknown session or a session with no active server", async () => {
    const mcp = createServerWithSession(SESSION_LOG);
    mcp._sessions["stopped"] = { slot: 3 };

    const unknown = await mcp._getMinecraftSessionLogsOp({ sessionName: "nope" });
    expect(unknown.isError).to.equal(true);
    expect(unknown.content[0].text).to.contain("listMinecraftSessions");

    const stopped = await mcp._getMinecraftSessionLogsOp({ sessionName: "stopped" });
    expect(stopped.isError).to.equal(true);
    expect(stopped.content[0].text).to.contain("No active server");
  });

  it("points to the log tool from listMinecraftSessions and runCommandInMinecraft when errors exist", async () => {
    const mcp = createServerWithSession(SESSION_LOG);
    mcp._creatorTools = {};
    mcp._env = {};
    mcp.runCommand = async () => "Command ran";

    const list = await mcp._listMinecraftSessionsOp();
    const sessions = JSON.parse(list.content[0].text);
    expect(sessions[0].errorsSinceStart).to.equal(2);
    expect(sessions[0].warningsSinceStart).to.equal(1);
    expect(list.content[1].text).to.contain("getMinecraftSessionLogs");

    const command = await mcp._runCommandOp({ sessionName: "default", command: "say hi" });
    expect(command.content[0].text).to.contain("Command ran");
    expect(command.content[0].text).to.contain("2 error(s)");
    expect(command.content[0].text).to.contain("getMinecraftSessionLogs");
  });

  it("doesn't add a log hint to runCommandInMinecraft when the server has no errors", async () => {
    const mcp = createServerWithSession(lines(bdsLine("INFO", "Starting Server"), bdsLine("INFO", "Server started.")));
    mcp._creatorTools = {};
    mcp._env = {};
    mcp.runCommand = async () => "Command ran";

    const command = await mcp._runCommandOp({ sessionName: "default", command: "say hi" });
    expect(command.content[0].text).to.equal("Command ran");

    const list = await mcp._listMinecraftSessionsOp();
    expect(list.content.length).to.equal(1);
    expect(JSON.parse(list.content[0].text)[0].errorsSinceStart).to.equal(0);
  });

  it("reads an unnamed slot using the slot that listMinecraftSessions reports", async () => {
    const mcp = createServerWithSession(lines(bdsLine("INFO", "Starting Server")), {
      3: lines(bdsLine("INFO", "Starting Server"), bdsLine("ERROR", "slot three error")),
    });
    mcp._creatorTools = {};
    mcp._env = {};

    const list = await mcp._listMinecraftSessionsOp();
    const listed = JSON.parse(list.content[0].text).find((s: any) => s.slot === 3);
    expect(listed.errorsSinceStart).to.equal(1);
    expect(list.content[1].text).to.contain("slot");

    const byName = await mcp._getMinecraftSessionLogsOp({ sessionName: listed.name });
    expect(byName.isError).to.equal(true);

    const bySlot = await mcp._getMinecraftSessionLogsOp({ slot: listed.slot });
    expect(bySlot.isError).to.not.equal(true);
    expect(bySlot.content[0].text).to.contain("slot three error");
    expect(bySlot.content[0].text).to.contain(listed.name);

    mcp._sessions["named"] = { slot: 0 };
    const mismatch = await mcp._getMinecraftSessionLogsOp({ sessionName: "named", slot: 3 });
    expect(mismatch.isError).to.equal(true);
  });
});

describe("queryServerLog", () => {
  const filterCases: {
    name: string;
    options: IServerLogQueryOptions;
    expectedMessages: string[];
  }[] = [
    {
      name: "defaults to errors and warnings since the latest start",
      options: {},
      expectedMessages: ["ReferenceError", "not present in the Schema", "deprecated format version"],
    },
    {
      name: "includes earlier starts when sinceLatestStart is false",
      options: { sinceLatestStart: false, levels: ["error"] },
      expectedMessages: ["Old error from a previous start", "ReferenceError", "not present in the Schema"],
    },
    {
      name: "filters by level",
      options: { levels: ["warning"] },
      expectedMessages: ["deprecated format version"],
    },
    {
      name: "searches case-insensitively",
      options: { search: "DEMO:GLOW" },
      expectedMessages: ["not present in the Schema"],
    },
    {
      name: "returns info when asked",
      options: { levels: ["info"] },
      expectedMessages: ["Starting Server", "Version: 1.26.0.1", "Server started."],
    },
    {
      name: "keeps the most recent entries within the limit",
      options: { limit: 1 },
      expectedMessages: ["deprecated format version"],
    },
  ];

  for (const testCase of filterCases) {
    it(testCase.name, () => {
      const result = queryServerLog(SESSION_LOG, testCase.options);

      expect(result.entries.length).to.equal(testCase.expectedMessages.length);
      testCase.expectedMessages.forEach((expected, i) => expect(result.entries[i].message).to.contain(expected));
    });
  }

  it("excludes internal lines by default", () => {
    const log = [
      { message: bdsLine("INFO", "Starting Server"), received: 0 },
      { message: bdsLine("ERROR", "querytarget noise"), received: 1, isInternal: true },
      { message: bdsLine("ERROR", "real error"), received: 2 },
    ];

    expect(queryServerLog(log).entries.map((e) => e.message)).to.deep.equal(["real error"]);
    expect(queryServerLog(log, { includeInternal: true }).entries.length).to.equal(2);
  });

  it("reports truncation and counts", () => {
    const result = queryServerLog(SESSION_LOG, { limit: 1 });

    expect(result.truncated).to.equal(true);
    expect(result.distinctMatches).to.equal(3);
    expect(result.countsByLevel).to.deep.equal({ error: 2, warning: 1, info: 3, other: 0 });
  });

  it("caps the limit at the maximum", () => {
    const log = lines(...Array.from({ length: SERVER_LOG_MAX_LIMIT + 50 }, (_, i) => bdsLine("ERROR", `error ${i}`)));

    expect(queryServerLog(log, { limit: 10_000 }).entries.length).to.equal(SERVER_LOG_MAX_LIMIT);
  });

  it("collapses repeated entries with a count", () => {
    const log = lines(
      bdsLine("ERROR", "same error"),
      bdsLine("ERROR", "other error"),
      bdsLine("ERROR", "same error"),
      bdsLine("ERROR", "same error")
    );

    const result = queryServerLog(log);

    expect(result.entries.map((e) => [e.message, e.count])).to.deep.equal([
      ["other error", 1],
      ["same error", 3],
    ]);
    expect(result.countsByLevel.error).to.equal(4);
    expect(result.scope).to.equal("entireBuffer");
    expect(result.startFoundInBuffer).to.equal(false);
  });

  it("folds header-less lines after an error into that entry", () => {
    const log = lines(
      bdsLine("ERROR", "[Scripting] TypeError: cannot read property"),
      "    at tick (main.js:12)",
      "    at <anonymous> (main.js:30)",
      bdsLine("INFO", "Server started.")
    );

    const result = queryServerLog(log);

    expect(result.entries.length).to.equal(1);
    expect(result.entries[0].message).to.equal(
      "[Scripting] TypeError: cannot read property\nat tick (main.js:12)\nat <anonymous> (main.js:30)"
    );
    expect(result.entries[0].time).to.equal("2026-10-13 18:00:00:000");
  });

  it("caps message length", () => {
    const log = lines(bdsLine("ERROR", "x".repeat(5000)));

    const message = queryServerLog(log, { maxMessageLength: 100 }).entries[0].message;

    expect(message.startsWith("x".repeat(100))).to.equal(true);
    expect(message).to.contain("4900 more characters");
  });

  it("bounds an oversized line before redaction and grouping", () => {
    const huge = "y".repeat(SERVER_LOG_MAX_INSPECTED_LENGTH * 50);
    const log = lines(bdsLine("ERROR", huge), bdsLine("ERROR", huge + "different tail"));

    const result = queryServerLog(log);

    expect(result.entries.length).to.equal(1);
    expect(result.entries[0].count).to.equal(2);
    expect(result.entries[0].message.length).to.be.lessThan(SERVER_LOG_DEFAULT_MESSAGE_LENGTH + 50);
    expect(result.countsByLevel.error).to.equal(2);
  });

  it("bounds an oversized set of continuation lines", () => {
    const frame = "    at " + "z".repeat(SERVER_LOG_MAX_INSPECTED_LENGTH);
    const log = lines(bdsLine("ERROR", "TypeError: boom"), ...Array.from({ length: 40 }, () => frame));

    const result = queryServerLog(log);

    expect(result.entries.length).to.equal(1);
    expect(result.entries[0].message.startsWith("TypeError: boom\nat z")).to.equal(true);
    expect(result.entries[0].message.length).to.be.lessThan(SERVER_LOG_DEFAULT_MESSAGE_LENGTH + 50);
    expect(result.entries[0].message).to.contain("more characters");
  });

  it("keeps results bounded for many distinct oversized lines with a small limit", () => {
    const log = lines(
      ...Array.from({ length: 300 }, (_, i) =>
        bdsLine("ERROR", `${i} ` + "w".repeat(SERVER_LOG_MAX_INSPECTED_LENGTH * 2))
      )
    );

    const result = queryServerLog(log, { limit: 2 });

    expect(result.entries.length).to.equal(2);
    expect(result.distinctMatches).to.equal(300);
    expect(result.truncated).to.equal(true);
    expect(result.countsByLevel.error).to.equal(300);
    expect(result.entries[1].message.startsWith("299 ")).to.equal(true);
    result.entries.forEach((e) => expect(e.message.length).to.be.lessThan(SERVER_LOG_DEFAULT_MESSAGE_LENGTH + 50));
  });

  it("scopes to the newest process stream when an old stream drains after a restart", () => {
    const at = (streamId: number, message: string): OutputLine => ({ message, received: 0, streamId });
    const log: OutputLine[] = [
      at(1, bdsLine("INFO", "Starting Server")),
      at(1, bdsLine("ERROR", "first run error")),
      at(2, bdsLine("INFO", "Starting Server")),
      at(2, bdsLine("ERROR", "second run error")),
      at(1, bdsLine("INFO", "Starting Server")),
      at(1, bdsLine("ERROR", "late first run error")),
      at(2, bdsLine("WARN", "second run warning")),
    ];

    const result = queryServerLog(log);

    expect(result.startFoundInBuffer).to.equal(true);
    expect(result.scope).to.equal("sinceLatestStart");
    expect(result.entries.map((e) => e.message)).to.deep.equal(["second run error", "second run warning"]);
    expect(result.countsByLevel).to.deep.equal({ error: 1, warning: 1, info: 1, other: 0 });

    const everything = queryServerLog(log, { sinceLatestStart: false, levels: ["error"] });
    expect(everything.entries.length).to.equal(3);
  });

  const levelCases: { line: string; level: string }[] = [
    { line: bdsLine("ERROR", "boom"), level: "error" },
    { line: bdsLine("WARN", "careful"), level: "warning" },
    { line: bdsLine("INFO", "hello"), level: "info" },
    { line: bdsLine("INFO", "[Json][error]-bad field"), level: "error" },
    { line: bdsLine("INFO", "[Blocks][warning]-old format"), level: "warning" },
    { line: "plain output", level: "other" },
  ];

  for (const testCase of levelCases) {
    it(`classifies "${testCase.line}" as ${testCase.level}`, () => {
      expect(classifyServerLogLevel(new ServerMessage(testCase.line))).to.equal(testCase.level);
    });
  }
});

describe("redactLocalPaths", () => {
  const cases: { name: string; input: string; roots?: string[]; expected: string }[] = [
    {
      name: "a Windows path, keeping the file name",
      input: "at C:\\Users\\creator\\worlds\\scripts\\main.js:3",
      expected: `at ${REDACTED_PATH}/main.js:3`,
    },
    {
      name: "a forward-slash Windows path inside brackets",
      input: "[D:/projects/pack/main.js]",
      expected: `[${REDACTED_PATH}/main.js]`,
    },
    {
      name: "a POSIX home path",
      input: "failed to load /home/creator/packs/entity.json.",
      expected: `failed to load ${REDACTED_PATH}/entity.json.`,
    },
    {
      name: "a configured root with spaces, consuming the whole path",
      input: "C:\\Users\\Jane Doe\\customer-name\\worlds\\main.js",
      roots: ["C:\\Users\\Jane Doe"],
      expected: `${REDACTED_PATH}/main.js`,
    },
    {
      name: "a nested path under a configured POSIX temp root with spaces",
      input: "Failed to read /tmp/build area/acme studio/pack one/blocks.json | parse error",
      roots: ["/tmp/build area"],
      expected: `Failed to read ${REDACTED_PATH}/blocks.json | parse error`,
    },
    {
      name: "a Windows home path with spaces when no root is configured",
      input: "load C:\\Users\\Jane Doe\\secret project\\entities\\mob.json, skipping",
      expected: `load ${REDACTED_PATH}/mob.json, skipping`,
    },
    {
      name: "a path under an arbitrary POSIX root",
      input: "opened /srv2/clients/acme/world/level.dat",
      expected: `opened ${REDACTED_PATH}/level.dat`,
    },
    {
      name: "a delimiter-adjacent POSIX path",
      input: "cwd:/opt/acme/server",
      expected: `cwd:${REDACTED_PATH}/server`,
    },
    {
      name: "nothing in URLs",
      input: "See https://aka.ms/mcbds and/or retry",
      expected: "See https://aka.ms/mcbds and/or retry",
    },
    {
      name: "nothing in pack-relative paths",
      input: "entities/mob.json -> components -> demo:glow",
      expected: "entities/mob.json -> components -> demo:glow",
    },
  ];

  for (const testCase of cases) {
    it(`redacts ${testCase.name}`, () => {
      expect(redactLocalPaths(testCase.input, testCase.roots)).to.equal(testCase.expected);
    });
  }

  it("leaves no intermediate folder names", () => {
    const input =
      "C:\\Users\\Jane Doe\\customer-name\\worlds\\main.js and /tmp/build area/acme studio/x.json and /home/jdoe/proj/y.js";
    const result = redactLocalPaths(input, ["C:\\Users\\Jane Doe", "/tmp/build area"]);

    for (const fragment of ["Jane", "Doe", "customer-name", "worlds", "build area", "acme", "jdoe", "proj"]) {
      expect(result, fragment).to.not.contain(fragment);
    }
  });
});
