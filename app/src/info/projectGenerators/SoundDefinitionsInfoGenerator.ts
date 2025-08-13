// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ProjectInfoItem from "../ProjectInfoItem";
import IProjectInfoGenerator from "../IProjectInfoGenerator";
import { InfoItemType } from "../IInfoItemData";
import ProjectInfoSet from "../ProjectInfoSet";
import ProjectInfoUtilities from "../ProjectInfoUtilities";
import { ProjectItemType } from "../../app/IProjectItemData";
import Project from "../../app/Project";
import { SoundDefinitionCatalogSchema } from "../../minecraft/ISoundDefinitionCatalog";
import { ZodIssueCode } from "zod";
import StorageUtilities from "../../storage/StorageUtilities";

export enum SoundsDefinitionInfoGeneratorTest {
  multipleSoundsDefinitionManifests = 101,
  invalidSoundsDefinitionManifest = 102,
  soundsDefinitionManifestInvalidJson = 103,
  foundALooseSoundDefinition = 104,
}

/***********
 * Generator for validating Sounds Definition Manifest Files
 *
 * Will ensure:
 *  * only one Sounds Definition Manifest exists
 *  * Sounds Definition Manifest is valid JSON
 *  * Sounds Definition Manifest is formatted correctly
 *
 */

export default class SoundsDefinitionInfoGenerator implements IProjectInfoGenerator {
  id = "SNDSDEF";
  title = "Sounds Definition Manifest Validation";

  getTopicData(topicId: number) {
    return {
      title: ProjectInfoUtilities.getTitleFromEnum(SoundsDefinitionInfoGeneratorTest, topicId),
    };
  }

  summarize(info: any, infoSet: ProjectInfoSet) {
    info.multipleSoundsManifests = infoSet.getSummedDataValue(
      this.id,
      SoundsDefinitionInfoGeneratorTest.multipleSoundsDefinitionManifests
    );

    info.soundsDefinitionManifestFormatIsValid = infoSet.getSummedDataValue(
      this.id,
      SoundsDefinitionInfoGeneratorTest.invalidSoundsDefinitionManifest
    );

    info.soundsDefinitionManifestIsNotValidJson = infoSet.getSummedDataValue(
      this.id,
      SoundsDefinitionInfoGeneratorTest.soundsDefinitionManifestInvalidJson
    );
  }

  async generate(project: Project): Promise<ProjectInfoItem[]> {
    const items: ProjectInfoItem[] = [];
    const projItems = project.getItemsCopy();

    const packsWithSoundManifests: { [name: string]: boolean } = {};

    for (const item of projItems) {
      if (item.itemType !== ProjectItemType.soundDefinitionCatalog && item.itemType) {
        continue;
      }

      const pack = await item.getPack();

      if (!pack || !pack.projectItem.projectPath) {
        items.push(
          new ProjectInfoItem(
            InfoItemType.internalProcessingError,
            this.id,
            SoundsDefinitionInfoGeneratorTest.foundALooseSoundDefinition,
            this.getTopicData(SoundsDefinitionInfoGeneratorTest.multipleSoundsDefinitionManifests).title,
            item
          )
        );
        continue;
      }

      if (packsWithSoundManifests[pack.projectItem.projectPath]) {
        items.push(
          new ProjectInfoItem(
            InfoItemType.error,
            this.id,
            SoundsDefinitionInfoGeneratorTest.multipleSoundsDefinitionManifests,
            this.getTopicData(SoundsDefinitionInfoGeneratorTest.multipleSoundsDefinitionManifests).title,
            item
          )
        );

        continue;
      } else {
        packsWithSoundManifests[pack.projectItem.projectPath] = true;
      }

      await item.ensureStorage();
      if (!item.primaryFile) {
        continue;
      }

      await item.primaryFile.loadContent();
      const content = item.primaryFile.content;

      if (!content || typeof content !== "string") {
        continue;
      }

      const parsedContent: unknown = StorageUtilities.getJsonObject(item.primaryFile);
      if (!parsedContent) {
        items.push(
          new ProjectInfoItem(
            InfoItemType.error,
            this.id,
            SoundsDefinitionInfoGeneratorTest.soundsDefinitionManifestInvalidJson,
            this.getTopicData(SoundsDefinitionInfoGeneratorTest.soundsDefinitionManifestInvalidJson).title,
            item
          )
        );
        continue;
      }

      items.push(...this.getIsManifestValidResult(parsedContent));
    }

    return items;
  }

  // Uses a union to check for both possible versions of a Sound Manifest (per comment in ISoundDefinitionCatalog)
  private getIsManifestValidResult(fileContent: unknown): ProjectInfoItem[] {
    const results: ProjectInfoItem[] = [];
    const parseResult = SoundDefinitionCatalogSchema.safeParse(fileContent);

    if (!parseResult.success) {
      const parsedErrors: string[] = [];
      for (const issue of parseResult.error.issues) {
        if (issue.code === ZodIssueCode.invalid_union) {
          for (const e of issue.unionErrors) {
            for (const i of e.issues) {
              parsedErrors.push(`${i.message} at ${i.path.join("/")}`);
            }
          }
        }
      }

      results.push(
        new ProjectInfoItem(
          InfoItemType.error,
          this.id,
          SoundsDefinitionInfoGeneratorTest.invalidSoundsDefinitionManifest,
          `${
            this.getTopicData(SoundsDefinitionInfoGeneratorTest.invalidSoundsDefinitionManifest).title
          }: ${parsedErrors.join(", ")}`
        )
      );
    }

    return results;
  }
}
