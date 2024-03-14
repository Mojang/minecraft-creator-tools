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
  updaters?: IProjectUpdaterReference[];
}

export default interface IProjectInfoGeneratorBase {
  id: string;
  title: string;
  getTopicData(topicId: number): IProjectInfoTopicData | undefined;
  summarize(summaryDataObject: object, infoSet: ProjectInfoSet): void;
}
