// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import Utilities from "../../core/Utilities";
import CreatorToolsHost from "../CreatorToolsHost";
import IGalleryItem from "../IGalleryItem";

export default class GalleryReader {
  /**
   * Maps a GitHub repository name (e.g., "minecraft-samples") to the shortened
   * local folder name used under res/samples/<owner>/. These must match the
   * `replaceFirstFolderWith` values in app/reslist/*.resources.json.
   *
   * Falls back to the conventional `<repoName>-<branch>` pattern for unknown repos.
   */
  static readonly repoFolderMap: Record<string, string> = {
    "minecraft-samples": "samples",
    "minecraft-scripting-samples": "script-samples",
    "minecraft-gametests": "gametests",
  };

  static getLocalRepoFolder(gitHubRepoName: string, gitHubBranch?: string): string {
    return GalleryReader.repoFolderMap[gitHubRepoName] ?? gitHubRepoName + "-" + (gitHubBranch ?? "main");
  }

  constructor(private defaultProjectImage: string) {}

  private getStandinImage() {
    return this.defaultProjectImage;
  }

  public getGalleryImage(item: IGalleryItem) {
    if (item.logoImage === undefined && item.localLogo === undefined) {
      return this.getStandinImage();
    }

    let imagePath = item.logoImage;

    if (imagePath === undefined) {
      imagePath = CreatorToolsHost.getVanillaContentRoot() + "res/latest/van/serve/resource_pack/textures/" + item.localLogo;
    }

    if (item.logoImage === undefined) return imagePath;

    if (item.gitHubRepoName === "bedrock-samples") {
      imagePath = CreatorToolsHost.getVanillaContentRoot() + Utilities.ensureEndsWithSlash("res/latest/van/serve/");
    } else {
      imagePath =
        CreatorToolsHost.contentWebRoot +
        "res/samples/" +
        item.gitHubOwner +
        "/" +
        GalleryReader.getLocalRepoFolder(item.gitHubRepoName ?? "", item.gitHubBranch) +
        "/";
    }

    imagePath += Utilities.ensureNotStartsWithSlash(item.logoImage);

    return imagePath;
  }
}
