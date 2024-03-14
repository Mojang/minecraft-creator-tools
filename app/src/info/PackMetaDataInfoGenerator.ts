// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ProjectInfoItem from "./ProjectInfoItem";
import ProjectItem from "../app/ProjectItem";
import IProjectItemInfoGenerator from "./IProjectItemInfoGenerator";
import ProjectInfoSet from "./ProjectInfoSet";

export default class PackMetaDataInformationGenerator implements IProjectItemInfoGenerator {
  id = "PACKMETADATA";
  title = "General info";

  getTopicData(topicId: number) {
    return {
      title: topicId.toString(),
    };
  }

  summarize(info: any, infoSet: ProjectInfoSet) {}

  async generate(projectItem: ProjectItem): Promise<ProjectInfoItem[]> {
    const items: ProjectInfoItem[] = [];

    return items;
  }
}
