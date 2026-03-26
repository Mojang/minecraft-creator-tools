import { Command as Commander } from "commander";
import { ICommand, ICommandMetadata, CommandBase } from "../../core/ICommand";
import { ICommandContext, ErrorCodes } from "../../core/ICommandContext";
import JsonSchemaGenerator from "../../../schema/JsonSchemaGenerator";
import NodeStorage from "../../../local/NodeStorage";
import ClUtils, { TaskType } from "../../ClUtils";

/**
 * Generates JSON Schema files from form definitions.
 *
 * Usage: mct docsgeneratejsonschema [-i <inputFolder>] [-o <outputFolder>]
 */
export class DocsGenerateJsonSchemaCommand extends CommandBase implements ICommand {
  public readonly metadata: ICommandMetadata = {
    name: "docsgeneratejsonschema",
    description: "Generate JSON Schema files from form definitions",
    taskType: TaskType.docsGenerateJsonSchema,
    aliases: ["generatejsonschema", "genjsonschema", "genschema"],
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
      log.error("Not configured correctly to generate JSON schemas.");
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
      log.error("Could not find an output folder for generate JSON schemas.");
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    await outFolder.ensureExists();

    const inputFolder = await ClUtils.getMainWorkFolder(
      TaskType.docsGenerateJsonSchema,
      context.inputFolder,
      context.outputFolder
    );

    // Delete existing contents before generating
    await outFolder.deleteAllFolderContents();

    const schemaGen = new JsonSchemaGenerator();

    await schemaGen.generateSchemas(inputFolder, outFolder);

    log.info("JSON Schema generation complete.");
    return;
  }
}

export const docsGenerateJsonSchemaCommand = new DocsGenerateJsonSchemaCommand();
