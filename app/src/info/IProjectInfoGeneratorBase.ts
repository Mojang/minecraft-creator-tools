// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ProjectInfoSet from "./ProjectInfoSet";

export interface IProjectUpdaterReference {
  updaterId: string;
  updaterIndex: number;
  action: string;
}

export interface IProjectInfoTopicData {
  title: string;
  description?: string;
  technicalDescription?: string;
  howToUse?: string;
  updaters?: IProjectUpdaterReference[];
  /**
   * A JSON token or pattern to search for when highlighting this issue in a document.
   * Examples: "format_version", "identifier", "minecraft:entity"
   * The diagnostic provider will search for this string to locate the relevant line.
   */
  suggestedLineToken?: string;
  /**
   * If true, the diagnostic provider should also verify that ProjectInfoItem.data
   * appears on the same line as suggestedLineToken to pinpoint the exact location.
   */
  suggestedLineShouldHaveData?: boolean;
}

export default interface IProjectInfoGeneratorBase {
  id: string;
  title: string;
  canAlwaysProcess?: boolean;

  /**
   * Gets topic data for a specific topic ID.
   * @deprecated Topic data should be stored in form.json files in public/data/forms/mctoolsval/.
   * Use InfoGeneratorTopicUtilities.getTopicData() instead. This method is optional and will be
   * removed in a future version.
   */
  getTopicData?(topicId: number): IProjectInfoTopicData | undefined;
  summarize(summaryDataObject: object, infoSet: ProjectInfoSet): void;
}
