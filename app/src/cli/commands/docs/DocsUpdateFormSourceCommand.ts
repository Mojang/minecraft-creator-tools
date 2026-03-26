import { Command as Commander } from "commander";
import { ICommand, ICommandMetadata, CommandBase } from "../../core/ICommand";
import { ICommandContext, ErrorCodes } from "../../core/ICommandContext";
import FormJsonDocumentationGenerator from "../../../docgen/FormJsonDocumentationGenerator";
import StorageUtilities from "../../../storage/StorageUtilities";
import NodeStorage from "../../../local/NodeStorage";
import ClUtils, { TaskType } from "../../ClUtils";

/**
 * Updates form source files with generated content.
 *
 * Usage: mct docsupdateformsource [-i <inputFolder>] [-o <outputFolder>]
 */
export class DocsUpdateFormSourceCommand extends CommandBase implements ICommand {
  public readonly metadata: ICommandMetadata = {
    name: "docsupdateformsource",
    description: "Update form source files with generated content",
    taskType: TaskType.docsUpdateFormSource,
    aliases: ["updateformsource"],
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

    // If an input folder is specified (override/source forms), copy them to output first
    const inputFolder = await ClUtils.getMainWorkFolder(
      TaskType.docsUpdateFormSource,
      context.inputFolder,
      context.outputFolder
    );

    if (inputFolder && context.inputFolderSpecified) {
      // Copy source forms to output/forms/ first, preserving override content
      // Only when user explicitly specified -i (input folder)
      const formsFolder = outFolder.ensureFolder("forms");
      await formsFolder.ensureExists();
      await StorageUtilities.syncFolderTo(inputFolder, formsFolder, true, true, true);
      await formsFolder.saveAll();
    }

    const formJsonDocGen = new FormJsonDocumentationGenerator();

    await formJsonDocGen.updateFormSource(outFolder, true);

    log.info("Form source update complete.");
    return;
  }
}

export const docsUpdateFormSourceCommand = new DocsUpdateFormSourceCommand();
