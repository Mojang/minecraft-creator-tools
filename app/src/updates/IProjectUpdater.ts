// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import Project from "../app/Project";
import ProjectUpdateResult from "./ProjectUpdateResult";

export interface IProjectUpdaterData {
  title: string;
}

export default interface IProjectUpdater {
  update(project: Project, updateId: number): Promise<ProjectUpdateResult[]>;

  id: string;
  title: string;

  getUpdateIds(): number[];
  getUpdaterData(updaterId: number): IProjectUpdaterData;
}
