import MessageProxyFolder from "./MessageProxyFolder";
import StorageBase from "./../storage/StorageBase";
import IStorage from "./../storage/IStorage";
import Log from "../core/Log";
import CartoApp from "../app/CartoApp";
import { MessageProxyCommands } from "./MessageProxy";
import IFile from "../storage/IFile";
import MessageProxyFile from "./MessageProxyFile";

export default class MessageProxyStorage extends StorageBase implements IStorage {
  path: string;
  name?: string;
  channelId: string;
  isEnabled: boolean = true;
  rootFolder: MessageProxyFolder;

  static folderDelimiter = "\\";

  static determineDelimiter(path: string) {
    if (path.indexOf("\\") >= 0) {
      MessageProxyStorage.folderDelimiter = "\\";
    } else {
      MessageProxyStorage.folderDelimiter = "/";
    }
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

    CartoApp.onMessage.subscribe(this._handleNewMessage);
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
            await (val as MessageProxyFile).deleteFile();
            this.notifyFileRemoved(srPath);
          }
        });
      } else if (message === MessageProxyCommands.notifyFileContentsUpdated) {
        const srPath = message;

        this.rootFolder.getFileFromRelativePath(srPath).then(async (val) => {
          if (val) {
            await (val as MessageProxyFile).reload();

            this.notifyFileContentsUpdated(val as IFile);
          } else {
            Log.unexpectedUndefined("HNMA");
          }
        });
      }
    }
  }

  joinPath(pathA: string, pathB: string) {
    let fullPath = pathA;

    if (!fullPath.endsWith(MessageProxyStorage.folderDelimiter)) {
      fullPath += MessageProxyStorage.folderDelimiter;
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
