/**
 * CommandEffectsTest - Keeps the command effects table (cli/core/CommandEffects.ts) complete and consistent.
 *
 * Fails when a registered command has no entry, when an entry names a command that isn't registered, or
 * when an entry is malformed. Also checks the table against each command's globalOptionGroups, which
 * records the global flags a command reads: dryRun.support is "ignored" exactly when the command doesn't
 * read --dry-run, and a command that writes to the output folder reads -o. Because nothing else checks
 * globalOptionGroups against the code, it also checks that the dryRun group matches the command's source.
 * It also checks that the CLI creates the output folder only for runs that write there or look for projects there
 * (needsOutputFolder), with and without -i, including through cli/index.ts's older project scan.
 * Commands whose source turns on /mcp (setMcpEnabled(true)) must record the effects of the MCP tools, other commands'
 * entries must not mention /mcp, commands that can start Bedrock Dedicated Server must record that it listens on
 * ports, and `world set` runs in-process to check where its entry says it writes. See docs/CliCommandEffects.md.
 */

import { expect } from "chai";
import "mocha";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as ts from "typescript";
import { getAllCommands } from "../cli/commands/index";
import { worldCommand } from "../cli/commands/world/WorldCommand";
import ClUtils, { TaskType } from "../cli/ClUtils";
import { CommandContextFactory } from "../cli/core/CommandContextFactory";
import {
  COMMAND_EFFECTS,
  EFFECT_KEYS,
  EffectFrequency,
  EffectKey,
  DryRunSupport,
  ICommandEffect,
  ICommandEffects,
  StartupEffectId,
  getCommandEffects,
  getStartupEffectIds,
  needsOutputFolder,
} from "../cli/core/CommandEffects";
import TestPaths, { ITestEnvironment } from "./TestPaths";

const TABLE_FILE = "app/src/cli/core/CommandEffects.ts";
const COMMANDS_SOURCE_FOLDER = path.join(TestPaths.appRoot, "src", "cli", "commands");
const FREQUENCIES: EffectFrequency[] = ["always", "sometimes", "never"];
const DRY_RUN_SUPPORT: DryRunSupport[] = ["honored", "partial", "ignored"];

function listTypeScriptFiles(folder: string): string[] {
  const files: string[] = [];

  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    const fullPath = path.join(folder, entry.name);

    if (entry.isDirectory()) {
      files.push(...listTypeScriptFiles(fullPath));
    } else if (entry.name.endsWith(".ts")) {
      files.push(fullPath);
    }
  }

  return files;
}

/** The name in a `metadata = { name: "...", ... }` class property, or undefined for any other node. */
function getMetadataName(node: ts.Node): string | undefined {
  if (!ts.isPropertyDeclaration(node) || !ts.isIdentifier(node.name) || node.name.text !== "metadata") {
    return undefined;
  }

  const initializer = node.initializer;

  if (!initializer || !ts.isObjectLiteralExpression(initializer)) {
    return undefined;
  }

  for (const property of initializer.properties) {
    if (
      ts.isPropertyAssignment(property) &&
      ts.isIdentifier(property.name) &&
      property.name.text === "name" &&
      ts.isStringLiteralLike(property.initializer)
    ) {
      return property.initializer.text;
    }
  }

  return undefined;
}

/** True for the command context. Every command names its ICommandContext parameter `context`. */
function isCommandContext(node: ts.Node | undefined): boolean {
  return node !== undefined && ts.isIdentifier(node) && node.text === "context";
}

/**
 * True for a read of dryRun from the command context, as in `context.dryRun`, `context["dryRun"]`, or
 * `const { dryRun } = context`. Reads from other objects, object keys (such as a `dryRun: true` field in JSON
 * output), other strings, and comments don't count.
 */
