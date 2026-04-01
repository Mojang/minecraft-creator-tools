import Utilities from "../core/Utilities";
import IFile from "./IFile";
import IFolder from "./IFolder";
import StorageUtilities from "./StorageUtilities";
import { RegExpMatcher, englishDataset, englishRecommendedTransformers } from "obscenity";

/**
 * Maximum number of files allowed in shared content
 */
export const MAX_SHARED_FILES = 100;

/**
 * Maximum total size of shared content in bytes (1MB)
 */
export const MAX_SHARED_TOTAL_SIZE = 1024 * 1024;

/**
 * Allowed path patterns for shareable content.
 * Only files within these paths can be shared.
 */
export const ALLOWED_SHARE_PATHS: RegExp[] = [
  /^\/scripts\//i, // Scripts folder
  /^\/behavior_packs?\//i, // Behavior packs
  /^\/resource_packs?\//i, // Resource packs
  /^\/texts\//i, // Localization
  /^\/functions\//i, // mcfunction files folder
  /^\/items\//i, // Items folder
  /^\/entities\//i, // Entities folder
  /^\/blocks\//i, // Blocks folder
  /^\/recipes\//i, // Recipes folder
  /^\/loot_tables\//i, // Loot tables
  /^\/trading\//i, // Trading tables
  /^\/spawn_rules\//i, // Spawn rules
  /^\/animations?\//i, // Animations
  /^\/animation_controllers?\//i, // Animation controllers
  /^\/models?\//i, // Models (geometry)
  /^\/render_controllers?\//i, // Render controllers
  /^\/attachables?\//i, // Attachables
  /^\/biomes?\//i, // Biomes
  /^\/features?\//i, // Features
  /^\/feature_rules?\//i, // Feature rules
  /^\/structures?\//i, // Structures
];

/**
 * Dangerous code patterns that should not be allowed in shared TypeScript/JavaScript files.
 * These patterns could enable code execution, file system access, or other security risks.
 */
