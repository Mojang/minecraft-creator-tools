// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Runs tool commands through `mct serve`'s server API (/api/commands) with the built CLI, as a
 * client with the updateState passcode would:
 *
 * - Only the commands that opt in to the serverApi scope are listed and run. Other commands get
 *   404, and the passcode checks still apply.
 * - Without the Minecraft EULA, create and add fail with the message the CLI uses, and nothing is
 *   written: not to the data folder, and not to an existing folder passed as create's output.
 *   server, which doesn't need the EULA here, can't be given a project folder to deploy.
 * - With the EULA accepted, create's output flag, path-like names and creators, and flags the
 *   command doesn't have or of the wrong type are refused without writing anything, and create
 *   and add write their projects to the data folder. Accepting with `mct eula --accept` while the
 *   server runs takes effect without a restart, and the EULA environment variable counts and is
 *   saved, as in the CLI.
 * - add fails without writing anything when its gallery template can't be downloaded.
 *
 * Each server gets a new data folder (createTestDataDir), so these tests never read or accept the
 * EULA in the real profile. The servers' outgoing requests go to NetworkBlocker, which refuses
 * them, so no test needs the network. Build the CLI first (npm run jsncorebuild).
 * ToolCommandServerApiTest covers the same rules without a server.
 */

import { expect } from "chai";
import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import * as fs from "fs";
import * as http from "http";
import * as path from "path";
import "../app/CreatorToolsHost";
import { allToolCommands } from "../app/toolcommands/commands";
import LocalUtilities from "../local/LocalUtilities";
import { buildCliEnvironment, diffTrees, NetworkBlocker, snapshotTree } from "./CliTranscriptHarness";
import { createTestDataDir, EULA_ENV } from "./TestDataDir";

const UPDATE_PASSCODE = "apiupd01";
const FULL_READ_ONLY_PASSCODE = "apiread1";

/** The commands that opt in to the serverApi scope. */
const SERVER_API_COMMANDS = ["add", "create", "script", "server"];

const STARTUP_TIMEOUT_MS = 30000;

interface IServe {
  process: ChildProcessWithoutNullStreams;
  port: number;
  dataDir: string;
  output: string[];
}

interface IResponse {
  status: number;
  body: string;
}

async function startServe(dataDir: string, proxyUrl: string, acceptEula: boolean): Promise<IServe> {
  const port = await LocalUtilities.findAvailablePort(16500, 16599, "localhost");

  if (!port) {
    throw new Error("No free port in 16500-16599 for the server API tests.");
  }

  const env = buildCliEnvironment(dataDir, proxyUrl);

  if (acceptEula) {
    env[EULA_ENV] = "true";
  }

  const args = ["serve", "basicwebservices", "--port", String(port)];
  args.push("--updatepc", UPDATE_PASSCODE, "--fullropc", FULL_READ_ONLY_PASSCODE);

  const serveProcess = spawn("node", ["./toolbuild/jsn/cli/index.mjs", ...args], { env });
  const server: IServe = { process: serveProcess, port, dataDir, output: [] };

  serveProcess.stdout.on("data", (chunk) => server.output.push(String(chunk)));
  serveProcess.stderr.on("data", (chunk) => server.output.push(String(chunk)));

  const start = Date.now();

  while (!server.output.join("").includes("Web UI available at:")) {
    if (serveProcess.exitCode !== null || Date.now() - start > STARTUP_TIMEOUT_MS) {
      serveProcess.kill();
      throw new Error("mct serve didn't start:\n" + server.output.join(""));
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // The startup message can come just before the port accepts connections.
  while ((await request(server, "GET", "/api/commands", UPDATE_PASSCODE).catch(() => undefined)) === undefined) {
    if (Date.now() - start > STARTUP_TIMEOUT_MS) {
      throw new Error("mct serve didn't accept connections:\n" + server.output.join(""));
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return server;
}

async function stopServe(server: IServe | undefined) {
  if (!server || server.process.exitCode !== null) {
    return;
  }

  const exited = new Promise((resolve) => server.process.once("exit", resolve));
  server.process.kill();
  await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 10000))]);
}

