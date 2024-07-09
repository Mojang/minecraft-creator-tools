// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ProjectInfoItem from "../info/ProjectInfoItem";
import Project from "../app/Project";
import IProjectInfoGenerator from "../info/IProjectInfoGenerator";
import { ProjectItemType } from "../app/IProjectItemData";
import { InfoItemType } from "../info/IInfoItemData";
import BehaviorManifestDefinition from "../minecraft/BehaviorManifestDefinition";
import NpmPackageJson from "../devproject/NpmPackageJson";
import Database from "../minecraft/Database";
import ProjectItem from "../app/ProjectItem";
import IProjectUpdater from "../updates/IProjectUpdater";
import ProjectUpdateResult from "../updates/ProjectUpdateResult";
import { UpdateResultType } from "../updates/IUpdateResult";
import { IProjectInfoTopicData } from "../info/IProjectInfoGeneratorBase";
import ProjectInfoSet from "../info/ProjectInfoSet";
import ContentIndex from "../core/ContentIndex";
import EnvFile from "../devproject/EnvFile";

export default class ScriptModuleManager implements IProjectInfoGenerator, IProjectUpdater {
  id = "SCRIPTMODULE";
  title = "Script Modules";

  modulesInUse: { [name: string]: { version: string; manifest: BehaviorManifestDefinition; item: ProjectItem }[] } = {};
  packRegsInUse: { [name: string]: { package: NpmPackageJson; isDevDependency: boolean; version: string }[] } = {};

  getTopicData(topicId: number): IProjectInfoTopicData | undefined {
    return {
      title: topicId.toString(),
    };
  }

  getUpdaterData(topicId: number) {
    return {
      title: topicId.toString(),
    };
  }

  summarize(info: any, infoSet: ProjectInfoSet) {}

  private async generateProjectState(project: Project): Promise<ProjectInfoItem[]> {
    const items: ProjectInfoItem[] = [];
    this.modulesInUse = {};
    this.packRegsInUse = {};

    for (let i = 0; i < project.items.length; i++) {
      const pi = project.items[i];

      if (pi.itemType === ProjectItemType.behaviorPackManifestJson) {
        await pi.ensureFileStorage();

        if (pi.file) {
          const bpManifest = await BehaviorManifestDefinition.ensureOnFile(pi.file);

          if (bpManifest && bpManifest.definition && bpManifest.definition.dependencies) {
            const deps = bpManifest.definition.dependencies;

            for (let j = 0; j < deps.length; j++) {
              const dep = deps[j];

              if (dep.module_name && dep.version) {
                let verStr = "";
                if (typeof dep.version === "string") {
                  verStr = dep.version;
                } else {
                  verStr = dep.version.join(".");
                }

                if (!this.modulesInUse[dep.module_name]) {
                  this.modulesInUse[dep.module_name] = [];
                }

                items.push(
                  new ProjectInfoItem(
                    InfoItemType.info,
                    this.id,
                    100,
                    "Behavior pack dependency on " + verStr + " at " + dep.module_name,
                    pi,
                    verStr,
                    dep.module_name
                  )
                );

                this.modulesInUse[dep.module_name].push({ version: verStr, manifest: bpManifest, item: pi });
              }
            }
          }
        }
      } else if (pi.itemType === ProjectItemType.packageJson) {
        await pi.ensureFileStorage();

        if (pi.file) {
          const npmPackageJson = await NpmPackageJson.ensureOnFile(pi.file);

          if (npmPackageJson && npmPackageJson.definition) {
            const deps = npmPackageJson.definition.dependencies;
            const devDeps = npmPackageJson.definition.devDependencies;

            if (deps) {
              for (const depKey in deps) {
                if (depKey.startsWith("@minecraft/")) {
                  if (!this.packRegsInUse[depKey]) {
                    this.packRegsInUse[depKey] = [];
                  }

                  this.packRegsInUse[depKey].push({
                    package: npmPackageJson,
                    isDevDependency: false,
                    version: deps[depKey],
                  });

                  items.push(
                    new ProjectInfoItem(
                      InfoItemType.info,
                      this.id,
                      101,
                      "Package.json registers usage of " + depKey + " at " + deps[depKey],
                      pi,
                      deps[depKey],
                      depKey
                    )
                  );
                }
              }
            }

            if (devDeps) {
              for (const depKey in devDeps) {
                if (depKey.startsWith("@minecraft/")) {
                  if (!this.packRegsInUse[depKey]) {
                    this.packRegsInUse[depKey] = [];
                  }

                  this.packRegsInUse[depKey].push({
                    package: npmPackageJson,
                    isDevDependency: true,
                    version: devDeps[depKey],
                  });

                  items.push(
                    new ProjectInfoItem(
                      InfoItemType.info,
                      this.id,
                      102,
                      "Package.json registers developer usage of " + depKey + " at " + devDeps[depKey],
                      pi,
                      devDeps[depKey],
                      depKey
                    )
                  );
                }
              }
            }
          }
        }
      } else if (pi.itemType === ProjectItemType.env) {
        await pi.ensureFileStorage();

        if (pi.file) {
          const envFile = await EnvFile.ensureOnFile(pi.file);

          await envFile?.ensureEnvFile(project);
        }
      }
    }

    return items;
  }

