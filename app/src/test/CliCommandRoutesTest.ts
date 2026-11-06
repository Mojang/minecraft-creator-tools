// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Task routes share the flat commands' parser state and guards. The subprocess cases
 * exercise the built entry point with closed stdin, isolated profiles and real exports;
 * renderer artifacts and the browser-ready stream handshake live in CliRenderGpuSmokeTest.
 */
import { expect } from "chai";
import { CommanderError } from "commander";
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import JSZip from "jszip";
import { TaskType } from "../cli/ClUtils";
import { getAllCommands } from "../cli/commands";
import { CommandRegistry } from "../cli/core/CommandRegistry";
import { createCliProgram } from "../cli/core/CliProgram";
import { parseCommandLine } from "../cli/core/CommandLineHelp";
import { isDryRunSupported } from "../cli/core/DryRunGuard";
import { getRenderGpuOptions } from "../cli/commands/render/RenderGpuOptions";
import { buildCliEnvironment, copyFixture, diffTrees, snapshotTree } from "./CliTranscriptHarness";
import { cliEnv, createTestDataDir } from "./TestDataDir";
import TestPaths from "./TestPaths";

const commands = getAllCommands().filter((command) => command.metadata.route);

function parse(args: string[]) {
  const registry = new CommandRegistry();
  registry.registerAll(getAllCommands());
  let stdout = "";
  let stderr = "";
  let exitCode = 0;
  const program = createCliProgram({
    registry,
    includeDebugOptions: false,
    showAllCommands: args.includes("--all-commands"),
    prepare: (command) =>
      command.exitOverride().configureOutput({
        writeOut: (text) => {
          stdout += text;
        },
        writeErr: (text) => {
          stderr += text;
        },
        getOutHasColors: () => false,
        getErrHasColors: () => false,
      }),
  });
  try {
    parseCommandLine(program, ["node", "mct", ...args]);
  } catch (error) {
    if (!(error instanceof CommanderError)) throw error;
    exitCode = error.exitCode;
  }
  return { registry, program, stdout, stderr, exitCode, state: registry.getCapturedState() };
}

function requiredArgs(command: (typeof commands)[number]): string[] {
  return (command.metadata.arguments ?? [])
    .filter((argument) => argument.required)
    .map((argument) => argument.choices?.[0] ?? "file with spaces");
}

function expectOutputDestination(actual: string, expected: string, pathApi: Pick<typeof path, "resolve"> = path) {
  // Export results can retain mixed separators on Windows. Resolve only the destination
  // assertion; raw outputPath and stdout parity between routes are checked separately.
  expect(pathApi.resolve(actual)).to.equal(pathApi.resolve(expected));
}

describe("Export destination assertions", () => {
  for (const work of [String.raw`D:\runner\work`, String.raw`\\server\share\work`]) {
    it(`accepts mixed Win32 separators without equating raw output strings: ${work}`, () => {
      const actual = work + String.raw`\packages/Demo Pack.mcpack`;
      const expected = path.win32.join(work, "packages/Demo Pack.mcpack");
      expect(actual).not.to.equal(expected);
      expectOutputDestination(actual, expected, path.win32);
    });
  }

  for (const destination of ["different/Demo Pack.mcpack", "packages/Different Pack.mcpack"]) {
    it(`still rejects a different Win32 destination: ${destination}`, () => {
      const actual = String.raw`D:\runner\work\packages/Demo Pack.mcpack`;
      const expected = path.win32.join(String.raw`D:\runner\work`, destination);
      expect(() => expectOutputDestination(actual, expected, path.win32)).to.throw();
    });
  }
});

