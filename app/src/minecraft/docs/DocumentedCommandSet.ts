// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../../storage/IFile";
import { EventDispatcher, IEventHandler } from "ste-events";
import IFolder from "../../storage/IFolder";
import DocumentedCommand from "./DocumentedCommand";
import { remappedMinecraftScriptModules } from "../../app/Project";
import IDocCommandSet from "./IDocCommandSet";
import IDocCommandEnum from "./IDocCommandEnum";
import StorageUtilities from "../../storage/StorageUtilities";

export default class DocumentedCommandSet {
  private _file?: IFile;
  private _id?: string;
  private _name?: string;
  private _version?: string;
  private _isLoaded: boolean = false;
  private _docFolder: IFolder;

  private _docCommands: { [name: string]: DocumentedCommand } = {};

  public commandSetDefinition?: IDocCommandSet;

  private _onLoaded = new EventDispatcher<DocumentedCommandSet, DocumentedCommandSet>();

  public get isLoaded() {
    return this._isLoaded;
  }

  public get docFolder() {
    return this._docFolder;
  }

  public get commands() {
    return this._docCommands;
  }

  public get file() {
    return this._file;
  }

  public set file(newFile: IFile | undefined) {
    this._file = newFile;
  }

  public get onLoaded() {
    return this._onLoaded.asEvent();
  }

  public get name() {
    if (this.commandSetDefinition) {
      return this.commandSetDefinition.name;
    }

    return this._name;
  }

  public get id() {
    return this._id;
  }

  public set id(newId: string | undefined) {
    this._id = newId;

    if (newId) {
      const underscore = newId.lastIndexOf("_");

      if (underscore >= 0 && underscore < newId.length - 2) {
        this._name = newId.substring(0, underscore);
        this._version = newId.substring(underscore + 1);
      } else {
        this._name = newId;
        this._version = "";
      }
    }
  }

  constructor(docFolder: IFolder) {
    this._docFolder = docFolder;
  }

  getEnum(name: string) {
    const enums = this.commandSetDefinition?.command_enums;

    if (enums) {
      name = name.toLowerCase();

      for (const enumItem of enums) {
        if (enumItem.name.toLowerCase() === name) {
          return enumItem;
        }
      }
    }

    return undefined;
  }

  static async ensureOnFile(
    file: IFile,
    docFolder: IFolder,
    loadHandler?: IEventHandler<DocumentedCommandSet, DocumentedCommandSet>
  ) {
    let dt: DocumentedCommandSet | undefined;

    if (file.manager === undefined) {
      dt = new DocumentedCommandSet(docFolder);

      dt.file = file;

      file.manager = dt;
    }

    if (file.manager !== undefined && file.manager instanceof DocumentedCommandSet) {
      dt = file.manager as DocumentedCommandSet;

      if (!dt.isLoaded) {
        if (loadHandler) {
          dt.onLoaded.subscribe(loadHandler);
        }

        await dt.load();
      }
    }

    return dt;
  }

  ensureDocFolder(docsFolder: IFolder) {
    if (!this.name) {
      return;
    }

    let folderName = this.name;

    folderName = folderName.toLowerCase();

    if (remappedMinecraftScriptModules[folderName]) {
      folderName = remappedMinecraftScriptModules[folderName];
    }

    const folders = folderName.split("/");

    let curFolder = docsFolder;

    for (let i = 0; i < folders.length; i++) {
      curFolder = curFolder.ensureFolder(folders[i]);
    }

    return curFolder;
  }

  isEnumUsedInMultipleCommands(enumInstance: IDocCommandEnum) {
    let commandCount = 0;

    for (const commandName in this.commands) {
      const command = this.commands[commandName];

      if (command) {
        let isInCommand = false;
        const overloads = command.getOverloads();

        for (const overload of overloads) {
          for (const param of overload.params) {
            if (param.type && param.type.name.toUpperCase() === enumInstance.name.toUpperCase()) {
              isInCommand = true;
            }
          }
        }

        if (isInCommand) {
          commandCount++;

          if (commandCount > 1) {
            return true;
          }
        }
      }
    }

    return false;
  }

  async persist(): Promise<boolean> {
    if (this._file === undefined) {
      return false;
    }

    let didPersist = false;

    for (const docCommandName in this._docCommands) {
      const docCommand = this._docCommands[docCommandName];

      if (await docCommand.persist()) {
        didPersist = true;
      }
    }

    return didPersist;
  }

  async load() {
    if (this._file === undefined || this._isLoaded) {
      return;
    }

    if (!this._file.isContentLoaded) {
      await this._file.loadContent();
    }

    if (this._file.content === null || this._file.content instanceof Uint8Array) {
      return;
    }

    this.id = this._file.name;

    this.commandSetDefinition = StorageUtilities.getJsonObject(this._file);

    this._docCommands = {};

    if (this.commandSetDefinition) {
      for (const docClass of this.commandSetDefinition?.commands) {
        this._docCommands[docClass.name] = new DocumentedCommand(this, docClass);
      }
    }

    this._isLoaded = true;
  }
}
