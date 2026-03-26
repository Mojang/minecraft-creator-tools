import VsFsFolder from "./VsFsFolder";
import StorageBase from "../storage/StorageBase";
import IStorage from "../storage/IStorage";
import * as vscode from "vscode";
import VsFsFile from "./VsFsFile";
import IFile, { FileUpdateType } from "../storage/IFile";

export default class VsFsStorage extends StorageBase implements IStorage {
  path: string;
  name: string;

  rootFolder: VsFsFolder;

  constructor(context: vscode.ExtensionContext, path: string, name: string) {
    super();

    this.path = path;
    this.name = name;

    this.fileChange = this.fileChange.bind(this);
    this.fileCreate = this.fileCreate.bind(this);
    this.fileDelete = this.fileDelete.bind(this);

    this.rootFolder = new VsFsFolder(this, null, path);

    const fileSystemWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(this.rootFolder.uri, "*.*")
    );

    vscode.workspace.onDidChangeTextDocument((e) => {
      this.fileChange(e.document.uri);
    });
    vscode.workspace.onDidCreateFiles((e) => {
      const uris = e.files;

      for (let i = 0; i < uris.length; i++) {
        this.fileCreate(uris[i]);
      }
    });

    fileSystemWatcher.onDidChange(this.fileChange, context.subscriptions);
    fileSystemWatcher.onDidCreate(this.fileCreate, context.subscriptions);
    fileSystemWatcher.onDidDelete(this.fileDelete, context.subscriptions);
  }

  fileChange(uri: vscode.Uri) {
    let uriStr = uri.toString();

    if (uriStr.toLowerCase().startsWith(this.rootFolder.fullPath.toLowerCase())) {
      uriStr = uriStr.substring(this.rootFolder.fullPath.length - 1);
    } else {
      return;
    }

    this.rootFolder.getFileFromRelativePath(uriStr).then((val) => {
      if (val) {
        // console.log("File uri: reloaded " + uriStr);
        this.notifyFileContentsUpdated({
          file: val as IFile,
          updateType: FileUpdateType.regularEdit,
          priorVersion: undefined,
        });
        (val as VsFsFile).reload();
      }
    });
  }

  fileCreate(uri: vscode.Uri) {
    let uriStr = uri.toString();
    if (uriStr.toLowerCase().startsWith(this.rootFolder.fullPath.toLowerCase())) {
      uriStr = uriStr.substring(this.rootFolder.fullPath.length - 1);
    } else {
      return;
    }

    this.rootFolder.ensureFileFromRelativePath(uriStr).then((file) => {
      if (file) {
        this.notifyFileAdded(file);
        (file as VsFsFile).reload();
        // console.log("File uri: created" + uri.toString());
      }
    });
  }

  fileDelete(uri: vscode.Uri) {
    let uriStr = uri.toString();

    if (uriStr.toLowerCase().startsWith(this.rootFolder.fullPath.toLowerCase())) {
      uriStr = uriStr.substring(this.rootFolder.fullPath.length - 1);
    } else {
      return;
    }

    this.rootFolder.getFileFromRelativePath(uriStr).then((file) => {
      if (file) {
        this.notifyFileRemoved((file as IFile).storageRelativePath);
        file.deleteThisFile();
        // console.log("File uri: deleted" + uri.toString());
      }
    });
  }

  async getAvailable() {
    this.available = true;

    return this.available;
  }
}
