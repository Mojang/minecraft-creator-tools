import EntityTypeDefinition from "./EntityTypeDefinition";
import IManagedComponentSetItem from "./IManagedComponentSetItem";
import Log from "../core/Log";
import IFormDefinition from "../dataform/IFormDefinition";
import IManagedComponent from "./IManagedComponent";
import Database from "./Database";
import { FieldDataType } from "../dataform/IField";
import { MinecraftEventTrigger } from "./jsoncommon";
import { ManagedComponent } from "./ManagedComponent";
import { IComponentContainer } from "./IComponentDataItem";

export interface TriggerDescription {
  path: string;
  reference?: string | MinecraftEventTrigger;
  referenceId?: string;
}

export default class EntityTypeComponentSetUtilities {
  static async getTriggers(componentSet: IManagedComponentSetItem, isBaseComponent: boolean) {
    const allTriggers: TriggerDescription[] = [];

    const comps = componentSet.getComponents();

    for (const comp of comps) {
      let formName = comp.id;

      if (formName.startsWith("minecraft:") && (isBaseComponent || formName !== "minecraft:breedable")) {
        formName = EntityTypeDefinition.getFormIdFromComponentId(formName);

        const form = await Database.ensureFormLoaded("entity", formName);

        Log.assert(form !== undefined);

        if (form) {
          await EntityTypeComponentSetUtilities.processFormForTriggers(allTriggers, form, comp, comp.id);
        }
      }
    }

    return allTriggers;
  }

  static async processFormForTriggers(
    triggers: TriggerDescription[],
    form: IFormDefinition,
    component: IManagedComponent | undefined,
    propertyPath: string
  ) {
    for (const field of form.fields) {
      if ((field.dataType === FieldDataType.object || field.dataType === FieldDataType.objectArray) && field.subForm) {
        let obj = undefined;

        if (component) {
          obj = component.getProperty(field.id);
        }
        const data = component?.getData();

        if (data && typeof data === "object") {
          if (field.dataType === FieldDataType.objectArray && Array.isArray(obj)) {
            let index = 0;
            for (const arrObj of obj) {
              await this.processFormForTriggers(
                triggers,
                field.subForm,
                new ManagedComponent(data as IComponentContainer, field.id, arrObj),
                propertyPath + "." + field.id + "." + index
              );
              index++;
            }
          } else {
            await this.processFormForTriggers(
              triggers,
              field.subForm,
              new ManagedComponent(data as IComponentContainer, field.id, obj),
              propertyPath + "." + field.id
            );
          }
        }
      } else if (
        field.dataType === FieldDataType.minecraftEventTrigger ||
        field.dataType === FieldDataType.minecraftEventReference
      ) {
        let ref = undefined;

        if (component) {
          ref = component.getProperty(field.id);
        }
        const path = propertyPath + "." + field.id;

        if (!ref) {
          triggers.push({
            path: path,
          });
        } else {
          triggers.push({
            path: path,
            reference: ref,
            referenceId: (ref as MinecraftEventTrigger).event ? (ref as MinecraftEventTrigger).event : ref,
          });
        }
      }
    }
  }
}
