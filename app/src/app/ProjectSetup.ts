// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import Project from "./Project";
import { ProjectItemType } from "./IProjectItemData";
import NpmPackageDefinition from "../devproject/NpmPackageDefinition";
import JustConfig from "../devproject/JustConfig";
import EslintConfig from "../devproject/EslintConfig";
import PrettierRcConfig from "../devproject/PrettierRcConfig";
import EnvSettings from "../devproject/EnvSettings";
import VsCodeSettingsDefinition from "../devproject/VsCodeSettingsDefinition";
import VsCodeLaunchDefinition from "../devproject/VsCodeLaunchDefinition";
import VsCodeTasksDefinition from "../devproject/VsCodeTasksDefinition";
import VsCodeExtensionsDefinition from "../devproject/VsCodeExtensionsDefinition";
import BehaviorManifestDefinition from "../minecraft/BehaviorManifestDefinition";
import { FileUpdateType } from "../storage/IFile";
import { ILogger } from "../cli/core/ICommandContext";

export type SetupFileStatus = "unchanged" | "updated" | "created";

export interface SetupResult {
  filePath: string;
  status: SetupFileStatus;
  packageJsonContent?: string;
}

export default class ProjectSetup {
  static async setup(project: Project, log: ILogger): Promise<SetupResult[]> {
    const results: SetupResult[] = [];

    await project.inferProjectItemsFromFiles();

    const projectFolder = project.projectFolder;
    if (!projectFolder) {
      log.error("No project folder found.");
      return results;
    }

    // Read behavior pack manifest title
    const bpTitle = await ProjectSetup.getBehaviorPackTitle(project);

    // Ensure package.json
    results.push(await ProjectSetup.ensurePackageJson(project, projectFolder, bpTitle));

    // Ensure just.config.ts
    results.push(await ProjectSetup.ensureJustConfig(projectFolder));

    // Ensure eslint.config.mjs
    results.push(await ProjectSetup.ensureEslintConfig(projectFolder));

    // Ensure .prettierrc.json
    results.push(await ProjectSetup.ensurePrettierRc(projectFolder));

    // Ensure .env
    results.push(await ProjectSetup.ensureEnv(project, projectFolder));

    // Ensure .vscode files
    results.push(await ProjectSetup.ensureVsCodeExtensions(projectFolder));
    results.push(await ProjectSetup.ensureVsCodeLaunch(projectFolder));
    results.push(await ProjectSetup.ensureVsCodeSettings(projectFolder));
    results.push(await ProjectSetup.ensureVsCodeTasks(projectFolder));

    return results;
  }

  private static async getBehaviorPackTitle(project: Project): Promise<string | undefined> {
    const items = project.getItemsCopy();

    for (const item of items) {
      if (item.itemType === ProjectItemType.behaviorPackManifestJson && item.primaryFile) {
        const manifest = await BehaviorManifestDefinition.ensureOnFile(item.primaryFile);
        if (manifest && manifest.name) {
          return manifest.name;
        }
      }
    }

    return undefined;
  }

  private static async ensurePackageJson(
    project: Project,
    projectFolder: import("../storage/IFolder").default,
    bpTitle?: string
  ): Promise<SetupResult> {
    const filePath = "package.json";
    const file = await projectFolder.ensureFileFromRelativePath("/" + filePath);
    const existed = await file.exists();

    const npmPackage = await NpmPackageDefinition.ensureOnFile(file);
    if (!npmPackage) {
      return { filePath, status: "unchanged" };
    }

    const changed = await npmPackage.ensureSetupContent(bpTitle);

    if (changed || !existed) {
      await npmPackage.persist();
      await file.saveContent(false);

      let packageJsonContent: string | undefined;
      if (file.content && typeof file.content === "string") {
        packageJsonContent = file.content;
      } else if (npmPackage.definition) {
        packageJsonContent = JSON.stringify(npmPackage.definition, null, 2);
      }

      return {
        filePath,
        status: existed ? "updated" : "created",
        packageJsonContent,
      };
    }

    return { filePath, status: "unchanged" };
  }

  private static async ensureJustConfig(projectFolder: import("../storage/IFolder").default): Promise<SetupResult> {
    const filePath = "just.config.ts";
    const file = await projectFolder.ensureFileFromRelativePath("/" + filePath);
    const existed = await file.exists();

    const justConfig = await JustConfig.ensureOnFile(file);
    if (!justConfig) {
      return { filePath, status: "unchanged" };
    }

    await justConfig.ensureMin();
    await justConfig.save();

    if (!existed) {
      return { filePath, status: "created" };
    }

    return { filePath, status: "unchanged" };
  }

