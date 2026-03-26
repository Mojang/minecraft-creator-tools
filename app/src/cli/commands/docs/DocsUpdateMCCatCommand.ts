import { Command as Commander } from "commander";
import { ICommand, ICommandMetadata, CommandBase } from "../../core/ICommand";
import { ICommandContext, ErrorCodes } from "../../core/ICommandContext";
import { TaskType } from "../../ClUtils";
import MCCatGenerator from "../../../docgen/MCCatGenerator";
import NodeStorage from "../../../local/NodeStorage";

/**
 * Updates mccat.json with block/entity catalog data.
 *
 * Usage: mct docsupdatemccat [-o <outputFolder>]
 */
export class DocsUpdateMCCatCommand extends CommandBase implements ICommand {
  public readonly metadata: ICommandMetadata = {
    name: "docsupdatemccat",
    description: "Update mccat.json with block/entity catalog data",
    taskType: TaskType.docsUpdateMCCat,
    aliases: ["updatemccat"],
    requiresProjects: false,
    isWriteCommand: true,
    isEditInPlace: false,
    isLongRunning: false,
    category: "Documentation",
    internal: true,
  };

  public configure(_cmd: Commander): void {
    // No additional options needed - all configuration is in metadata
  }

  public async execute(context: ICommandContext): Promise<void> {
    const { creatorTools, log } = context;

    if (!creatorTools) {
      log.error("Not configured correctly to generate documents.");
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    let outFolder;

    if (context.outputFolder) {
      const ns = new NodeStorage(context.outputFolder, "");
      outFolder = ns.rootFolder;
    } else {
      const outputStorage = new NodeStorage(process.cwd(), "");
      outFolder = outputStorage.rootFolder;
    }

    if (!outFolder) {
      log.error("Could not find an output folder for generate documents.");
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    await outFolder.ensureExists();

    const mccatGen = new MCCatGenerator();

    await mccatGen.updateMCCat(outFolder, true);

    log.info("MCCat update complete.");
    return;
  }
}

export const docsUpdateMCCatCommand = new DocsUpdateMCCatCommand();
