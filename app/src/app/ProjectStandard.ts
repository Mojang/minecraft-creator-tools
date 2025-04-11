import EslintConfig from "../devproject/EslintConfig";
import JustConfig from "../devproject/JustConfig";
import NpmPackageDefinition from "../devproject/NpmPackageDefinition";
import { ProjectItemCreationType, ProjectItemStorageType, ProjectItemType } from "./IProjectItemData";
import Project, { FolderContext } from "./Project";

export default class ProjectStandard {
  static async ensureIsStandard(project: Project) {
    await project.ensureProjectFolder();

    if (project.projectFolder) {
      const justFile = await project.projectFolder.getFileFromRelativePath("/just.config.ts");

      if (justFile && (await justFile.exists())) {
        justFile.setContent(JustConfig.getDefaultContent());
        justFile.saveContent();
      }

      const eslintFile = await project.projectFolder.getFileFromRelativePath("/eslint.config.mjs");

      if (eslintFile && (await eslintFile.exists())) {
        eslintFile.setContent(EslintConfig.getDefaultContent());
        eslintFile.saveContent();
      }

      const packageJson = await project.projectFolder.getFileFromRelativePath("/package.json");

      if (packageJson && (await packageJson.exists())) {
        project.ensureItemByProjectPath(
          "/package.json",
          ProjectItemStorageType.singleFile,
          "package.json",
          ProjectItemType.packageJson,
          FolderContext.unknown,
          undefined,
          ProjectItemCreationType.generated
        );
      }
    }

    const itemsCopy = project.getItemsCopy();
    for (let i = 0; i < itemsCopy.length; i++) {
      const item = itemsCopy[i];

      if (item.itemType === ProjectItemType.justConfigTs && item.defaultFile) {
        item.creationType = ProjectItemCreationType.generated;

        const justConfig = await JustConfig.ensureOnFile(item.defaultFile);

        if (justConfig) {
          justConfig.ensureDefault();
          await justConfig.save();
        }
      } else if (item.itemType === ProjectItemType.esLintConfigMjs && item.defaultFile) {
        item.creationType = ProjectItemCreationType.generated;

        const eslintConfig = await EslintConfig.ensureOnFile(item.defaultFile);

        if (eslintConfig) {
          eslintConfig.ensureDefault();
          await eslintConfig.save();
        }
      } else if (item.itemType === ProjectItemType.packageJson && item.defaultFile) {
        item.creationType = ProjectItemCreationType.generated;

        const packageJson = await NpmPackageDefinition.ensureOnFile(item.defaultFile);

        if (packageJson) {
          await packageJson.ensureStandardContent();
          await packageJson.save();
        }
      }
    }
  }
}
