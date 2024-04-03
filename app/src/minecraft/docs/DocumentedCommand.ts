// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFolder from "../../storage/IFolder";
import IFile from "../../storage/IFile";
import DocumentedCommandSet from "./DocumentedCommandSet";
import IDocCommand from "./IDocCommand";
import IDocCommandOverloadParam from "./IDocCommandOverloadParam";

export default class DocumentedCommand {
  private _id?: string;
  private _isLoaded: boolean = false;

  public commandSet: DocumentedCommandSet;
  public infoJsonFiles: { [memberName: string]: IFile } | undefined;
  public commandDefinition: IDocCommand;

  public get isLoaded() {
    return this._isLoaded;
  }

  public get id() {
    return this._id;
  }

  public set id(newId: string | undefined) {
    this._id = newId;
  }

  public get docCommand() {
    return this.commandDefinition;
  }

  constructor(commandSet: DocumentedCommandSet, docCommand: IDocCommand) {
    this.commandDefinition = docCommand;
    this.commandSet = commandSet;

    this._id = docCommand.name;
  }

  async load() {
    await this.ensureInfoJson(this.commandSet.docFolder);

    this._isLoaded = true;
  }

  getOverloads() {
    return this.docCommand.overloads;
  }

  getArguments() {
    const overloadArgs: { [paramName: string]: IDocCommandOverloadParam } = {};

    for (const overload of this.docCommand.overloads) {
      for (const param of overload.params) {
        overloadArgs[param.name] = param;
      }
    }

    return overloadArgs;
  }

  getOverload(index: number) {
    const overloads = this.docCommand.overloads;

    if (overloads && overloads.length > index) {
      return overloads[index];
    }

    return undefined;
  }

  getParam(name: string) {
    const overloads = this.docCommand.overloads;

    if (overloads) {
      for (const overload of overloads) {
        for (const param of overload.params) {
          if (param.name === name) {
            return param;
          }
        }
      }
    }

    return undefined;
  }

  getAlias(name: string) {
    const aliases = this.docCommand.aliases;

    if (aliases) {
      for (const alias of aliases) {
        if (alias.alias === name) {
          return alias;
        }
      }
    }

    return undefined;
  }

  public async persist() {
    if (this.infoJsonFiles) {
      for (const fileName in this.infoJsonFiles) {
        const infoJsonFile = this.infoJsonFiles[fileName];

        await infoJsonFile.saveContent();
      }
    }
  }

  async ensureInfoJson(docsFolder: IFolder) {
    if (!this._id) {
      return;
    }

    const rootFolder = this.commandSet.ensureDocFolder(docsFolder);

    if (!rootFolder) {
      return;
    }

    const commandsFolder = rootFolder.ensureFolder("commands");

    if (!commandsFolder) {
      return;
    }

    this.infoJsonFiles = {};

    const commandFolder = commandsFolder.ensureFolder(this._id);

    const rootFile = commandFolder.ensureFile("info.json");

    await rootFile.loadContent();

    this.infoJsonFiles["_command"] = rootFile;
    const paramTypeNames: string[] = [];

    for (const docOverload of this.commandDefinition.overloads) {
      for (const docParam of docOverload.params) {
        if (docParam.type && docParam.type.name && !paramTypeNames.includes(docParam.type.name)) {
          paramTypeNames.push(docParam.type.name);
        }
      }
    }

    for (const paramTypeName of paramTypeNames) {
      const enumVal = this.commandSet.getEnum(paramTypeName);

      if (enumVal && !this.commandSet.isEnumUsedInMultipleCommands(enumVal)) {
        const enumFolder = commandFolder.ensureFolder("command_enums").ensureFolder(enumVal.name);

        const exists = await enumFolder.exists();

        if (exists) {
          const enumFile = enumFolder.ensureFile("info.json");

          await enumFile.loadContent();

          this.infoJsonFiles[enumVal.name] = enumFile;
        }
      }
    }
  }
}