/** Runs the built CLI with a server's data folder and no EULA environment variable, and returns its stdout. */
async function runCli(dataDir: string, proxyUrl: string, args: string[]): Promise<string> {
  const cli = spawn("node", ["./toolbuild/jsn/cli/index.mjs", ...args], {
    env: buildCliEnvironment(dataDir, proxyUrl),
  });
  let stdout = "";
  let stderr = "";

  cli.stdout.on("data", (chunk) => (stdout += chunk));
  cli.stderr.on("data", (chunk) => (stderr += chunk));

  const exitCode = await new Promise((resolve) => cli.once("exit", resolve));

  expect(exitCode, `mct ${args.join(" ")}\n${stdout}\n${stderr}`).to.equal(0);

  return stdout;
}

function request(
  server: IServe,
  method: string,
  urlPath: string,
  passcode: string | undefined,
  body?: unknown
): Promise<IResponse> {
  return new Promise((resolve, reject) => {
    const headers: http.OutgoingHttpHeaders = { "content-type": "application/json" };

    if (passcode) {
      headers.mctpc = passcode;
    }

    const req = http.request(
      { host: "127.0.0.1", port: server.port, path: urlPath, method, agent: false, headers },
      (res) => {
        let text = "";
        res.setEncoding("utf8");
        res.on("data", (chunk: string) => (text += chunk));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: text }));
      }
    );

    req.on("error", reject);

    if (body !== undefined) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

function runCommand(server: IServe, name: string, body: unknown) {
  return request(server, "POST", "/api/commands/" + name, UPDATE_PASSCODE, body);
}

/** The error a refused or failed command returns, checking the response's shape. */
function commandError(response: IResponse) {
  const result = JSON.parse(response.body);

  expect(result.success, response.body).to.equal(false);

  return result.error as { code: string; message: string };
}

