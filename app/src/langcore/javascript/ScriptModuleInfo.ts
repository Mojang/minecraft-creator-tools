// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ScriptModuleInfo - Minecraft Script API module information
 *
 * Contains version information, API documentation, and metadata for
 * Minecraft Script API modules.
 */

/**
 * Script module stability level
 */
export enum ModuleStability {
  Stable = "stable",
  Beta = "beta",
  Internal = "internal",
}

/**
 * Information about a script module
 */
export interface IScriptModuleInfo {
  /** Module name (e.g., "@minecraft/server") */
  name: string;
  /** Latest stable version */
  latestStableVersion: string;
  /** Latest beta version */
  latestBetaVersion: string;
  /** Minimum supported Minecraft version */
  minMinecraftVersion: string;
  /** Short description */
  description: string;
  /** Stability level */
  stability: ModuleStability;
  /** NPM package name for type definitions */
  typesPackage: string;
  /** Documentation URL */
  docsUrl: string;
}

/**
 * Known Minecraft Script API modules
 */
export const SCRIPT_MODULES: IScriptModuleInfo[] = [
  {
    name: "@minecraft/server",
    latestStableVersion: "1.17.0",
    latestBetaVersion: "1.18.0-beta",
    minMinecraftVersion: "1.20.0",
    description: "Core Minecraft server APIs for entities, blocks, dimensions, and world manipulation",
    stability: ModuleStability.Stable,
    typesPackage: "@minecraft/server",
    docsUrl: "https://learn.microsoft.com/minecraft/creator/scriptapi/minecraft/server/minecraft-server",
  },
  {
    name: "@minecraft/server-ui",
    latestStableVersion: "1.4.0",
    latestBetaVersion: "1.5.0-beta",
    minMinecraftVersion: "1.20.0",
    description: "UI APIs for creating forms, dialogs, and player interactions",
    stability: ModuleStability.Stable,
    typesPackage: "@minecraft/server-ui",
    docsUrl: "https://learn.microsoft.com/minecraft/creator/scriptapi/minecraft/server-ui/minecraft-server-ui",
  },
  {
    name: "@minecraft/server-admin",
    latestStableVersion: "1.0.0-beta",
    latestBetaVersion: "1.0.0-beta",
    minMinecraftVersion: "1.20.0",
    description: "Administrative APIs for Bedrock Dedicated Server",
    stability: ModuleStability.Beta,
    typesPackage: "@minecraft/server-admin",
    docsUrl: "https://learn.microsoft.com/minecraft/creator/scriptapi/minecraft/server-admin/minecraft-server-admin",
  },
  {
    name: "@minecraft/server-gametest",
    latestStableVersion: "1.0.0-beta",
    latestBetaVersion: "1.0.0-beta",
    minMinecraftVersion: "1.20.0",
    description: "GameTest Framework APIs for automated testing",
    stability: ModuleStability.Beta,
    typesPackage: "@minecraft/server-gametest",
    docsUrl:
      "https://learn.microsoft.com/minecraft/creator/scriptapi/minecraft/server-gametest/minecraft-server-gametest",
  },
  {
    name: "@minecraft/server-net",
    latestStableVersion: "1.0.0-beta",
    latestBetaVersion: "1.0.0-beta",
    minMinecraftVersion: "1.20.0",
    description: "Networking APIs for HTTP requests (Dedicated Server only)",
    stability: ModuleStability.Beta,
    typesPackage: "@minecraft/server-net",
    docsUrl: "https://learn.microsoft.com/minecraft/creator/scriptapi/minecraft/server-net/minecraft-server-net",
  },
  {
    name: "@minecraft/server-editor",
    latestStableVersion: "0.1.0-beta",
    latestBetaVersion: "0.1.0-beta",
    minMinecraftVersion: "1.21.0",
    description: "Editor extension APIs for Minecraft Editor",
    stability: ModuleStability.Beta,
    typesPackage: "@minecraft/server-editor",
    docsUrl: "https://learn.microsoft.com/minecraft/creator/documents/editoroverview",
  },
  {
    name: "@minecraft/vanilla-data",
    latestStableVersion: "1.20.80",
    latestBetaVersion: "1.21.40",
    minMinecraftVersion: "1.20.0",
    description: "Type definitions for vanilla Minecraft identifiers (blocks, items, entities)",
    stability: ModuleStability.Stable,
    typesPackage: "@minecraft/vanilla-data",
    docsUrl: "https://www.npmjs.com/package/@minecraft/vanilla-data",
  },
  {
    name: "@minecraft/common",
    latestStableVersion: "1.2.0",
    latestBetaVersion: "1.2.0",
    minMinecraftVersion: "1.20.0",
    description: "Common types and utilities used across Minecraft modules",
    stability: ModuleStability.Stable,
    typesPackage: "@minecraft/common",
    docsUrl: "https://learn.microsoft.com/minecraft/creator/scriptapi/minecraft/common/minecraft-common",
  },
  {
    name: "@minecraft/debug-utilities",
    latestStableVersion: "1.0.0-beta",
    latestBetaVersion: "1.0.0-beta",
    minMinecraftVersion: "1.21.0",
    description: "Debugging utilities for script development",
    stability: ModuleStability.Beta,
    typesPackage: "@minecraft/debug-utilities",
    docsUrl: "https://learn.microsoft.com/minecraft/creator/scriptapi/",
  },
];

