// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ProjectInfoItem from "./ProjectInfoItem";
import Project from "./../app/Project";
import IProjectInfoGeneratorBase from "./IProjectInfoGeneratorBase";
import ContentIndex from "../core/ContentIndex";

export default interface IProjectInfoGenerator extends IProjectInfoGeneratorBase {
  generate(project: Project, contentIndex: ContentIndex): Promise<ProjectInfoItem[]>;
}
