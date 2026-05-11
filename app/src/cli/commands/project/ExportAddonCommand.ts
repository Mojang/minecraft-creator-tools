/**
 * ExportAddonCommand - Package project as an MCAddon
 *
 * ARCHITECTURE DOCUMENTATION
 * ==========================
 *
 * This command packages the project's behavior and resource packs
 * into an MCAddon (or MCPack) file for distribution.
 *
 * OUTPUT:
 * - .mcpack file when the project contains a single pack (BP only or RP only).
 * - .mcaddon file when the project contains BOTH a behavior pack and a
 *   resource pack (the conventional bundle for multi-pack add-ons).
 *
 * The output extension is decided by the --format option:
 *  - auto    (default) — inspect the project's manifests and pick mcpack vs mcaddon.
 *  - mcpack  — force a .mcpack extension.
 *  - mcaddon — force a .mcaddon extension.
 *
 * If the user explicitly passes --of <file.ext>, their extension is honored
 * verbatim and --format is ignored for that case.
 *
 * USAGE:
 * npx mct exportaddon -i <project-folder> -o <output-folder>
 * npx mct exportaddon -i <project-folder> -o <output-folder> --format mcaddon
 */

import { Command } from "commander";
import { ICommandMetadata, CommandBase } from "../../core/ICommand";
import { ICommandContext, ErrorCodes } from "../../core/ICommandContext";
import { TaskType } from "../../ClUtils";
import ProjectExporter from "../../../app/ProjectExporter";
import StorageUtilities from "../../../storage/StorageUtilities";
import NodeStorage from "../../../local/NodeStorage";
import { ProjectItemType } from "../../../app/IProjectItemData";
import * as path from "path";

type AddonFormat = "auto" | "mcpack" | "mcaddon";

export class ExportAddonCommand extends CommandBase {
  readonly metadata: ICommandMetadata = {
    name: "exportaddon",
    description:
      "Packages the specified project into an addon file. Produces .mcaddon when both a behavior and resource pack are present, .mcpack for single-pack projects.",
    taskType: TaskType.exportAddon,
    aliases: [],
    requiresProjects: true,
    isWriteCommand: true,
    isEditInPlace: false,
    isLongRunning: false,
    category: "Project",
  };

  configure(cmd: Command): void {
    cmd.option(
      "--format <format>",
      "Output format: 'auto' (default — picks mcaddon for BP+RP, mcpack otherwise), 'mcpack', or 'mcaddon'.",
      "auto"
    );

    cmd.addHelpText(
      "after",
      "\nExamples:\n" +
        "  $ mct exportaddon -i ./myproj -o ./out                       # auto-detect format\n" +
        "  $ mct exportaddon -i ./myproj -o ./out --format mcaddon      # force .mcaddon\n" +
        "  $ mct exportaddon -i ./myproj --of ./out/myproj.mcpack       # explicit filename\n" +
        "  $ mct exportaddon -i ./myproj -o ./out --json                # machine-readable result\n"
    );
  }

  /**
   * Decide what extension to use for the output file.
   * Priority:
   *  1. If the user passed --of, that filename's extension wins.
   *  2. Otherwise, --format mcpack or mcaddon forces that extension.
   *  3. Otherwise (--format auto), inspect manifests: BP+RP → .mcaddon, else → .mcpack.
   */
  private resolveFormat(project: import("../../../app/Project").default, formatOption: string): AddonFormat {
    const requested = (formatOption || "auto").toLowerCase() as AddonFormat;

    if (requested === "mcpack" || requested === "mcaddon") {
      return requested;
    }

    let hasBehaviorManifest = false;
    let hasResourceManifest = false;

    for (const pi of project.items) {
      if (pi.itemType === ProjectItemType.behaviorPackManifestJson) {
        hasBehaviorManifest = true;
      } else if (pi.itemType === ProjectItemType.resourcePackManifestJson) {
        hasResourceManifest = true;
      }
    }

    return hasBehaviorManifest && hasResourceManifest ? "mcaddon" : "mcpack";
  }

