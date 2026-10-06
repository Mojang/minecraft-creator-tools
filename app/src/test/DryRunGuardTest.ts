/**
 * DryRunGuardTest - Checks that the CLI rejects --dry-run for every command that doesn't honor it.
 *
 * Builds the real program through createCliProgram, the same wiring cli/index.ts uses, with Commander's
 * exit and output captured. It then parses every registered command with --dry-run. Commands whose entry
 * in the effects table (cli/core/CommandEffects.ts) is "honored" must reach their action. Every other
 * command must stop before its action, with exit code 1 and one error line on stderr. Help must list
 * --dry-run exactly for the commands that accept it.
 *
 * Parsing only records which command would run, so these checks need no build and touch no files.
 * CliDryRunTest runs the built CLI to check that nothing changes on disk.
 */

import { expect } from "chai";
import "mocha";
import { CommanderError } from "commander";
import { TaskType } from "../cli/ClUtils";
import { getAllCommands } from "../cli/commands/index";
import { createCliProgram } from "../cli/core/CliProgram";
import { getCommandEffects } from "../cli/core/CommandEffects";
import { parseCommandLine } from "../cli/core/CommandLineHelp";
import { CommandRegistry } from "../cli/core/CommandRegistry";
import { DRY_RUN_NOT_SUPPORTED_CODE, formatDryRunNotSupportedError, isDryRunSupported } from "../cli/core/DryRunGuard";
import { ICommand } from "../cli/core/ICommand";

interface IParseResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  /** The CommanderError code when parsing stopped, such as DRY_RUN_NOT_SUPPORTED_CODE. */
  errorCode?: string;
  /** The command whose action ran; noCommand when none did. */
  taskType: TaskType;
}

/** Parses `args` as `mct <args>`, capturing output and the exit code instead of exiting. */
function parse(args: string[]): IParseResult {
  const output = { stdout: "", stderr: "" };
  const registry = new CommandRegistry();
  registry.registerAll(getAllCommands());

  const program = createCliProgram({
    registry,
    includeDebugOptions: false,
    showAllCommands: false,
    prepare: (p) =>
      p.exitOverride().configureOutput({
        writeOut: (text) => {
          output.stdout += text;
        },
        writeErr: (text) => {
          output.stderr += text;
        },
        getOutHelpWidth: () => 100,
        getErrHelpWidth: () => 100,
        getOutHasColors: () => false,
        getErrHasColors: () => false,
      }),
  });

  let exitCode = 0;
  let errorCode: string | undefined;

  try {
    parseCommandLine(program, ["node", "mct", ...args]);
  } catch (e) {
    if (!(e instanceof CommanderError)) {
      throw e;
    }

    exitCode = e.exitCode;
    errorCode = e.code;
  }

  return { ...output, exitCode, errorCode, taskType: registry.getCapturedState().taskType };
}

/** Values for the command's required arguments that Commander accepts, so --dry-run is all that's left to reject. */
function getRequiredArgumentValues(command: ICommand): string[] {
  return (command.metadata.arguments ?? [])
    .filter((argument) => argument.required)
    .map((argument) => argument.choices?.[0] ?? "x");
}

/** Problems with a parse that the guard should have stopped, or an empty list. */
function describeRejectionProblems(label: string, result: IParseResult, commandPath: string): string[] {
  const problems: string[] = [];
  const expectedError = formatDryRunNotSupportedError(commandPath) + "\n";

  if (result.exitCode !== 1 || result.errorCode !== DRY_RUN_NOT_SUPPORTED_CODE) {
    problems.push(
      `${label}: exited with ${result.exitCode} (${result.errorCode ?? "no error"}), not the --dry-run rejection`
    );
  }

  if (result.stderr !== expectedError) {
    problems.push(`${label}: stderr was ${JSON.stringify(result.stderr)}, not ${JSON.stringify(expectedError)}`);
  }

  if (result.stdout !== "") {
    problems.push(`${label}: printed to stdout: ${JSON.stringify(result.stdout)}`);
  }

  if (result.taskType !== TaskType.noCommand) {
    problems.push(`${label}: the command's action ran (TaskType ${result.taskType})`);
  }

  return problems;
}

