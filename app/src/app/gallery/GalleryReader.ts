import Utilities from "../../core/Utilities";
import CreatorToolsHost from "../CreatorToolsHost";
import IGalleryItem from "../IGalleryItem";

export default class GalleryReader {
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
      imagePath = CreatorToolsHost.contentRoot + "res/latest/van/serve/resource_pack/textures/" + item.localLogo;
    }

    if (item.logoImage === undefined) return imagePath;

    if (item.gitHubRepoName === "bedrock-samples") {
      imagePath = CreatorToolsHost.contentRoot + Utilities.ensureEndsWithSlash("res/latest/van/serve/");
    } else {
      imagePath = CreatorToolsHost.contentRoot + "res/samples/" + item.gitHubOwner + "/" + item.gitHubRepoName + "-";

      if (item.gitHubBranch !== undefined) {
        imagePath += Utilities.ensureEndsWithSlash(item.gitHubBranch);
      } else {
        imagePath += "main/";
      }
    }

    imagePath += Utilities.ensureNotStartsWithSlash(item.logoImage);

    return imagePath;
  }
}
