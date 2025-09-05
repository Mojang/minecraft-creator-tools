// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ProjectInfoItem from "../info/ProjectInfoItem";
import Project from "../app/Project";
import IProjectInfoGenerator from "../info/IProjectInfoGenerator";
import { ProjectItemStorageType, ProjectItemType } from "../app/IProjectItemData";
import { InfoItemType } from "../info/IInfoItemData";
import IProjectUpdater from "../updates/IProjectUpdater";
import ProjectUpdateResult from "../updates/ProjectUpdateResult";
import VsCodeTasksDefinition from "../devproject/VsCodeTasksDefinition";
import { UpdateResultType } from "../updates/IUpdateResult";
import VsCodeLaunchDefinition from "../devproject/VsCodeLaunchDefinition";
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

    const itemsCopy = project.getItemsCopy();

    for (const pi of itemsCopy) {
      if (pi.itemType === ProjectItemType.vsCodeTasksJson && pi.storageType === ProjectItemStorageType.singleFile) {
        if (!pi.isContentLoaded) {
          await pi.loadContent();
        }

        if (pi.primaryFile) {
          const vscodeTasksJson = await VsCodeTasksDefinition.ensureOnFile(pi.primaryFile);

          if (vscodeTasksJson) {
            const hasMinecraftTasks = await vscodeTasksJson.hasMinContent();

            if (!hasMinecraftTasks) {
              infoItems.push(
                new ProjectInfoItem(
                  InfoItemType.info,
                  this.id,
                  100,
                  "Project has a VSCode tasks file, but no minecraft deploy tasks.",
                  pi,
                  undefined,
                  pi.primaryFile.storageRelativePath
                )
              );
            }
          }
        }
      } else if (
        pi.itemType === ProjectItemType.vsCodeLaunchJson &&
        pi.storageType === ProjectItemStorageType.singleFile
      ) {
        if (!pi.isContentLoaded) {
          await pi.loadContent();
        }

        if (pi.primaryFile) {
          const vscodeLaunchJson = await VsCodeLaunchDefinition.ensureOnFile(pi.primaryFile);

          if (vscodeLaunchJson) {
            vscodeLaunchJson.project = project;
            const hasMinecraftDebugConfig = await vscodeLaunchJson.hasMinContent({ isServer: true });

            if (!hasMinecraftDebugConfig) {
              infoItems.push(
                new ProjectInfoItem(
                  InfoItemType.info,
                  this.id,
                  101,
                  "Project has a VSCode launch file, but is not configured for Minecraft server launch.",
                  pi,
                  undefined,
                  pi.primaryFile.storageRelativePath
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

    const itemsCopy = project.getItemsCopy();

    for (const pi of itemsCopy) {
      if (pi.itemType === ProjectItemType.vsCodeTasksJson && pi.storageType === ProjectItemStorageType.singleFile) {
        if (!pi.isContentLoaded) {
          await pi.loadContent();
        }

        if (pi.primaryFile) {
          const vscodeTasksJson = await VsCodeTasksDefinition.ensureOnFile(pi.primaryFile);

          if (vscodeTasksJson) {
            const hasTasks = await vscodeTasksJson.hasMinContent();

            if (!hasTasks) {
              const result = await vscodeTasksJson.ensureMinContent();

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

    const itemsCopy = project.getItemsCopy();

    for (const pi of itemsCopy) {
      if (pi.itemType === ProjectItemType.vsCodeLaunchJson && pi.storageType === ProjectItemStorageType.singleFile) {
        if (!pi.isContentLoaded) {
          await pi.loadContent();
        }

        if (pi.primaryFile) {
          const vscodeLaunchJson = await VsCodeLaunchDefinition.ensureOnFile(pi.primaryFile);

          const pack = await project.getDefaultBehaviorPack();

          const debugSettings: IDebugSettings = { isServer: true };

          if (pack && pack.folder) {
            debugSettings.behaviorPackFolderName = pack.folder.name;
          }

          if (vscodeLaunchJson) {
            const hasConfig = await vscodeLaunchJson.hasMinContent(debugSettings);

            if (!hasConfig) {
              const result = await vscodeLaunchJson.ensureMinContent(debugSettings);

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
