/**
 * Prompt - The one way `mct` commands ask the user a question.
 *
 * A prompt needs a person at a terminal: stdin and stdout must both be terminals (TTYs). Without
 * one (in CI, in a pipe, or under an AI agent), inquirer writes cursor-control codes into captured
 * output, reads piped input as answers, or waits forever on a pipe that stays open. So `prompt()`
 * checks first. When it can't prompt, it throws a PromptUnavailableError that names the missing
 * input and how to supply it (an argument, a flag, or --yes). Commands report that error with
 * reportPromptUnavailable(), which fails the command with INIT_ERROR.
 *
 * Commands must not import inquirer themselves; ESLint enforces this (app/.eslintrc.cjs).
 */

import inquirer, { Answers, DistinctQuestion } from "inquirer";
import { escapeControlCharacters } from "./CommandLineHelp";
import { ErrorCodes, ICommandContext } from "./ICommandContext";

/** A question for prompt(). */
export type PromptQuestion = DistinctQuestion<Answers>;

/** What a prompt asks for, and how to supply it when mct can't prompt. */
export interface IPromptRequest {
  /** Completes "Can't ask ...", for example "for the project name" or "whether you agree to the Minecraft EULA". */
  asking: string;

  /** How to supply the answer without a prompt, such as the argument or flag to pass. May span lines. */
  instead: string;
}

/** The part of a standard stream that the terminal check reads. */
export interface ITerminalStream {
  isTTY?: boolean;
}

/**
 * Thrown instead of prompting when stdin or stdout isn't a terminal. Control characters in the
 * message, such as from an argument it quotes, are escaped so it can't write terminal sequences.
 */
export class PromptUnavailableError extends Error {
  constructor(request: IPromptRequest, reason: string) {
    super(escapeControlCharacters(`Can't ask ${request.asking}, because ${reason}.\n${request.instead}`));
    this.name = "PromptUnavailableError";
  }
}

/** Says why mct can't prompt, or returns undefined when it can: stdin and stdout must both be terminals. */
export function getPromptBlocker(
  stdin: ITerminalStream = process.stdin,
  stdout: ITerminalStream = process.stdout
): string | undefined {
  const stdinIsTerminal = stdin.isTTY === true;
  const stdoutIsTerminal = stdout.isTTY === true;

  if (stdinIsTerminal && stdoutIsTerminal) {
    return undefined;
  }

  if (!stdinIsTerminal && !stdoutIsTerminal) {
    return "stdin and stdout aren't terminals";
  }

  return stdinIsTerminal ? "stdout isn't a terminal" : "stdin isn't a terminal";
}

/** Throws a PromptUnavailableError unless mct can prompt. Call it before printing text that leads into a prompt. */
export function ensureCanPrompt(request: IPromptRequest): void {
  const blocker = getPromptBlocker();

  if (blocker) {
    throw new PromptUnavailableError(request, blocker);
  }
}

/** Asks `questions`, or throws a PromptUnavailableError without a terminal (see ensureCanPrompt). */
export async function prompt(questions: PromptQuestion[], request: IPromptRequest): Promise<Answers> {
  if (questions.length === 0) {
    return {};
  }

  ensureCanPrompt(request);

  return await inquirer.prompt(questions);
}

/**
 * Reports `error` as the command's failure if it's a PromptUnavailableError, and returns true.
 * Returns false for any other error, which the caller handles as before.
 */
export function reportPromptUnavailable(context: ICommandContext, error: unknown): boolean {
  if (!(error instanceof PromptUnavailableError)) {
    return false;
  }

  context.log.error(error.message);
  context.setExitCode(ErrorCodes.INIT_ERROR);

  return true;
}