function isDryRunRead(node: ts.Node): boolean {
  if (ts.isPropertyAccessExpression(node)) {
    return node.name.text === "dryRun" && isCommandContext(node.expression);
  }

  if (ts.isElementAccessExpression(node)) {
    return (
      isCommandContext(node.expression) &&
      ts.isStringLiteralLike(node.argumentExpression) &&
      node.argumentExpression.text === "dryRun"
    );
  }

  if (ts.isBindingElement(node) && ts.isObjectBindingPattern(node.parent)) {
    const property = node.propertyName ?? node.name;
    const declaration = node.parent.parent;

    return (
      ts.isIdentifier(property) &&
      property.text === "dryRun" &&
      ts.isVariableDeclaration(declaration) &&
      isCommandContext(declaration.initializer)
    );
  }

  return false;
}

function parseSource(fileName: string, text: string): ts.SourceFile {
  return ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true);
}

function forEachNode(node: ts.Node, visit: (node: ts.Node) => void): void {
  visit(node);
  ts.forEachChild(node, (child) => forEachNode(child, visit));
}

function sourceReadsDryRun(sourceFile: ts.SourceFile): boolean {
  let reads = false;

  forEachNode(sourceFile, (node) => {
    reads = reads || isDryRunRead(node);
  });

  return reads;
}

/** What a command's source file does, as far as these checks need. */
interface ICommandSource {
  readsDryRun: boolean;

  /** Names of the functions and methods the file calls, such as "ensureActiveServer". */
  calls: Set<string>;

  /** Whether the file turns on the MCP endpoint of its HTTP server, with setMcpEnabled(true). */
  enablesMcp: boolean;
}

function isEnableMcpCall(node: ts.Node): boolean {
  return (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === "setMcpEnabled" &&
    node.arguments.length > 0 &&
    node.arguments[0].kind === ts.SyntaxKind.TrueKeyword
  );
}

/** Maps each command name to facts about its source file, parsing every file under cli/commands/. */
function scanCommandSources(): Map<string, ICommandSource> {
  const sourcesByCommand = new Map<string, ICommandSource>();

  for (const file of listTypeScriptFiles(COMMANDS_SOURCE_FOLDER)) {
    const sourceFile = parseSource(file, fs.readFileSync(file, "utf8"));
    const names: string[] = [];
    const calls = new Set<string>();
    let enablesMcp = false;

    forEachNode(sourceFile, (node) => {
      const name = getMetadataName(node);

      if (name !== undefined) {
        names.push(name);
      }

      if (ts.isCallExpression(node)) {
        const callee = node.expression;

        if (ts.isPropertyAccessExpression(callee)) {
          calls.add(callee.name.text);
        } else if (ts.isIdentifier(callee)) {
          calls.add(callee.text);
        }
      }

      enablesMcp = enablesMcp || isEnableMcpCall(node);
    });

    const source: ICommandSource = { readsDryRun: sourceReadsDryRun(sourceFile), calls, enablesMcp };

    for (const name of names) {
      sourcesByCommand.set(name, source);
    }
  }

  return sourcesByCommand;
}

function describeEffectProblems(name: string, key: string, effect: ICommandEffect | undefined): string[] {
  if (effect === undefined) {
    return [`${name}.${key} is missing`];
  }

  const problems: string[] = [];

  if (!FREQUENCIES.includes(effect.frequency)) {
    problems.push(`${name}.${key} has an unknown frequency '${effect.frequency}'`);
  }

  if (effect.frequency === "sometimes" && !effect.details?.trim()) {
    problems.push(`${name}.${key} is "sometimes" but its details don't say when`);
  }

  if (effect.details !== undefined && !effect.details.trim()) {
    problems.push(`${name}.${key} has empty details`);
  }

  if (effect.unverified !== undefined && !effect.unverified.trim()) {
    problems.push(`${name}.${key} is marked unverified without saying what is unclear`);
  }

  return problems;
}

