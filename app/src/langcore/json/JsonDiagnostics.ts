// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * JsonDiagnostics - Platform-agnostic diagnostic generation
 *
 * This module provides utilities for generating diagnostics (errors, warnings)
 * for Minecraft JSON files. Integrates with the ProjectInfoSet validation
 * infrastructure to provide consistent validation across platforms.
 */

/**
 * Diagnostic severity levels (platform-agnostic)
 */
export enum DiagnosticSeverity {
  Error = 1,
  Warning = 2,
  Information = 3,
  Hint = 4,
}

/**
 * A diagnostic (platform-agnostic)
 */
export interface IDiagnostic {
  /** Start line (1-based) */
  startLine: number;
  /** Start column (1-based) */
  startColumn: number;
  /** End line (1-based) */
  endLine: number;
  /** End column (1-based) */
  endColumn: number;
  /** Diagnostic message */
  message: string;
  /** Severity level */
  severity: DiagnosticSeverity;
  /** Diagnostic code (for quick fixes) */
  code?: string;
  /** Source identifier */
  source: string;
  /** Generator ID (for linking to updaters) */
  generatorId?: string;
  /** Generator index (for multi-item generators) */
  generatorIndex?: number;
  /** Related information */
  relatedInfo?: Array<{
    filePath: string;
    line: number;
    column: number;
    message: string;
  }>;
}

/**
 * Quick fix information attached to a diagnostic
 */
export interface IDiagnosticFix {
  /** Title of the fix */
  title: string;
  /** Whether this is the preferred fix */
  isPreferred?: boolean;
  /** Edits to apply */
  edits: Array<{
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
    newText: string;
  }>;
}

/**
 * Generate JSON-specific diagnostics
 */
export class JsonDiagnosticGenerator {
  /**
   * Generate diagnostics for format_version issues
   */
  public generateFormatVersionDiagnostic(
    currentVersion: string,
    recommendedVersion: string,
    line: number,
    startColumn: number,
    endColumn: number
  ): IDiagnostic | null {
    if (currentVersion === recommendedVersion) {
      return null;
    }

    // Parse versions to compare
    const current = this.parseVersion(currentVersion);
    const recommended = this.parseVersion(recommendedVersion);

    if (!current || !recommended) {
      return null;
    }

    // Only warn if current is significantly older
    if (this.isVersionOlder(current, recommended, 2)) {
      return {
        startLine: line,
        startColumn,
        endLine: line,
        endColumn,
        message: `format_version "${currentVersion}" is outdated. Consider updating to "${recommendedVersion}"`,
        severity: DiagnosticSeverity.Warning,
        source: "MCTools",
        code: "FORMAT_VERSION_OLD",
        generatorId: "FORMATVER",
      };
    }

    return null;
  }

  /**
   * Generate diagnostic for deprecated properties
   */
  public generateDeprecatedPropertyDiagnostic(
    propertyName: string,
    deprecatedSince: string | undefined,
    replacement: string | undefined,
    line: number,
    startColumn: number,
    endColumn: number
  ): IDiagnostic {
    let message = `Property "${propertyName}" is deprecated`;
    if (deprecatedSince) {
      message += ` since version ${deprecatedSince}`;
    }
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
      code: "DEPRECATED_PROPERTY",
      generatorId: "DEPRECATED",
    };
  }

  /**
   * Generate diagnostic for missing required property
   */
  public generateMissingPropertyDiagnostic(
    propertyName: string,
    parentPath: string,
    line: number,
    startColumn: number,
    endColumn: number
  ): IDiagnostic {
    return {
      startLine: line,
      startColumn,
      endLine: line,
      endColumn,
      message: `Required property "${propertyName}" is missing in ${parentPath || "object"}`,
      severity: DiagnosticSeverity.Error,
      source: "MCTools",
      code: "MISSING_REQUIRED",
    };
  }

  /**
   * Generate diagnostic for invalid value
   */
  public generateInvalidValueDiagnostic(
    propertyName: string,
    actualValue: string,
    expectedType: string,
    validValues: string[] | undefined,
    line: number,
    startColumn: number,
    endColumn: number
  ): IDiagnostic {
    let message = `Invalid value "${actualValue}" for "${propertyName}"`;

    if (validValues && validValues.length <= 5) {
      message += `. Expected one of: ${validValues.join(", ")}`;
    } else if (expectedType) {
      message += `. Expected ${expectedType}`;
    }

    return {
      startLine: line,
      startColumn,
      endLine: line,
      endColumn,
      message,
      severity: DiagnosticSeverity.Error,
      source: "MCTools",
      code: "INVALID_VALUE",
    };
  }

  /**
   * Generate diagnostic for unresolved reference
   */
  public generateUnresolvedReferenceDiagnostic(
    referenceType: string,
    referenceValue: string,
    line: number,
    startColumn: number,
    endColumn: number
  ): IDiagnostic {
    return {
      startLine: line,
      startColumn,
      endLine: line,
      endColumn,
      message: `Cannot resolve ${referenceType} "${referenceValue}"`,
      severity: DiagnosticSeverity.Warning,
      source: "MCTools",
      code: "UNRESOLVED_REFERENCE",
    };
  }

  /**
   * Parse a version string into components
   */
  private parseVersion(version: string): { major: number; minor: number; patch: number } | null {
    const match = version.match(/^(\d+)\.(\d+)(?:\.(\d+))?/);
    if (!match) {
      return null;
    }

    return {
      major: parseInt(match[1], 10),
      minor: parseInt(match[2], 10),
      patch: parseInt(match[3] || "0", 10),
    };
  }

  /**
   * Check if version A is older than version B by at least N minor versions
   */
  private isVersionOlder(
    a: { major: number; minor: number; patch: number },
    b: { major: number; minor: number; patch: number },
    minorDiff: number
  ): boolean {
    if (a.major < b.major) {
      return true;
    }
    if (a.major > b.major) {
      return false;
    }
    return b.minor - a.minor >= minorDiff;
  }
}

// Singleton instance
export const jsonDiagnosticGenerator = new JsonDiagnosticGenerator();
