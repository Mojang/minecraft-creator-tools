import { Command as Commander } from "commander";
import { ICommand, ICommandMetadata, CommandBase } from "../../core/ICommand";
import { ICommandContext, ErrorCodes } from "../../core/ICommandContext";
import { TaskType } from "../../ClUtils";
import { IBlockVolume } from "../../../minecraft/IBlockVolume";
import StructureUtilities from "../../../minecraft/StructureUtilities";
import * as fs from "fs";
import * as path from "path";

/**
 * Build an .mcstructure file from an IBlockVolume JSON.
 * Optionally render a preview PNG image.
 *
 * Usage: mct buildstructure <inputPath> <outputPath> [--preview <previewPath>] [--overwrite]
 *
 * NOTE: This command uses positional arguments (not -i/-o) because the global
 * -i/--input-folder flag is processed by the framework as a project folder.
 * Using positional args avoids that conflict.
 */
export class BuildStructureCommand extends CommandBase implements ICommand {
  public readonly metadata: ICommandMetadata = {
    name: "buildstructure",
    description: "Build an .mcstructure file from IBlockVolume JSON",
    taskType: TaskType.buildStructure,
    aliases: ["buildstruct"],
    requiresProjects: false,
    isWriteCommand: true,
    isEditInPlace: false,
    isLongRunning: false,
    category: "Render",
    arguments: [
      {
        name: "inputPath",
        description: "Path to IBlockVolume JSON file, or '-' to read from stdin",
        required: true,
        contextField: "mode",
      },
      {
        name: "outputPath",
        description: "Path to save the .mcstructure file",
        required: false,
        contextField: "newName",
      },
    ],
  };

  public configure(cmd: Commander): void {
    // Add command-specific options (the command itself is created by CommandRegistry)
    cmd
      .option("--preview <path>", "Also render a PNG preview image to the specified path")
      .option("--overwrite", "Overwrite existing files without prompting")
      .option("--isolated", "Use isolated mode for preview (skip vanilla resources)");
  }

  public async execute(context: ICommandContext): Promise<void> {
    const { creatorTools, localEnv, log } = context;

    if (!creatorTools || !localEnv) {
      log.error("Not properly configured.");
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    const inputPath = context.mode;
    const outputPath = context.newName;
    const overwrite = context.force;

    if (!inputPath) {
      log.error("Usage: mct buildstructure <inputPath> [outputPath] [--overwrite]");
      log.error("");
      log.error("Arguments:");
      log.error("  inputPath    Path to IBlockVolume JSON file, or '-' to read from stdin");
      log.error("  outputPath   Path to save the .mcstructure file (default: derived from input name)");
      log.error("");
      log.error("Options:");
      log.error("  --overwrite     Overwrite existing files without prompting");
      log.error("  --preview <path>  Also render a PNG preview image");
      log.error("  --isolated      Use isolated mode for preview (skip vanilla resources)");
      log.error("");
      log.error("Example IBlockVolume JSON:");
      log.error(`  {
    "southWestBottom": { "x": 0, "y": 64, "z": 0 },
    "blockLayersBottomToTop": [
      ["sss", "s s", "sss"],
      ["s s", "   ", "s s"],
      ["sss", "s s", "sss"]
    ],
    "key": {
      "s": { "typeId": "minecraft:stone" }
    }
  }`);
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    // Read the input JSON
    let jsonContent: string;
    if (inputPath === "-") {
      // Read from stdin
      log.info("Reading IBlockVolume JSON from stdin...");
      const chunks: Buffer[] = [];
      for await (const chunk of process.stdin) {
        chunks.push(chunk);
      }
      jsonContent = Buffer.concat(chunks).toString("utf-8");
    } else {
      // Read from file
      const absoluteInputPath = path.isAbsolute(inputPath) ? inputPath : path.join(process.cwd(), inputPath);
      if (!fs.existsSync(absoluteInputPath)) {
        log.error(`Input file not found: ${absoluteInputPath}`);
        context.setExitCode(ErrorCodes.INIT_ERROR);
        return;
      }
      jsonContent = fs.readFileSync(absoluteInputPath, "utf-8");
      log.info(`Read IBlockVolume JSON from: ${absoluteInputPath}`);
    }

    // Parse the JSON
    let blockVolume: IBlockVolume;
    try {
      blockVolume = JSON.parse(jsonContent);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      log.error("Failed to parse JSON: " + message);
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    // Validate required fields
    if (!blockVolume.blockLayersBottomToTop || !blockVolume.key) {
      log.error("Error: IBlockVolume must have 'blockLayersBottomToTop' and 'key' properties");
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    if (!blockVolume.southWestBottom) {
      log.error("Error: IBlockVolume must have 'southWestBottom' property");
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    // Get effective size (inferred if not specified)
    const effectiveSize = StructureUtilities.getEffectiveSize(blockVolume);
    log.info(`Structure size: ${effectiveSize.x} x ${effectiveSize.y} x ${effectiveSize.z}`);

    // Derive output path if not specified
    let effectiveOutputPath = outputPath;
    if (!effectiveOutputPath) {
      if (inputPath === "-") {
        effectiveOutputPath = "output.mcstructure";
      } else {
        const baseName = path.basename(inputPath, path.extname(inputPath));
        effectiveOutputPath = baseName + ".mcstructure";
      }
    }

    // Check for existing output file
    const absoluteOutputPath = path.isAbsolute(effectiveOutputPath)
      ? effectiveOutputPath
      : path.join(process.cwd(), effectiveOutputPath);
    if (!overwrite && fs.existsSync(absoluteOutputPath)) {
      log.error(`Output file already exists: ${absoluteOutputPath}`);
      log.error("Use --overwrite to replace it.");
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    // Convert to Structure and generate MCStructure bytes
    const structure = StructureUtilities.createStructureFromIBlockVolume(blockVolume);
    const structureBytes = structure.getMCStructureBytes();

    if (!structureBytes) {
      log.error("Failed to generate MCStructure bytes from block volume");
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    // Write the .mcstructure file
    const outputDir = path.dirname(absoluteOutputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(absoluteOutputPath, Buffer.from(structureBytes));
    log.info(`Wrote .mcstructure file to: ${absoluteOutputPath}`);

    log.info("Done.");
    return;
  }
}

export const buildStructureCommand = new BuildStructureCommand();
