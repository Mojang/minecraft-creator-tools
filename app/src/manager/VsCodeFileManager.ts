// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ProjectInfoItem from "../info/ProjectInfoItem";
import Project from "../app/Project";
import IProjectInfoGenerator from "../info/IProjectInfoGenerator";
import { ProjectItemStorageType, ProjectItemType } from "../app/IProjectItemData";
import { InfoItemType } from "../info/IInfoItemData";
import IProjectUpdater from "../updates/IProjectUpdater";
import ProjectUpdateResult from "../updates/ProjectUpdateResult";
import VsCodeTasksJson from "../devproject/VsCodeTasksJson";
import { UpdateResultType } from "../updates/IUpdateResult";
import VsCodeLaunchJson from "../devproject/VsCodeLaunchJson";
import { IProjectInfoTopicData } from "../info/IProjectInfoGeneratorBase";
import ProjectInfoSet from "../info/ProjectInfoSet";
import ContentIndex from "../core/ContentIndex";
import IDebugSettings from "../devproject/IDebugSettings";

export default class VsCodeFileManager implements IProjectInfoGenerator, IProjectUpdater {
  id = "VSCODEFILE";
  title = "VSCode Files";

  getTopicData(topicId: number): IProjectInfoTopicData | undefined {
    return {
      title: topicId.toString(),
    };
  }

  getUpdaterData(updateId: number) {
    return {
      title: updateId.toString(),
    };
  }

  summarize(info: any, infoSet: ProjectInfoSet) {}

  async generate(project: Project, contentIndex: ContentIndex): Promise<ProjectInfoItem[]> {
    const infoItems: ProjectInfoItem[] = [];

    for (const pi of project.items) {
      if (pi.itemType === ProjectItemType.vsCodeTasksJson && pi.storageType === ProjectItemStorageType.singleFile) {
        await pi.ensureFileStorage();

        if (pi.file) {
          const vscodeTasksJson = await VsCodeTasksJson.ensureOnFile(pi.file);

          if (vscodeTasksJson) {
            const hasMinecraftTasks = await vscodeTasksJson.hasMinecraftTasks();

            if (!hasMinecraftTasks) {
              infoItems.push(
                new ProjectInfoItem(
                  InfoItemType.info,
                  this.id,
                  100,
                  "Project has a VSCode tasks file, but no minecraft deploy tasks.",
                  pi,
                  undefined,
                  pi.file.storageRelativePath
                )
              );
            }
          }
        }
      } else if (
        pi.itemType === ProjectItemType.vsCodeLaunchJson &&
        pi.storageType === ProjectItemStorageType.singleFile
      ) {
        await pi.ensureFileStorage();

        if (pi.file) {
          const vscodeLaunchJson = await VsCodeLaunchJson.ensureOnFile(pi.file);

          if (vscodeLaunchJson) {
            vscodeLaunchJson.project = project;
            const hasMinecraftDebugConfig = await vscodeLaunchJson.hasMinecraftDebugLaunch({ isServer: true });

            if (!hasMinecraftDebugConfig) {
              infoItems.push(
                new ProjectInfoItem(
                  InfoItemType.info,
                  this.id,
                  101,
                  "Project has a VSCode launch file, but is not configured for Minecraft server launch.",
                  pi,
                  undefined,
                  pi.file.storageRelativePath
                )
              );
            }
          }
        }
      }
    }

    return infoItems;
  }

  async update(project: Project, updateId: number): Promise<ProjectUpdateResult[]> {
    const results: ProjectUpdateResult[] = [];

    switch (updateId) {
      case 1:
        results.push(...(await this.ensureMinecraftLaunchTasks(project)));
        break;
      case 2:
        results.push(...(await this.ensureMinecraftDebugConfig(project)));
        break;
    }

    return results;
  }

  getUpdateIds() {
    return [1, 2];
  }

  async ensureMinecraftLaunchTasks(project: Project) {
    const results: ProjectUpdateResult[] = [];

    for (const pi of project.items) {
      if (pi.itemType === ProjectItemType.vsCodeTasksJson && pi.storageType === ProjectItemStorageType.singleFile) {
        await pi.ensureFileStorage();

        if (pi.file) {
          const vscodeTasksJson = await VsCodeTasksJson.ensureOnFile(pi.file);

          if (vscodeTasksJson) {
            const hasTasks = await vscodeTasksJson.hasMinecraftTasks();

            if (!hasTasks) {
              const result = await vscodeTasksJson.ensureMinecraftTasks();

              if (result) {
                await vscodeTasksJson.save();
                results.push(
                  new ProjectUpdateResult(UpdateResultType.updatedFile, this.id, 1, "Updated Minecraft Tasks", pi)
                );
              }
            }
          }
        }
      }
    }

    return results;
  }

  async ensureMinecraftDebugConfig(project: Project) {
    const results: ProjectUpdateResult[] = [];

    for (const pi of project.items) {
      if (pi.itemType === ProjectItemType.vsCodeLaunchJson && pi.storageType === ProjectItemStorageType.singleFile) {
        await pi.ensureFileStorage();

        if (pi.file) {
          const vscodeLaunchJson = await VsCodeLaunchJson.ensureOnFile(pi.file);

          const pack = await project.getDefaultBehaviorPack();

          const debugSettings: IDebugSettings = { isServer: true };

          if (pack && pack.folder) {
            debugSettings.behaviorPackFolderName = pack.folder.name;
          }

          if (vscodeLaunchJson) {
            const hasConfig = await vscodeLaunchJson.hasMinecraftDebugLaunch(debugSettings);

            if (!hasConfig) {
              const result = await vscodeLaunchJson.ensureMinecraftDebugLaunch(debugSettings);

              if (result) {
                await vscodeLaunchJson.save();
                results.push(
                  new ProjectUpdateResult(UpdateResultType.updatedFile, this.id, 2, "Updated Minecraft Launch JSON", pi)
                );
              }
            }
          }
        }
      }
    }

    return results;
  }
}