describe("DryRunGuard", () => {
  const commands = getAllCommands();

  it("lists --dry-run in help exactly for the commands that accept it", () => {
    const problems: string[] = [];

    for (const { metadata } of commands) {
      const accepted = isDryRunSupported(metadata.name);
      const listed = parse(["help", metadata.name]).stdout.includes("--dry-run");

      if (listed !== accepted) {
        problems.push(
          `${metadata.name}: help ${listed ? "lists" : "doesn't list"} --dry-run, but the CLI ${
            accepted ? "accepts" : "rejects"
          } it because dryRun.support is '${getCommandEffects(metadata.name)?.dryRun.support}'. Either skip every ` +
            "effect under --dry-run and mark the entry honored, or stop reading dryRun and drop the dryRun group."
        );
      }
    }

    expect(problems).to.deep.equal([]);
  });

  it("lets every command that honors --dry-run run with it", () => {
    const problems: string[] = [];
    const honored = commands.filter(({ metadata }) => isDryRunSupported(metadata.name));

    expect(honored.map(({ metadata }) => metadata.name)).to.not.be.empty;

    for (const command of honored) {
      const { name, taskType } = command.metadata;
      const result = parse([name, ...getRequiredArgumentValues(command), "--dry-run"]);

      if (result.exitCode !== 0 || result.stderr !== "" || result.taskType !== taskType) {
        problems.push(`${name}: exited with ${result.exitCode}, stderr ${JSON.stringify(result.stderr)}`);
      }
    }

    expect(problems).to.deep.equal([]);
  });

  it("stops every other command before it runs", () => {
    const problems: string[] = [];
    const rejected = commands.filter(({ metadata }) => !isDryRunSupported(metadata.name));

    expect(rejected.map(({ metadata }) => metadata.name)).to.include.members(["deploy", "validate", "ensureworld"]);

    for (const command of rejected) {
      const { name } = command.metadata;
      const result = parse([name, ...getRequiredArgumentValues(command), "--dry-run"]);

      problems.push(...describeRejectionProblems(name, result, `mct ${name}`));
    }

    expect(problems).to.deep.equal([]);
  });

  const rejectionCases: { name: string; args: string[]; reportedAs: string }[] = [
    { name: "the short flag", args: ["deploy", "folder", "-n"], reportedAs: "mct deploy" },
    { name: "the flag before the command", args: ["--dry-run", "deploy", "folder"], reportedAs: "mct deploy" },
    { name: "an alias", args: ["dp", "folder", "--dry-run"], reportedAs: "mct dp" },
    { name: "eula through its alias", args: ["eula", "--yes", "--dry-run"], reportedAs: "mct eula" },
    {
      name: "eula through its full name",
      args: ["minecrafteulaandprivacystatement", "--dry-run"],
      reportedAs: "mct minecrafteulaandprivacystatement",
    },
    { name: "--json", args: ["validate", "--json", "--dry-run"], reportedAs: "mct validate" },
    { name: "a command that used to honor it in part", args: ["add", "cow", "my_cow", "-n"], reportedAs: "mct add" },
  ];

  for (const { name, args, reportedAs } of rejectionCases) {
    it(`rejects --dry-run given with ${name}`, () => {
      expect(describeRejectionProblems(args.join(" "), parse(args), reportedAs)).to.deep.equal([]);
    });
  }

  const allowedCases: { name: string; args: string[]; taskType: TaskType; stdoutIncludes?: string }[] = [
    {
      name: "the short flag on a command that honors it",
      args: ["fix", "randomizealluids", "-n"],
      taskType: TaskType.fix,
    },
    { name: "no --dry-run", args: ["deploy", "folder"], taskType: TaskType.deploy },
    {
      name: "help for a command that rejects it",
      args: ["help", "deploy", "--dry-run"],
      taskType: TaskType.noCommand,
      stdoutIncludes: "mct deploy <mode>",
    },
    {
      name: "--help on a command that rejects it",
      args: ["deploy", "--help", "--dry-run"],
      taskType: TaskType.noCommand,
      stdoutIncludes: "mct deploy <mode>",
    },
  ];

  for (const { name, args, taskType, stdoutIncludes } of allowedCases) {
    it(`doesn't reject ${name}`, () => {
      const result = parse(args);

      expect(result.errorCode, result.stderr).to.not.equal(DRY_RUN_NOT_SUPPORTED_CODE);
      expect(result.exitCode, result.stderr).to.equal(0);
      expect(result.stderr).to.equal("");
      expect(result.taskType).to.equal(taskType);

      if (stdoutIncludes) {
        expect(result.stdout).to.include(stdoutIncludes);
      }
    });
  }
});