function describeEntryProblems(name: string, entry: ICommandEffects): string[] {
  const problems: string[] = [];
  const allowedKeys = new Set<string>([...EFFECT_KEYS, "dryRun", "notes"]);

  for (const key of Object.keys(entry)) {
    if (!allowedKeys.has(key)) {
      problems.push(`${name} has an unexpected field '${key}'; add it to EFFECT_KEYS if it's an effect`);
    }
  }

  for (const key of EFFECT_KEYS) {
    problems.push(...describeEffectProblems(name, key, entry[key]));
  }

  if (!DRY_RUN_SUPPORT.includes(entry.dryRun?.support)) {
    problems.push(`${name}.dryRun.support is '${entry.dryRun?.support}'`);
  } else if (entry.dryRun.support === "partial" && !entry.dryRun.details?.trim()) {
    problems.push(`${name}.dryRun is "partial" but its details don't say which effects still happen`);
  }

  for (const note of entry.notes ?? []) {
    if (!note.trim()) {
      problems.push(`${name} has an empty note`);
    }
  }

  return problems;
}

describe("CommandEffects", () => {
  const commands = getAllCommands();
  const registeredNames = commands.map((command) => command.metadata.name);

  it("has an entry for every registered command", () => {
    const missing = registeredNames.filter((name) => getCommandEffects(name) === undefined);

    expect(missing, `Add entries to ${TABLE_FILE} for these commands (see docs/CliCommandEffects.md)`).to.deep.equal(
      []
    );
  });

  it("has no entries for commands that aren't registered", () => {
    const registered = new Set(registeredNames);
    const stale = Object.keys(COMMAND_EFFECTS).filter((name) => !registered.has(name));

    expect(stale, `Remove or rename these entries in ${TABLE_FILE}`).to.deep.equal([]);
  });

  it("records every effect with a known frequency and says when 'sometimes' applies", () => {
    const problems = Object.entries(COMMAND_EFFECTS).flatMap(([name, entry]) => describeEntryProblems(name, entry));

    expect(problems).to.deep.equal([]);
  });

  it("marks --dry-run as ignored exactly when globalOptionGroups doesn't include dryRun", () => {
    const problems: string[] = [];

    for (const { metadata } of commands) {
      const entry = getCommandEffects(metadata.name);

      if (entry === undefined) {
        continue; // Reported by the coverage test.
      }

      const readsDryRunFlag = metadata.globalOptionGroups.includes("dryRun");

      if (readsDryRunFlag !== (entry.dryRun.support !== "ignored")) {
        problems.push(
          `${metadata.name}: dryRun.support is '${entry.dryRun.support}' but globalOptionGroups ${
            readsDryRunFlag ? "includes" : "doesn't include"
          } dryRun`
        );
      }
    }

    expect(problems).to.deep.equal([]);
  });

  it("declares the dryRun option group exactly when the command's source reads dryRun", () => {
    const sources = scanCommandSources();
    const problems: string[] = [];

    for (const { metadata } of commands) {
      const readsDryRun = sources.get(metadata.name)?.readsDryRun;

      if (readsDryRun === undefined) {
        problems.push(`${metadata.name}: couldn't find its metadata under app/src/cli/commands/`);
        continue;
      }

      const declared = metadata.globalOptionGroups.includes("dryRun");

      if (readsDryRun !== declared) {
        problems.push(
          `${metadata.name}: globalOptionGroups ${declared ? "includes" : "doesn't include"} dryRun but its source ${
            declared ? "doesn't read" : "reads"
          } dryRun`
        );
      }
    }

    expect(problems).to.deep.equal([]);
  });

  it("counts reads of dryRun from the command context, but not other objects, object keys, strings, or comments", () => {
    const cases: { source: string; reads: boolean }[] = [
      { source: "if (context.dryRun) {}", reads: true },
      { source: "if (context?.dryRun) {}", reads: true },
      { source: 'if (context["dryRun"]) {}', reads: true },
      { source: "const { dryRun } = context;", reads: true },
      { source: "const { dryRun: preview } = context;", reads: true },
      { source: "if (options.dryRun) {}", reads: false },
      { source: "this.dryRun();", reads: false },
      { source: "const { dryRun } = options;", reads: false },
      { source: "log(JSON.stringify({ dryRun: true }));", reads: false },
      { source: 'const group = "dryRun";', reads: false },
      { source: "// if (context.dryRun) {}", reads: false },
      { source: "const dryRun = false;", reads: false },
    ];

    for (const { source, reads } of cases) {
      expect(sourceReadsDryRun(parseSource("case.ts", source)), source).to.equal(reads);
    }
  });

  it("agrees with globalOptionGroups about the output folder", () => {
    const problems: string[] = [];

    for (const { metadata } of commands) {
      const entry = getCommandEffects(metadata.name);

      if (entry === undefined) {
        continue; // Reported by the coverage test.
      }

      const readsOutputFolder = metadata.globalOptionGroups.includes("outputFolder");
      const worksOnProjectsThere = getStartupEffectIds(metadata.name).includes("detectsProjectsInOutputFolder");
      const { frequency, details } = entry.writesOutputFolder;

      if (frequency !== "never" && !readsOutputFolder && !worksOnProjectsThere) {
        problems.push(
          `${metadata.name}: writes to the output folder, but neither reads -o (globalOptionGroups doesn't ` +
            "include outputFolder) nor works on projects found there (detectsProjectsInOutputFolder)"
        );
      }

      if (frequency === "never" && readsOutputFolder && !details) {
        problems.push(
          `${metadata.name}: reads -o (globalOptionGroups includes outputFolder) but never writes there; ` +
            "say how it uses -o in writesOutputFolder.details"
        );
      }
    }

    expect(problems).to.deep.equal([]);
  });

  it("records the MCP tools' effects for every command that serves them", () => {
    // mcp serves the tools over stdio. An HTTP server serves them at /mcp only after setMcpEnabled(true); the
    // others answer /mcp with 404.
    const sources = scanCommandSources();
    const servers = registeredNames.filter((name) => sources.get(name)?.enablesMcp);

    expect(servers, "commands whose source calls setMcpEnabled(true)").to.include.members(["serve"]);

    const toolEffects: EffectKey[] = [
      "changesProject",
      "writesOtherLocations",
      "updatesSavedState",
      "usesNetwork",
      "startsLocalServer",
      "launchesProcesses",
    ];
    const problems: string[] = [];

    for (const name of ["mcp", ...servers]) {
      for (const key of toolEffects) {
        if (getCommandEffects(name)?.[key].frequency === "never") {
          problems.push(`${name}.${key} is "never", but the MCP tools it serves have this effect`);
        }
      }
    }

    expect(problems).to.deep.equal([]);
  });

  it("records effects through /mcp only for commands that serve it", () => {
    // The endpoint, including in URLs such as http://localhost:6126/mcp, but not paths such as .mct/mcp/prefs.json.
    const mcpEndpoint = /(?<!\.mct)\/mcp\b/i;
    const sources = scanCommandSources();
    const problems: string[] = [];

    for (const name of registeredNames) {
      if (sources.get(name)?.enablesMcp) {
        continue;
      }

      const entry = getCommandEffects(name);

      if (!entry) {
        continue;
      }

      const texts: { where: string; text: string | undefined }[] = [
        ...EFFECT_KEYS.flatMap((key) => [
          { where: key, text: entry[key].details },
          { where: key, text: entry[key].unverified },
        ]),
        { where: "dryRun", text: entry.dryRun.details },
        ...(entry.notes ?? []).map((note, index) => ({ where: `notes[${index}]`, text: note })),
      ];

      for (const { where, text } of texts) {
        if (text !== undefined && mcpEndpoint.test(text)) {
          problems.push(`${name}.${where} mentions /mcp, but the command's source doesn't call setMcpEnabled(true)`);
        }
      }
    }

    expect([...new Set(problems)]).to.deep.equal([]);
  });

  it("records that Bedrock Dedicated Server listens on ports for every command that can start it", () => {
    // A command whose source calls ensureActiveServer() can start Bedrock Dedicated Server, which listens for
    // game connections.
    const sources = scanCommandSources();
    const starters = registeredNames.filter((name) => sources.get(name)?.calls.has("ensureActiveServer"));

    expect(starters, "commands whose source calls ensureActiveServer()").to.include.members([
      "serve",
      "dedicatedserve",
    ]);

    const listeningNever = starters.filter((name) => getCommandEffects(name)?.startsLocalServer.frequency === "never");

    expect(listeningNever, "startsLocalServer is never, but Bedrock Dedicated Server listens on ports").to.deep.equal(
      []
    );
  });

  it("looks up entries by registered name in any letter case, but not by alias", () => {
    const cases: { name: string; expected: ICommandEffects | undefined }[] = [
      { name: "validate", expected: COMMAND_EFFECTS.validate },
      { name: "VALIDATE", expected: COMMAND_EFFECTS.validate },
      { name: "profilevalidation", expected: COMMAND_EFFECTS.profileValidation },
      { name: "minecrafteulaandprivacystatement", expected: COMMAND_EFFECTS.minecrafteulaandprivacystatement },
      { name: "eula", expected: undefined },
      { name: "val", expected: undefined },
      { name: "notacommand", expected: undefined },
    ];

    for (const { name, expected } of cases) {
      expect(getCommandEffects(name), name).to.equal(expected);
    }
  });

  it("applies startup effects to the commands they list", () => {
    const cases: { name: string; includes: StartupEffectId[]; excludes: StartupEffectId[] }[] = [
      {
        name: "skills",
        includes: ["createsDataFolder", "setsVanillaContentRoot"],
        excludes: ["createsOutputFolder", "listsInputFolder", "savesPasscodeFlags", "readsStdin"],
      },
      {
        name: "fix",
        includes: ["createsOutputFolder", "detectsProjectsInOutputFolder"],
        excludes: ["readsStdin"],
      },
      {
        name: "validate",
        includes: ["createsOutputFolder"],
        excludes: ["detectsProjectsInOutputFolder", "readsStdin"],
      },
      { name: "serve", includes: ["readsStdin"], excludes: ["createsOutputFolder", "detectsProjectsInOutputFolder"] },
      { name: "view", includes: ["createsOutputFolder", "detectsProjectsInOutputFolder", "readsStdin"], excludes: [] },
      { name: "edit", includes: ["createsOutputFolder", "detectsProjectsInOutputFolder", "readsStdin"], excludes: [] },
      { name: "version", includes: ["listsInputFolder"], excludes: ["createsOutputFolder"] },
      { name: "notacommand", includes: [], excludes: ["createsDataFolder"] },
    ];

    for (const { name, includes, excludes } of cases) {
      const ids = getStartupEffectIds(name);

      expect(ids, name).to.include.members(includes);

      for (const id of excludes) {
        expect(ids, name).not.to.include(id);
      }
    }
  });

  it("creates the output folder only for runs that write there or look for projects there", () => {
    // Commands named in the output folder issue, the commands that need ./out today, and lookups that aren't
    // registered command names, with default options (no -i), with -i, and with --if. add, create, fix, view, and
    // edit use -o as their project, or look for projects there, only without -i or --if.
    const withInput = { inputFolder: "./my-project" };
    const withInputFile = { inputFile: "./my-addon.mcaddon" };
    const cases: { name: string; needed: boolean; withInput: boolean }[] = [
      { name: "version", needed: false, withInput: false },
      { name: "info", needed: false, withInput: false },
      { name: "mcp", needed: false, withInput: false },
      { name: "minecrafteulaandprivacystatement", needed: false, withInput: false },
      { name: "passcodes", needed: false, withInput: false },
      { name: "skills", needed: false, withInput: false },
      { name: "ensureworld", needed: false, withInput: false },
      { name: "setup", needed: false, withInput: false },
      { name: "validate", needed: true, withInput: true },
      { name: "exportaddon", needed: true, withInput: true },
      { name: "deploy", needed: true, withInput: true },
      { name: "world", needed: true, withInput: true },
      { name: "add", needed: true, withInput: false },
      { name: "create", needed: true, withInput: false },
      { name: "fix", needed: true, withInput: false },
      { name: "view", needed: true, withInput: false },
      { name: "edit", needed: true, withInput: false },
      { name: "EXPORTADDON", needed: true, withInput: true },
      { name: "eula", needed: false, withInput: false },
      { name: "notacommand", needed: false, withInput: false },
    ];

    for (const { name, needed, withInput: neededWithInput } of cases) {
      expect(needsOutputFolder(name), name).to.equal(needed);
      expect(needsOutputFolder(name, {}), `${name} with no input options`).to.equal(needed);
      expect(needsOutputFolder(name, withInput), `${name} with -i`).to.equal(neededWithInput);
      expect(needsOutputFolder(name, withInputFile), `${name} with --if`).to.equal(neededWithInput);
    }

    // The createsOutputFolder startup effect lists the commands that need -o with default options.
    const problems = commands
      .filter(
        ({ metadata }) =>
          getStartupEffectIds(metadata.name).includes("createsOutputFolder") !== needsOutputFolder(metadata.name)
      )
      .map(
        ({ metadata }) => `${metadata.name}: the createsOutputFolder startup effect disagrees with needsOutputFolder()`
      );

    expect(problems).to.deep.equal([]);
  });

  it("records writes to -o for commands that look for projects there only as changes to that project", () => {
    // needsOutputFolder() relies on this: with -i or --if, these commands don't need -o, because the only writes
    // their entries record there are to the project they find there without -i. An entry that records another
    // write to -o has to say so, and needsOutputFolder() has to keep -o for it.
    const problems: string[] = [];

    for (const { metadata } of commands) {
      if (!getStartupEffectIds(metadata.name).includes("detectsProjectsInOutputFolder")) {
        continue;
      }

      const { frequency, details } = getCommandEffects(metadata.name)!.writesOutputFolder;

      if (frequency !== "never" && !/^Without -i\b/.test(details ?? "")) {
        problems.push(`${metadata.name}: writesOutputFolder doesn't say it writes only to the project in -o`);
      }
    }

    expect(problems).to.deep.equal([]);
  });

  it("lists exactly the commands that detect projects in the output folder", () => {
    // CommandContextFactory picks these commands with ClUtils.getIsEditInPlaceCommand, and needsOutputFolder()
    // relies on detectsProjectsInOutputFolder to create the folder for them.
    const problems = commands
      .filter(
        ({ metadata }) =>
          ClUtils.getIsEditInPlaceCommand(metadata.taskType) !==
          getStartupEffectIds(metadata.name).includes("detectsProjectsInOutputFolder")
      )
      .map(({ metadata }) => `${metadata.name}: detectsProjectsInOutputFolder disagrees with getIsEditInPlaceCommand`);

    expect(problems).to.deep.equal([]);
  });

  it("only lets cli/index.ts's older project scan create the output folder for commands that need it", () => {
    // Without -i, ClUtils.getMainWorkFolder() creates -o for these commands before CommandContextFactory runs.
    const problems = commands
      .filter(({ metadata }) => ClUtils.getIsWriteCommand(metadata.taskType) && !needsOutputFolder(metadata.name, {}))
      .map(({ metadata }) => `${metadata.name}: the project scan creates -o, but needsOutputFolder() is false`);

    expect(problems).to.deep.equal([]);
  });
});

