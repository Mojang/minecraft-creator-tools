/**
 * EulaCommand - Minecraft EULA and Privacy Statement
 *
 * ARCHITECTURE DOCUMENTATION
 * ==========================
 *
 * This command displays the Minecraft EULA and Privacy Statement
 * and prompts the user to accept them. This is required for features
 * that use Minecraft assets or the Bedrock Dedicated Server.
 *
 * EULA can also be accepted via environment variable:
 * MCTOOLS_I_ACCEPT_EULA_AT_MINECRAFTDOTNETSLASHEULA=true
 *
 * USAGE:
 * npx mct eula
 */

import { Command } from "commander";
import { ICommandMetadata, CommandBase } from "../../core/ICommand";
import { ICommandContext, ErrorCodes } from "../../core/ICommandContext";
import { TaskType } from "../../ClUtils";
import LocalUtilities from "../../../local/LocalUtilities";
import inquirer, { DistinctQuestion } from "inquirer";

export class EulaCommand extends CommandBase {
  readonly metadata: ICommandMetadata = {
    name: "minecrafteulaandprivacystatement",
    description: "See the Minecraft End User License Agreement.",
    taskType: TaskType.minecraftEulaAndPrivacyStatement,
    aliases: ["eula"],
    requiresProjects: false,
    isWriteCommand: true,
    isEditInPlace: false,
    isLongRunning: false,
    category: "Server",
  };

  configure(cmd: Command): void {
    // Pro-grade additions for non-interactive CI:
    //   --accept   Accept EULA without prompting
    //   --status   Print current EULA acceptance state and exit
    cmd.option("--accept", "Accept the EULA + Privacy Statement non-interactively (no prompt). Equivalent to setting MCTOOLS_I_ACCEPT_EULA_AT_MINECRAFTDOTNETSLASHEULA=true.");
    cmd.option("--status", "Print current EULA acceptance state and exit. Honours --json.");
  }

  async execute(context: ICommandContext): Promise<void> {
    this.logStart(context);

    await context.localEnv.load();

    const wantsStatus = Boolean(context.commandOptions?.status);
    const wantsAccept = Boolean(context.commandOptions?.accept) || context.yes;

    if (wantsStatus) {
      const accepted =
        context.localEnv.iAgreeToTheMinecraftEndUserLicenseAgreementAndPrivacyStatementAtMinecraftDotNetSlashEula ||
        LocalUtilities.eulaAcceptedViaEnvironment;
      const acceptedViaEnv = LocalUtilities.eulaAcceptedViaEnvironment;
      if (context.json) {
        context.log.data(
          JSON.stringify({
            schemaVersion: "1.0.0",
            command: "eula",
            accepted,
            acceptedViaEnvironment: acceptedViaEnv,
          })
        );
      } else {
        context.log.info(`EULA accepted: ${accepted}${acceptedViaEnv ? " (via environment variable)" : ""}`);
      }
      this.logComplete(context);
      return;
    }

    // Check if EULA was accepted via environment variable (Docker-friendly)
    if (LocalUtilities.eulaAcceptedViaEnvironment) {
      context.log.info(
        "MCTOOLS_I_ACCEPT_EULA_AT_MINECRAFTDOTNETSLASHEULA environment variable is set to 'true'.\n" +
          "Minecraft End User License Agreement and Privacy Statement accepted via environment.\n" +
          "    Minecraft End User License Agreement: https://minecraft.net/eula\n" +
          "    Minecraft Privacy Statement: https://go.microsoft.com/fwlink/?LinkId=521839\n"
      );
      context.localEnv.iAgreeToTheMinecraftEndUserLicenseAgreementAndPrivacyStatementAtMinecraftDotNetSlashEula = true;
      await context.localEnv.save();
      return;
    }

    if (wantsAccept) {
      // Non-interactive acceptance — for CI / Docker / scripted environments.
      // Equivalent to confirming the prompt with `yes`. The user is still
      // responsible for reading the EULA at the URLs printed below.
      context.log.info(
        "Accepting EULA non-interactively (--accept / --yes).\n" +
          "    Minecraft End User License Agreement: https://minecraft.net/eula\n" +
          "    Minecraft Privacy Statement: https://go.microsoft.com/fwlink/?LinkId=521839\n"
      );
      context.localEnv.iAgreeToTheMinecraftEndUserLicenseAgreementAndPrivacyStatementAtMinecraftDotNetSlashEula = true;
      await context.localEnv.save();
      if (context.json) {
        context.log.data(
          JSON.stringify({ schemaVersion: "1.0.0", command: "eula", accepted: true, acceptedViaEnvironment: false })
        );
      } else {
        context.log.success("EULA accepted.");
      }
      this.logComplete(context);
      return;
    }

    const questions: DistinctQuestion<any>[] = [];

    context.log.info(
      "This feature uses Minecraft assets and/or the Minecraft Bedrock Dedicated Server. To use it, you must agree to the Minecraft End User License Agreement and Privacy Statement.\n"
    );
    context.log.info("    Minecraft End User License Agreement: https://minecraft.net/eula");
    context.log.info("    Minecraft Privacy Statement: https://go.microsoft.com/fwlink/?LinkId=521839\n");

    questions.push({
      type: "confirm",
      default: false,
      name: "minecraftEulaAndPrivacyStatement",
      message: "I agree to the Minecraft End User License Agreement and Privacy Statement",
    });

    let answers;
    try {
      answers = await inquirer.prompt(questions);
    } catch (err) {
      context.log.error("EULA prompt cancelled");
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    const iaccept = answers["minecraftEulaAndPrivacyStatement"];

    if (iaccept === true || iaccept === false) {
      context.localEnv.iAgreeToTheMinecraftEndUserLicenseAgreementAndPrivacyStatementAtMinecraftDotNetSlashEula =
        iaccept;
      await context.localEnv.save();

      if (iaccept) {
        context.log.success("EULA accepted.");
      } else {
        context.log.info("EULA not accepted. Some features will be unavailable.");
      }
    }

    this.logComplete(context);
  }
}

export const eulaCommand = new EulaCommand();
