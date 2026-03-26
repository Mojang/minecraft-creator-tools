import { Command as Commander } from "commander";
import { ICommand, ICommandMetadata, CommandBase } from "../../core/ICommand";
import { ICommandContext, ErrorCodes } from "../../core/ICommandContext";
import FormMarkdownDocumentationGenerator from "../../../docgen/FormMarkdownDocumentationGenerator";
import TableMarkdownDocumentationGenerator from "../../../docgen/TableMarkdownDocumentationGenerator";
import DocJsonMarkdownDocumentationGenerator from "../../../docgen/DocJsonMarkdownDocumentationGenerator";
import NodeStorage from "../../../local/NodeStorage";
import IFolder from "../../../storage/IFolder";
import ClUtils, { TaskType } from "../../ClUtils";

/**
 * Generates Markdown documentation from forms and tables.
 *
 * Usage: mct docsgeneratemarkdown [-i <inputFolder>] [-o <outputFolder>]
 */
export class DocsGenerateMarkdownCommand extends CommandBase implements ICommand {
  public readonly metadata: ICommandMetadata = {
    name: "docsgeneratemarkdown",
    description: "Generate Markdown documentation from forms and tables",
    taskType: TaskType.docsGenerateMarkdown,
    aliases: ["generatemarkdown", "genmarkdown", "genmd"],
    requiresProjects: false,
    isWriteCommand: true,
    isEditInPlace: false,
    isLongRunning: false,
    category: "Documentation",
    internal: true,
  };

  public configure(cmd: Commander): void {
    cmd.option(
      "--ref, --reference-folder <path>",
      "Path to existing documentation folder - files that exist here will be skipped"
    );
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
      TaskType.docsGenerateMarkdown,
      context.inputFolder,
      context.outputFolder
    );

    // Delete existing contents before generating
    await outFolder.deleteAllFolderContents();

    // Load reference folder if specified (for skipping existing docs)
    let referenceFolder: IFolder | undefined;
    if (context.referenceFolder) {
      const refStorage = new NodeStorage(context.referenceFolder, "");
      referenceFolder = refStorage.rootFolder;
      await referenceFolder.load();
    }

    // Generate from forms
    const formDocGen = new FormMarkdownDocumentationGenerator();
    await formDocGen.generateMarkdown(inputFolder, outFolder, referenceFolder);

    // Generate from tables
    const tableDocGen = new TableMarkdownDocumentationGenerator();
    await tableDocGen.generateMarkdown(outFolder);

    // Generate from doc JSON
    const markdownFromDocDocGen = new DocJsonMarkdownDocumentationGenerator();
    await markdownFromDocDocGen.generateMarkdown(inputFolder, outFolder);

    log.info("Markdown documentation generation complete.");
    return;
  }
}

export const docsGenerateMarkdownCommand = new DocsGenerateMarkdownCommand();
