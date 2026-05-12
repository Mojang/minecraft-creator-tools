// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ValidateCommand - Run inspector validation on the current project
 *
 * Builds a `ProjectInfoSet` for the active project using the
 * `defaultInDevelopment` suite and reports a one-line summary of
 * errors, warnings, and recommendations. Useful as a quick
 * "is my project healthy?" check from the slash bar.
 */

import type { IToolCommandMetadata, IToolCommandResult } from "../IToolCommand";
import { ToolCommandBase } from "../IToolCommand";
import type { IToolCommandContext } from "../IToolCommandContext";
import { ProjectInfoSuite } from "../../../info/IProjectInfoData";
import { InfoItemType } from "../../../info/IInfoItemData";
import ProjectInfoSet from "../../../info/ProjectInfoSet";

export class ValidateCommand extends ToolCommandBase {
  readonly metadata: IToolCommandMetadata = {
    name: "validate",
    description: "Run inspector validation on the current project and print a summary",
    aliases: ["val"],
    category: "Validation",
    requiresProject: true,
    isWriteCommand: false,
    examples: ["/validate", "/val"],
  };

  async execute(
    context: IToolCommandContext,
    _args: string[],
    _flags: Record<string, string | boolean | string[]>
  ): Promise<IToolCommandResult> {
    if (!context.project) {
      context.output.error("No active project — open a project before running /validate.");
      return this.error("NO_PROJECT", "No active project");
    }

    const project = context.project;

    try {
      context.output.info(`Validating project '${project.name}'...`);

      const infoSet = new ProjectInfoSet(project, ProjectInfoSuite.defaultInDevelopment);
      await infoSet.generateForProject();

      const errors = infoSet.getCountByType(InfoItemType.error);
      const warnings = infoSet.getCountByType(InfoItemType.warning);
      const recommendations = infoSet.getCountByType(InfoItemType.recommendation);
      const internal = infoSet.getCountByType(InfoItemType.internalProcessingError);

      const summary = `errors=${errors} warnings=${warnings} recommendations=${recommendations}`;

      if (errors > 0 || internal > 0) {
        context.output.error(`Validation: ${summary}`);
      } else if (warnings > 0) {
        context.output.warn(`Validation: ${summary}`);
      } else {
        context.output.success(`Validation: ${summary}`);
      }

      return this.success(summary, {
        errors,
        warnings,
        recommendations,
        internalProcessingErrors: internal,
        projectName: project.name,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      context.output.error(`Validation failed: ${message}`);
      return this.error("VALIDATE_ERROR", `Failed to validate project: ${message}`);
    }
  }
}

export const validateCommand = new ValidateCommand();
