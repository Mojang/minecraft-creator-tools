import { Command as Commander } from "commander";
import { ICommand, ICommandMetadata, CommandBase } from "../../core/ICommand";
import { ICommandContext, ILogger, ErrorCodes } from "../../core/ICommandContext";
import JsonSchemaGenerator from "../../../schema/JsonSchemaGenerator";
import FormDefinitionTypeScriptGenerator from "../../../docgen/FormDefinitionTypeScriptGenerator";
import { PACKAGE_SCHEMA_ENTRIES, IPackageSchemaEntry } from "../../../schema/PackageSchemaMapping";
import NodeStorage from "../../../local/NodeStorage";
import ClUtils, { TaskType } from "../../ClUtils";
import * as fs from "fs";
import * as path from "path";

/**
 * Generates an organized schema package from form definitions.
 *
 * Outputs schemas into bp_<folder>/rp_<folder> directories matching Minecraft
 * pack paths, with index.schema.json entry points and component schemas as
 * separate files using relative $ref.
 *
 * Usage: mct generateschemapackage [-i <inputFolder>] [-o <outputFolder>]
 */
export class GenerateSchemaPackageCommand extends CommandBase implements ICommand {
  public readonly metadata: ICommandMetadata = {
    name: "generateschemapackage",
    description: "Generate organized schema package (bp_/rp_ folders with index.schema.json entry points)",
    taskType: TaskType.generateSchemaPackage,
    aliases: ["genschemapackage", "schemapackage"],
    requiresProjects: false,
    isWriteCommand: true,
    isEditInPlace: false,
    isLongRunning: false,
    category: "Documentation",
    internal: true,
  };

  public configure(_cmd: Commander): void {
    // No additional options needed
  }

