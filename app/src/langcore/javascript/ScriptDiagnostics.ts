// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ScriptDiagnostics - Diagnostics for Minecraft scripts
 *
 * Provides diagnostics for common issues in Minecraft Script API usage.
 */

import { DiagnosticSeverity, IDiagnostic, IDiagnosticFix } from "../json/JsonDiagnostics";
import { ScriptModuleInfoProvider } from "./ScriptModuleInfo";

/**
 * Generate script-specific diagnostics
 */
export class ScriptDiagnosticGenerator {
  /**
   * Generate diagnostic for outdated module version
   */
  public generateOutdatedModuleDiagnostic(
    moduleName: string,
    currentVersion: string,
    line: number,
    startColumn: number,
    endColumn: number
  ): { diagnostic: IDiagnostic; fix: IDiagnosticFix } | null {
    const versionCheck = ScriptModuleInfoProvider.isVersionOutdated(moduleName, currentVersion);

    if (!versionCheck.isOutdated) {
      return null;
    }

    const diagnostic: IDiagnostic = {
      startLine: line,
      startColumn,
      endLine: line,
      endColumn,
      message: `Module "${moduleName}" version "${currentVersion}" is outdated. Latest: "${versionCheck.latestVersion}"`,
      severity: DiagnosticSeverity.Warning,
      source: "MCTools",
      code: "OUTDATED_MODULE_VERSION",
      generatorId: "SCRIPT_MODULE",
    };

    const fix: IDiagnosticFix = {
      title: `Update ${moduleName} to ${versionCheck.latestVersion}`,
      isPreferred: true,
      edits: [
        {
          startLine: line,
          startColumn,
          endLine: line,
          endColumn,
          newText: versionCheck.latestVersion,
        },
      ],
    };

    return { diagnostic, fix };
  }

  /**
   * Generate diagnostic for unknown module
   */
  public generateUnknownModuleDiagnostic(
    moduleName: string,
    line: number,
    startColumn: number,
    endColumn: number
  ): IDiagnostic | null {
    // Only warn about @minecraft/ modules
    if (!moduleName.startsWith("@minecraft/")) {
      return null;
    }

    if (ScriptModuleInfoProvider.isMinecraftModule(moduleName)) {
      return null;
    }

    return {
      startLine: line,
      startColumn,
      endLine: line,
      endColumn,
      message: `Unknown Minecraft module "${moduleName}". Did you mean one of: ${ScriptModuleInfoProvider.getAllModuleNames()
        .slice(0, 3)
        .join(", ")}?`,
      severity: DiagnosticSeverity.Error,
      source: "MCTools",
      code: "UNKNOWN_MODULE",
    };
  }

  /**
   * Generate diagnostic for deprecated API usage
   */
  public generateDeprecatedApiDiagnostic(
    apiName: string,
    replacement: string | undefined,
    line: number,
    startColumn: number,
    endColumn: number
  ): IDiagnostic {
    let message = `"${apiName}" is deprecated`;
    if (replacement) {
      message += `. Use "${replacement}" instead`;
    }

    return {
      startLine: line,
      startColumn,
      endLine: line,
      endColumn,
      message,
      severity: DiagnosticSeverity.Warning,
      source: "MCTools",
      code: "DEPRECATED_API",
    };
  }

  /**
   * Generate diagnostic for beta API used without beta flag
   */
  public generateBetaApiDiagnostic(apiName: string, line: number, startColumn: number, endColumn: number): IDiagnostic {
    return {
      startLine: line,
      startColumn,
      endLine: line,
      endColumn,
      message: `"${apiName}" requires @minecraft/server-beta or beta modules. Ensure dependencies are properly configured.`,
      severity: DiagnosticSeverity.Information,
      source: "MCTools",
      code: "BETA_API_USAGE",
    };
  }

  /**
   * Generate diagnostic for common mistakes
   */
  public generateCommonMistakeDiagnostic(
    mistakeType: "sync-in-before-event" | "missing-await" | "world-in-import",
    line: number,
    startColumn: number,
    endColumn: number
  ): IDiagnostic {
    const mistakes: { [key: string]: { message: string; severity: DiagnosticSeverity } } = {
      "sync-in-before-event": {
        message:
          "Modifying world state synchronously in a beforeEvent may cause issues. Consider using system.run() for deferred execution.",
        severity: DiagnosticSeverity.Warning,
      },
      "missing-await": {
        message: "This async function call is missing 'await'. The promise result will be ignored.",
        severity: DiagnosticSeverity.Warning,
      },
      "world-in-import": {
        message: "Accessing 'world' at module load time may fail. Move this to a function or event handler.",
        severity: DiagnosticSeverity.Error,
      },
    };

    const mistake = mistakes[mistakeType];

    return {
      startLine: line,
      startColumn,
      endLine: line,
      endColumn,
      message: mistake.message,
      severity: mistake.severity,
      source: "MCTools",
      code: `COMMON_MISTAKE_${mistakeType.toUpperCase().replace(/-/g, "_")}`,
    };
  }

  /**
   * Detect common patterns that indicate potential issues
   */
  public analyzeScriptPatterns(
    content: string
  ): Array<{ type: string; line: number; column: number; endColumn: number }> {
    const issues: Array<{ type: string; line: number; column: number; endColumn: number }> = [];
    const lines = content.split("\n");

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];

      // Check for world access at top level (outside functions)
      // This is a simplified check - real implementation would use AST
      if (lineNum < 20 && !line.trim().startsWith("//") && !line.trim().startsWith("*")) {
        const worldMatch = line.match(/^(const|let|var)\s+\w+\s*=\s*world\./);
        if (worldMatch) {
          issues.push({
            type: "world-in-import",
            line: lineNum + 1,
            column: worldMatch.index! + 1,
            endColumn: worldMatch.index! + worldMatch[0].length + 1,
          });
        }
      }

      // Check for common async issues with forms
      if (line.includes(".show(") && !line.includes("await") && !line.includes(".then(")) {
        const showMatch = line.match(/\.show\s*\(/);
        if (showMatch) {
          issues.push({
            type: "missing-await",
            line: lineNum + 1,
            column: showMatch.index! + 1,
            endColumn: showMatch.index! + showMatch[0].length + 1,
          });
        }
      }
    }

    return issues;
  }
}

// Singleton instance
export const scriptDiagnosticGenerator = new ScriptDiagnosticGenerator();