export const DANGEROUS_CODE_PATTERNS: { pattern: RegExp; description: string }[] = [
  { pattern: /import\s+.*from\s+['"]child_process['"]/i, description: "child_process import" },
  { pattern: /require\s*\(\s*['"]child_process['"]\s*\)/i, description: "child_process require" },
  { pattern: /import\s+.*from\s+['"]fs['"]/i, description: "fs module import" },
  { pattern: /require\s*\(\s*['"]fs['"]\s*\)/i, description: "fs module require" },
  { pattern: /import\s+.*from\s+['"]path['"]/i, description: "path module import" },
  { pattern: /require\s*\(\s*['"]path['"]\s*\)/i, description: "path module require" },
  { pattern: /import\s+.*from\s+['"]os['"]/i, description: "os module import" },
  { pattern: /require\s*\(\s*['"]os['"]\s*\)/i, description: "os module require" },
  { pattern: /import\s+.*from\s+['"]net['"]/i, description: "net module import" },
  { pattern: /require\s*\(\s*['"]net['"]\s*\)/i, description: "net module require" },
  { pattern: /import\s+.*from\s+['"]dgram['"]/i, description: "dgram module import" },
  { pattern: /require\s*\(\s*['"]dgram['"]\s*\)/i, description: "dgram module require" },
  { pattern: /import\s+.*from\s+['"]cluster['"]/i, description: "cluster module import" },
  { pattern: /require\s*\(\s*['"]cluster['"]\s*\)/i, description: "cluster module require" },
  { pattern: /import\s+.*from\s+['"]vm['"]/i, description: "vm module import" },
  { pattern: /require\s*\(\s*['"]vm['"]\s*\)/i, description: "vm module require" },
  { pattern: /import\s+.*from\s+['"]worker_threads['"]/i, description: "worker_threads module import" },
  { pattern: /require\s*\(\s*['"]worker_threads['"]\s*\)/i, description: "worker_threads module require" },
  { pattern: /\beval\s*\(/i, description: "eval() call" },
  { pattern: /\bFunction\s*\(\s*['"`]/i, description: "Function constructor with string" },
  { pattern: /\bexec\s*\(/i, description: "exec() call" },
  { pattern: /\bexecSync\s*\(/i, description: "execSync() call" },
  { pattern: /\bspawn\s*\(/i, description: "spawn() call" },
  { pattern: /\bspawnSync\s*\(/i, description: "spawnSync() call" },
  { pattern: /\bfork\s*\(/i, description: "fork() call" },
  { pattern: /process\.exit/i, description: "process.exit call" },
  { pattern: /process\.env/i, description: "process.env access" },
  { pattern: /process\.cwd/i, description: "process.cwd access" },
  { pattern: /__dirname/i, description: "__dirname access" },
  { pattern: /__filename/i, description: "__filename access" },
  { pattern: /import\s*\(\s*[^)]*\+/i, description: "dynamic import with concatenation" },
  { pattern: /require\s*\(\s*[^)]*\+/i, description: "dynamic require with concatenation" },
  { pattern: /globalThis\s*\[/i, description: "globalThis bracket access" },
  { pattern: /global\s*\[/i, description: "global bracket access" },
  { pattern: /window\s*\[/i, description: "window bracket access" },
];

export class BasicValidators {
  private static contentMatcher: RegExpMatcher | undefined = undefined;

  /**
   * Checks if a file's content contains dangerous code patterns that could pose security risks.
   * This is used to validate shared TypeScript/JavaScript files.
   * @param content The file content to check
   * @returns An object with isUnsafe boolean and matched patterns, or undefined if safe
   */
  public static hasUnsafeCodePatterns(content: string): { isUnsafe: boolean; matches: string[] } | undefined {
    if (!content || typeof content !== "string") {
      return undefined;
    }

    const matches: string[] = [];

    for (const { pattern, description } of DANGEROUS_CODE_PATTERNS) {
      if (pattern.test(content)) {
        matches.push(description);
      }
    }

    if (matches.length > 0) {
      return { isUnsafe: true, matches };
    }

    return undefined;
  }

  /**
   * Validates if a file path is within the allowed shareable paths.
   * @param filePath The storage-relative path to validate
   * @returns true if the path is allowed for sharing, false otherwise
   */
  public static isPathAllowedForSharing(filePath: string): boolean {
    if (!filePath) {
      return false;
    }

    // Normalize path
    const normalizedPath = filePath.replace(/\\/g, "/");

    // Check against allowed patterns
    return ALLOWED_SHARE_PATHS.some((pattern) => pattern.test(normalizedPath));
  }

  static async isFolderSharingValid(
    folder: IFolder,
    isChildFolder?: boolean,
    stats?: { fileCount: number; totalSize: number }
  ): Promise<string | undefined> {
    // Initialize stats on first call
    if (!stats) {
      stats = { fileCount: 0, totalSize: 0 };
    }

    if (!this.isFolderNameOKForSharing(folder.name)) {
      return folder.name + " is an unsupported folder name.";
    }

    if (!folder.isLoaded) {
      await folder.load();
    }

    if (!isChildFolder && folder.fileCount > 0) {
      return "Folder that contains files at the root.";
    }

    for (const childFileName in folder.files) {
      const childFile = folder.files[childFileName];

      if (childFile) {
        // Check file count limit
        stats.fileCount++;
        if (stats.fileCount > MAX_SHARED_FILES) {
          return `Too many files in shared content (limit: ${MAX_SHARED_FILES}).`;
        }

        const result = this.isFileNameOKForSharing(childFile.name);

        if (!result) {
          return childFile.name + " is an unsupported file name.";
        }

        // Load content to check for strong language and unsafe patterns
        if (!childFile.isContentLoaded) {
          await childFile.loadContent();
        }

        // Check total size
        if (childFile.content && typeof childFile.content === "string") {
          stats.totalSize += childFile.content.length;
          if (stats.totalSize > MAX_SHARED_TOTAL_SIZE) {
            return `Total shared content size exceeds limit (${MAX_SHARED_TOTAL_SIZE} bytes).`;
          }
        }

        const res = await this.hasStrongLanguageContent(childFile);

        if (res) {
          return childFile.name + " has unsupported content.";
        }

        // Check for unsafe code patterns in TypeScript/JavaScript files
        const ext = StorageUtilities.getTypeFromName(childFile.name);
        if (ext === "ts" || ext === "js") {
          if (childFile.content && typeof childFile.content === "string") {
            const unsafeResult = this.hasUnsafeCodePatterns(childFile.content);
            if (unsafeResult && unsafeResult.isUnsafe) {
              return `${childFile.name} contains potentially unsafe code patterns: ${unsafeResult.matches.join(", ")}.`;
            }
          }
        }
      }
    }

    for (const childFolderName in folder.folders) {
      const childFolder = folder.folders[childFolderName];

      if (childFolder) {
        const result = await this.isFolderSharingValid(childFolder, true, stats);

        if (result) {
          return result;
        }
      }
    }

    return undefined;
  }

  public static isFileNameOKForSharing(fileName: string) {
    fileName = fileName.toLowerCase();

    const ext = StorageUtilities.getTypeFromName(fileName);

    if (ext !== "ts" && ext !== "json" && ext !== "lang") {
      return false;
    }

    if (
      fileName.startsWith(".") ||
      fileName.startsWith("just.config") ||
      fileName.endsWith(".config.ts") ||
      fileName.endsWith(".config.js") ||
      (fileName.startsWith("manifest") && fileName.endsWith("json")) ||
      (fileName.startsWith("package") && fileName.endsWith("json"))
    ) {
      return false;
    }

    if (!Utilities.isUsableAsObjectKey(fileName)) {
      return false;
    }

    return true;
  }

  public static isFolderNameOKForSharing(folderName: string) {
    if (
      folderName.startsWith(".") ||
      folderName === "lib" ||
      folderName === "node_modules" ||
      folderName === ".git" ||
      folderName === "dist" ||
      folderName === "build"
    ) {
      return false;
    }

    return true;
  }

  public static async hasStrongLanguageContent(file: IFile) {
    if (!file.isContentLoaded) {
      await file.loadContent();
    }

    if (file.isBinary) {
      return undefined;
    }

    const str = file.content;

    if (!str) {
      return undefined;
    }

    if (typeof str !== "string") {
      return undefined;
    }

    if (str.length < 1) {
      return undefined;
    }

    const content = str.toLowerCase();

    if (this.contentMatcher === undefined) {
      this.contentMatcher = new RegExpMatcher({
        ...englishDataset.build(),
        ...englishRecommendedTransformers,
      });
    }

    if (this.contentMatcher.hasMatch(content)) {
      const matches = this.contentMatcher.getAllMatches(content);
      let strMatches: string[] = [];
      const strMatchesSet = new Set<string>();

      for (let i = 0; i < matches.length && i < 100; i++) {
        const match = matches[i];

        if (match) {
          const result = content.substring(match.startIndex, match.endIndex + 1);

          if (!strMatchesSet.has(result)) {
            strMatches.push(result);
            strMatchesSet.add(result);
          }
        }
      }

      return strMatches.join(", ");
    }

    return undefined;
  }
}