  private static async ensureEslintConfig(projectFolder: import("../storage/IFolder").default): Promise<SetupResult> {
    const filePath = "eslint.config.mjs";
    const file = await projectFolder.ensureFileFromRelativePath("/" + filePath);
    const existed = await file.exists();

    const eslintConfig = await EslintConfig.ensureOnFile(file);
    if (!eslintConfig) {
      return { filePath, status: "unchanged" };
    }

    await eslintConfig.ensureMin();
    await eslintConfig.save();

    if (!existed) {
      return { filePath, status: "created" };
    }

    return { filePath, status: "unchanged" };
  }

  private static async ensurePrettierRc(projectFolder: import("../storage/IFolder").default): Promise<SetupResult> {
    const filePath = ".prettierrc.json";
    const file = await projectFolder.ensureFileFromRelativePath("/" + filePath);
    const existed = await file.exists();

    const prettierRc = await PrettierRcConfig.ensureOnFile(file);
    if (!prettierRc) {
      return { filePath, status: "unchanged" };
    }

    await prettierRc.ensureMinContent();
    const persisted = await prettierRc.persist();

    if (persisted) {
      await file.saveContent(false);
      return { filePath, status: existed ? "updated" : "created" };
    }

    if (!existed) {
      return { filePath, status: "created" };
    }

    return { filePath, status: "unchanged" };
  }

  private static async ensureEnv(
    project: Project,
    projectFolder: import("../storage/IFolder").default
  ): Promise<SetupResult> {
    const filePath = ".env";
    const file = await projectFolder.ensureFileFromRelativePath("/" + filePath);
    const existed = await file.exists();

    await file.loadContent();

    const existingContent = file.content && typeof file.content === "string" ? file.content : undefined;
    const newContent = await EnvSettings.getContent(project, existingContent);

    const changed = file.setContentIfSemanticallyDifferent(newContent, FileUpdateType.versionlessEdit);

    if (changed || !existed) {
      await file.saveContent(false);
      return { filePath, status: existed ? "updated" : "created" };
    }

    return { filePath, status: "unchanged" };
  }

  private static async ensureVsCodeExtensions(
    projectFolder: import("../storage/IFolder").default
  ): Promise<SetupResult> {
    const filePath = ".vscode/extensions.json";
    const file = await projectFolder.ensureFileFromRelativePath("/" + filePath);
    const existed = await file.exists();

    const extensions = await VsCodeExtensionsDefinition.ensureOnFile(file);
    if (!extensions) {
      return { filePath, status: "unchanged" };
    }

    await extensions.ensureMinContent();
    const persisted = await extensions.persist();

    if (persisted) {
      await file.saveContent(false);
      return { filePath, status: existed ? "updated" : "created" };
    }

    if (!existed) {
      return { filePath, status: "created" };
    }

    return { filePath, status: "unchanged" };
  }

  private static async ensureVsCodeLaunch(projectFolder: import("../storage/IFolder").default): Promise<SetupResult> {
    const filePath = ".vscode/launch.json";
    const file = await projectFolder.ensureFileFromRelativePath("/" + filePath);
    const existed = await file.exists();

    const launch = await VsCodeLaunchDefinition.ensureOnFile(file);
    if (!launch) {
      return { filePath, status: "unchanged" };
    }

    await launch.ensureMinContent();
    const persisted = await launch.persist();

    if (persisted) {
      await file.saveContent(false);
      return { filePath, status: existed ? "updated" : "created" };
    }

    if (!existed) {
      return { filePath, status: "created" };
    }

    return { filePath, status: "unchanged" };
  }

  private static async ensureVsCodeSettings(projectFolder: import("../storage/IFolder").default): Promise<SetupResult> {
    const filePath = ".vscode/settings.json";
    const file = await projectFolder.ensureFileFromRelativePath("/" + filePath);
    const existed = await file.exists();

    const settings = await VsCodeSettingsDefinition.ensureOnFile(file);
    if (!settings) {
      return { filePath, status: "unchanged" };
    }

    await settings.ensureMinContent();
    const persisted = await settings.persist();

    if (persisted) {
      await file.saveContent(false);
      return { filePath, status: existed ? "updated" : "created" };
    }

    if (!existed) {
      return { filePath, status: "created" };
    }

    return { filePath, status: "unchanged" };
  }

  private static async ensureVsCodeTasks(projectFolder: import("../storage/IFolder").default): Promise<SetupResult> {
    const filePath = ".vscode/tasks.json";
    const file = await projectFolder.ensureFileFromRelativePath("/" + filePath);
    const existed = await file.exists();

    const tasks = await VsCodeTasksDefinition.ensureOnFile(file);
    if (!tasks) {
      return { filePath, status: "unchanged" };
    }

    await tasks.ensureMinContent();
    const persisted = await tasks.persist();

    if (persisted) {
      await file.saveContent(false);
      return { filePath, status: existed ? "updated" : "created" };
    }

    if (!existed) {
      return { filePath, status: "created" };
    }

    return { filePath, status: "unchanged" };
  }
}