/**
 * Utility class for script module information
 */
export class ScriptModuleInfoProvider {
  private static moduleMap: Map<string, IScriptModuleInfo> | null = null;

  /**
   * Get module map (lazy initialization)
   */
  private static getModuleMap(): Map<string, IScriptModuleInfo> {
    if (!this.moduleMap) {
      this.moduleMap = new Map();
      for (const module of SCRIPT_MODULES) {
        this.moduleMap.set(module.name, module);
      }
    }
    return this.moduleMap;
  }

  /**
   * Get info for a specific module
   */
  public static getModuleInfo(moduleName: string): IScriptModuleInfo | undefined {
    return this.getModuleMap().get(moduleName);
  }

  /**
   * Gets the latest version for a Minecraft module.
   * @param moduleName Module name (with or without @minecraft/ prefix)
   * @param preferBeta If true, returns the latest beta version; otherwise returns stable
   * @returns The version string, or undefined if module is not known
   */
  public static getLatestVersion(moduleName: string, preferBeta: boolean = true): string | undefined {
    // Normalize: add @minecraft/ prefix if not present
    const fullName = moduleName.startsWith("@minecraft/") ? moduleName : `@minecraft/${moduleName}`;
    const info = this.getModuleInfo(fullName);
    if (!info) {
      return undefined;
    }
    return preferBeta ? info.latestBetaVersion : info.latestStableVersion;
  }

  /**
   * Gets version info for a Minecraft module.
   * @param moduleName Module name (with or without @minecraft/ prefix)
   * @returns Version info object, or undefined if module is not known
   */
  public static getVersionInfo(
    moduleName: string
  ): { latestStableVersion: string; latestBetaVersion: string; minMinecraftVersion: string } | undefined {
    // Normalize: add @minecraft/ prefix if not present
    const fullName = moduleName.startsWith("@minecraft/") ? moduleName : `@minecraft/${moduleName}`;
    const info = this.getModuleInfo(fullName);
    if (!info) {
      return undefined;
    }
    return {
      latestStableVersion: info.latestStableVersion,
      latestBetaVersion: info.latestBetaVersion,
      minMinecraftVersion: info.minMinecraftVersion,
    };
  }

  /**
   * Get all module names
   */
  public static getAllModuleNames(): string[] {
    return SCRIPT_MODULES.map((m) => m.name);
  }

  /**
   * Check if a module name is a valid Minecraft module
   */
  public static isMinecraftModule(moduleName: string): boolean {
    return this.getModuleMap().has(moduleName);
  }

