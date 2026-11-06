import { Command as Commander } from "commander";
import { ICommand, ICommandMetadata, CommandBase } from "../../core/ICommand";
import { ICommandContext, ErrorCodes } from "../../core/ICommandContext";
import { TaskType } from "../../ClUtils";
import { IBlockVolume } from "../../../minecraft/IBlockVolume";
import Structure from "../../../minecraft/Structure";
import StructureUtilities from "../../../minecraft/StructureUtilities";
import StructureProgramRunner from "../../../minecraft/structureProgram/StructureProgramRunner";
import * as fs from "fs";
import * as path from "path";

const PROGRAM_EXTENSIONS = [".js", ".mjs", ".cjs"];

/**
 * Build an .mcstructure file from an IBlockVolume JSON, or from a structure
 * program (a JavaScript `build(api)` function; see StructureProgramRunner).
 *
 * Usage:
 *   mct buildstructure <inputPath> [outputPath] [--overwrite]
 *   mct buildstructure <program.js> [outputPath] [--program-seed <n>] [--base <existing.mcstructure>]
 *
 * Program mode is used when the input ends in .js/.mjs/.cjs or --program is
 * set (needed for stdin). With --base the program edits that structure.
 *
 * NOTE: This command uses positional arguments (not -i/-o) because the global
 * -i/--input-folder flag is processed by the framework as a project folder.
 * Using positional args avoids that conflict.
 */
