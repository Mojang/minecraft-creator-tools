// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import Project from "../app/Project";
import IProjectUpdater from "./IProjectUpdater";
import Log from "../core/Log";
import ProjectUpdateResult from "./ProjectUpdateResult";
import GeneratorRegistrations from "../info/GeneratorRegistrations";

export default class ProjectUpdateRunner {
  project?: Project;

  constructor(project: Project) {
    this.project = project;
  }

  async updateProject(includeUpdaters?: string[], excludeUpdaters?: string[]) {
    const updaters: IProjectUpdater[] = GeneratorRegistrations.updaters;

    const results: ProjectUpdateResult[] = [];

    if (!this.project) {
      Log.throwUnexpectedUndefined("PURUP");
      return;
    }

    for (let i = 0; i < updaters.length; i++) {
      const updater = updaters[i];

      const updaterIds = updater.getUpdateIds();

      for (let j = 0; j < updaterIds.length; j++) {
        if (
          (!includeUpdaters || includeUpdaters.includes(updater.id)) &&
          (!excludeUpdaters || !excludeUpdaters.includes(updater.id))
        ) {
          const localResults = await updater.update(this.project, updaterIds[j]);

          results.push(...localResults);
        }
      }
    }

    return results;
  }

  async update(updaterId: string, updaterIndex: number): Promise<ProjectUpdateResult[]> {
    const updaters: IProjectUpdater[] = GeneratorRegistrations.updaters;
    const allResults: ProjectUpdateResult[] = [];

    if (!this.project) {
      Log.throwUnexpectedUndefined("PURU");
      return [];
    }

    for (let i = 0; i < updaters.length; i++) {
      const updater = updaters[i];

      if (updater.id === updaterId) {
        const results = await updater.update(this.project, updaterIndex);

        for (const result of results) {
          allResults.push(result);
        }
      }
    }

    return allResults;
  }
}