  public async execute(context: ICommandContext): Promise<void> {
    const { creatorTools, log } = context;

    if (!creatorTools) {
      log.error("Not configured correctly to generate schema package.");
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
      log.error("Could not find an output folder for schema package.");
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    await outFolder.ensureExists();

    const inputFolder = await ClUtils.getMainWorkFolder(
      TaskType.generateSchemaPackage,
      context.inputFolder,
      context.outputFolder
    );

    // Generate JSON schemas into schemas/ subfolder
    const schemasFolder = await outFolder.ensureFolderFromRelativePath("./schemas");
    const schemaGen = new JsonSchemaGenerator();
    await schemaGen.generatePackageSchemas(inputFolder, schemasFolder);

    // Generate TypeScript types into types/ subfolder
    const typesFolder = await outFolder.ensureFolderFromRelativePath("./types");
    const typeGen = new FormDefinitionTypeScriptGenerator();
    await typeGen.generatePackageTypes(inputFolder, typesFolder);

    // Copy form definitions into forms/ subfolder
    const formsOutputPath = path.join(outFolder.fullPath, "forms");
    GenerateSchemaPackageCommand._copyFormFiles(inputFolder.fullPath, formsOutputPath);
    log.info(`Copied form definitions to forms/.`);

    // Read the version from the preview version.json
    const version = GenerateSchemaPackageCommand._readPreviewVersion(inputFolder.fullPath, log);

    // Generate supporting files
    const outPath = outFolder.fullPath;
    GenerateSchemaPackageCommand._writeRootTypesIndex(outPath);
    GenerateSchemaPackageCommand._writePackageJson(outPath, version);
    GenerateSchemaPackageCommand._writeCatalog(outPath);
    GenerateSchemaPackageCommand._writeSettingsTemplate(outPath);
    GenerateSchemaPackageCommand._writeTsConfig(outPath);
    GenerateSchemaPackageCommand._writeNpmIgnore(outPath);
    log.info("Generated package.json, catalog.json, settings-template.json, tsconfig.json, .npmignore");

    log.info("Schema package generation complete.");
    return;
  }

  /**
   * Recursively copies .form.json files from source to target directory.
   */
  private static _copyFormFiles(srcDir: string, destDir: string): void {
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    const entries = fs.readdirSync(srcDir, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(srcDir, entry.name);
      const destPath = path.join(destDir, entry.name);

      if (entry.isDirectory()) {
        GenerateSchemaPackageCommand._copyFormFiles(srcPath, destPath);
      } else if (entry.isFile() && entry.name.endsWith(".form.json")) {
        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true });
        }
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  /**
   * Derives VS Code fileMatch glob patterns from a schema entry.
   */
  private static _getFileMatch(entry: IPackageSchemaEntry): string[] {
    if (!entry.packFolder) return [];

    // For index.schema.json entries, match all .json in the pack folder
    if (entry.outputFilename === "index.schema.json") {
      return [`**/${entry.packFolder}/**/*.json`];
    }

    // For named schemas (e.g., terrain_texture.schema.json), match specific filenames
    const baseName = entry.outputFilename.replace(".schema.json", "");
    return [`**/${baseName}.json`];
  }

  /**
   * Generates a root types/index.d.ts that re-exports all category barrel exports.
   */
  private static _writeRootTypesIndex(outPath: string): void {
    const typesDir = path.join(outPath, "types");
    if (!fs.existsSync(typesDir)) return;

    const typeFolders = fs
      .readdirSync(typesDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name !== "common")
      .map((d) => d.name)
      .sort();

    const lines: string[] = [
      "// Copyright (c) Microsoft Corporation.",
      "// Licensed under the MIT License.",
      "// Root barrel export for @minecraft/bedrock-schemas types.",
      "// Re-exports all category modules for convenient access.",
      "",
      "export * as common from './common';",
    ];

    for (const folder of typeFolders) {
      const indexPath = path.join(typesDir, folder, "index.d.ts");
      if (fs.existsSync(indexPath)) {
        // Convert folder name to a valid JS identifier (bp_entities → bp_entities)
        lines.push(`export * as ${folder} from './${folder}';`);
      }
    }

    lines.push("");
    fs.writeFileSync(path.join(typesDir, "index.d.ts"), lines.join("\n"));
  }

  /**
   * Generates package.json with proper `types` and `exports` fields.
   * The exports map is built from the actual type folders that were generated.
   */
  private static _writePackageJson(outPath: string, version: string): void {
    const typesDir = path.join(outPath, "types");

    const exports: Record<string, Record<string, string>> = {
      ".": { types: "./types/index.d.ts" },
      "./catalog.json": { default: "./catalog.json" },
    };

    // Recursively find all folders with index.d.ts and add them to exports
    if (fs.existsSync(typesDir)) {
      GenerateSchemaPackageCommand._findIndexFiles(typesDir, typesDir, exports);
    }

    const pkg = {
      name: "@minecraft/bedrock-schemas",
      version: version,
      description:
        "JSON Schemas and TypeScript types for Minecraft Bedrock Edition content files (entities, blocks, items, biomes, and more).",
      license: "MIT",
      types: "./types/index.d.ts",
      keywords: ["minecraft", "bedrock", "schema", "json-schema", "types", "addon", "behavior-pack", "resource-pack"],
      files: ["schemas/", "types/", "forms/", "catalog.json", "settings-template.json", "README.md", "LICENSE"],
      scripts: {
        typecheck: "tsc --noEmit",
        prepublishOnly: "npm run typecheck",
      },
      devDependencies: {
        typescript: "^5.0.0",
      },
      exports,
      repository: {
        type: "git",
        url: "https://github.com/Mojang/bedrock-schemas",
      },
      homepage: "https://learn.microsoft.com/minecraft/creator/",
    };

    fs.writeFileSync(path.join(outPath, "package.json"), JSON.stringify(pkg, null, 2) + "\n");
  }

  /**
   * Generates catalog.json — a VS Code JSON Schema catalog listing all document schemas
   * with fileMatch patterns for automatic schema association.
   */
  private static _writeCatalog(outPath: string): void {
    const schemas: Array<{
      name: string;
      description: string;
      fileMatch: string[];
      url: string;
    }> = [];

    for (const entry of PACKAGE_SCHEMA_ENTRIES) {
      const fileMatch = GenerateSchemaPackageCommand._getFileMatch(entry);
      if (fileMatch.length === 0) continue;

      schemas.push({
        name: entry.title,
        description: `Schema for ${entry.title} (${entry.packType} pack: ${entry.packFolder || "root"})`,
        fileMatch,
        url: `./schemas/${entry.outputFolder}/${entry.outputFilename}`,
      });
    }

    const catalog = {
      name: "Minecraft Bedrock Edition Schema Catalog",
      schemas,
    };

    fs.writeFileSync(path.join(outPath, "catalog.json"), JSON.stringify(catalog, null, 2) + "\n");
  }

  /**
   * Generates settings-template.json — a VS Code json.schemas settings fragment that
   * creators can copy into their .vscode/settings.json for schema auto-association.
   */
  private static _writeSettingsTemplate(outPath: string): void {
    const jsonSchemas: Array<{
      fileMatch: string[];
      url: string;
    }> = [];

    for (const entry of PACKAGE_SCHEMA_ENTRIES) {
      const fileMatch = GenerateSchemaPackageCommand._getFileMatch(entry);
      if (fileMatch.length === 0) continue;

      jsonSchemas.push({
        fileMatch,
        url: `./node_modules/@minecraft/bedrock-schemas/schemas/${entry.outputFolder}/${entry.outputFilename}`,
      });
    }

    const settings = {
      "json.schemas": jsonSchemas,
    };

    fs.writeFileSync(path.join(outPath, "settings-template.json"), JSON.stringify(settings, null, 2) + "\n");
  }

  /**
   * Generates tsconfig.json — a minimal TypeScript configuration for consumers
   * who want to use the package's .d.ts types.
   */
  private static _writeTsConfig(outPath: string): void {
    const tsconfig = {
      compilerOptions: {
        target: "ES2020",
        module: "ES2020",
        moduleResolution: "node",
        declaration: true,
        emitDeclarationOnly: true,
        strict: true,
        skipLibCheck: false,
        outDir: "./dist",
      },
      include: ["types/**/*"],
    };

    fs.writeFileSync(path.join(outPath, "tsconfig.json"), JSON.stringify(tsconfig, null, 2) + "\n");
  }

  /**
   * Generates .npmignore — excludes dev/build files from the published package.
   */
  private static _writeNpmIgnore(outPath: string): void {
    const content = [".git/", ".vscode/", "tsconfig.json", ".npmignore", "dist/", "settings-template.json", ""].join(
      "\n"
    );

    fs.writeFileSync(path.join(outPath, ".npmignore"), content);
  }

  /**
   * Recursively finds all folders containing index.d.ts and adds them to the exports map.
   */
  private static _findIndexFiles(
    baseDir: string,
    currentDir: string,
    exports: Record<string, Record<string, string>>
  ): void {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const fullPath = path.join(currentDir, entry.name);
      const indexPath = path.join(fullPath, "index.d.ts");

      if (fs.existsSync(indexPath)) {
        const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, "/");
        exports["./" + relativePath] = { types: `./types/${relativePath}/index.d.ts` };
      }

      // Recurse into subdirectories
      GenerateSchemaPackageCommand._findIndexFiles(baseDir, fullPath, exports);
    }
  }

  /**
   * Reads the latest preview version from version.json and converts it to a valid semver string.
   *
   * Minecraft versions are 4-segment (e.g., "1.26.20.21"). npm requires semver (3-segment),
   * so we convert to "major.minor.patch-beta.build" (e.g., "1.26.20-beta.21").
   *
   * The version.json is located relative to the forms input folder:
   *   input: public/data/forms/ → version: public/res/latest/van/preview/version.json
   */
  private static _readPreviewVersion(inputFormsPath: string, log: ILogger): string {
    const fallback = "0.1.0";

    // Navigate from public/data/forms/ up to public/, then down to res/latest/van/preview/version.json
    const publicDir = path.resolve(inputFormsPath, "..", "..");
    const versionJsonPath = path.join(publicDir, "res", "latest", "van", "preview", "version.json");

    if (!fs.existsSync(versionJsonPath)) {
      log.warn(`Could not find version.json at ${versionJsonPath}. Using fallback version ${fallback}.`);
      return fallback;
    }

    try {
      const versionData = JSON.parse(fs.readFileSync(versionJsonPath, "utf-8"));
      const latestVersion = versionData.latest?.version;

      if (!latestVersion || typeof latestVersion !== "string") {
        log.warn(`No "latest.version" found in version.json. Using fallback version ${fallback}.`);
        return fallback;
      }

      // Convert 4-segment Minecraft version to semver: "1.26.20.21" → "1.26.20-beta.21"
      const parts = latestVersion.split(".");
      if (parts.length === 4) {
        const semver = `${parts[0]}.${parts[1]}.${parts[2]}-beta.${parts[3]}`;
        log.info(`Using preview version: ${semver} (from ${latestVersion})`);
        return semver;
      }

      // If it's already 3 segments, use as-is
      if (parts.length === 3) {
        log.info(`Using version: ${latestVersion}`);
        return latestVersion;
      }

      log.warn(`Unexpected version format "${latestVersion}". Using fallback version ${fallback}.`);
      return fallback;
    } catch (e) {
      log.warn(`Error reading version.json: ${e instanceof Error ? e.message : String(e)}. Using fallback.`);
      return fallback;
    }
  }
}

export const generateSchemaPackageCommand = new GenerateSchemaPackageCommand();
