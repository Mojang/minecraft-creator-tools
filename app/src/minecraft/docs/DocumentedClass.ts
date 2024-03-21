// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IDocClass from "./IDocClass";
import DocumentedModule from "./DocumentedModule";
import IFolder from "../../storage/IFolder";
import IFile from "../../storage/IFile";
import IDocFunction from "./IDocFunction";
import IDocProperty from "./IDocProperty";

export default class DocumentedClass {
  private _id?: string;
  private _isLoaded: boolean = false;
  private _undocumentedCount: number = 0;
  private _effectiveFuncs: IDocFunction[] | undefined = undefined;
  private _effectiveProps: IDocProperty[] | undefined = undefined;

  public isInterface: boolean = false;

  private module: DocumentedModule;
  public infoJsonFiles: { [memberName: string]: IFile } | undefined = undefined;
  public classDefinition: IDocClass;

  public parentClasses: DocumentedClass[];

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

  public get docClass() {
    return this.classDefinition;
  }

  constructor(module: DocumentedModule, docClass: IDocClass) {
    this.classDefinition = docClass;
    this.module = module;
    this.parentClasses = [];

    this._id = docClass.name;
  }

  async load() {
    if (!this._isLoaded) {
      await this.ensureInfoJson(this.module.docFolder);
    }

    this._isLoaded = true;
  }

  getEffectiveFunctions() {
    if (this._effectiveFuncs) {
      return this._effectiveFuncs;
    }

    const funcs: IDocFunction[] = [];

    for (const parentClass of this.parentClasses) {
      const parentFuncs = parentClass.getEffectiveFunctions();
      if (parentFuncs) {
        funcs.push(...parentFuncs);
      }
    }

    if (this.docClass.functions) {
      funcs.push(...this.docClass.functions);
    }

    this._effectiveFuncs = funcs;

    return funcs;
  }

  getEffectiveProperties() {
    if (this._effectiveProps) {
      return this._effectiveProps;
    }

    const props: IDocProperty[] = [];

    for (const parentClass of this.parentClasses) {
      const parentProps = parentClass.getEffectiveProperties();
      if (parentProps) {
        props.push(...parentProps);
      }
    }

    if (this.docClass.properties) {
      props.push(...this.docClass.properties);
    }
    this._effectiveProps = props;

    return props;
  }

  getFunction(name: string) {
    const functions = this.getEffectiveFunctions();

    if (functions) {
      for (const func of functions) {
        if (func.name === name) {
          return func;
        }
      }
    }

    return undefined;
  }

  getProperty(name: string) {
    const properties = this.getEffectiveProperties();

    if (properties) {
      for (const prop of properties) {
        if (prop.name === name) {
          return prop;
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

      if (functionName === "_class") {
        if (this.docClass.raw_tsdoc_text !== undefined && this.docClass.raw_tsdoc_text.length > 2) {
          isDefaultDoced = true;
        }
      }

      if (!isDefaultDoced) {
        const func = this.getFunction(functionName);
        if (func && func.raw_tsdoc_text && func.raw_tsdoc_text.length > 2) {
          isDefaultDoced = true;
        }
      }

      if (!isDefaultDoced) {
        const prop = this.getProperty(functionName);
        if (prop && prop.raw_tsdoc_text && prop.raw_tsdoc_text.length > 2) {
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

    const classFolder = rootFolder.ensureFolder(this._id);

    const rootFile = classFolder.ensureFile("info.json");

    await rootFile.loadContent();

    this.infoJsonFiles["_class"] = rootFile;

    const funcs = this.getEffectiveFunctions();

    if (funcs) {
      for (const docFunction of funcs) {
        const memberFolder = classFolder.ensureFolder(docFunction.name);
        const memberFile = memberFolder.ensureFile("info.json");

        await memberFile.loadContent();

        this.infoJsonFiles[docFunction.name] = memberFile;
      }
    }

    const props = this.getEffectiveProperties();

    if (props) {
      for (const docProp of props) {
        const memberFolder = classFolder.ensureFolder(docProp.name);
        const memberFile = memberFolder.ensureFile("info.json");

        await memberFile.loadContent();

        this.infoJsonFiles[docProp.name] = memberFile;
      }
    }

    this.generateUndocumentedCount();
  }
}
