import { Command as Commander } from "commander";
import { ICommand, ICommandMetadata, CommandBase } from "../../core/ICommand";
import { ICommandContext, ErrorCodes } from "../../core/ICommandContext";
import FormDefinitionTypeScriptGenerator from "../../../docgen/FormDefinitionTypeScriptGenerator";
import NodeStorage from "../../../local/NodeStorage";
import ClUtils, { TaskType } from "../../ClUtils";

/**
 * Generates TypeScript type definitions from form definitions.
 *
 * Usage: mct docsgeneratetypes [-i <inputFolder>] [-o <outputFolder>]
 */
export class DocsGenerateTypesCommand extends CommandBase implements ICommand {
  public readonly metadata: ICommandMetadata = {
    name: "docsgeneratetypes",
    description: "Generate TypeScript type definitions from form definitions",
    taskType: TaskType.docsGenerateTypes,
    aliases: ["generatetypes", "gentypes"],
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
      log.error("Not configured correctly to generate types and schemas.");
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
      TaskType.docsGenerateTypes,
      context.inputFolder,
      context.outputFolder
    );

    // Delete existing contents before generating
    await outFolder.deleteAllFolderContents();

    const formDocGen = new FormDefinitionTypeScriptGenerator();

    await formDocGen.generateTypes(inputFolder, outFolder);

    log.info("TypeScript type generation complete.");
    return;
  }
}

export const docsGenerateTypesCommand = new DocsGenerateTypesCommand();
