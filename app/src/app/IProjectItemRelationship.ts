// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ProjectItem from "./ProjectItem";

export default interface IProjectItemRelationship {
  parentItem: ProjectItem;
  childItem: ProjectItem;
}
