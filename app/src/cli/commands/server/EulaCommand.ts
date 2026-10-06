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
 * CONSENT: only these accept the EULA:
 * - `--accept`
 * - the MCTOOLS_I_ACCEPT_EULA_AT_MINECRAFTDOTNETSLASHEULA=true environment variable
 * - answering yes at the interactive prompt
 * `--yes` and `--json` (which implies `--yes`) mean "don't prompt", not "I agree". Without
 * `--accept`, they leave acceptance unchanged and exit non-zero with instructions.
 * `--status` takes precedence and never saves consent. JSON acceptance results are emitted
 * after saving, including when consent comes from the environment variable.
 *
 * The prompt goes through prompt() (cli/core/Prompt.ts), so it appears only when stdin and stdout
 * are both terminals. Without a terminal, eula prints nothing that leads into a prompt: it fails
 * with INIT_ERROR, changes nothing, and says how to accept non-interactively. Piped input such as
 * `echo y | mct eula` is not read as an answer.
 *
 * USAGE:
 * npx mct eula
 * npx mct eula --accept
 * npx mct eula --status --json
 */

import { Command } from "commander";
import { ICommandMetadata, CommandBase } from "../../core/ICommand";
import { ICommandContext, ErrorCodes } from "../../core/ICommandContext";
import { TaskType } from "../../ClUtils";
import LocalUtilities from "../../../local/LocalUtilities";
import { ensureCanPrompt, IPromptRequest, prompt, PromptQuestion, reportPromptUnavailable } from "../../core/Prompt";

const EULA_PROMPT: IPromptRequest = {
  asking: "whether you agree to the Minecraft EULA",
  instead:
    "Nothing was changed. To accept it:\n" +
    "  Interactive:     mct eula\n" +
    "  Non-interactive: mct eula --accept   (or set MCTOOLS_I_ACCEPT_EULA_AT_MINECRAFTDOTNETSLASHEULA=true)\n" +
    "    Minecraft End User License Agreement: https://minecraft.net/eula\n" +
    "    Minecraft Privacy Statement: https://go.microsoft.com/fwlink/?LinkId=521839",
};

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
    globalOptionGroups: ["prompts", "json"],
    learnMore: [
      "`--yes` and `--json` don't accept the EULA; only `--accept`, the environment variable, or answering yes at the prompt does.",
    ],
  };

  configure(cmd: Command): void {
    // Pro-grade additions for non-interactive CI:
    //   --accept   Accept EULA without prompting
    //   --status   Print current EULA acceptance state and exit
    cmd.option(
      "--accept",
      "Accept the EULA + Privacy Statement non-interactively (no prompt). Equivalent to setting MCTOOLS_I_ACCEPT_EULA_AT_MINECRAFTDOTNETSLASHEULA=true."
    );
    cmd.option("--status", "Print current EULA acceptance state and exit. Honours --json.");
  }

  async execute(context: ICommandContext): Promise<void> {
    this.logStart(context);

    await context.localEnv.load();

    const wantsStatus = Boolean(context.commandOptions?.status);
    const wantsAccept = Boolean(context.commandOptions?.accept);

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
      if (context.json) {
        context.log.data(
          JSON.stringify({ schemaVersion: "1.0.0", command: "eula", accepted: true, acceptedViaEnvironment: true })
        );
      }
      return;
    }

    if (wantsAccept) {
      // Non-interactive acceptance — for CI / Docker / scripted environments.
      // Equivalent to confirming the prompt with `yes`. The user is still
      // responsible for reading the EULA at the URLs printed below.
      context.log.info(
        "Accepting EULA non-interactively (--accept).\n" +
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

    // Non-interactive isn't consent: --yes (and --json, which implies it) may skip the
    // prompt, but only --accept, the environment variable, or an interactive yes accepts.
    if (context.yes) {
      context.log.error(
        "--yes and --json don't accept the Minecraft EULA, so nothing was changed. To accept it:\n" +
          "  Interactive:     mct eula\n" +
          "  Non-interactive: mct eula --accept   (or set MCTOOLS_I_ACCEPT_EULA_AT_MINECRAFTDOTNETSLASHEULA=true)\n" +
          "    Minecraft End User License Agreement: https://minecraft.net/eula\n" +
          "    Minecraft Privacy Statement: https://go.microsoft.com/fwlink/?LinkId=521839"
      );
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    const questions: PromptQuestion[] = [];

    questions.push({
      type: "confirm",
      default: false,
      name: "minecraftEulaAndPrivacyStatement",
      message: "I agree to the Minecraft End User License Agreement and Privacy Statement",
    });

    let answers;
    try {
      ensureCanPrompt(EULA_PROMPT);

      context.log.info(
        "This feature uses Minecraft assets and/or the Minecraft Bedrock Dedicated Server. To use it, you must agree to the Minecraft End User License Agreement and Privacy Statement.\n"
      );
      context.log.info("    Minecraft End User License Agreement: https://minecraft.net/eula");
      context.log.info("    Minecraft Privacy Statement: https://go.microsoft.com/fwlink/?LinkId=521839\n");

      answers = await prompt(questions, EULA_PROMPT);
    } catch (err) {
      if (!reportPromptUnavailable(context, err)) {
        context.log.error("EULA prompt cancelled");
        context.setExitCode(ErrorCodes.INIT_ERROR);
      }
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
