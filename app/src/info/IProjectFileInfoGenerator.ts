// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ProjectInfoItem from "./ProjectInfoItem";
import IFile from "../storage/IFile";
import IProjectInfoGeneratorBase from "./IProjectInfoGeneratorBase";
import Project from "../app/Project";
import ContentIndex from "../core/ContentIndex";

export default interface IProjectFileInfoGenerator extends IProjectInfoGeneratorBase {
  generate(project: Project, projectFile: IFile, contentIndex: ContentIndex): Promise<ProjectInfoItem[]>;
}