  async generate(project: Project, contentIndex: ContentIndex): Promise<ProjectInfoItem[]> {
    const items: ProjectInfoItem[] = await this.generateProjectState(project);
    let foundManifest = false;
    let foundError = false;

    let hasPackageJson = false;

    for (const item of project.items) {
      if (item.itemType === ProjectItemType.packageJson) {
        hasPackageJson = true;
      }
    }

    for (const moduleName in this.modulesInUse) {
      const moduleInfo = this.modulesInUse[moduleName];
      foundManifest = true;

      if (moduleInfo) {
        const npmModule = await Database.getModuleDescriptor(moduleName);

        if (npmModule) {
          if (npmModule.betaVersion) {
            for (let k = 0; k < moduleInfo.length; k++) {
              const mod = moduleInfo[k];

              if (mod.version.indexOf("-beta") >= 0) {
                if (!mod.version.startsWith(npmModule.betaVersion)) {
                  items.push(
                    new ProjectInfoItem(
                      InfoItemType.error,
                      this.id,
                      114,
                      "For " +
                        moduleName +
                        ", using an out of date beta version: " +
                        mod.version +
                        " compared to what is available (" +
                        npmModule.betaVersion +
                        ")",
                      mod.item,
                      mod.version
                    )
                  );
                  foundError = true;
                }
              }
            }
          }

          const packReg = this.packRegsInUse[moduleName];

          if (!packReg && hasPackageJson) {
            items.push(
              new ProjectInfoItem(
                InfoItemType.error,
                this.id,
                110,
                "Could not find an package.json registration for " + moduleName,
                undefined,
                moduleName
              )
            );
            foundError = true;
          }
        } else if (hasPackageJson) {
          items.push(
            new ProjectInfoItem(
              InfoItemType.error,
              this.id,
              111,
              "Could not find an NPMJS.org NPM module registration for " + moduleName,
              undefined,
              moduleName
            )
          );
          foundError = true;
        }
      }
    }

    if (!foundManifest) {
      items.push(
        new ProjectInfoItem(
          InfoItemType.testCompleteSuccess,
          this.id,
          260,
          "No script module was found; script module version check passes."
        )
      );
    } else if (foundError) {
      items.push(
        new ProjectInfoItem(InfoItemType.testCompleteSuccess, this.id, 262, "Script module version check passes.")
      );
    }
    return items;
  }

  async update(project: Project, updateId: number): Promise<ProjectUpdateResult[]> {
    const results: ProjectUpdateResult[] = [];

    switch (updateId) {
      case 1:
        const localResults = await this.updateModulesToLatestVersion(project);

        results.push(...localResults);
        break;
    }

    return results;
  }

  getUpdateIds() {
    return [1];
  }

  async updateModulesToLatestVersion(project: Project) {
    const results: ProjectUpdateResult[] = [];

    await this.generateProjectState(project);

    for (const moduleName in this.modulesInUse) {
      const moduleInfo = this.modulesInUse[moduleName];

      if (moduleInfo) {
        const npmModule = await Database.getModuleDescriptor(moduleName);

        if (npmModule) {
          for (let k = 0; k < moduleInfo.length; k++) {
            const mod = moduleInfo[k];

            if (mod.version.indexOf("-beta") >= 0) {
              if (npmModule.betaVersion) {
                const isChanged = mod.manifest.setModuleVersion(moduleName, npmModule.betaVersion + "-beta");

                if (isChanged) {
                  await mod.manifest.save();
                  results.push(
                    new ProjectUpdateResult(
                      UpdateResultType.updatedFile,
                      this.id,
                      1,
                      "Set module to latest beta version",
                      undefined,
                      npmModule.betaVersion + "-beta"
                    )
                  );
                }
              }
            } else if (mod.version.indexOf("-") < 1) {
              if (npmModule.latest) {
                mod.manifest.setModuleVersion(moduleName, npmModule.latest);
                await mod.manifest.save();

                results.push(
                  new ProjectUpdateResult(
                    UpdateResultType.updatedFile,
                    this.id,
                    1,
                    "Set module to latest stable version",
                    undefined,
                    npmModule.latest
                  )
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
