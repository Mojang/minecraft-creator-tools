// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ProjectInfoItem from "./ProjectInfoItem";
import ProjectItem from "./../app/ProjectItem";
import IProjectInfoGeneratorBase from "./IProjectInfoGeneratorBase";
import ContentIndex from "../core/ContentIndex";
import { IGeneratorOptions } from "./ProjectInfoSet";

export default interface IProjectItemInfoGenerator extends IProjectInfoGeneratorBase {
  generate(
    projectItem: ProjectItem,
    contentIndex: ContentIndex,
    options?: IGeneratorOptions
  ): Promise<ProjectInfoItem[]>;
}
