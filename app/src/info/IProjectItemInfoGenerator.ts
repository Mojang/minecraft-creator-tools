// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ProjectInfoItem from "./ProjectInfoItem";
import ProjectItem from "./../app/ProjectItem";
import IProjectInfoGeneratorBase from "./IProjectInfoGeneratorBase";
import ContentIndex from "../core/ContentIndex";

export default interface IProjectItemInfoGenerator extends IProjectInfoGeneratorBase {
  generate(projectItem: ProjectItem, contentIndex: ContentIndex): Promise<ProjectInfoItem[]>;
}