  async execute(context: ICommandContext): Promise<void> {
    this.logStart(context);

    if (context.projectCount === 0) {
      context.log.error("No projects to export. Use -i to specify a project folder.");
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    for (const project of context.projects) {
      try {
        await project.inferProjectItemsFromFiles();

        // Suppress the human "Packaging project:" line when in JSON mode so
        // that scripts merging stdout+stderr (or capturing only stdout via the
        // logger's data() channel) get a clean parseable result.
        if (!context.json) {
          context.log.info(`Packaging project: ${project.name}`);
        }

        if (context.dryRun) {
          if (context.json) {
            context.log.data(
              JSON.stringify({
                schemaVersion: "1.0.0",
                command: "exportaddon",
                project: project.name,
                dryRun: true,
                success: true,
              })
            );
          } else {
            context.log.info("Dry run: would export addon for project: " + project.name);
          }
          continue;
        }

        const bytes = await ProjectExporter.generateMCAddonAsZip(context.creatorTools, project, false);

        if (!bytes || !(bytes instanceof Uint8Array) || bytes.length === 0) {
          if (context.json) {
            context.log.data(
              JSON.stringify({
                schemaVersion: "1.0.0",
                command: "exportaddon",
                project: project.name,
                success: false,
                error: "Failed to generate addon package — the project may have script build errors.",
              })
            );
          } else {
            context.log.error(
              "Failed to generate addon package for project: " +
                project.name +
                ". The project may have script build errors — check messages above."
            );
          }
          context.setExitCode(ErrorCodes.VALIDATION_ERROR);
          continue;
        }

        // Determine output path: use --of if specified, otherwise auto-generate in output folder
        let folderPath: string;
        let filePath: string;
        let resolvedFormat: AddonFormat;
        let resolvedExtension: string;

        if (context.outputFile) {
          // Honor the user's exact filename and extension. Report whichever extension they used.
          const resolvedOutputFile = path.isAbsolute(context.outputFile)
            ? context.outputFile
            : path.resolve(process.cwd(), context.outputFile);
          folderPath = path.dirname(resolvedOutputFile);
          filePath = path.basename(resolvedOutputFile);
          const ext = path.extname(filePath).toLowerCase();
          if (ext === ".mcaddon") {
            resolvedFormat = "mcaddon";
            resolvedExtension = ".mcaddon";
          } else if (ext === ".mcpack") {
            resolvedFormat = "mcpack";
            resolvedExtension = ".mcpack";
          } else {
            // Unknown user-supplied extension — still report what was actually written.
            resolvedFormat = "mcpack";
            resolvedExtension = ext || ".mcpack";
          }
        } else {
          folderPath = context.outputFolder || ".";
          // Pull --format from this command's options (set in configure()).
          const formatOption = (context.commandOptions?.format as string) || "auto";
          resolvedFormat = this.resolveFormat(project, formatOption);
          resolvedExtension = resolvedFormat === "mcaddon" ? ".mcaddon" : ".mcpack";
          filePath = project.name + resolvedExtension;
        }

        const ns = new NodeStorage(folderPath, "");
        await ns.rootFolder.ensureExists();
        const file = ns.rootFolder.ensureFile(filePath);

        file.setContent(bytes);
        await ns.rootFolder.saveAll();

        if (context.json) {
          context.log.data(
            JSON.stringify({
              schemaVersion: "1.0.0",
              command: "exportaddon",
              project: project.name,
              success: true,
              outputPath: StorageUtilities.joinPath(folderPath, filePath),
              format: resolvedFormat,
              extension: resolvedExtension,
              bytes: bytes.length,
            })
          );
        } else {
          context.log.success(`Exported: ${filePath}`);
        }
      } catch (err) {
        if (context.json) {
          context.log.data(
            JSON.stringify({
              schemaVersion: "1.0.0",
              command: "exportaddon",
              success: false,
              error: err instanceof Error ? err.message : String(err),
            })
          );
        } else {
          context.log.error("Failed to export addon: " + (err instanceof Error ? err.message : String(err)));
        }
        context.setExitCode(ErrorCodes.VALIDATION_ERROR);
        continue;
      }
    }

    this.logComplete(context);
  }
}

export const exportAddonCommand = new ExportAddonCommand();
