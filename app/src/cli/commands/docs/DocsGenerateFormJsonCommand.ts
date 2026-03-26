import { Command as Commander } from "commander";
import { ICommand, ICommandMetadata, CommandBase } from "../../core/ICommand";
import { ICommandContext, ErrorCodes } from "../../core/ICommandContext";
import FormJsonDocumentationGenerator from "../../../docgen/FormJsonDocumentationGenerator";
import NodeStorage from "../../../local/NodeStorage";
import ClUtils, { TaskType } from "../../ClUtils";

/**
 * Generates form JSON files from input data.
 *
 * Usage: mct docsgenerateformjson [-i <inputFolder>] [-o <outputFolder>]
 */
export class DocsGenerateFormJsonCommand extends CommandBase implements ICommand {
  public readonly metadata: ICommandMetadata = {
    name: "docsgenerateformjson",
    description: "Generate form JSON files from input data",
    taskType: TaskType.docsGenerateFormJson,
    aliases: ["generateformjson", "genformjson"],
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

    const inputFolder = await ClUtils.getMainWorkFolder(
      TaskType.docsGenerateFormJson,
      context.inputFolder,
      context.outputFolder
    );

    const docGen = new FormJsonDocumentationGenerator();

    await docGen.generateFormJson(inputFolder, outFolder);

    log.info("Form JSON generation complete.");
    return;
  }
}

export const docsGenerateFormJsonCommand = new DocsGenerateFormJsonCommand();