describe("Task command routes", () => {
  it("exposes only the bounded six routes, without registering duplicate implementations", () => {
    const { registry } = parse(["version"]);
    expect(commands.map(({ metadata }) => metadata.route?.join(" ")).sort()).to.deep.equal([
      "export addon",
      "export world",
      "render batch",
      "render model",
      "render structure",
      "render vanilla",
    ]);
    expect(registry.getAll()).to.have.length(getAllCommands().length);
    for (const command of commands) {
      expect(registry.get(command.metadata.route!.join(" "))).to.equal(command);
      expect(registry.getByTaskType(command.metadata.taskType)).to.equal(command);
    }
  });

  it("rejects duplicate routes", () => {
    const registry = new CommandRegistry();
    registry.register(commands[0]);
    expect(() =>
      registry.register({
        metadata: { ...commands[1].metadata, route: commands[0].metadata.route },
        configure: () => {},
        execute: async () => {},
      })
    ).to.throw("Command route");
  });

  it("lists only task leaves, without a second implicit Commander help command", () => {
    for (const [group, names] of [
      ["render", ["model", "batch", "vanilla", "structure"]],
      ["export", ["addon", "world"]],
    ] as const) {
      const help = parse([group, "--help"]).stdout;
      const section = help.split("AVAILABLE COMMANDS\n")[1].split("\n\n")[0];
      expect([...section.matchAll(/^  (\w+):/gm)].map((match) => match[1])).to.deep.equal(names);
    }
  });

  it("teaches canonical groups by default and lists compatibility only on all-commands", () => {
    const normal = parse(["--help"]).stdout;
    const all = parse(["--all-commands"]).stdout;
    expect(normal).to.include("  render:");
    expect(normal).to.include("  export:");
    expect(normal).to.include("  buildstructure:");
    expect(normal).not.to.include("COMPATIBILITY COMMANDS");
    expect(all).to.include("COMPATIBILITY COMMANDS");
    for (const { metadata } of commands) {
      expect(normal).not.to.include(`  ${metadata.name}:`);
      expect(all).to.include(`  ${metadata.name}:`);
      for (const alias of metadata.aliases ?? []) expect(all).to.include(alias);
    }
  });

  for (const command of commands) {
    const { metadata } = command;
    const route = [...metadata.route!];
    const positional = requiredArgs(command);
    it(`${route.join(" ")} captures the same arguments and options as every original name`, () => {
      const canonical = parse([...route, ...positional]);
      expect(canonical.exitCode, canonical.stderr).to.equal(0);
      for (const name of [metadata.name, ...(metadata.aliases ?? [])]) {
        const legacy = parse([name, ...positional]);
        expect(legacy.exitCode, legacy.stderr).to.equal(0);
        expect(canonical.state).to.deep.equal(legacy.state);
      }
      const group = canonical.program.commands.find((candidate) => candidate.name() === route[0])!;
      const leaf = group.commands.find((candidate) => candidate.name() === route[1])!;
      expect(canonical.registry.getForCommand(leaf)).to.equal(command);
      expect(canonical.registry.getHelpMetadata(leaf)?.globalOptionGroups).to.deep.equal(metadata.globalOptionGroups);
    });

    it(`${route.join(" ")} keeps global options before, between and after the route`, () => {
      const globals = ["--json", "--offline", "-q", "-i", "render", "-o", "export", "--psw", "Demo"];
      const expected = parse([metadata.name, ...positional, ...globals]);
      for (const args of [
        [...globals, ...route, ...positional],
        [route[0], ...globals, route[1], ...positional],
        [...route, ...globals, ...positional],
        [...route, ...positional, ...globals],
      ]) {
        const result = parse(args);
        expect(result.exitCode, result.stderr).to.equal(0);
        expect(result.state).to.deep.equal(expected.state);
        expect(result.program.opts()).to.deep.equal(expected.program.opts());
      }
    });

    it(`${route.join(" ")} preserves its dry-run policy and contextual help`, () => {
      const result = parse([...route, ...positional, "--dry-run"]);
      const supported = isDryRunSupported(metadata.name);
      expect(result.exitCode).to.equal(supported ? 0 : 1);
      expect(result.state.taskType).to.equal(supported ? metadata.taskType : TaskType.noCommand);
      if (!supported)
        expect(result.stderr).to.equal(
          `error: \`mct ${route.join(" ")}\` doesn't support --dry-run yet, so nothing was changed.\n`
        );
      const help = parse([...route, "--help"]);
      expect(help.stdout).to.equal(parse(["help", ...route]).stdout);
      expect(help.stdout.includes("--dry-run")).to.equal(supported);
      expect(help.stdout).not.to.include("Existing commands still work");
      expect(help.stdout).to.include(`mct ${route.join(" ")}`);
      const flags = (text: string) => text.slice(text.indexOf("\nFLAGS\n"), text.indexOf("\nEXAMPLES\n"));
      expect(flags(help.stdout)).to.equal(flags(parse([metadata.name, "--help"]).stdout));
    });
  }

  for (const name of ["model", "batch"]) {
    it(`render ${name} captures leaf options without losing negated flags or values`, () => {
      const local = [
        "--port",
        "6789",
        "--port-start",
        "6500",
        "--port-end",
        "6599",
        "--width",
        "320",
        "--height",
        "240",
        "--render-wait-ms",
        "50",
        "--canvas-timeout-ms",
        "1234",
      ];
      for (const flags of [[], ["--gpu"], ["--no-gpu"], ["--gpu", "--no-gpu"], ["--no-gpu", "--gpu"]]) {
        const result = parse([
          "--offline",
          "render",
          name,
          "input.json",
          ...local,
          "--vanilla",
          "--no-vanilla",
          ...flags,
        ]);
        const flat = parse([
          "--offline",
          `render${name}`,
          "input.json",
          ...local,
          "--vanilla",
          "--no-vanilla",
          ...flags,
        ]);
        expect(result.state).to.deep.equal(flat.state);
        expect(result.state.commandOptions).to.include({
          port: "6789",
          width: "320",
          height: "240",
          renderWaitMs: "50",
          canvasTimeoutMs: "1234",
          vanilla: false,
        });
        expect(getRenderGpuOptions(result.state.commandOptions)).to.deep.equal(
          getRenderGpuOptions(flat.state.commandOptions)
        );
      }
    });
  }

  it("does not consume operands after -- as routes or flags", () => {
    const result = parse(["-i", "export", "render", "model", "--", "--render.geo.json", "image \n name.png"]);
    expect(result.exitCode).to.equal(0);
    expect(result.state.args).to.deep.equal({ mode: "--render.geo.json", newName: "image \n name.png" });
    expect(result.program.opts().inputFolder).to.equal("export");
  });
});

