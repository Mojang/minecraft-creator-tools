import IProperty from "../dataform/IProperty";
import ComponentizedBase from "./ComponentizedBase";
import Database from "./../minecraft/Database";
import Log from "./../core/Log";
import IFormDefinition from "../dataform/IFormDefinition";
import IField, { FieldDataType } from "../dataform/IField";
import NumberValueComponent from "./components/NumberValueComponent";

export default class ComponentProperty implements IProperty {
  public id: string;
  private _item: ComponentizedBase;

  private _form?: IFormDefinition;
  private _field?: IField;
  private isCoreProp: boolean = false;
  private isInstanceProp: boolean = false;

  constructor(item: ComponentizedBase, id: string) {
    this._item = item;
    this.id = id;
  }

  load() {
    if (Database.uxCatalog === null || this._form !== undefined) {
      return;
    }

    const result = Database.getComponentFormField(this.id);

    if (result !== undefined) {
      this._form = result.form;

      if (this._form.id === "entityCore") {
        this.isCoreProp = true;
      } else if (this._form.id === "entityInstance") {
        this.isInstanceProp = true;
      }

      this._field = result.field;
    } else {
      Log.debugAlert("Form field " + this.id + " not found.");
    }
  }

  public get type() {
    if (this._field !== undefined) {
      return this._field.dataType;
    }

    return FieldDataType.string;
  }

  get defaultValue(): string | number | number[] | bigint | bigint[] | boolean | undefined {
    if (this._field === undefined) {
      Log.fail("Unbacked component property '" + this.id + "' found.");
      return undefined;
    }

    return this._field.defaultValue;
  }

  get value(): string | number | number[] | bigint | bigint[] | boolean | undefined {
    if (this._field === undefined) {
      Log.fail("Unbacked component property '" + this.id + "' found.");
      return undefined;
    }

    if (this.isCoreProp && this._field.groupId !== undefined) {
      const componentId = this._field.groupId;
      const component = this._item.getComponent(componentId);

      if (this._field.dataType === FieldDataType.boolean) {
        if (component !== undefined) {
          return true;
        } else {
          return false;
        }
      } else if (
        this._field.dataType === FieldDataType.number ||
        this._field.dataType === FieldDataType.int ||
        this._field.dataType === FieldDataType.intBoolean ||
        this._field.dataType === FieldDataType.intValueLookup
      ) {
        if (component !== undefined) {
          const val = (component as NumberValueComponent).value;

          return val;
        }
      }
    } else if (!this.isCoreProp && this._form !== undefined && this._field !== undefined) {
      const componentId = this._form.id;
      const component = this._item.getComponent(componentId);
      if (component !== undefined && typeof component !== "object") {
        return component[this._field.id];
      }
    }

    return this.defaultValue;
  }

  asBoolean(defaultVal: boolean): boolean {
    const val = this.value;

    if (val === null || val === undefined) {
      return defaultVal;
    }

    if (typeof val === "boolean") {
      return val;
    } else if (typeof val === "number") {
      return val !== 0;
    } else if (typeof val === "string") {
      return val === "true" || val === "1";
    }

    return defaultVal;
  }

  asString(defaultVal: string): string {
    const val = this.value;

    if (val === null || val === undefined) {
      return defaultVal;
    }

    return val.toString();
  }

  asNumber(defaultVal: number): number {
    const val = this.value;

    if (val === null || val === undefined) {
      return defaultVal;
    }

    if (typeof val === "number") {
      return val;
    } else if (typeof val === "string") {
      return parseInt(val);
    } else if (typeof val === "boolean") {
      if (val) {
        return 1;
      } else {
        return 0;
      }
    }

    return defaultVal;
  }

  set value(newValue: string | number | number[] | bigint | bigint[] | boolean | undefined) {
    const val = this.value;

    if (val !== newValue) {
    }
  }
}