function isInside(child: string, parent: string) {
  const relative = path.relative(fs.realpathSync(parent), fs.realpathSync(child));

  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

describe("mct serve /api/commands", function () {
  this.timeout(120000);

  const blocker = new NetworkBlocker();
  let outsideFolder: string;

  before(async function () {
    await blocker.start();

    // An existing folder outside the data folder. create used to write a project into it.
    outsideFolder = createTestDataDir("api-commands-outside");
  });

  after(async function () {
    await blocker.stop();
  });

  /** Sends a request that must be refused, and checks that it changed no file in the data or outside folder. */
  async function expectNothingWritten(server: IServe, send: () => Promise<IResponse>) {
    const dataBefore = snapshotTree(server.dataDir);
    const response = await send();

    expect(diffTrees(dataBefore, snapshotTree(server.dataDir)), response.body).to.deep.equal([]);
    expect(fs.readdirSync(outsideFolder), response.body).to.deep.equal([]);

    return response;
  }

  describe("without the Minecraft EULA accepted", function () {
    let server: IServe;

    before(async function () {
      server = await startServe(createTestDataDir("api-commands-no-eula"), blocker.url, false);
    });

    after(async function () {
      await stopServe(server);
    });

    it("lists only the commands that opt in to the server API", async function () {
      const response = await request(server, "GET", "/api/commands", UPDATE_PASSCODE);

      expect(response.status, response.body).to.equal(200);
      expect(
        JSON.parse(response.body)
          .commands.map((command: { name: string }) => command.name)
          .sort()
      ).to.deep.equal(SERVER_API_COMMANDS);
    });

    it("returns 404 for every other command, as for an unknown one", async function () {
      const otherCommands = allToolCommands
        .map((command) => command.metadata.name)
        .filter((name) => !SERVER_API_COMMANDS.includes(name));

      expect(otherCommands).to.include.members(["deploy", "export", "help", "remove", "rename", "validate"]);

      for (const name of [...otherCommands, "rm", "not-a-command"]) {
        const response = await expectNothingWritten(server, () => runCommand(server, name, { args: ["x"] }));

        expect(response.status, name + ": " + response.body).to.equal(404);
      }
    });

    it("still requires the updateState passcode", async function () {
      for (const passcode of [undefined, FULL_READ_ONLY_PASSCODE]) {
        const list = await request(server, "GET", "/api/commands", passcode);
        const create = await expectNothingWritten(server, () =>
          request(server, "POST", "/api/commands/create", passcode, { args: ["addonstarter", "pwned"] })
        );

        expect(list.status, list.body).to.equal(401);
        expect(create.status, create.body).to.equal(401);
      }
    });

    const refused: { label: string; name: string; body: () => unknown }[] = [
      // The request from the bug report, with an output folder that exists.
      {
        label: "create with an output folder",
        name: "create",
        body: () => ({ args: ["addonstarter", "pwned"], flags: { output: outsideFolder } }),
      },
      { label: "create", name: "create", body: () => ({ args: ["addonstarter", "pwned"] }) },
      { label: "create's alias new", name: "new", body: () => ({ args: ["addonstarter", "pwned"] }) },
      { label: "add", name: "add", body: () => ({ args: ["entity", "my_mob"] }) },
    ];

    for (const testCase of refused) {
      it(`refuses ${testCase.label}, says how to accept the EULA, and writes nothing`, async function () {
        const response = await expectNothingWritten(server, () => runCommand(server, testCase.name, testCase.body()));
        const error = commandError(response);

        expect(response.status, response.body).to.equal(451);
        expect(error.code).to.equal("EULA_REQUIRED");
        expect(error.message).to.equal(LocalUtilities.eulaNotAcceptedMessage);
        expect(error.message).to.contain("mct eula --accept");
      });
    }

    // server isn't a write command, so the EULA check doesn't stop it; the path check does.
    it("refuses a project folder for server to deploy, and writes nothing", async function () {
      const response = await expectNothingWritten(server, () =>
        runCommand(server, "server", { args: ["start"], flags: { project: outsideFolder } })
      );

      expect(response.status, response.body).to.equal(400);
      expect(commandError(response).code).to.equal("PATH_NOT_ALLOWED");
    });
  });

  describe("with the Minecraft EULA accepted", function () {
    let server: IServe;

    before(async function () {
      server = await startServe(createTestDataDir("api-commands-eula"), blocker.url, false);

      // Accept the way a user would, while the server runs. The server re-reads acceptance, so it
      // takes effect without a restart, and nothing else changes the data folder in these tests.
      await runCli(server.dataDir, blocker.url, ["eula", "--accept"]);
    });

    after(async function () {
      await stopServe(server);
    });

    for (const flag of ["output", "o"]) {
      it(`refuses the ${flag} flag and writes nothing`, async function () {
        const response = await expectNothingWritten(server, () =>
          runCommand(server, "create", { args: ["addonstarter", "pwned"], flags: { [flag]: outsideFolder } })
        );

        expect(response.status, response.body).to.equal(400);
        expect(commandError(response).code).to.equal("PATH_NOT_ALLOWED");
      });
    }

    const pathNames: { name: string; args: unknown[] }[] = [
      { name: "create", args: ["addonstarter", "../../../escaped"] },
      { name: "create", args: ["addonstarter", "..\\..\\..\\escaped"] },
      { name: "create", args: ["addonstarter", ".."] },
      // create expands this placeholder to .. after the request is checked.
      { name: "create", args: ["addonstarter", "<pt_..>"] },
      // A drive-relative path on Windows; elsewhere, a folder name with a colon.
      { name: "create", args: ["addonstarter", "C:temp"] },
      { name: "add", args: ["entity", "../../../escaped"] },
    ];

    for (const testCase of pathNames) {
      it(`refuses ${testCase.name} with the name ${String(testCase.args[1])} and writes nothing`, async function () {
        const response = await expectNothingWritten(server, () =>
          runCommand(server, testCase.name, { args: testCase.args })
        );

        expect(response.status, response.body).to.equal(400);
        expect(commandError(response).code).to.equal("PATH_NOT_ALLOWED");
        expect(fs.existsSync(path.join(path.dirname(server.dataDir), "escaped"))).to.equal(false);
      });
    }

    // create turns its creator into the names of the project's pack folders.
    for (const creator of ["../../evil", "..\\..\\evil"]) {
      it(`refuses the creator ${creator} and writes nothing`, async function () {
        const response = await expectNothingWritten(server, () =>
          runCommand(server, "create", { args: ["addonstarter", "pwned"], flags: { creator } })
        );

        expect(response.status, response.body).to.equal(400);
        expect(commandError(response).code).to.equal("PATH_NOT_ALLOWED");
      });
    }

    // Commands use values as the types their flags declare, and create would write its project
    // before it noticed a creator that isn't text.
    const invalidRequests: { label: string; name: string; body: unknown }[] = [
      { label: "arguments that aren't text", name: "create", body: { args: ["addonstarter", ["../../../escaped"]] } },
      {
        label: "a creator that isn't text",
        name: "create",
        body: { args: ["addonstarter", "pwned"], flags: { creator: true } },
      },
      {
        label: "a single trait that isn't in a list",
        name: "add",
        body: { args: ["entity", "pwned"], flags: { traits: "hostile" } },
      },
      {
        label: "a flag the command doesn't have",
        name: "create",
        body: { args: ["addonstarter", "pwned"], flags: { session: "s" } },
      },
      {
        label: "a flag given by both its name and its short name",
        name: "create",
        body: { args: ["addonstarter", "pwned"], flags: { creator: "A", c: "B" } },
      },
    ];

    for (const testCase of invalidRequests) {
      it(`refuses ${testCase.label} and writes nothing`, async function () {
        const response = await expectNothingWritten(server, () => runCommand(server, testCase.name, testCase.body));

        expect(response.status, response.body).to.equal(400);
        expect(commandError(response).code).to.equal("INVALID_REQUEST");
      });
    }

    it("creates a project in the data folder, with its packs inside it", async function () {
      const dataBefore = snapshotTree(server.dataDir);
      const response = await runCommand(server, "create", {
        args: ["addonstarter", "api-project"],
        flags: { creator: "Jane O'Neil-Smith, Ltd.", description: "An A/B test <beta>" },
      });
      const result = JSON.parse(response.body);

      expect(response.status, response.body).to.equal(200);
      expect(result.success).to.equal(true);
      expect(isInside(result.data.projectPath, server.dataDir), result.data.projectPath).to.equal(true);

      for (const packsFolder of ["behavior_packs", "resource_packs"]) {
        expect(fs.readdirSync(path.join(result.data.projectPath, packsFolder)), packsFolder).to.have.lengthOf(1);
      }

      // Apart from Creator Tools' preferences, every new file is in the new project.
      const projectFolder = path
        .relative(fs.realpathSync(server.dataDir), fs.realpathSync(result.data.projectPath))
        .replace(/\\/g, "/");
      const elsewhere = diffTrees(dataBefore, snapshotTree(server.dataDir)).filter(
        (change) => !change.path.startsWith(projectFolder + "/") && !change.path.startsWith("cli/prefs/")
      );

      expect(elsewhere).to.deep.equal([]);
      expect(fs.readdirSync(outsideFolder)).to.deep.equal([]);
    });

    // add creates a starter project to add to, because no project is open through the API. It
    // must check what it's asked to add first, so these fail without leaving a project behind.
    const rejectedAdds: { label: string; flags: Record<string, unknown>; args?: string[] }[] = [
      { label: "a health above 100", flags: { traits: ["hostile"], health: 500 } },
      { label: "a color that isn't a hex color", flags: { color: "blue" } },
      { label: "a trait entities don't have", flags: { traits: ["flying_unicorn"] } },
      { label: "a type it doesn't know", flags: {}, args: ["not_a_type", "api_mob"] },
    ];

    for (const testCase of rejectedAdds) {
      it(`refuses an add with ${testCase.label} and writes nothing`, async function () {
        const response = await expectNothingWritten(server, () =>
          runCommand(server, "add", { args: testCase.args ?? ["entity", "api_mob"], flags: testCase.flags })
        );

        expect(response.status, response.body).to.equal(400);
        expect(commandError(response).code).to.be.oneOf(["VALIDATION_ERROR", "TYPE_NOT_FOUND"]);
      });
    }

    // Without traits, add copies the Allay template from Minecraft's vanilla packs, which the server
    // downloads and NetworkBlocker refuses. Copying it would add nothing, so add fails first.
    it("fails an add whose gallery template can't be downloaded, and writes nothing", async function () {
      const response = await expectNothingWritten(server, () =>
        runCommand(server, "add", { args: ["entity", "offline_mob"] })
      );
      const error = commandError(response);

      expect(response.status, response.body).to.equal(400);
      expect(error.code).to.equal("TEMPLATE_UNAVAILABLE");
      expect(error.message).to.equal("Couldn't download the 'Allay' template. Check your internet connection.");
    });

    // Commands read flags by name, so the API passes values given by short name under the name.
    it("applies create's short flag c as its creator", async function () {
      const response = await runCommand(server, "create", {
        args: ["addonstarter", "api-short"],
        flags: { c: "Zed Quinn" },
      });
      const result = JSON.parse(response.body);

      expect(response.status, response.body).to.equal(200);

      // create names the pack folders after the creator's initials, so the default creator would give creator_….
      expect(fs.readdirSync(path.join(result.data.projectPath, "behavior_packs"))).to.deep.equal(["zq_apishort"]);
    });

    it("applies add's short flag t as its traits", async function () {
      const response = await runCommand(server, "add", { args: ["entity", "short_mob"], flags: { t: ["hostile"] } });
      const result = JSON.parse(response.body);

      // With traits, add generates the entity; without them, it would copy a gallery template.
      expect(response.status, response.body).to.equal(200);
      expect(result.data.mode).to.equal("wizard");
      expect(result.data.traits).to.deep.equal(["hostile"]);
    });

    it("adds an item to a new project in the data folder", async function () {
      const projectsBefore = snapshotTree(server.dataDir);
      // With traits, add generates the entity instead of copying a gallery template, so it needs no network.
      // 100 is the highest health add allows.
      const response = await runCommand(server, "add", {
        args: ["entity", "api_mob"],
        flags: { traits: ["hostile"], health: 100 },
      });
      const created = diffTrees(projectsBefore, snapshotTree(server.dataDir)).filter(
        (change) => change.kind === "created"
      );

      expect(response.status, response.body).to.equal(200);
      expect(JSON.parse(response.body).success).to.equal(true);
      expect(
        created.some((change) => change.path.includes("api_mob")),
        JSON.stringify(created)
      ).to.equal(true);
      expect(fs.readdirSync(outsideFolder)).to.deep.equal([]);
    });
  });

  describe("with the EULA environment variable set", function () {
    let server: IServe;

    before(async function () {
      server = await startServe(createTestDataDir("api-commands-eula-env"), blocker.url, true);
    });

    after(async function () {
      await stopServe(server);
    });

    it("creates a project and saves the acceptance, as the CLI's create does", async function () {
      const response = await runCommand(server, "create", { args: ["addonstarter", "env-project"] });

      expect(response.status, response.body).to.equal(200);
      expect(JSON.parse(response.body).success).to.equal(true);

      const status = JSON.parse(await runCli(server.dataDir, blocker.url, ["eula", "--status", "--json"]));

      expect(status.accepted).to.equal(true);
      expect(status.acceptedViaEnvironment).to.equal(false);
    });
  });
});