export class BuildStructureCommand extends CommandBase implements ICommand {
  public readonly metadata: ICommandMetadata = {
    name: "buildstructure",
    description: "Build an .mcstructure file from IBlockVolume JSON or a structure program (JavaScript)",
    taskType: TaskType.buildStructure,
    aliases: ["buildstruct"],
    requiresProjects: false,
    isWriteCommand: true,
    isEditInPlace: false,
    isLongRunning: false,
    category: "Render",
    globalOptionGroups: ["force"],
    arguments: [
      {
        name: "inputPath",
        description: "Path to an IBlockVolume JSON file or a structure program (.js), or '-' to read from stdin",
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
      .option("--isolated", "Use isolated mode for preview (skip vanilla resources)")
      .option("--program", "Treat the input as a structure program (implied for .js/.mjs/.cjs input)")
      .option("--program-seed <seed>", "Seed for api.random/api.pick in a structure program")
      .option("--base <path>", "Existing .mcstructure for a structure program to edit");
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
    const options = (context.commandOptions ?? {}) as Record<string, unknown>;
    const overwrite = context.force || Boolean(options.overwrite);

    if (!inputPath) {
      this._logUsage(context);
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    const isProgram = Boolean(options.program) || PROGRAM_EXTENSIONS.includes(path.extname(inputPath).toLowerCase());

    if (!isProgram && (options.base !== undefined || options.programSeed !== undefined)) {
      log.error("--base and --program-seed only apply to structure programs. Use a .js input or add --program.");
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    let content: string;
    if (inputPath === "-") {
      log.info(`Reading ${isProgram ? "structure program" : "IBlockVolume JSON"} from stdin...`);
      const chunks: Buffer[] = [];
      for await (const chunk of process.stdin) {
        chunks.push(chunk);
      }
      content = Buffer.concat(chunks).toString("utf-8");
    } else {
      const absoluteInputPath = this._absolute(inputPath);
      if (!fs.existsSync(absoluteInputPath)) {
        log.error(`Input file not found: ${absoluteInputPath}`);
        context.setExitCode(ErrorCodes.INIT_ERROR);
        return;
      }
      content = fs.readFileSync(absoluteInputPath, "utf-8");
      log.info(`Read ${isProgram ? "structure program" : "IBlockVolume JSON"} from: ${absoluteInputPath}`);
    }

    let effectiveOutputPath = outputPath;
    if (!effectiveOutputPath) {
      if (inputPath === "-") {
        effectiveOutputPath = "output.mcstructure";
      } else {
        const baseName = path.basename(inputPath, path.extname(inputPath));
        effectiveOutputPath = baseName + ".mcstructure";
      }
    }

    const absoluteOutputPath = this._absolute(effectiveOutputPath);
    if (!overwrite && fs.existsSync(absoluteOutputPath)) {
      log.error(`Output file already exists: ${absoluteOutputPath}`);
      log.error("Use --overwrite to replace it.");
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    const structure = isProgram
      ? await this._structureFromProgram(context, content, options)
      : this._structureFromBlockVolume(context, content);

    if (!structure) {
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    const structureBytes = structure.getMCStructureBytes();

    if (!structureBytes) {
      log.error("Failed to generate MCStructure bytes");
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    const outputDir = path.dirname(absoluteOutputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(absoluteOutputPath, Buffer.from(structureBytes));
    log.info(`Wrote .mcstructure file to: ${absoluteOutputPath}`);

    log.info("Done.");
  }

  private _structureFromBlockVolume(context: ICommandContext, jsonContent: string): Structure | undefined {
    const { log } = context;

    let blockVolume: IBlockVolume;
    try {
      blockVolume = JSON.parse(jsonContent);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      log.error("Failed to parse JSON: " + message);
      return undefined;
    }

    if (!blockVolume.blockLayersBottomToTop || !blockVolume.key) {
      log.error("Error: IBlockVolume must have 'blockLayersBottomToTop' and 'key' properties");
      return undefined;
    }

    if (!blockVolume.southWestBottom) {
      log.error("Error: IBlockVolume must have 'southWestBottom' property");
      return undefined;
    }

    const effectiveSize = StructureUtilities.getEffectiveSize(blockVolume);
    log.info(`Structure size: ${effectiveSize.x} x ${effectiveSize.y} x ${effectiveSize.z}`);

    return StructureUtilities.createStructureFromIBlockVolume(blockVolume);
  }

  private async _structureFromProgram(
    context: ICommandContext,
    code: string,
    options: Record<string, unknown>
  ): Promise<Structure | undefined> {
    const { log } = context;

    let seed: number | undefined;
    if (options.programSeed !== undefined) {
      seed = Number(options.programSeed);
      if (!Number.isInteger(seed)) {
        log.error(`--program-seed must be an integer, got '${options.programSeed}'.`);
        return undefined;
      }
    }

    let base: Structure | undefined;
    if (typeof options.base === "string") {
      const basePath = this._absolute(options.base);
      if (!fs.existsSync(basePath)) {
        log.error(`Base structure not found: ${basePath}`);
        return undefined;
      }
      base = new Structure();
      try {
        await base.loadFromNbtBytes(new Uint8Array(fs.readFileSync(basePath)));
      } catch (e: unknown) {
        log.error(`Could not read base structure ${basePath}: ${e instanceof Error ? e.message : e}`);
        return undefined;
      }
      log.info(`Editing base structure: ${basePath}`);
    }

    const result = await StructureProgramRunner.run({ code, seed, base });

    for (const line of result.logs) {
      log.info(`[program] ${line}`);
    }

    if (result.ok === false) {
      log.error(StructureProgramRunner.describeFailure(result));
      return undefined;
    }

    const { realized } = result;
    log.info(
      `Structure size: ${realized.sizeX} x ${realized.sizeY} x ${realized.sizeZ} ` +
        `(${realized.blockCount} blocks, ${realized.airCount} air cells, seed ${result.seed})`
    );
    for (const warning of result.warnings) {
      log.warn(warning);
    }

    return realized.structure;
  }

  private _absolute(p: string): string {
    return path.isAbsolute(p) ? p : path.join(process.cwd(), p);
  }

  private _logUsage(context: ICommandContext): void {
    const { log } = context;
    log.error("Usage: mct buildstructure <inputPath> [outputPath] [--overwrite]");
    log.error("");
    log.error("Arguments:");
    log.error("  inputPath    IBlockVolume JSON file or structure program (.js), or '-' to read from stdin");
    log.error("  outputPath   Path to save the .mcstructure file (default: derived from input name)");
    log.error("");
    log.error("Options:");
    log.error("  --overwrite            Overwrite existing files without prompting");
    log.error("  --program              Treat the input as a structure program (implied for .js input)");
    log.error("  --program-seed <seed>  Seed for api.random/api.pick in a structure program");
    log.error("  --base <path>          Existing .mcstructure for a structure program to edit");
    log.error("  --preview <path>       Also render a PNG preview image");
    log.error("  --isolated             Use isolated mode for preview (skip vanilla resources)");
    log.error("");
    log.error("Example structure program (tower.js):");
    log.error(`  function build(api) {
    api.declareSize(7, 9, 7);
    api.fill(0, 0, 0, 6, 0, 6, "cobblestone");
    api.walls(0, 1, 0, 6, 7, 6, "stone_bricks");
    api.clear(3, 1, 0, 3, 2, 0);
    api.set(3, 4, 3, "lantern");
  }`);
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
  }
}

export const buildStructureCommand = new BuildStructureCommand();