  /**
   * Parse a module version from package.json dependency
   */
  public static parseModuleVersion(versionSpec: string): { version: string; isBeta: boolean } {
    // Handle version specs like "^1.0.0", "~1.0.0", "1.0.0-beta", etc.
    const cleanVersion = versionSpec.replace(/^[\^~>=<]+/, "").trim();
    const isBeta = cleanVersion.includes("beta") || cleanVersion.includes("alpha");

    return { version: cleanVersion, isBeta };
  }

  /**
   * Check if a module version is outdated
   */
  public static isVersionOutdated(
    moduleName: string,
    currentVersion: string
  ): { isOutdated: boolean; latestVersion: string; isBetaAvailable: boolean } {
    const info = this.getModuleInfo(moduleName);
    if (!info) {
      return { isOutdated: false, latestVersion: currentVersion, isBetaAvailable: false };
    }

    const { version, isBeta } = this.parseModuleVersion(currentVersion);
    const targetVersion = isBeta ? info.latestBetaVersion : info.latestStableVersion;

    // Simple version comparison (works for semver)
    const isOutdated = this.compareVersions(version, targetVersion) < 0;
    const isBetaAvailable = this.compareVersions(info.latestStableVersion, info.latestBetaVersion) < 0;

    return {
      isOutdated,
      latestVersion: targetVersion,
      isBetaAvailable,
    };
  }

  /**
   * Compare two semver versions
   * Returns: -1 if a < b, 0 if a == b, 1 if a > b
   */
  public static compareVersions(a: string, b: string): number {
    // Strip beta/alpha suffixes for comparison
    const cleanA = a.replace(/-.*$/, "");
    const cleanB = b.replace(/-.*$/, "");

    const partsA = cleanA.split(".").map((n) => parseInt(n, 10) || 0);
    const partsB = cleanB.split(".").map((n) => parseInt(n, 10) || 0);

    for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
      const numA = partsA[i] || 0;
      const numB = partsB[i] || 0;

      if (numA < numB) return -1;
      if (numA > numB) return 1;
    }

    // If base versions are equal, non-beta > beta
    const isBetaA = a.includes("beta") || a.includes("alpha");
    const isBetaB = b.includes("beta") || b.includes("alpha");

    if (isBetaA && !isBetaB) return -1;
    if (!isBetaA && isBetaB) return 1;

    return 0;
  }

  /**
   * Get recommended dependency entries for manifest.json
   */
  public static getRecommendedDependency(
    moduleName: string,
    useBeta: boolean = false
  ): { module_name: string; version: string } | null {
    const info = this.getModuleInfo(moduleName);
    if (!info) {
      return null;
    }

    return {
      module_name: moduleName,
      version: useBeta ? info.latestBetaVersion : info.latestStableVersion,
    };
  }
}

/**
 * Common Script API types that need special handling
 */
export const COMMON_SCRIPT_TYPES = {
  // Core types
  world: {
    module: "@minecraft/server",
    description: "The global World object - access to dimensions, players, and world state",
  },
  system: {
    module: "@minecraft/server",
    description: "The System object - timing, events, and script lifecycle",
  },
  Entity: {
    module: "@minecraft/server",
    description: "Base class for all entities (players, mobs, items)",
  },
  Player: {
    module: "@minecraft/server",
    description: "Represents a player in the world",
  },
  Block: {
    module: "@minecraft/server",
    description: "Represents a block in the world",
  },
  Dimension: {
    module: "@minecraft/server",
    description: "Represents a dimension (overworld, nether, end)",
  },
  ItemStack: {
    module: "@minecraft/server",
    description: "Represents an item stack",
  },
  Vector3: {
    module: "@minecraft/server",
    description: "3D vector with x, y, z coordinates",
  },

  // UI types
  ActionFormData: {
    module: "@minecraft/server-ui",
    description: "Button-based form for player selection",
  },
  MessageFormData: {
    module: "@minecraft/server-ui",
    description: "Simple message with two buttons",
  },
  ModalFormData: {
    module: "@minecraft/server-ui",
    description: "Complex form with multiple input types",
  },
};
