// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFolder from "../storage/IFolder";
import { MinecraftTrack } from "./ICartoData";
import IGalleryItem from "./IGalleryItem";

export default interface IProjectSeed {
  name?: string;
  shortName?: string;
  creator?: string;
  description?: string;
  path?: string;
  track?: MinecraftTrack;
  galleryProject?: IGalleryItem;
  targetFolder?: IFolder;
  targetFolderTitle?: string;
}
