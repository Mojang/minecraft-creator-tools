/**
 * CommandHelpTest.ts - Tests for the `mct` help experience
 *
 * Builds the real program through createCliProgram (the same wiring cli/index.ts uses) with
 * Commander's exit and output redirected, then checks:
 * - equivalent help invocations render identical output
 * - root and leaf section order (gh-style: unlabeled description, ARGUMENTS, FLAGS)
 * - per-command scoping of global flags
 * - unknown-command errors
 * - layout at narrow widths
 * - metadata guard rails (every global option has a group, every group is reachable, no
 *   command appends help text outside the renderer)
 */

import { expect } from "chai";
import { Command, CommanderError } from "commander";
import { CommandRegistry } from "../cli/core/CommandRegistry";
import { getAllCommands } from "../cli/commands/index";
import { createCliProgram } from "../cli/core/CliProgram";
import { renderCommandHelp, wrap } from "../cli/core/CommandHelpWriter";
import { parseCommandLine } from "../cli/core/CommandLineHelp";
import { TaskType } from "../cli/ClUtils";
import { applyMcpInputAlias } from "../cli/commands/server/McpCommand";
import { applyWorldSettings } from "../cli/commands/world/WorldCommand";
import { GlobalOptionGroup, IMPLICIT_GROUPS, getGlobalOptionGroup } from "../cli/core/GlobalOptions";
import { LOGO_FACE, LogoScale, getLogoWidth, renderLogo } from "../cli/core/CliLogo";

interface ICliRunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  /** The command Commander dispatched to; noCommand when none ran. */
  taskType: TaskType;
}

function buildProgram(width: number, showAllCommands: boolean, output: { stdout: string; stderr: string }) {
  const registry = new CommandRegistry();
  registry.registerAll(getAllCommands());

  const program = createCliProgram({
    registry,
    includeDebugOptions: false,
    showAllCommands,
    prepare: (p) =>
      p.exitOverride().configureOutput({
        writeOut: (text) => {
          output.stdout += text;
        },
        writeErr: (text) => {
          output.stderr += text;
        },
        getOutHelpWidth: () => width,
        getErrHelpWidth: () => width,
        getOutHasColors: () => false,
        getErrHasColors: () => false,
      }),
  });

  return { program, registry };
}

/** Parses `args` exactly as cli/index.ts does, capturing output instead of exiting. */
function runCli(args: string[], width = 100): ICliRunResult {
  const output = { stdout: "", stderr: "" };
  const { program, registry } = buildProgram(width, args.includes("--all-commands"), output);
  let exitCode = 0;

  try {
    parseCommandLine(program, ["node", "mct", ...args]);
  } catch (e) {
    if (!(e instanceof CommanderError)) {
      throw e;
    }
    exitCode = e.exitCode;
  }

  return { ...output, exitCode, taskType: registry.getCapturedState().taskType };
}

/** Splits an example command into arguments, honoring double and single quotes. */
function splitCommandLine(commandLine: string): string[] {
  return [...commandLine.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)].map((m) => m[1] ?? m[2] ?? m[3]);
}

function sectionTitles(text: string): string[] {
  return text.split("\n").filter((line) => /^[A-Z][A-Z &]+$/.test(line));
}

function sectionBody(text: string, title: string): string {
  const lines = text.split("\n");
  const start = lines.indexOf(title);
  if (start < 0) {
    return "";
  }
  const end = lines.findIndex((line, index) => index > start && /^[A-Z][A-Z &]+$/.test(line));
  return lines.slice(start + 1, end < 0 ? undefined : end).join("\n");
}

function visibleCommandNames(): string[] {
  const { program } = buildProgram(100, false, { stdout: "", stderr: "" });
  return program
    .createHelp()
    .visibleCommands(program)
    .map((command) => command.name());
}

