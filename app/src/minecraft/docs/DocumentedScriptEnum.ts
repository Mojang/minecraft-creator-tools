// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IDocScriptEnum from "./IDocScriptEnum";
import DocumentedModule from "./DocumentedModule";
import IFolder from "../../storage/IFolder";
import IFile from "../../storage/IFile";
import IDocScriptEnumConstant from "./IDocScriptEnumConstant";

export default class DocumentedScriptEnum {
  private _id?: string;
  private _isLoaded: boolean = false;
  private _undocumentedCount: number = 0;
  private _effectiveConstants: IDocScriptEnumConstant[] | undefined;

  public isInterface: boolean = false;

  private module: DocumentedModule;
  public infoJsonFiles: { [memberName: string]: IFile } | undefined;
  public enumDefinition: IDocScriptEnum;

  public get isLoaded() {
    return this._isLoaded;
  }

  public get undocumentedCount() {
    return this._undocumentedCount;
  }

  public get id() {
    return this._id;
  }

  public set id(newId: string | undefined) {
    this._id = newId;
  }

  public get docEnum() {
    return this.enumDefinition;
  }

  constructor(module: DocumentedModule, docEnum: IDocScriptEnum) {
    this.enumDefinition = docEnum;
    this.module = module;

    this._id = docEnum.name;
  }

  async load() {
    if (!this._isLoaded) {
      await this.ensureInfoJson(this.module.docFolder);
    }

    this._isLoaded = true;
  }

  getEffectiveConstants() {
    if (this._effectiveConstants) {
      return this._effectiveConstants;
    }

    const constants: IDocScriptEnumConstant[] = [];

    if (this.docEnum.constants) {
      constants.push(...this.docEnum.constants);
    }

    this._effectiveConstants = constants;

    return constants;
  }

  getConstant(name: string) {
    const constants = this.getEffectiveConstants();

    if (constants) {
      for (const constant of constants) {
        if (constant.name === name) {
          return constant;
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

  generateUndocumentedCount() {
    let unDocCount = 0;

    for (const functionName in this.infoJsonFiles) {
      const file = this.infoJsonFiles[functionName];

      let isDefaultDoced = false;

      if (functionName === "_enum") {
        if (this.docEnum.raw_tsdoc_text !== undefined && this.docEnum.raw_tsdoc_text.length > 2) {
          isDefaultDoced = true;
        }
      }

      if (!isDefaultDoced) {
        const constant = this.getConstant(functionName);
        if (constant && constant.raw_tsdoc_text && constant.raw_tsdoc_text.length > 2) {
          isDefaultDoced = true;
        }
      }

      if (!isDefaultDoced) {
        if (file.content === undefined || file.content === "" || typeof file.content !== "string") {
          unDocCount++;
        } else {
          try {
            const obj = JSON.parse(file.content) as any;

            if (!obj) {
              unDocCount++;
            } else {
              if (!obj.description || obj.description === "") {
                unDocCount++;
              }
            }
          } catch (e) {
            unDocCount++;
          }
        }
      }
    }

    this._undocumentedCount = unDocCount;
  }

  async ensureInfoJson(docsFolder: IFolder) {
    if (!this._id) {
      return;
    }

    const rootFolder = this.module.ensureDocFolder(docsFolder);

    if (!rootFolder) {
      return;
    }

    this.infoJsonFiles = {};

    const enumFolder = rootFolder.ensureFolder(this._id);

    const rootFile = enumFolder.ensureFile("info.json");

    await rootFile.loadContent();

    this.infoJsonFiles["_enum"] = rootFile;

    const constants = this.getEffectiveConstants();

    if (constants) {
      for (const docConstant of constants) {
        const memberFolder = enumFolder.ensureFolder(docConstant.name);
        const memberFile = memberFolder.ensureFile("info.json");

        await memberFile.loadContent();

        this.infoJsonFiles[docConstant.name] = memberFile;
      }
    }

    this.generateUndocumentedCount();
  }
}
