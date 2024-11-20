import Database from "../minecraft/Database";
import { FieldDataType } from "./IField";
import IFormDefinition from "./IFormDefinition";

export interface IProcessorIssue {
  subject: string;
  message: string;
  path?: string;
}

export enum ProcessorFixupLevel {
  none = 0,
  perField = 1,
  full = 9,
}

export default class DataFormProcessor {
  static async process(
    obj: { [key: string]: any },
    form: string | IFormDefinition,
    fixupLevel?: ProcessorFixupLevel,
    path?: string,
    issues?: IProcessorIssue[]
  ) {
    if (path === undefined) {
      path = "";
    } else {
      path += ".";
    }

    if (issues === undefined) {
      issues = [];
    }

    let formInstance: IFormDefinition | undefined = undefined;

    if (typeof form === "string") {
      formInstance = await Database.ensureFormLoaded(form);
    } else {
      formInstance = form;
    }

    if (formInstance === undefined) {
      return;
    }

    for (const key in obj) {
      const val = obj[key as string] as any;

      let foundField = false;

      for (const field of formInstance.fields) {
        if (field.id === key) {
          foundField = true;

          if (field.dataType === FieldDataType.objectArray && field.subForm) {
            if (val && Array.isArray(val)) {
              for (const obj of val) {
                await DataFormProcessor.process(obj, field.subForm, fixupLevel, path + key, issues);
              }
            }
          }
          if (field.dataType === FieldDataType.keyedObjectCollection && field.subForm) {
            if (val && typeof val === "object") {
              for (const subKey in val) {
                const subObj = val[subKey];

                await DataFormProcessor.process(subObj, field.subForm, fixupLevel, path + key + "." + subKey, issues);
              }
            }
          } else if (field.dataType === FieldDataType.object && field.subForm) {
            if (val && typeof val === "object") {
              let keyCount = 0;

              for (const key in obj) {
                if (key) {
                  keyCount++;
                }
              }

              if (keyCount === 0 && field.undefinedIfEmpty) {
                issues.push({
                  subject: key,
                  message: "Object is defined but empty; should be undefined.",
                  path: path,
                });

                if (fixupLevel === ProcessorFixupLevel.perField || fixupLevel === ProcessorFixupLevel.full) {
                  obj[key] = undefined;
                }
              } else {
                await DataFormProcessor.process(val, field.subForm, fixupLevel, path + key, issues);
              }
            }
          } else if (
            field.dataType === FieldDataType.keyedStringArrayCollection ||
            field.dataType === FieldDataType.keyedKeyedStringArrayCollection
          ) {
            if (val && typeof val === "object") {
              let keyCount = 0;

              for (const key in val) {
                if (key) {
                  keyCount++;
                }
              }

              if (keyCount === 0 && field.undefinedIfEmpty) {
                issues.push({
                  subject: key,
                  message: "Object is defined but empty; should be undefined.",
                  path: path,
                });

                if (fixupLevel === ProcessorFixupLevel.perField || fixupLevel === ProcessorFixupLevel.full) {
                  obj[key] = undefined;
                }
              }
            }
          }
        }
      }

      if (!foundField) {
        issues.push({
          subject: key,
          message: "Could not find field in data definition.",
          path: path,
        });

        if (fixupLevel === ProcessorFixupLevel.full) {
          obj[key] = undefined;
        }
      }
    }
  }
}