describe("CLI help", () => {
  describe("equivalent invocations render identical help", () => {
    const cases: { name: string; invocations: string[][] }[] = [
      { name: "root", invocations: [["--help"], ["-h"], ["help"], []] },
      {
        name: "validate",
        invocations: [
          ["validate", "--help"],
          ["help", "validate"],
          ["help", "val"],
          ["val", "-h"],
        ],
      },
      {
        name: "deploy",
        invocations: [
          ["deploy", "--help"],
          ["help", "dp"],
        ],
      },
      {
        name: "help",
        invocations: [
          ["help", "--help"],
          ["help", "help"],
        ],
      },
    ];

    for (const testCase of cases) {
      it(`${testCase.name}: ${testCase.invocations.map((args) => `[${args.join(" ")}]`).join(", ")}`, () => {
        const results = testCase.invocations.map((args) => runCli(args));

        for (const result of results) {
          expect(result.exitCode).to.equal(0);
          expect(result.stderr).to.equal("");
          expect(result.stdout).to.equal(results[0].stdout);
        }
      });
    }
  });

  describe("root help", () => {
    it("renders sections in order", () => {
      const titles = sectionTitles(runCli(["--help"]).stdout);
      const expected = [
        "GET STARTED",
        "USAGE",
        "PROJECT COMMANDS",
        "VALIDATION COMMANDS",
        "SERVER COMMANDS",
        "INFORMATION COMMANDS",
        "FLAGS",
        "EXAMPLES",
        "LEARN MORE",
      ];

      const positions = expected.map((title) => titles.indexOf(title));
      expect(positions).to.not.include(-1);
      expect([...positions].sort((a, b) => a - b)).to.deep.equal(positions);
    });

    it("lists every visible command under a declared category", () => {
      const help = runCli(["--help"]).stdout;

      const lines = help.split("\n");

      expect(help).to.not.include("ADDITIONAL COMMANDS");
      for (const name of visibleCommandNames()) {
        expect(
          lines.some((line) => line.startsWith(`  ${name}:`)),
          `root help should list ${name}`
        ).to.equal(true);
      }
    });

    it("shows only help, version, and all-commands flags, as gh does", () => {
      const help = runCli(["--help"]).stdout;
      const labels = sectionBody(help, "FLAGS")
        .split("\n")
        .filter((line) => line.trim().length > 0)
        .map((line) => line.trim().split(/ {2,}/)[0]);

      expect(labels).to.deep.equal(["-h, --help", "-v, --version", "--all-commands"]);
      expect(sectionBody(help, "LEARN MORE")).to.include("including all of its flags");
    });

    it("hides content-production commands unless --all-commands is passed", () => {
      const normal = runCli(["--help"]).stdout;
      const all = runCli(["--all-commands"]);

      expect(normal).to.not.include("docsgeneratemarkdown:");
      expect(normal).to.include("--all-commands` to also list");
      expect(all.exitCode).to.equal(0);
      expect(all.stdout).to.include("DOCUMENTATION COMMANDS");
      expect(all.stdout).to.include("docsgeneratemarkdown:");
      expect(all.stdout).to.not.include("--all-commands` to also list");
    });
  });

  describe("leaf help", () => {
    it("renders sections in order and omits empty ones", () => {
      const help = runCli(["deploy", "--help"]).stdout;

      // The description is unlabeled prose at the top, as in gh.
      expect(help.split("\n")[0]).to.match(/^Deploys Minecraft project packs to a destination\./);
      expect(sectionTitles(help)).to.deep.equal([
        "USAGE",
        "ALIASES",
        "ARGUMENTS",
        "FLAGS",
        "INHERITED FLAGS",
        "EXAMPLES",
        "LEARN MORE",
      ]);
      expect(sectionBody(help, "USAGE").trim()).to.equal("mct deploy <mode> [flags]");
      expect(sectionBody(help, "ALIASES").trim()).to.equal("mct dp");
      expect(sectionBody(help, "ARGUMENTS")).to.match(/^ {2}<mode> {2,}Deployment target/);
    });

    // Positive and negative expectations for flags under INHERITED FLAGS, based on what each
    // command reads from its context.
    const scopingCases: { args: string[]; includes: string[]; excludes: string[] }[] = [
      {
        args: ["serve"],
        includes: ["--experimental-ssl-cert", "--once", "--adminpc", "--editor"],
        excludes: ["--warn-only", "--dry-run", "--betaapis", "--json"],
      },
      {
        args: ["validate"],
        includes: ["-i, --input-folder", "--if, --input-file", "--warn-only", "--threads", "-f, --force", "--json"],
        excludes: ["--experimental-ssl-cert", "--yes", "--output-file", "--launch"],
      },
      {
        args: ["profileValidation"],
        includes: ["--threads", "--output-type"],
        excludes: ["--warn-only"],
      },
      // create iterates the projects loaded from -i/--if, so project-selection flags apply.
      {
        args: ["create"],
        includes: ["-o, --output-folder", "-y, --yes", "--if, --input-file"],
        excludes: ["--warn-only", "--experimental-ssl-cert"],
      },
      { args: ["version"], includes: ["--json"], excludes: ["-i, --input-folder", "-o, --output-folder"] },
      // `deploy --launch` is the root flag; deploy ignores world settings and packs.
      {
        args: ["deploy"],
        includes: ["--test-world", "-l, --launch", "-o, --output-folder"],
        excludes: ["--betaapis", "--editor", "--mctemplate", "--behavior-pack"],
      },
      // MCP runs over stdio; its preview server's URLs are plain HTTP.
      { args: ["mcp"], includes: ["-i, --input-folder", "--input <folder>"], excludes: ["--experimental-ssl-cert"] },
      { args: ["world"], includes: ["--betaapis", "--no-editor"], excludes: ["--mctemplate", "--ensure-world"] },
      // Deploy's --launch needs --test-world; help says so.
      { args: ["deploy"], includes: ["only applies with `--test-world`"], excludes: [] },
      // `help` renders before logging or network options apply, so it lists only -h.
      { args: ["help"], includes: [], excludes: ["--json", "--isolated", "--verbose", "--quiet"] },
    ];

    for (const testCase of scopingCases) {
      it(`scopes inherited flags for ${testCase.args.join(" ")}`, () => {
        const help = runCli([...testCase.args, "--help"]).stdout;
        const inherited = sectionBody(help, "INHERITED FLAGS");

        for (const flag of [...testCase.includes, "-h, --help"]) {
          expect(help).to.include(flag);
        }
        for (const flag of testCase.excludes) {
          expect(inherited, flag).to.not.include(flag);
        }
      });
    }

    it("lists the process-wide options on every command", () => {
      for (const name of visibleCommandNames().filter((n) => n !== "help")) {
        const inherited = sectionBody(runCli([name, "--help"]).stdout, "INHERITED FLAGS");
        for (const flag of ["--verbose", "-q, --quiet", "-d, --debug", "--isolated"]) {
          expect(inherited, `${name} ${flag}`).to.include(flag);
        }
      }
    });

    it("hides world's older options that nothing reads, but still parses them", () => {
      const help = runCli(["world", "--help"]).stdout;

      for (const flag of [
        "--betaApis <value>",
        "--dataDrivenItems",
        "--behaviorPack",
        "--resourcePack",
        "--editor <value>",
      ]) {
        expect(help, flag).to.not.include(flag);
      }

      const result = runCli(["world", "--betaApis", "true", "--dataDrivenItems", "true", "-b", "x", "-r", "y"]);
      expect(result.stderr).to.equal("");
      expect(result.taskType).to.equal(TaskType.world);
    });

    it("still parses options that nothing reads, for existing scripts", () => {
      const result = runCli([
        "version",
        "--mcpack",
        "pack.mcpack",
        "--ensure-world",
        "--unsafe-skip-signature-validation",
      ]);

      expect(result.exitCode).to.equal(0);
      expect(result.stderr).to.equal("");
      expect(result.taskType).to.equal(TaskType.version);
    });

    it("never suggests options that nothing reads", () => {
      expect(runCli(["--mcpak"]).stderr).to.not.include("--mcpack");
    });

    it("never advertises options that nothing reads", () => {
      for (const name of visibleCommandNames()) {
        const inherited = sectionBody(runCli([name, "--help"]).stdout, "INHERITED FLAGS");
        for (const flag of [
          "--mctemplate",
          "--mcpack",
          "--behavior-pack",
          "--ensure-world",
          "--preview-server",
          "--unsafe-skip-signature-validation",
        ]) {
          expect(inherited, `${name} ${flag}`).to.not.include(flag);
        }
      }
    });

    it("omits local options the root consumes, and still lists their root counterparts", () => {
      const { program } = buildProgram(100, true, { stdout: "", stderr: "" });
      const rootTokens = new Map<string, string>();
      for (const option of program.options) {
        for (const token of option.flags.split(/[\s,|]+/).filter((t) => t.startsWith("-"))) {
          rootTokens.set(token, option.flags);
        }
      }

      let shadowedCount = 0;
      for (const command of program.commands) {
        const help = runCli([command.name(), "--help"]).stdout;
        const local = sectionBody(help, "FLAGS");
        const inherited = sectionBody(help, "INHERITED FLAGS");

        for (const option of command.options) {
          const tokens = option.flags.split(/[\s,|]+/).filter((t) => t.startsWith("-"));
          if (option.hidden || !tokens.every((token) => rootTokens.has(token))) {
            continue;
          }

          shadowedCount++;
          const localLabels = local.split("\n").map((line) => line.trim().split(/ {2,}/)[0]);
          expect(localLabels, `${command.name()} ${option.flags}`).to.not.include(option.flags);
          for (const token of tokens) {
            expect(inherited, `${command.name()} ${token}`).to.include(rootTokens.get(token) as string);
          }
        }
      }

      expect(shadowedCount).to.be.greaterThan(0);
    });

    it("renders every command, ending with the renderer's own LEARN MORE section", () => {
      // A command that calls Commander's addHelpText("after", ...) would append text after this.
      const { program } = buildProgram(100, true, { stdout: "", stderr: "" });

      for (const command of program.commands) {
        const help = runCli([command.name(), "--help"]).stdout;
        const lastLine = help.trimEnd().split("\n").pop() ?? "";

        expect(sectionTitles(help)[0], command.name()).to.equal("USAGE");
        expect(help.split("\n")[0], command.name()).to.not.equal("USAGE");
        expect(lastLine, command.name()).to.match(/^  Read the documentation at /);
      }
    });
  });

  describe("unknown commands", () => {
    const cases: { args: string[]; header: string; suggestion?: string; usage: string }[] = [
      {
        args: ["valdate"],
        header: 'error: unknown command "valdate" for "mct"',
        suggestion: "validate",
        usage: "Usage:  mct <command> [arguments] [flags]",
      },
      {
        args: ["help", "bogus"],
        header: 'error: unknown command "bogus" for "mct"',
        usage: "Usage:  mct <command> [arguments] [flags]",
      },
      {
        args: ["help", "validate", "extra"],
        header: 'error: unknown command "extra" for "mct validate"',
        usage: "Usage:  mct validate [suite] [exclusions] [aggregateReports] [flags]",
      },
    ];

    for (const testCase of cases) {
      it(`reports [${testCase.args.join(" ")}] on stderr with exit code 1`, () => {
        const result = runCli(testCase.args);

        expect(result.exitCode).to.equal(1);
        expect(result.stdout).to.equal("");
        expect(result.stderr.split("\n")[0]).to.equal(testCase.header);
        expect(result.stderr).to.include(testCase.usage);

        if (testCase.suggestion) {
          expect(result.stderr).to.include(`Did you mean this?\n  ${testCase.suggestion}`);
        } else {
          expect(result.stderr).to.not.include("Did you mean");
        }
      });
    }

    // Commander echoes argv into its own errors; none of it may reach the terminal as a control sequence.
    const injectionCases: { name: string; args: string[] }[] = [
      { name: "unknown option (CSI)", args: ["--bo\u001b[31mgus"] },
      { name: "unknown option (OSC)", args: ["validate", "--x\u001b]8;;https://example.test\u0007y"] },
      { name: "invalid choice", args: ["validate", "ma\u001b[2Jin"] },
      { name: "invalid choice (carriage return)", args: ["rendervanilla", "blo\rck", "stone"] },
    ];

    for (const testCase of injectionCases) {
      it(`escapes control characters in errors: ${testCase.name}`, () => {
        const result = runCli(testCase.args);

        expect(result.exitCode).to.equal(1);
        expect(result.stderr).to.not.match(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/);
        expect(result.stderr).to.match(/\\u00(1b|07|0d)/);
      });
    }

    it("escapes control characters in the unknown token", () => {
      const result = runCli(["bo\u001b[31mgus"]);

      expect(result.exitCode).to.equal(1);
      expect(result.stderr).to.not.include("\u001b");
      expect(result.stderr).to.include("\\u001b[31mgus");
    });

    // A command-specific flag after a mistyped command must not mask the command suggestion.
    const typoWithFlagCases: { args: string[]; header: string; suggestion: string }[] = [
      { args: ["serv", "--port", "8080"], header: 'error: unknown command "serv" for "mct"', suggestion: "serve" },
      {
        args: ["exportadon", "-i", "x", "--format", "mcaddon"],
        header: 'error: unknown command "exportadon" for "mct"',
        suggestion: "exportaddon",
      },
    ];

    for (const testCase of typoWithFlagCases) {
      it(`suggests a command for [${testCase.args.join(" ")}]`, () => {
        const result = runCli(testCase.args);

        expect(result.exitCode).to.equal(1);
        expect(result.stderr.split("\n")[0]).to.equal(testCase.header);
        expect(result.stderr).to.include(`Did you mean this?\n  ${testCase.suggestion}`);
      });
    }

    const unknownOptionCases: { args: string[]; stderr: string }[] = [
      { args: ["--bogus"], stderr: "error: unknown option '--bogus'\n" },
      { args: ["--bogus", "validate"], stderr: "error: unknown option '--bogus'\n" },
      { args: ["--jsn"], stderr: "error: unknown option '--jsn'\n(Did you mean --json?)\n" },
      { args: ["validate", "--bogus"], stderr: "error: unknown option '--bogus'\n" },
    ];

    for (const testCase of unknownOptionCases) {
      it(`reports unknown option for [${testCase.args.join(" ")}] as Commander does`, () => {
        const result = runCli(testCase.args);

        expect(result.exitCode).to.equal(1);
        expect(result.stdout).to.equal("");
        expect(result.stderr).to.equal(testCase.stderr);
      });
    }

    // With no command, options are an error (help goes to stderr), unlike bare `mct`.
    for (const args of [["--json"], ["-i", "./x"], ["--debug"]]) {
      it(`fails [${args.join(" ")}] without a command`, () => {
        const result = runCli(args);

        expect(result.exitCode).to.equal(1);
        expect(result.stdout).to.equal("");
        expect(result.stderr).to.include("USAGE");
        expect(result.taskType).to.equal(TaskType.noCommand);
      });
    }

    // After `--`, everything is an operand, even text that looks like an option.
    for (const token of ["foo", "--json"]) {
      it(`treats [-- ${token}] as an unknown command`, () => {
        const result = runCli(["--", token]);

        expect(result.exitCode).to.equal(1);
        expect(result.stderr.split("\n")[0]).to.equal(`error: unknown command ${JSON.stringify(token)} for "mct"`);
      });
    }

    it("shows every command for --all-commands, even with a command, and never runs it", () => {
      const result = runCli(["--all-commands", "validate"]);

      expect(result.exitCode).to.equal(0);
      expect(result.stdout).to.include("DOCUMENTATION COMMANDS");
      expect(result.taskType).to.equal(TaskType.noCommand);
    });

    it("still dispatches commands with global flags before or after them", () => {
      for (const args of [
        ["--json", "version"],
        ["version", "--json"],
        ["-i", "./x", "val", "--warn-only"],
      ]) {
        const result = runCli(args);
        expect(result.exitCode, args.join(" ")).to.equal(0);
        expect(result.stderr, args.join(" ")).to.equal("");
        expect(result.stdout, args.join(" ")).to.equal("");
        expect(result.taskType, args.join(" ")).to.not.equal(TaskType.noCommand);
      }
    });
  });

  describe("mcp --input", () => {
    const cases: {
      name: string;
      inputFolder?: unknown;
      input?: unknown;
      expectedFolder?: unknown;
      error?: boolean;
    }[] = [
      { name: "no alias leaves -i alone", inputFolder: "./a", expectedFolder: "./a" },
      { name: "alias alone becomes -i", input: "./b", expectedFolder: "./b" },
      { name: "alias fills -i given without a value", inputFolder: true, input: "./b", expectedFolder: "./b" },
      { name: "the same folder both ways is fine", inputFolder: "./b", input: "./b/", expectedFolder: "./b/" },
      { name: "different folders are rejected", inputFolder: "./a", input: "./b", expectedFolder: "./a", error: true },
    ];

    it("escapes the folders it names in its conflict error", () => {
      const error = applyMcpInputAlias({ inputFolder: "./a" }, { input: "./b\u001b[31m" });

      expect(error).to.include("\\u001b[31m");
      expect(error).to.not.include("\u001b");
    });

    for (const testCase of cases) {
      it(testCase.name, () => {
        const programOptions: { inputFolder?: unknown } = { inputFolder: testCase.inputFolder };
        const error = applyMcpInputAlias(programOptions, { input: testCase.input });

        expect(error !== undefined, error).to.equal(!!testCase.error);
        expect(programOptions.inputFolder).to.equal(testCase.expectedFolder);
      });
    }

    it("gives -i and --input the same program options after parsing", () => {
      const parse = (args: string[]) => {
        const { program, registry } = buildProgram(100, false, { stdout: "", stderr: "" });
        parseCommandLine(program, ["node", "mct", ...args]);
        const options = program.opts();
        expect(applyMcpInputAlias(options, registry.getCapturedState().commandOptions)).to.equal(undefined);
        return options.inputFolder;
      };

      expect(parse(["mcp", "--input", "./my-project"])).to.equal(parse(["mcp", "-i", "./my-project"]));
    });
  });

  describe("world settings", () => {
    // --betaapis/--no-betaapis and --editor/--no-editor: on, off, or leave as is.
    const cases: {
      name: string;
      start: { betaApisExperiment?: boolean; isCreatedInEditor?: boolean };
      settings: { betaApis?: boolean; editor?: boolean };
      end: { betaApisExperiment?: boolean; isCreatedInEditor?: boolean };
      changes: number;
    }[] = [
      {
        name: "--no-betaapis and --no-editor turn both off",
        start: { betaApisExperiment: true, isCreatedInEditor: true },
        settings: { betaApis: false, editor: false },
        end: { betaApisExperiment: false, isCreatedInEditor: false },
        changes: 2,
      },
      {
        name: "--betaapis turns Beta APIs on and leaves the editor setting alone",
        start: { betaApisExperiment: false, isCreatedInEditor: true },
        settings: { betaApis: true },
        end: { betaApisExperiment: true, isCreatedInEditor: true },
        changes: 1,
      },
      {
        name: "no flags change nothing",
        start: { betaApisExperiment: true, isCreatedInEditor: false },
        settings: {},
        end: { betaApisExperiment: true, isCreatedInEditor: false },
        changes: 0,
      },
      {
        name: "a flag matching the world changes nothing",
        start: { betaApisExperiment: false },
        settings: { betaApis: false },
        end: { betaApisExperiment: false },
        changes: 0,
      },
    ];

    for (const testCase of cases) {
      it(testCase.name, () => {
        const levelData = { ...testCase.start };

        expect(applyWorldSettings(levelData, testCase.settings)).to.have.length(testCase.changes);
        expect(levelData).to.deep.equal(testCase.end);
      });
    }

    it("passes --no-betaapis and --no-editor through as false, and omitted flags as undefined", () => {
      const parse = (args: string[]) => {
        const { program } = buildProgram(100, false, { stdout: "", stderr: "" });
        parseCommandLine(program, ["node", "mct", "world", ...args]);
        const { betaApis, editor } = program.opts();
        return { betaApis, editor };
      };

      expect(parse(["--no-betaapis", "--no-editor"])).to.deep.equal({ betaApis: false, editor: false });
      expect(parse([])).to.deep.equal({ betaApis: undefined, editor: undefined });
    });
  });

  describe("deploy", () => {
    it("accepts --server-path for `deploy server`", () => {
      const output = { stdout: "", stderr: "" };
      const { program, registry } = buildProgram(100, false, output);

      parseCommandLine(program, ["node", "mct", "deploy", "server", "--server-path", "./bds"]);

      expect(output.stderr).to.equal("");
      expect(registry.getCapturedState().taskType).to.equal(TaskType.deploy);
      expect(registry.getCapturedState().commandOptions.serverPath).to.equal("./bds");
    });
  });

  describe("eula", () => {
    for (const args of [
      ["help", "eula"],
      ["eula", "--help"],
    ]) {
      it(`[${args.join(" ")}] says --yes and --json don't accept the EULA, and points to --accept`, () => {
        const learnMore = sectionBody(runCli(args).stdout, "LEARN MORE").replace(/\s+/g, " ");

        expect(learnMore).to.include("`--yes` and `--json` don't accept the EULA");
        expect(learnMore).to.include("`--accept`");
      });
    }
  });

  describe("root help links", () => {
    it("points to the creator documentation and a place to report problems", () => {
      const learnMore = sectionBody(runCli(["--help"]).stdout, "LEARN MORE").replace(/\s+/g, " ");

      expect(learnMore).to.include(
        "Read the documentation at https://learn.microsoft.com/minecraft/creator/documents/mctoolsoverview"
      );
      expect(learnMore).to.include("Report a problem at https://aka.ms/mctbugs");
    });
  });

  describe("help command", () => {
    it("is the first way root help suggests getting help", () => {
      const help = runCli(["--help"]).stdout;

      expect(sectionBody(help, "USAGE")).to.include("mct help [command]");
      expect(sectionBody(help, "LEARN MORE").trim()).to.match(/^Use `mct help <command>`/);
      expect(sectionBody(help, "LEARN MORE")).to.not.include("for the same information");
      expect(sectionBody(help, "EXAMPLES")).to.include("$ mct help create");
      expect(sectionBody(help, "INFORMATION COMMANDS")).to.match(/^ {2}help: +Show help for any command$/m);
    });

    it("is pointed to from command help and from errors", () => {
      expect(sectionBody(runCli(["validate", "--help"]).stdout, "LEARN MORE")).to.include(
        "Use `mct help` to see all commands."
      );
      expect(runCli(["valdate"]).stderr).to.include("Run `mct help` to see available commands.");
      expect(runCli(["help", "validate", "extra"]).stderr).to.include("Run `mct help validate` for more information.");
    });
  });

  describe("layout", () => {
    for (const width of [40, 60, 80, 120]) {
      it(`wraps prose within ${width} columns`, () => {
        for (const args of [["--help"], ...visibleCommandNames().map((name) => [name, "--help"])]) {
          const help = runCli(args, width).stdout;

          for (const line of help.split("\n")) {
            if (line.length <= width) {
              continue;
            }

            // USAGE and EXAMPLES are verbatim so they stay copy-pasteable; a flag or argument
            // label on its own line and a single unbreakable token (a URL) may also overflow.
            const isVerbatim = /^ {2}(\$ |# |mct )/.test(line) || /^(│|┌|└)/.test(line);
            const isLabelOnly = /^ {2}[-<[]/.test(line) && !/\S {2,}\S/.test(line);
            const isSingleToken = line.trim().split(" ").length === 1;
            expect(isVerbatim || isLabelOnly || isSingleToken, `${args.join(" ")} @${width}: "${line}"`).to.equal(true);
          }
        }
      });
    }

    const descriptionColumns = (body: string) =>
      new Set(
        body
          .split("\n")
          // A row is a 2-space-indented label (single spaces only) followed by 2+ spaces and text.
          .map((line) => /^ {2}\S(?:\S| (?! ))* {2,}(?=\S)/.exec(line))
          .filter((match): match is RegExpExecArray => !!match)
          .map((match) => match[0].length)
      );

    it("aligns descriptions within each section, sized to that section", () => {
      const help = runCli(["validate", "--help"], 100).stdout;
      const argumentColumns = descriptionColumns(sectionBody(help, "ARGUMENTS"));
      const inheritedColumns = descriptionColumns(sectionBody(help, "INHERITED FLAGS"));

      expect(argumentColumns.size).to.equal(1);
      expect(inheritedColumns.size).to.equal(1);
      // `[aggregateReports]` is far shorter than the longest inherited flag, as in gh.
      expect([...argumentColumns][0]).to.equal("  [aggregateReports]  ".length);
      expect([...argumentColumns][0]).to.be.lessThan([...inheritedColumns][0]);
    });

    it("shares one column across root command sections", () => {
      const help = runCli(["--help"], 100).stdout;
      const columns = new Set<number>();

      for (const title of sectionTitles(help).filter((t) => t.endsWith(" COMMANDS"))) {
        descriptionColumns(sectionBody(help, title)).forEach((column) => columns.add(column));
      }

      expect(columns.size).to.equal(1);
    });
  });

  describe("renderCommandHelp", () => {
    function renderSynthetic(configure: (command: Command) => void): string {
      const root = new Command("mct");
      const command = root.command("demo").description("First sentence. Second sentence.");
      configure(command);
      return renderCommandHelp(root, command, {
        productName: "Test",
        version: "0.0.0",
        documentationUrl: "https://example.test",
        width: 80,
        useColor: false,
        colorDepth: 1,
        showAllCommands: false,
        getMetadata: () => ({ globalOptionGroups: [] }),
      });
    }

    const cases: { name: string; configure: (command: Command) => void; expected: RegExp[] }[] = [
      {
        name: "required and optional arguments share one ARGUMENTS section",
        configure: (c) => c.argument("<source>", "Where to read").argument("[target]", "Where to write"),
        expected: [/^ARGUMENTS\n {2}<source> {2}Where to read\n {2}\[target\] {2}Where to write$/m],
      },
      {
        name: "required options are marked in FLAGS and listed in USAGE",
        configure: (c) => c.requiredOption("--name <name>", "Project name").option("--quiet", "Less output"),
        expected: [
          /^USAGE\n {2}mct demo --name <name> \[flags\]$/m,
          /^FLAGS\n {2}--name <name> {2}Project name \(required\)\n {2}--quiet {8}Less output$/m,
        ],
      },
      {
        name: "the full description leads, unlabeled",
        configure: () => undefined,
        expected: [/^First sentence\. Second sentence\.\n\nUSAGE$/m],
      },
    ];

    for (const testCase of cases) {
      it(testCase.name, () => {
        const help = renderSynthetic(testCase.configure);

        expect(help).to.not.include("DESCRIPTION");
        for (const pattern of testCase.expected) {
          expect(help).to.match(pattern);
        }
      });
    }
  });

  describe("metadata guard rails", () => {
    it("assigns every visible global option to a help group", () => {
      const { program } = buildProgram(100, false, { stdout: "", stderr: "" });

      for (const option of program.options.filter((opt) => !opt.hidden)) {
        expect(getGlobalOptionGroup(option), option.flags).to.not.equal(undefined);
      }
    });

    it("makes every global option group reachable from at least one command", () => {
      const { program, registry } = buildProgram(100, true, { stdout: "", stderr: "" });
      const reachable = new Set<GlobalOptionGroup>(IMPLICIT_GROUPS);

      for (const command of registry.getAll()) {
        command.metadata.globalOptionGroups.forEach((group) => reachable.add(group));
      }

      for (const option of program.options) {
        const group = getGlobalOptionGroup(option);
        expect(group && reachable.has(group), `${option.flags} (${group})`).to.equal(true);
      }
    });

    it("only mentions flags that exist, in descriptions, examples, and tips", () => {
      const { program, registry } = buildProgram(100, true, { stdout: "", stderr: "" });
      const tokens = (command: Command) =>
        command.options.flatMap((option) => option.flags.split(/[\s,|]+/).filter((t) => t.startsWith("-")));
      const rootFlags = new Set(tokens(program));
      const flagPattern = /(?<![\w-])(--?[a-zA-Z][\w-]*)/g;

      for (const option of program.options.filter((o) => !o.hidden)) {
        for (const [, flag] of option.description.matchAll(flagPattern)) {
          expect(rootFlags.has(flag), `global ${option.flags} mentions ${flag}`).to.equal(true);
        }
      }

      for (const command of program.commands) {
        const known = new Set([...rootFlags, ...tokens(command), "-h", "--help"]);
        const metadata = registry.get(command.name())?.metadata;
        const texts = [
          command.description(),
          ...command.registeredArguments.map((argument) => argument.description),
          ...command.options.map((option) => option.description),
          ...(metadata?.learnMore ?? []),
          ...(metadata?.examples ?? []).flatMap((example) => [example.command, example.description ?? ""]),
        ];

        for (const text of texts) {
          for (const [, flag] of text.matchAll(flagPattern)) {
            expect(known.has(flag), `${command.name()} mentions ${flag}: "${text}"`).to.equal(true);
          }
        }
      }
    });

    it("uses examples that parse, as written, into the command that shows them", () => {
      const { registry } = buildProgram(100, true, { stdout: "", stderr: "" });

      for (const command of registry.getAll()) {
        for (const example of command.metadata.examples ?? []) {
          const [cli, ...args] = splitCommandLine(example.command);
          const result = runCli(args);

          expect(cli, example.command).to.equal("mct");
          expect(result.stderr, example.command).to.equal("");
          expect(result.exitCode, example.command).to.equal(0);
          expect(result.taskType, example.command).to.equal(command.metadata.taskType);
        }
      }
    });
  });

  describe("logo", () => {
    const visible = (line: string) => line.replace(/\x1b\[[0-9;]*m/g, "");

    /**
     * Decodes rendered logo lines back into a grid of logical pixels, each named by the SGR color
     * that paints it (e.g. "2;0;0;0", "5;70", "40"), by replaying the escape codes like a terminal.
     */
    function decode(lines: string[], scale: LogoScale): string[][] {
      const grid: string[][] = [];

      for (const line of lines) {
        let fg = "";
        let bg = "";
        const top: string[] = [];
        const bottom: string[] = [];

        for (const token of line.match(/\x1b\[[0-9;]*m|[^\x1b]/g) ?? []) {
          const sgr = /^\x1b\[([0-9;]*)m$/.exec(token);
          if (sgr) {
            const code = sgr[1];
            if (code === "0") {
              fg = bg = "";
            } else if (code.startsWith("38;")) {
              fg = code.slice(3);
            } else if (code.startsWith("48;")) {
              bg = code.slice(3);
            } else if (/^3\d$/.test(code)) {
              fg = String(Number(code) + 10);
            } else if (/^4\d$/.test(code)) {
              bg = code;
            } else {
              throw new Error(`unexpected SGR ${code}`);
            }
            continue;
          }

          top.push(token === "▀" ? fg : bg);
          bottom.push(bg);
        }

        if (scale === "compact") {
          grid.push(top, bottom);
        } else {
          grid.push(top.filter((_, index) => index % 2 === 0));
        }
      }

      return grid;
    }

    const modes: { colorDepth: number; face: string; greens: string[] }[] = [
      { colorDepth: 24, face: "2;0;0;0", greens: ["2;82;165;53", "2;74;149;48"] },
      { colorDepth: 8, face: "5;16", greens: ["5;71", "5;65"] },
      // Normal ANSI black, not bright black; the 16-color background is flat green.
      { colorDepth: 4, face: "40", greens: ["42"] },
    ];

    for (const scale of ["compact", "standard"] as LogoScale[]) {
      for (const mode of modes) {
        it(`reproduces the reference face at ${mode.colorDepth}-bit color, ${scale}`, () => {
          const lines = renderLogo(mode.colorDepth, scale);
          const grid = decode(lines, scale);

          expect(lines.length).to.equal(scale === "compact" ? 5 : 10);
          expect(grid.length).to.equal(10);
          for (let y = 0; y < 10; y++) {
            expect(grid[y].length, `row ${y}`).to.equal(10);
            const faceMask = grid[y].map((color) => (color === mode.face ? "#" : ".")).join("");
            expect(faceMask, `row ${y}`).to.equal(LOGO_FACE[y]);
            for (const color of grid[y].filter((c) => c !== mode.face)) {
              expect(mode.greens, `row ${y}`).to.include(color);
            }
          }

          for (const line of lines) {
            expect(visible(line)).to.have.length(getLogoWidth(scale));
            expect(visible(line)).to.match(scale === "compact" ? /^[ ▀]+$/ : /^ +$/);
            expect(line.endsWith("\x1b[0m"), "resets after every line").to.equal(true);
            if (mode.colorDepth < 24) {
              expect(line, "no 24-bit codes").to.not.match(/\x1b\[[34]8;2;/);
            }
          }
        });
      }

      it(`is square at the ${scale} scale: each pixel is ${scale === "compact" ? "1 column by half a row" : "2 columns by 1 row"}`, () => {
        const rows = renderLogo(24, scale).length;
        // A terminal cell is about twice as tall as it is wide.
        expect(getLogoWidth(scale)).to.equal(rows * 2);
      });
    }

    it("uses texture in 24-bit and 256 colors but a flat green in 16 colors", () => {
      expect(new Set(decode(renderLogo(24), "compact").flat()).size).to.equal(3);
      expect(new Set(decode(renderLogo(8), "compact").flat()).size).to.equal(3);
      expect(new Set(decode(renderLogo(4), "compact").flat()).size).to.equal(2);
      expect(renderLogo(4).join("")).to.not.match(/\x1b\[(9\d|10\d)m/);
    });

    it("pads the face with two green pixels on every side, spanning 60% of the width", () => {
      const faceRows = LOGO_FACE.map((row, y) => (row.includes("#") ? y : -1)).filter((y) => y >= 0);
      const faceCols = [...LOGO_FACE[0]]
        .map((_, x) => (LOGO_FACE.some((row) => row[x] === "#") ? x : -1))
        .filter((x) => x >= 0);

      expect([faceRows[0], faceRows[faceRows.length - 1]]).to.deep.equal([2, 7]);
      expect([faceCols[0], faceCols[faceCols.length - 1]]).to.deep.equal([2, 7]);
    });

    it("renders identically every time", () => {
      expect(renderLogo(24)).to.deep.equal(renderLogo(24));
    });

    it("draws nothing without color", () => {
      expect(renderLogo(1)).to.deep.equal([]);
    });

    it("is replaced by a plain title when help has no color", () => {
      const help = runCli(["--help"]).stdout;

      expect(help.split("\n")[0]).to.match(/^Minecraft Creator Tools \(preview\) v/);
      expect(help).to.not.include("▀");
    });

    function renderColorRoot(description: string, width: number): string[] {
      const root = new Command("mct").description(description);
      return renderCommandHelp(root, root, {
        productName: "Minecraft Creator Tools",
        version: "1.0.0",
        documentationUrl: "https://example.test",
        width,
        useColor: false,
        colorDepth: 24,
        showAllCommands: false,
        getMetadata: () => undefined,
      }).split("\n");
    }

    it("leaves a blank line above the logo and puts the title beside it", () => {
      const lines = renderColorRoot("Short description.", 100);
      const titleLine = lines.find((line) => line.includes("Minecraft Creator Tools v1.0.0"));

      expect(lines[0]).to.equal("");
      expect(lines[1]).to.match(/^\x1b\[/);
      expect(titleLine).to.match(/^\x1b\[.*\x1b\[0m {2}Minecraft Creator Tools v1\.0\.0$/);
    });

    it("keeps text that is taller than the logo", () => {
      const description = "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen";
      const text = renderColorRoot(description, 40)
        .map((line) => visible(line).slice(getLogoWidth()).trim())
        .join(" ");

      expect(text).to.include(description);
    });
  });

  describe("wrap", () => {
    const cases: { text: string; width: number; expected: string[] }[] = [
      { text: "one two three", width: 7, expected: ["one two", "three"] },
      {
        text: "https://example.com/a/very/long/url stays",
        width: 10,
        expected: ["https://example.com/a/very/long/url", "stays"],
      },
      { text: "Heading:\n  item one is long", width: 12, expected: ["Heading:", "  item one", "  is long"] },
      { text: "", width: 10, expected: [""] },
    ];

    for (const testCase of cases) {
      it(`wraps ${JSON.stringify(testCase.text)} at ${testCase.width}`, () => {
        expect(wrap(testCase.text, testCase.width)).to.deep.equal(testCase.expected);
      });
    }
  });
});
