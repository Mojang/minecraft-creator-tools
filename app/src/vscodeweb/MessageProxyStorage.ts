import MessageProxyFolder from "./MessageProxyFolder";
import StorageBase from "./../storage/StorageBase";
import IStorage from "./../storage/IStorage";
import Log from "../core/Log";
import CreatorToolsHost from "../app/CreatorToolsHost";
import { MessageProxyCommands } from "./MessageProxy";
import IFile from "../storage/IFile";
import MessageProxyFile from "./MessageProxyFile";

export default class MessageProxyStorage extends StorageBase implements IStorage {
  path: string;
  name?: string;
  channelId: string;
  isEnabled: boolean = true;
  rootFolder: MessageProxyFolder;

  // Use forward slash for URI-based paths (VS Code web uses URIs like vscode-test-web://mount/)
  static messageFolderDelimiter = "/";

  get folderDelimiter() {
    return MessageProxyStorage.messageFolderDelimiter;
  }

  constructor(channelId: string, path: string, name?: string) {
    super();

    Log.assert(channelId !== "", "Unexpected empty channel");
    this.channelId = channelId;

    this.path = path;
    this.name = name;

    if (!name) {
      name = "";
    }

    this.rootFolder = new MessageProxyFolder(this, null, path, name);

    CreatorToolsHost.onMessage.subscribe(this._handleNewMessage);
  }

  private _handleNewMessage(source: any, message: any) {
    if (message.command && message.command.length > 0 && message.id === this.channelId) {
      if (message === MessageProxyCommands.notifyFileAdded) {
        const srPath = message;

        this.rootFolder.ensureFileFromRelativePath(srPath).then(async (val) => {
          if (val) {
            await (val as MessageProxyFile).reload();

            this.notifyFileAdded(val as IFile);
          } else {
            Log.unexpectedUndefined("HNM");
          }
        });
      } else if (message === MessageProxyCommands.notifyFileRemoved) {
        const srPath = message;

        this.rootFolder.ensureFileFromRelativePath(srPath).then(async (val) => {
          if (val) {
            await (val as MessageProxyFile).deleteThisFile();
            this.notifyFileRemoved(srPath);
          }
        });
      } else if (message === MessageProxyCommands.notifyFileContentsUpdated) {
        const srPath = message;

        this.rootFolder.getFileFromRelativePath(srPath).then(async (val) => {
          if (val) {
            await (val as MessageProxyFile).reload();

            this.notifyFileContentsUpdated({ file: val as IFile, updateType: message.updateType });
          } else {
            Log.unexpectedUndefined("HNMA");
          }
        });
      }
    }
  }

  joinPath(pathA: string, pathB: string) {
    let fullPath = pathA;

    if (!fullPath.endsWith(MessageProxyStorage.messageFolderDelimiter)) {
      fullPath += MessageProxyStorage.messageFolderDelimiter;
    }

    fullPath += pathB;

    return fullPath;
  }

  static getParentFolderPath(path: string) {
    const lastDelim = path.lastIndexOf(this.messageFolderDelimiter);

    if (lastDelim < 0) {
      return path;
    }

    return path.substring(0, lastDelim);
  }

  async getAvailable() {
    this.available = true;

    return this.available;
  }
}
