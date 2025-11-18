// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../../storage/IFile";
import Log from "../../core/Log";
import { EventDispatcher, IEventHandler } from "ste-events";
import IFolder from "../../storage/IFolder";
import IDocModule from "./IDocModule";
import DocumentedClass from "./DocumentedClass";
import { remappedMinecraftScriptModules } from "../../app/Project";
import DocumentedScriptEnum from "./DocumentedScriptEnum";

export default class DocumentedModule {
  private _file?: IFile;
  private _id?: string;
  private _name?: string;
  private _version?: string;
  private _isLoaded: boolean = false;
  private _isUnassociatedDocsLoaded: boolean = false;
  private _docFolder: IFolder;

  private _docClassesAndInterfaces: { [name: string]: DocumentedClass } = {};
  private _docEnums: { [name: string]: DocumentedScriptEnum } = {};

  private _associatedInfoJsonFiles: { [path: string]: IFile } = {};
  private _unassociatedInfoJsonFiles: { [path: string]: IFile } = {};

  public moduleDefinition?: IDocModule;

  private _onLoaded = new EventDispatcher<DocumentedModule, DocumentedModule>();

  public get isLoaded() {
    return this._isLoaded;
  }

  public get unassociatedInfoJsonFiles() {
    return this._unassociatedInfoJsonFiles;
  }

  public get isUnassociatedDocsLoaded() {
    return this._isUnassociatedDocsLoaded;
  }

  public get docFolder() {
    return this._docFolder;
  }

  public get classes() {
    return this._docClassesAndInterfaces;
  }

  public get enums() {
    return this._docEnums;
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

  public get uuid() {
    if (!this.moduleDefinition) {
      return undefined;
    }

    return this.moduleDefinition.uuid;
  }

  public get moduleType() {
    if (!this.moduleDefinition) {
      return undefined;
    }

    return this.moduleDefinition.module_type;
  }

  public get name() {
    if (this.moduleDefinition) {
      return this.moduleDefinition.name;
    }

    return this._name;
  }

  public get version() {
    if (this.moduleDefinition) {
      return this.moduleDefinition.version;
    }

    return this._version;
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

  associateParentClasses() {
    for (const docClassName in this.classes) {
      const docClass = this.classes[docClassName];

      docClass.parentClasses = [];

      const bts = docClass.docClass.base_types;

      if (bts) {
        for (const bt of bts) {
          const parentC = this.classes[bt.name];
          if (parentC) {
            docClass.parentClasses.push(parentC);
          }
        }
      }
    }
  }

  async loadUnassociatedDocumentation(force?: boolean) {
    if (this._isUnassociatedDocsLoaded && !force) {
      return;
    }

    this._associatedInfoJsonFiles = {};
    this._unassociatedInfoJsonFiles = {};

    for (const dcName in this._docClassesAndInterfaces) {
      const dc = this._docClassesAndInterfaces[dcName];

      for (const memberName in dc.infoJsonFiles) {
        const infoJson = dc.infoJsonFiles[memberName];

        if (infoJson) {
          this._associatedInfoJsonFiles[infoJson.storageRelativePath] = infoJson;
        }
      }
    }

    for (const dcName in this._docEnums) {
      const denum = this._docEnums[dcName];

      for (const memberName in denum.infoJsonFiles) {
        const infoJson = denum.infoJsonFiles[memberName];

        if (infoJson) {
          this._associatedInfoJsonFiles[infoJson.storageRelativePath] = infoJson;
        }
      }
    }

    await this.loadUnassociatedDocumentationFolder(this.docFolder);

    this._isUnassociatedDocsLoaded = true;
  }

  async loadUnassociatedDocumentationFolder(folder: IFolder) {
    if (!folder.isLoaded) {
      await folder.load();
    }

    for (const fileName in folder.files) {
      const file = folder.files[fileName];

      if (file && file.name === "info.json" && this._associatedInfoJsonFiles[file.storageRelativePath] === undefined) {
        this._unassociatedInfoJsonFiles[file.storageRelativePath] = file;
      }
    }

    for (const folderName in folder.folders) {
      const childFolder = folder.folders[folderName];

      if (childFolder) {
        await this.loadUnassociatedDocumentationFolder(childFolder);
      }
    }
  }

  static async ensureOnFile(
    file: IFile,
    docFolder: IFolder,
    loadHandler?: IEventHandler<DocumentedModule, DocumentedModule>
  ) {
    if (file.manager === undefined) {
      const dt = new DocumentedModule(docFolder);

      dt.file = file;

      file.manager = dt;
    }

    if (file.manager !== undefined && file.manager instanceof DocumentedModule) {
      const dt = file.manager as DocumentedModule;

      if (!dt.isLoaded) {
        if (loadHandler) {
          dt.onLoaded.subscribe(loadHandler);
        }

        await dt.load();
      }
    }
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

  async persist(): Promise<boolean> {
    if (this._file === undefined) {
      return false;
    }

    let didPersist = false;

    for (const docClassName in this._docClassesAndInterfaces) {
      const docClass = this._docClassesAndInterfaces[docClassName];

      if (await docClass.persist()) {
        didPersist = true;
      }
    }

    for (const docEnumName in this._docEnums) {
      const docEnum = this._docEnums[docEnumName];

      if (await docEnum.persist()) {
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

    try {
      const data: any = JSON.parse(this._file.content);

      this.moduleDefinition = data;
    } catch (e) {
      Log.fail("Could not parse documented module JSON " + e);
    }

    this._docClassesAndInterfaces = {};

    if (this.moduleDefinition && this.moduleDefinition.classes) {
      for (const docClass of this.moduleDefinition?.classes) {
        this._docClassesAndInterfaces[docClass.name] = new DocumentedClass(this, docClass);
      }

      for (const docClass of this.moduleDefinition?.interfaces) {
        const dc = new DocumentedClass(this, docClass);
        dc.isInterface = true;
        this._docClassesAndInterfaces[docClass.name] = dc;
      }
    }

    if (this.moduleDefinition && this.moduleDefinition.errors) {
      for (const docError of this.moduleDefinition.errors) {
        this._docClassesAndInterfaces[docError.name] = new DocumentedClass(this, docError);
      }
    }

    this._docEnums = {};

    if (this.moduleDefinition && this.moduleDefinition.enums) {
      for (const docEnum of this.moduleDefinition.enums) {
        this._docEnums[docEnum.name] = new DocumentedScriptEnum(this, docEnum);
      }
    }

    this._isLoaded = true;
  }
}
