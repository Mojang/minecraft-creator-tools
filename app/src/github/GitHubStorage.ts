import GitHubFolder from "./GitHubFolder";
import StorageBase from "../storage/StorageBase";
import IStorage from "../storage/IStorage";
import GitHubManager from "./GitHubManager";

export default class GitHubStorage extends StorageBase implements IStorage {
  rootFolder: GitHubFolder;
  manager: GitHubManager;
  repoName: string;
  ownerName: string;
  branch?: string;

  subPath: string;

  static readonly folderDelimiter = "/";

  constructor(manager: GitHubManager, repoName: string, ownerName: string, branch?: string, subPath: string = "") {
    super();

    this.manager = manager;
    this.repoName = repoName;
    this.branch = branch;
    this.ownerName = ownerName;

    this.subPath = subPath;

    this.rootFolder = new GitHubFolder(this, null, subPath, "");
  }

  joinPath(pathA: string, pathB: string) {
    let fullPath = pathA;

    if (!fullPath.endsWith(GitHubStorage.folderDelimiter)) {
      fullPath += GitHubStorage.folderDelimiter;
    }

    fullPath += pathB;

    return fullPath;
  }

  static getParentFolderPath(path: string) {
    const lastDelim = path.lastIndexOf(this.folderDelimiter);

    if (lastDelim < 0) {
      return path;
    }

    return path.substring(0, lastDelim);
  }
}
