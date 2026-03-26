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
    // No additional arguments
  }

  async execute(context: ICommandContext): Promise<void> {
    this.logStart(context);

    await context.localEnv.load();

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
