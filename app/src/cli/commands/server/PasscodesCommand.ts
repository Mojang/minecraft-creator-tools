/**
 * PasscodesCommand - Display server passcodes
 *
 * ARCHITECTURE DOCUMENTATION
 * ==========================
 *
 * This command displays the authentication passcodes used to access
 * the MCT web server and dedicated server administration features.
 *
 * PASSCODE TYPES:
 * - Display read-only: View-only access
 * - Full read-only: View access + server content sources
 * - Update/reset: Can reset server state
 * - Admin: Full developer access
 *
 * USAGE:
 * npx mct passcodes
 */

import { Command } from "commander";
import { ICommandMetadata, CommandBase } from "../../core/ICommand";
import { ICommandContext, ErrorCodes } from "../../core/ICommandContext";
import { TaskType } from "../../ClUtils";
import { constants } from "../../../core/Constants";

export class PasscodesCommand extends CommandBase {
  readonly metadata: ICommandMetadata = {
    name: "passcodes",
    description: "Shows active pass codes for web server validation.",
    taskType: TaskType.passcodes,
    aliases: ["pc"],
    requiresProjects: false,
    isWriteCommand: false,
    isEditInPlace: false,
    isLongRunning: false,
    category: "Server",
  };

  configure(cmd: Command): void {
    // No additional arguments
  }

  async execute(context: ICommandContext): Promise<void> {
    this.logStart(context);

    await this.displayPasscodes(context, false);

    this.logComplete(context);
  }

  async displayPasscodes(context: ICommandContext, displayIndent: boolean): Promise<void> {
    let linePrefix = "";

    if (displayIndent) {
      linePrefix = "    ";
    }

    if (!context.json) {
      context.log.info("\n" + linePrefix + constants.name + " Server Passcodes");
    }

    if (!context.localEnv) {
      context.log.error("Local environment not available.");
      return;
    }

    await context.localEnv.load();

    if (
      context.localEnv.displayReadOnlyPasscode === undefined ||
      context.localEnv.adminPasscode === undefined ||
      context.localEnv.fullReadOnlyPasscode === undefined ||
      context.localEnv.updateStatePasscode === undefined
    ) {
      await context.localEnv.setDefaults();
    }

    if (
      context.localEnv.displayReadOnlyPasscode === undefined ||
      context.localEnv.adminPasscode === undefined ||
      context.localEnv.fullReadOnlyPasscode === undefined ||
      context.localEnv.updateStatePasscode === undefined
    ) {
      context.log.error("Failed to generate passcodes.");
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    if (context.json) {
      const passcodes = {
        displayReadOnly: this.getFriendlyPasscode(context.localEnv.displayReadOnlyPasscode),
        fullReadOnly: this.getFriendlyPasscode(context.localEnv.fullReadOnlyPasscode),
        updateState: this.getFriendlyPasscode(context.localEnv.updateStatePasscode),
        admin: this.getFriendlyPasscode(context.localEnv.adminPasscode),
      };
      context.log.data(
        JSON.stringify({
          schemaVersion: "1.0.0",
          command: "passcodes",
          passcodes,
        })
      );
      return;
    }

    context.log.info(
      linePrefix +
        "These passcodes let remote computers access your Minecraft web server and administer your Minecraft dedicated server."
    );
    context.log.info(
      linePrefix + "Note: unless set via the console, these passcodes are randomly generated for the current session."
    );
    context.log.info(linePrefix + "  *** Please be careful if you share these. ***\n");
    context.log.info(
      linePrefix + "  Display read-only passcode: " + this.getFriendlyPasscode(context.localEnv.displayReadOnlyPasscode)
    );
    context.log.info(
      linePrefix +
        "  Display + server content source read-only passcode: " +
        this.getFriendlyPasscode(context.localEnv.fullReadOnlyPasscode)
    );
    context.log.info(
      linePrefix + "  Update/reset server passcode: " + this.getFriendlyPasscode(context.localEnv.updateStatePasscode)
    );
    context.log.info(
      linePrefix + "  Admin/full developer passcode: " + this.getFriendlyPasscode(context.localEnv.adminPasscode) + "\n"
    );
  }

  private getFriendlyPasscode(str: string): string {
    if (str.length >= 4) {
      str = str.toUpperCase();
      return str.substring(0, 4) + "-" + str.substring(4);
    }
    return str;
  }
}

export const passcodesCommand = new PasscodesCommand();