describe("CommandEffects: where world set writes", function () {
  this.timeout(60000);

  let env: ITestEnvironment;
  let tempBase: string;

  before(async () => {
    env = await TestPaths.createTestEnvironment();
    tempBase = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "mct-effects-world-")));
  });

  after(() => {
    fs.rmSync(tempBase, { recursive: true, force: true });
  });

  function describeWorldEntry(): string {
    const world = COMMAND_EFFECTS.world;

    return [world.changesProject.details, world.writesOutputFolder.details, ...(world.notes ?? [])].join(" ");
  }

  // With no world found, `world set` saves a new world at each project's root (samplecontent/simple has no worlds/
  // folder), unless -o's path starts with the input folder's path and the rest is longer than two characters.
  // Then it saves it at that rest under each project, or under the project's world folder. Paths are relative to
  // a temporary folder.
  const cases: {
    name: string;
    projects: string[];
    inputFolder: string;
    outputFolder: string;
    worldFolders: string[];
    foldersWithoutWorld: string[];
    effect: EffectKey;
    /** Words the world entry uses for this case, so a case the entry doesn't describe fails. */
    describedAs: string;
  }[] = [
    {
      name: "-o inside the input folder",
      projects: ["project"],
      inputFolder: "project",
      outputFolder: "project/out",
      worldFolders: ["project/out"],
      foldersWithoutWorld: ["project"],
      effect: "writesOutputFolder",
      describedAs: "a subfolder of the input folder",
    },
    {
      name: "-o outside the input folder",
      projects: ["project"],
      inputFolder: "project",
      outputFolder: "elsewhere",
      worldFolders: ["project"],
      foldersWithoutWorld: ["elsewhere"],
      effect: "changesProject",
      describedAs: "at the project root",
    },
    {
      name: "-o a sibling whose name starts with the project's",
      projects: ["project"],
      inputFolder: "project",
      outputFolder: "project-out",
      worldFolders: ["project/-out"],
      foldersWithoutWorld: ["project", "project-out"],
      effect: "changesProject",
      describedAs: "-o <project>-out",
    },
    {
      name: "-o a one-character folder directly inside the input folder",
      projects: ["project"],
      inputFolder: "project",
      outputFolder: "project/a",
      worldFolders: ["project"],
      foldersWithoutWorld: ["project/a"],
      effect: "changesProject",
      describedAs: "-o <project>/a",
    },
    {
      name: "-o the input folder itself",
      projects: ["project"],
      inputFolder: "project",
      outputFolder: "project",
      worldFolders: ["project"],
      foldersWithoutWorld: [],
      effect: "writesOutputFolder",
      describedAs: "-o is the input folder itself",
    },
    {
      name: "-o the project's worlds/ folder",
      projects: ["project"],
      inputFolder: "project",
      outputFolder: "project/worlds",
      worldFolders: ["project/worlds/worlds"],
      foldersWithoutWorld: ["project", "project/worlds"],
      effect: "writesOutputFolder",
      describedAs: "-o is that world folder itself",
    },
    {
      name: "an input folder that holds one project folder",
      projects: ["parent/a"],
      inputFolder: "parent",
      outputFolder: "parent/out",
      worldFolders: ["parent/a/out"],
      foldersWithoutWorld: ["parent/out", "parent/a"],
      effect: "changesProject",
      describedAs: "holds project folders",
    },
    {
      name: "an input folder that holds several project folders",
      projects: ["parent/a", "parent/b"],
      inputFolder: "parent",
      outputFolder: "parent/out",
      worldFolders: ["parent/a/out", "parent/b/out"],
      foldersWithoutWorld: ["parent/out", "parent/a", "parent/b"],
      effect: "changesProject",
      describedAs: "holds project folders",
    },
  ];

  cases.forEach((testCase, index) => {
    it(`saves the new world where its entry says, with ${testCase.name}`, async () => {
      const base = path.join(tempBase, String(index));
      const resolve = (relativePath: string) => path.join(base, relativePath);

      for (const project of testCase.projects) {
        fs.cpSync(TestPaths.sampleContentPath("simple"), resolve(project), { recursive: true });
      }

      const outputFolder = resolve(testCase.outputFolder);
      const context = await CommandContextFactory.create(
        env.creatorTools,
        env.localEnv,
        TaskType.world,
        {
          inputFolder: resolve(testCase.inputFolder),
          outputFolder,
          betaApis: true,
          quiet: true,
        },
        { mode: "set" }
      );

      await worldCommand.execute(context);

      for (const folder of testCase.worldFolders) {
        expect(fs.existsSync(path.join(resolve(folder), "level.dat")), `level.dat in ${folder}`).to.equal(true);
      }

      for (const folder of testCase.foldersWithoutWorld) {
        expect(fs.existsSync(path.join(resolve(folder), "level.dat")), `no level.dat in ${folder}`).to.equal(false);
      }

      expect(COMMAND_EFFECTS.world[testCase.effect].frequency).to.equal("sometimes");
      expect(describeWorldEntry(), "the world entry's description of this case").to.include(testCase.describedAs);
    });
  });
});