describe("Built task command routes", function () {
  this.timeout(60000);
  const cli = path.resolve(TestPaths.appRoot, "toolbuild/jsn/cli/index.mjs");
  let root: string;
  let work: string;
  let profile: string;
  const launchMarker = "UNEXPECTED_ROUTE_SIDE_EFFECT";
  const guard = `
    require("node:net").Server.prototype.listen = function () { throw new Error("${launchMarker}: listen"); };
    require(${JSON.stringify(require.resolve("playwright"))}).chromium.launch = async () => { throw new Error("${launchMarker}: browser"); };
    import(require("node:url").pathToFileURL(process.argv[1]).href).catch(error => { process.stderr.write(String(error)); process.exitCode = 1; });
  `;

  beforeEach(() => {
    const results = path.join(TestPaths.testRoot, "results");
    fs.mkdirSync(results, { recursive: true });
    root = fs.mkdtempSync(path.join(results, "cli-command-routes-"));
    work = path.join(root, "work");
    profile = path.join(root, "profile");
    fs.mkdirSync(work);
    copyFixture(TestPaths.sampleContentPath("simple"), path.join(work, "Demo Addon"));
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  async function run(args: string[], guardEffects = false, input?: string) {
    return new Promise<{ exitCode: number | null; stdout: string; stderr: string }>((resolve, reject) => {
      const child = spawn(process.execPath, [...(guardEffects ? ["-e", guard] : []), cli, ...args], {
        cwd: work,
        env: buildCliEnvironment(
          profile,
          "http://127.0.0.1:9",
          cliEnv({ dataDir: createTestDataDir("command-routes") })
        ),
        timeout: 45000,
      });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
      });
      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });
      child.once("error", reject);
      child.once("close", (exitCode) => resolve({ exitCode, stdout, stderr }));
      child.stdin.end(input);
    });
  }

  const helpCases = [
    ["--help"],
    ["--all-commands"],
    ["render", "--help"],
    ["export", "--help"],
    ["help", "render"],
    ["help", "export"],
    ...commands.flatMap(({ metadata }) => [
      [...metadata.route!, "--help"],
      ["help", ...metadata.route!],
      [metadata.name, "--help"],
      ["help", metadata.name],
      ...(metadata.aliases ?? []).map((alias) => [alias, "--help"]),
    ]),
  ];
  for (const args of helpCases) {
    it(`${args.join(" ")} completes before filesystem, server, or browser effects`, async () => {
      const before = snapshotTree(root);
      const result = await run(args, true);
      expect(result.exitCode, result.stderr).to.equal(0);
      expect(result.stderr).to.equal("");
      expect(result.stdout).to.include("USAGE");
      expect(diffTrees(before, snapshotTree(root))).to.deep.equal([]);
    });
  }

  for (const args of [
    ["render"],
    ["export"],
    ["--json", "-o", "must not exist", "render"],
    ["render", "modle", "--width", "32"],
    ["help", "render", "modle"],
    ["export", "adddon", "--format", "mcaddon"],
    ["render", "model"],
    ["render", "model", "--no-such-option"],
    ["render", "model", "x", "--dry-run"],
    ["export", "world", "--dry-run"],
    ["render", "--", "--json"],
    ["render", "mo\u001b[31mdel"],
    ["render", "vanilla", "blo\rck", "stone"],
    ["--if", "", "export", "addon"],
    ["render", "model", "x", "--psw", ""],
  ]) {
    it(`rejects ${JSON.stringify(args)} before startup`, async () => {
      const before = snapshotTree(root);
      const result = await run(args, true);
      expect(result.exitCode, result.stderr).to.equal(1);
      expect(result.stdout).to.equal("");
      expect(result.stderr).not.to.include(launchMarker);
      expect(result.stderr).not.to.match(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/);
      expect(diffTrees(before, snapshotTree(root))).to.deep.equal([]);
      if (args.includes("modle")) {
        expect(result.stderr).to.include('unknown command "modle" for "mct render"');
        expect(result.stderr).to.include("Did you mean this?\n  model");
        expect(result.stderr).to.include("Run `mct help render`");
      }
    });
  }

  it("keeps legacy feature-probe errors exact", async () => {
    for (const [args, stderr] of [
      [["rendermodel"], "error: missing required argument 'geometryPath'\n"],
      [["rendermodel", "--no-such-flag"], "error: unknown option '--no-such-flag'\n"],
      [["--width", "0", "rendermodel", "x"], "error: unknown option '--width'\n"],
      [
        ["exportadon", "--format", "mcaddon"],
        'error: unknown command "exportadon" for "mct"\n\nDid you mean this?\n  exportaddon\n\nUsage:  mct <command> [arguments] [flags]\n\nRun `mct help` to see available commands.\n',
      ],
    ] as const) {
      const result = await run([...args], true);
      expect(result).to.deep.equal({ exitCode: 1, stdout: "", stderr });
    }
  });

  it("exports equivalent real packages through both names and all global-option placements", async () => {
    const globals = [
      "--json",
      "-q",
      "--offline",
      "-i",
      "Demo Addon",
      "-o",
      "packages",
      "--of",
      "packages/Demo Pack.mcpack",
    ];
    const argsList = [
      [...globals, "exportaddon"],
      [...globals, "export", "addon"],
      ["export", ...globals, "addon"],
      ["export", "addon", ...globals],
    ];
    const projectBefore = snapshotTree(path.join(work, "Demo Addon"));
    const contents: Record<string, string>[] = [];
    let legacyResult: { outputPath: string; stdout: string } | undefined;
    for (const args of argsList) {
      const result = await run(args);
      expect(result.exitCode, result.stderr + result.stdout).to.equal(0);
      expect(result.stderr).to.equal("");
      const record = JSON.parse(result.stdout);
      expect(record).to.have.all.keys(
        "schemaVersion",
        "command",
        "project",
        "success",
        "outputPath",
        "format",
        "extension",
        "bytes"
      );
      expect(record).to.include({
        schemaVersion: "1.0.0",
        command: "exportaddon",
        project: "Demo Addon",
        success: true,
        format: "mcpack",
        extension: ".mcpack",
      });
      expectOutputDestination(record.outputPath, path.join(work, "packages/Demo Pack.mcpack"));
      if (legacyResult) {
        expect(record.outputPath).to.equal(legacyResult.outputPath);
        expect(result.stdout).to.equal(legacyResult.stdout);
      } else {
        legacyResult = { outputPath: record.outputPath, stdout: result.stdout };
      }
      const bytes = fs.readFileSync(record.outputPath);
      expect(record.bytes).to.equal(bytes.length);
      const zip = await JSZip.loadAsync(bytes);
      const entries: Record<string, string> = {};
      for (const name of Object.keys(zip.files).sort()) entries[name] = await zip.files[name].async("base64");
      expect(Object.keys(entries).some((name) => name.endsWith("/manifest.json"))).to.equal(true);
      contents.push(entries);
    }
    for (const entries of contents) expect(entries).to.deep.equal(contents[0]);
    expect(diffTrees(projectBefore, snapshotTree(path.join(work, "Demo Addon")))).to.deep.equal([]);
  });

  it("keeps multiple-project JSON as separate records rather than adding an envelope", async () => {
    const collection = path.join(work, "projects");
    copyFixture(TestPaths.sampleContentPath("simple"), path.join(collection, "One"));
    copyFixture(TestPaths.sampleContentPath("simple"), path.join(collection, "Two"));
    for (const route of [["exportaddon"], ["export", "addon"]]) {
      const result = await run([...route, "-i", "projects", "-o", "packages", "--json", "-q", "--offline"]);
      expect(result.exitCode, result.stderr).to.equal(0);
      const records = result.stdout
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      expect(records.map((record) => record.project).sort()).to.deep.equal(["One", "Two"]);
      for (const record of records) {
        expect(record).to.include({ command: "exportaddon", success: true });
        expect(fs.existsSync(record.outputPath)).to.equal(true);
      }
    }
  });

  it("keeps package targeting and project selectors on the existing input path", async () => {
    const created = await run([
      "export",
      "addon",
      "-i",
      "Demo Addon",
      "-o",
      "packages",
      "--of",
      "packages/Demo.mcpack",
      "--offline",
      "--json",
    ]);
    expect(created.exitCode, created.stderr).to.equal(0);
    const sourceFile = path.join(work, "packages/Demo.mcpack");
    const original = fs.readFileSync(sourceFile);
    for (const route of [["exportaddon"], ["export", "addon"]]) {
      const result = await run([
        "--if",
        sourceFile,
        "--single",
        "--psw",
        "Demo",
        ...route,
        "-o",
        "repacked",
        "--json",
        "-q",
        "--offline",
      ]);
      expect(result.exitCode, result.stderr).to.equal(0);
      const record = JSON.parse(result.stdout);
      expect(record).to.include({ command: "exportaddon", success: true });
      expect(fs.existsSync(record.outputPath)).to.equal(true);
      expect(fs.readFileSync(sourceFile)).to.deep.equal(original);

      const rejected = await run([
        ...route,
        "--if",
        sourceFile,
        "--psw",
        "not selected",
        "-o",
        "must not exist",
        "--json",
        "--offline",
      ]);
      expect(rejected.exitCode, rejected.stderr).to.equal(1);
      expect(rejected.stdout).to.equal("");
      expect(fs.existsSync(path.join(work, "must not exist"))).to.equal(false);
      expect(fs.readFileSync(sourceFile)).to.deep.equal(original);
    }
  });

  it("preserves frame-based failure and closed-stdin completion for batch and rb", async () => {
    const manifest = path.join(work, "missing geometry.json");
    fs.writeFileSync(
      manifest,
      JSON.stringify({
        renders: [{ geometryPath: "missing.geo.json", outputPath: path.join(work, "must not exist.png") }],
      })
    );
    for (const route of [["renderbatch"], ["rb"], ["render", "batch"]]) {
      const result = await run([
        ...route,
        manifest,
        "--stdin",
        "-i",
        "Demo Addon",
        "--offline",
        "--no-gpu",
        "--no-vanilla",
      ]);
      expect(result.exitCode, result.stderr).to.equal(0);
      expect(result.stdout.match(/^RENDER_(DONE|ERROR)$/gm)).to.deep.equal(["RENDER_ERROR"]);
      expect(result.stderr, result.stderr).to.include("Could not find geometry file");
      expect(fs.existsSync(path.join(work, "must not exist.png"))).to.equal(false);
    }
  });
});
