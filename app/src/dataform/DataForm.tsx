import { Component, SyntheticEvent } from "react";
import "./DataForm.css";
import IField, { FieldDataType, FieldExperienceType, FieldVisualExperience } from "./IField";
import IFormDefinition from "./IFormDefinition";
import IProperty from "./IProperty";
import {
  DropdownItemProps,
  DropdownProps,
  FormDropdown,
  FormInput,
  FormCheckbox,
  InputProps,
  TextArea,
  TextAreaProps,
  ButtonProps,
  Toolbar,
  Slider,
  SliderProps,
  ThemeInput,
  CheckboxProps,
  Button,
} from "@fluentui/react-northstar";
import Log from "./../core/Log";
import Point3, { IPoint3Props } from "./Point3";
import Version, { IVersionProps } from "./Version";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faXmark } from "@fortawesome/free-solid-svg-icons";
import ScalarArray, { IScalarArrayProps } from "./ScalarArray";
import Range, { IRangeProps } from "./Range";
import MinecraftFilterEditor, { IMinecraftFilterEditorProps } from "./MinecraftFilterEditor";
import ISimpleReference from "./ISimpleReference";
import Utilities from "../core/Utilities";
import IDataContainer from "./IDataContainer";
import FieldUtilities from "./FieldUtilities";
import StorageUtilities from "../storage/StorageUtilities";
import Carto from "../app/Carto";
import Project from "../app/Project";
import EntityTypeDefinition from "../minecraft/EntityTypeDefinition";
import BlockTypeDefinition from "../minecraft/BlockTypeDefinition";
import ItemTypeDefinition from "../minecraft/ItemTypeDefinition";
import MinecraftEventTriggerEditor from "./MinecraftEventTriggerEditor";
import Database from "../minecraft/Database";
import DataFormUtilities from "./DataFormUtilities";
import ILookupProvider from "./ILookupProvider";
import { MinecraftEventTrigger } from "../minecraft/jsoncommon";
import { CustomLabel } from "../UX/Labels";
import VanillaProjectManager from "../minecraft/VanillaProjectManager";

export interface IDataFormProps extends IDataContainer {
  definition: IFormDefinition;
  lookupSets?: { [lookupId: string]: ISimpleReference[] };
  objectKey?: string;
  displayTitle?: boolean;
  displaySubTitle?: boolean;
  title?: string;
  titleFieldBinding?: string;
  subTitle?: string;
  indentLevel?: number;
  displayNarrow?: boolean;
  tag?: any;
  parentField?: IField;
  carto?: Carto;
  project?: Project;
  select?: string;
  lookupProvider?: ILookupProvider;
  itemDefinition?: EntityTypeDefinition | BlockTypeDefinition | ItemTypeDefinition | undefined;
  formId?: string;
  theme: ThemeInput<any>;
  closeButton?: boolean;
  constrainHeight?: boolean;
  defaultVisualExperience?: FieldVisualExperience;
  displayDescription?: boolean;
  ambientSelectedPoint?: number[] | undefined;
  tagData?: any;
  readOnly: boolean;
  onClose?: (props: IDataFormProps) => void;
  onPropertyChanged?: (props: IDataFormProps, property: IProperty, newValue: any, updatingObject?: any) => void;
}

interface IDataFormState {
  objectIncrement: number;
  updatedDirectObject?: any;
  subFormLoadState: string | undefined;
  keyAliases: { [name: string]: string };
  lookups: { [name: string]: ISimpleReference[] | undefined };
}

export default class DataForm extends Component<IDataFormProps, IDataFormState> {
  private dropdownNames: string[] = [];
  private dropdownItems: DropdownItemProps[][] = [];
  private checkboxNames: string[] = [];
  private checkboxItems: any[] = [];
  private formComponentNames: string[] = [];
  private formComponents: any[] = [];

  private _workingValues: { [name: string]: string } = {};

  constructor(props: IDataFormProps) {
    super(props);

    this._addObjectArrayItem = this._addObjectArrayItem.bind(this);
    this._handleCheckboxChange = this._handleCheckboxChange.bind(this);
    this._handleDropdownChange = this._handleDropdownChange.bind(this);
    this._handleBlockChanged = this._handleBlockChanged.bind(this);
    this._handleTextboxChange = this._handleTextboxChange.bind(this);
    this._handleSliderChange = this._handleSliderChange.bind(this);
    this._handleTextAreaChange = this._handleTextAreaChange.bind(this);
    this._handleCloseClick = this._handleCloseClick.bind(this);
    this._handlePoint3PropertyChange = this._handlePoint3PropertyChange.bind(this);
    this._handleVersionPropertyChange = this._handleVersionPropertyChange.bind(this);
    this._handleRangePropertyChange = this._handleRangePropertyChange.bind(this);
    this._handleStringArrayPropertyChange = this._handleStringArrayPropertyChange.bind(this);
    this._handleMinecraftFilterPropertyChange = this._handleMinecraftFilterPropertyChange.bind(this);
    this._handleMinecraftEventTriggerPropertyChange = this._handleMinecraftEventTriggerPropertyChange.bind(this);
    this._handleIndexedArraySubFormPropertyChange = this._handleIndexedArraySubFormPropertyChange.bind(this);
    this._handleKeyedObjectArraySubFormPropertyChange = this._handleKeyedObjectArraySubFormPropertyChange.bind(this);
    this._handleObjectSubFormPropertyChange = this._handleObjectSubFormPropertyChange.bind(this);
    this._handleKeyedObjectArraySubFormClose = this._handleKeyedObjectArraySubFormClose.bind(this);
    this._handleIndexedArraySubFormClose = this._handleIndexedArraySubFormClose.bind(this);
    this._addKeyedBooleanItem = this._addKeyedBooleanItem.bind(this);
    this._addKeyedStringItem = this._addKeyedStringItem.bind(this);
    this._handleKeyedBooleanTextChange = this._handleKeyedBooleanTextChange.bind(this);
    this._handleKeyedBooleanValueChange = this._handleKeyedBooleanValueChange.bind(this);
    this._handleKeyedBooleanValueClose = this._handleKeyedBooleanValueClose.bind(this);
    this._handleKeyedStringTextChange = this._handleKeyedStringTextChange.bind(this);
    this._handleKeyedStringValueChange = this._handleKeyedStringValueChange.bind(this);
    this._handleKeyedStringValueClose = this._handleKeyedStringValueClose.bind(this);
    this._load = this._load.bind(this);
    this._handleDropdownTextChange = this._handleDropdownTextChange.bind(this);

    this.state = {
      objectIncrement: 0,
      subFormLoadState: undefined,
      keyAliases: {},
      lookups: {},
    };
  }

  componentDidMount(): void {
    this._load();
  }

  componentDidUpdate(prevProps: IDataFormProps, prevState: IDataFormState) {
    if (prevProps !== undefined && prevProps.dataPropertyObject !== undefined) {
      prevProps.dataPropertyObject.onPropertyChanged.unsubscribe(this._handleBlockChanged);
    }

    if (this.props !== undefined && this.props.dataPropertyObject !== undefined) {
      this.props.dataPropertyObject.onPropertyChanged.unsubscribe(this._handleBlockChanged);
    }

    if (
      this.props !== undefined &&
      this.props.definition &&
      prevProps.definition &&
      this.props.definition !== prevProps.definition
    ) {
      this._load();
    }
  }

  async _load() {
    const subFormLoadState = await DataFormUtilities.loadSubForms(this.props.definition);

    this.setState({
      updatedDirectObject: undefined,
      objectIncrement: this.state.objectIncrement,
      keyAliases: this.state.keyAliases,
      subFormLoadState: subFormLoadState,
      lookups: this.state.lookups,
    });

    if (this.props.lookupProvider && this.props.definition && this.props.definition.fields) {
      const lookUps: { [name: string]: ISimpleReference[] | undefined } = {};

      for (const coreField of this.props.definition.fields) {
        const unrolledFields = DataFormUtilities.getFieldAndAlternates(coreField);

        for (const field of unrolledFields) {
          if (
            field.lookupId &&
            lookUps[field.lookupId] === undefined &&
            Utilities.isUsableAsObjectKey(field.lookupId)
          ) {
            lookUps[field.lookupId] = await this.props.lookupProvider.getLookupChoices(field.lookupId);
          }
        }
      }

      await VanillaProjectManager.getBlocksCatalog();
      await VanillaProjectManager.getTerrainTexturesCatalog();

      this.setState({
        updatedDirectObject: undefined,
        objectIncrement: this.state.objectIncrement,
        keyAliases: this.state.keyAliases,
        subFormLoadState: subFormLoadState,
        lookups: lookUps,
      });
    }
  }

  _handleBlockChanged() {
    this._incrementObjectState();
  }

  _incrementObjectState() {
    this.setState({
      objectIncrement: this.state.objectIncrement + 1,
      subFormLoadState: this.state.subFormLoadState,
      keyAliases: this.state.keyAliases,
    });
  }

  _getObjectId() {
    if (this.props.objectKey) {
      return this.props.objectKey;
    }

    const fieldId = this._getProperty("id");

    if (fieldId) {
      return fieldId;
    }

    return this.state.objectIncrement.toString();
  }

  _getProperty(name: string, defaultValue?: any) {
    let value = undefined;

    if (defaultValue === undefined) {
      const field = this._getFieldById(name);

      if (field) {
        defaultValue = field.defaultValue;
      }
    }

    if (this.props.dataPropertyObject !== undefined) {
      const prop = this.props.dataPropertyObject.getProperty(name);

      if (prop !== undefined) {
        value = prop.value;
      }
    }

    if (this.props.getsetPropertyObject !== undefined) {
      if (name === "__scalar") {
      }
      value = this.props.getsetPropertyObject.getProperty(name);
    }

    let directObject: { [name: string]: any } | undefined = undefined;

    if (this.state.updatedDirectObject !== undefined) {
      directObject = this.state.updatedDirectObject;
    } else if (this.props.directObject !== undefined) {
      directObject = this.props.directObject;
    }

    if (directObject) {
      directObject = this._upscaleDirectObject(directObject);

      value = directObject[name];
    }

    if (value === undefined) {
      if (defaultValue !== undefined && typeof defaultValue === "object") {
        /*if (directObject && directObject[name] === undefined && Utilities.isUsableAsObjectKey(name)) {
          directObject[name] = defaultValue;
        }

        if (this.props.getsetPropertyObject !== undefined) {
          this.props.getsetPropertyObject.setProperty(name, defaultValue);
        }*/
      }

      return defaultValue;
    }

    return value;
  }

  _getPropertyAsInt(name: string, defaultValue?: number) {
    let value = this._getProperty(name, defaultValue);

    if (typeof value === "boolean") {
      if (value) {
        return 1;
      }

      return 0;
    } else if (typeof value === "number") {
      return value;
    } else if (typeof value === "string") {
      return parseInt(value);
    }

    return defaultValue;
  }

  _getPropertyAsBoolean(name: string, defaultValue?: boolean) {
    let value = this._getProperty(name, defaultValue);

    if (typeof value === "boolean") {
      return value;
    } else if (typeof value === "number") {
      return value !== 0;
    } else if (typeof value === "string") {
      if (value !== undefined && value !== "" && value !== "false" && value !== "0") {
        return true;
      }

      return false;
    }

    return defaultValue === true;
  }

  _getFieldById(id: string) {
    const fields = this.props.definition.fields;

    if (id === "__scalar" && this.props.definition.scalarField && !this.props.definition.scalarFieldUpgradeName) {
      return this.props.definition.scalarField;
    }

    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];

      if (field.id === id) {
        return field;
      }
    }

    return undefined;
  }

  processInputUpdate(id: string | undefined, data: string | undefined) {
    if (!id || data === undefined) {
      return;
    }

    let updatedObject: object | any = undefined;
    const protoObj = this.props.dataPropertyObject;

    if (!Utilities.isUsableAsObjectKey(id)) {
      Log.unsupportedToken(id);
      return;
    }

    const field = this._getFieldById(id);

    this._workingValues[id] = data;

    if (field === undefined) {
      Log.fail("Could not re-find field " + id);

      return;
    }

    const val = this._getTypedData(field, data);

    if (protoObj !== undefined) {
      const property = protoObj.ensureProperty(id);

      if (property !== undefined && property.id !== undefined) {
        property.value = val;
      }
    }

    const protogsObj = this.props.getsetPropertyObject;

    if (protogsObj !== undefined) {
      if (id === "__scalar") {
        protogsObj.setBaseValue(val);
      } else {
        protogsObj.setProperty(id, val);
      }
    }

    let dirObj = this.state.updatedDirectObject;

    if (dirObj === undefined) {
      dirObj = this.props.directObject;
    }

    dirObj = this._upscaleDirectObject(dirObj);

    dirObj[id] = val;

    dirObj = this._downscaleDirectObject(dirObj);

    updatedObject = dirObj;

    Log.assert(
      dirObj !== undefined || protogsObj !== undefined || protoObj !== undefined,
      "Could not find a backing object to edit."
    );

    if (this.props.onPropertyChanged !== undefined) {
      this.props.onPropertyChanged(this.props, { id: id, value: val }, val, updatedObject);
    }

    this.setState({
      updatedDirectObject: updatedObject,
      objectIncrement: this.state.objectIncrement + 1,
      subFormLoadState: this.state.subFormLoadState,
      keyAliases: this.state.keyAliases,
    });
  }

  _directObjectHasUniqueValuesBesidesScalar(directObject: { [propName: string]: any }) {
    const fields = this.props.definition.fields;

    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];

      if (
        field.id !== "__scalar" &&
        (this.props.definition.scalarFieldUpgradeName === undefined ||
          field.id !== this.props.definition.scalarFieldUpgradeName)
      ) {
        if (directObject[field.id] !== undefined && directObject[field.id] !== field.defaultValue) {
          return true;
        }
      }
    }

    return false;
  }

  _upscaleDirectObject(directObject: { [propName: string]: any } | string | number | boolean): { [name: string]: any } {
    if (typeof directObject === "string" || typeof directObject === "number" || typeof directObject === "boolean") {
      if (this.props.definition.scalarField && !this.props.definition.scalarFieldUpgradeName) {
        return {
          __scalar: directObject,
        };
      }

      if (this.props.definition.scalarFieldUpgradeName) {
        const fi = DataFormUtilities.getFieldById(this.props.definition, this.props.definition.scalarFieldUpgradeName);

        if (fi) {
          const retObj: { [name: string]: string | number | boolean } = {};

          if (Utilities.isUsableAsObjectKey(fi.id)) {
            retObj[fi.id] = directObject;
          } else {
            Log.unsupportedToken(fi.id);
          }
          return retObj;
        }
      }

      return { value: directObject };
    }

    if (directObject === undefined) {
      return {};
    }

    return directObject;
  }

  _downscaleDirectObject(directObject: { [propName: string]: any }) {
    const fields = this.props.definition.fields;

    // collapse empty objects and default values
    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];

      if (!field.retainIfEmptyOrDefault) {
        let hasContent = false;

        if (directObject[field.id] !== undefined) {
          const fieldData = directObject[field.id];

          if (typeof fieldData === "object") {
            for (const propVal in directObject[field.id]) {
              if (propVal.length !== undefined && propVal.length > 0) {
                hasContent = true;
              }
            }
          } else {
            if (field.defaultValue === undefined || fieldData !== field.defaultValue) {
              hasContent = true;
            }
          }
        }

        if (!hasContent) {
          if (Utilities.isUsableAsObjectKey(field.id)) {
            directObject[field.id] = undefined;
          }
        }
      }
    }

    const hasUniqueValuesBesidesScalar = this._directObjectHasUniqueValuesBesidesScalar(directObject);

    if (!hasUniqueValuesBesidesScalar) {
      // convert down to a scalar value if possible
      if (this.props.definition.scalarFieldUpgradeName) {
        if (directObject[this.props.definition.scalarFieldUpgradeName] !== undefined) {
          directObject = directObject[this.props.definition.scalarFieldUpgradeName];
        }
      } else {
        if (directObject["__scalar"] !== undefined) {
          directObject = directObject["__scalar"];
        }
      }
    }

    return directObject;
  }

  _handleSliderChange(
    event: SyntheticEvent<HTMLElement, Event> | React.KeyboardEvent<Element> | null,
    data: (SliderProps & { value: string }) | undefined
  ) {
    this.processInputUpdate(event?.currentTarget?.id, data?.value);
  }

  _handleTextboxChange(
    event: SyntheticEvent<HTMLElement, Event> | React.KeyboardEvent<Element> | null,
    data: (InputProps & { value: string }) | undefined
  ) {
    this.processInputUpdate(event?.currentTarget?.id, data?.value);
  }

  _handleDropdownTextChange(
    event: React.MouseEvent<Element, MouseEvent> | React.KeyboardEvent<Element> | null,
    data: DropdownProps | undefined
  ) {
    if (data && data.value !== undefined && (data.value as any).id && (data as any).id) {
      this.processInputUpdate((data as any).id, (data.value as any).id);
    }
  }

  _handleTextAreaChange(
    event: SyntheticEvent<HTMLElement, Event> | React.KeyboardEvent<Element> | null,
    data: TextAreaProps | undefined
  ) {
    this.processInputUpdate(event?.currentTarget?.id, data?.value);
  }

  _handleKeyedBooleanTextChange(
    event: SyntheticEvent<HTMLElement, Event> | React.KeyboardEvent<Element> | null,
    data: (InputProps & { value: string }) | undefined
  ) {
    if (!data || !data.id) {
      return;
    }

    const keySplit = data.id.split(".");

    if (keySplit.length !== 3) {
      Log.unexpectedState("DFKBTFC1");
      return;
    }

    const arrayOfDataVal = this._getProperty(keySplit[0], []);
    const field = this._getFieldById(keySplit[0]);

    if (field === undefined) {
      Log.unexpectedUndefined("DFKBTFC3");
      return;
    }

    const val = arrayOfDataVal[keySplit[1]];
    const keyAliases = this.state.keyAliases;

    if (Utilities.isUsableAsObjectKey(keySplit[1])) {
      arrayOfDataVal[keySplit[1]] = undefined;

      if (Utilities.isUsableAsObjectKey(data.value)) {
        arrayOfDataVal[data.value] = val;
        keyAliases[data.value] = this.state.keyAliases[keySplit[1]] ? this.state.keyAliases[keySplit[1]] : keySplit[1];
      }
    }
    this._setPropertyValue(keySplit[0], arrayOfDataVal);

    this.setState({
      objectIncrement: this.state.objectIncrement,
      subFormLoadState: this.state.subFormLoadState,
      keyAliases: keyAliases,
    });
  }

  _handleKeyedBooleanValueChange(
    event: SyntheticEvent<HTMLElement, Event> | React.KeyboardEvent<Element> | null,
    data?: CheckboxProps & { checked: boolean; id?: string }
  ) {
    if (!data || !data.id) {
      return;
    }

    const keySplit = data.id.split(".");

    if (keySplit.length !== 3) {
      Log.unexpectedState("DFKBVFC1");
      return;
    }

    const arrayOfDataVal = this._getProperty(keySplit[0], []);
    const field = this._getFieldById(keySplit[0]);

    if (field === undefined) {
      Log.unexpectedUndefined("DFKBVFC3");
      return;
    }
    if (Utilities.isUsableAsObjectKey(keySplit[1])) {
      arrayOfDataVal[keySplit[1]] = data.checked;
    }
    this.forceUpdate();
  }

  _handleKeyedBooleanValueClose(event: React.SyntheticEvent<HTMLElement>, data?: ButtonProps & { id?: string }) {
    if (!data || !data.id) {
      return;
    }

    if (this.props.onClose) {
      this.props.onClose(this.props);
    }

    const keySplit = data.id.split(".");

    if (keySplit.length !== 3) {
      Log.unexpectedState("DFKBVFC1");
      return;
    }

    const arrayOfDataVal = this._getProperty(keySplit[0], []);
    const field = this._getFieldById(keySplit[0]);

    if (field === undefined) {
      Log.unexpectedUndefined("DFKBVFC3");
      return;
    }

    if (Utilities.isUsableAsObjectKey(keySplit[1])) {
      arrayOfDataVal[keySplit[1]] = undefined;
    }

    this.forceUpdate();
  }

  _handleKeyedStringTextChange(
    event: SyntheticEvent<HTMLElement, Event> | React.KeyboardEvent<Element> | null,
    data: (InputProps & { value: string }) | undefined
  ) {
    if (!data || !data.id) {
      return;
    }

    const keySplit = data.id.split(".");

    if (keySplit.length !== 3) {
      Log.unexpectedState("DFKBTFC1");
      return;
    }

    const arrayOfDataVal = this._getProperty(keySplit[0], []);
    const field = this._getFieldById(keySplit[0]);

    if (field === undefined) {
      Log.unexpectedUndefined("DFKBTFC3");
      return;
    }

    const val = arrayOfDataVal[keySplit[1]];

    const keyAliases = this.state.keyAliases;

    if (Utilities.isUsableAsObjectKey(keySplit[1]) && Utilities.isUsableAsObjectKey(data.value)) {
      arrayOfDataVal[keySplit[1]] = undefined;

      arrayOfDataVal[data.value] = val;

      keyAliases[data.value] = this.state.keyAliases[keySplit[1]] ? this.state.keyAliases[keySplit[1]] : keySplit[1];
    }

    this.setState({
      objectIncrement: this.state.objectIncrement,
      subFormLoadState: this.state.subFormLoadState,
      keyAliases: keyAliases,
    });

    this.forceUpdate();
  }

  _handleKeyedStringValueChange(
    event: SyntheticEvent<HTMLElement, Event> | React.KeyboardEvent<Element> | null,
    data?: (InputProps & { value: string }) | undefined
  ) {
    if (!data || !data.id) {
      return;
    }

    const keySplit = data.id.split(".");

    if (keySplit.length !== 3) {
      Log.unexpectedState("DFKBVFC1");
      return;
    }

    const arrayOfDataVal = this._getProperty(keySplit[0], []);
    const field = this._getFieldById(keySplit[0]);

    if (field === undefined) {
      Log.unexpectedUndefined("DFKBVFC3");
      return;
    }

    if (Utilities.isUsableAsObjectKey(keySplit[1])) {
      arrayOfDataVal[keySplit[1]] = data.value;
    }

    this.forceUpdate();
  }

  _handleKeyedStringValueClose(event: React.SyntheticEvent<HTMLElement>, data?: ButtonProps & { id?: string }) {
    if (!data || !data.id) {
      return;
    }

    if (this.props.onClose) {
      this.props.onClose(this.props);
    }

    const keySplit = data.id.split(".");

    if (keySplit.length !== 3) {
      Log.unexpectedState("DFKBVFC1");
      return;
    }

    const arrayOfDataVal = this._getProperty(keySplit[0], []);
    const field = this._getFieldById(keySplit[0]);

    if (field === undefined) {
      Log.unexpectedUndefined("DFKBVFC3");
      return;
    }

    arrayOfDataVal[keySplit[1]] = undefined;

    this.forceUpdate();
  }

  _getTypedData(field: IField, value: any) {
    if (
      field.dataType === FieldDataType.int ||
      field.dataType === FieldDataType.intBoolean ||
      field.dataType === FieldDataType.intEnum ||
      field.dataType === FieldDataType.intValueLookup
    ) {
      if (typeof value === "number") {
        return value;
      } else if (typeof value === "string") {
        if (value.length === 0) {
          return undefined;
        }

        return parseInt(value);
      } else if (typeof value === "boolean") {
        if (value) {
          return 1;
        }

        return 0;
      }
    } else if (field.dataType === FieldDataType.number || field.dataType === FieldDataType.float) {
      if (typeof value === "number") {
        return value;
      } else if (typeof value === "string") {
        if (value.length === 0) {
          return undefined;
        }

        return parseFloat(value);
      } else if (typeof value === "boolean") {
        if (value) {
          return 1;
        }

        return 0;
      }
    } else if (DataFormUtilities.isString(field.dataType)) {
      if (typeof value === "string") {
        return value;
      } else {
        return value.toString();
      }
    }

    return value;
  }

  _handleCheckboxChange(event: SyntheticEvent<HTMLElement, Event> | React.KeyboardEvent<Element> | null) {
    if (event === null) {
      return;
    }

    let updatedObject: object | any = undefined;
    const protoObj = this.props.dataPropertyObject;
    const id = event.currentTarget.id;

    const val = this._getPropertyAsBoolean(id);

    if (protoObj !== undefined) {
      const property = protoObj.ensureProperty(id);

      if (property !== undefined && property.id !== undefined) {
        let newBoolVal: boolean | number = val;

        newBoolVal = !newBoolVal;

        property.value = newBoolVal;
      }
    }

    const protogsObj = this.props.getsetPropertyObject;

    if (protogsObj !== undefined) {
      let newBoolVal: boolean | number = val;

      newBoolVal = !newBoolVal;

      if (id === "__scalar") {
        protogsObj.setBaseValue(newBoolVal);
      } else {
        protogsObj.setProperty(id, newBoolVal);
      }
    }

    let dirObj = this.state.updatedDirectObject;

    if (!dirObj) {
      dirObj = this.props.directObject;
    }

    if (dirObj !== undefined) {
      let newBoolVal: boolean | number = val;

      newBoolVal = !newBoolVal;

      dirObj = this._upscaleDirectObject(dirObj);

      dirObj[id] = newBoolVal;

      updatedObject = this._downscaleDirectObject(dirObj);
    }

    if (this.props.onPropertyChanged !== undefined) {
      this.props.onPropertyChanged(this.props, { id: id, value: val }, val, updatedObject);
    }

    this.setState({
      updatedDirectObject: updatedObject,
      objectIncrement: this.state.objectIncrement + 1,
      subFormLoadState: this.state.subFormLoadState,
      keyAliases: this.state.keyAliases,
    });
  }

  _handleDropdownChange(
    event: React.KeyboardEvent<Element> | React.MouseEvent<Element, MouseEvent> | null,
    data: DropdownProps
  ) {
    if (data.value !== null && data.value !== undefined) {
      const val = data.value as DropdownItemProps;

      if (val !== undefined) {
        const content = val.content;

        for (let i = 0; i < this.dropdownNames.length; i++) {
          const items = this.dropdownItems[i];
          const propDef = this._getFieldById(this.dropdownNames[i]);

          if (propDef === undefined) {
            return;
          }

          let lookupSet: ISimpleReference[] | undefined;

          if (propDef.choices) {
            lookupSet = propDef.choices;
          } else if (propDef.lookupId && this.props.lookupSets) {
            lookupSet = this.props.lookupSets[propDef.lookupId];
          }

          if (lookupSet) {
            for (let j = 0; j < items.length; j++) {
              if (items[j].content === content) {
                // OK, we've found which dropdown item is now selected, now re-unify that with
                // a property.
                for (let k = 0; k < lookupSet.length; k++) {
                  let title = lookupSet[k].title;

                  if (!title) {
                    title = Utilities.humanify(lookupSet[k].id, propDef.humanifyValues).toString();
                  }

                  if (title === content) {
                    const val = lookupSet[k].id;

                    this._setPropertyValue(propDef.id, val);
                  }
                }
              }
            }
          }
        }
      }

      this._incrementObjectState();
    }
  }

  _setPropertyValue(id: string, val: any) {
    const protoBlock = this.props.dataPropertyObject;

    if (protoBlock !== undefined) {
      const prop = protoBlock.ensureProperty(id);
      prop.value = val;

      if (this.props.onPropertyChanged !== undefined) {
        this.props.onPropertyChanged(this.props, prop, val);
      }
    }

    const directPropO = this.props.getsetPropertyObject;

    if (directPropO !== undefined) {
      if (id === "__scalar") {
        directPropO.setBaseValue(val);
      } else {
        directPropO.setProperty(id, val);
      }
    }

    let directO = this.state.updatedDirectObject;

    if (!directO) {
      directO = this.props.directObject;
    }

    if (directO !== undefined) {
      directO = this._upscaleDirectObject(directO);

      directO[id] = val;

      directO = this._downscaleDirectObject(directO);

      if (this.props.onPropertyChanged !== undefined) {
        this.props.onPropertyChanged(this.props, { id: id, value: val }, val, directO);
      }

      this.setState({
        updatedDirectObject: directO,
        objectIncrement: this.state.objectIncrement + 1,
        subFormLoadState: this.state.subFormLoadState,
        keyAliases: this.state.keyAliases,
      });
    }
  }

  _handleKeyedObjectArraySubFormClose(props: IDataFormProps) {
    const formId = props.formId;

    if (formId === undefined) {
      Log.unexpectedState("DFKOASFC1");
      return;
    }

    const lastPeriod = formId.lastIndexOf(".");

    if (lastPeriod < 0) {
      Log.unexpectedState("DFKOASFC2");
      return;
    }

    const objectFieldIndex: string = formId.substring(lastPeriod + 1);
    const fieldId = formId.substring(0, lastPeriod);

    if (fieldId === undefined || objectFieldIndex === undefined) {
      Log.unexpectedUndefined("DFKOASFC5");
      return;
    }

    const arrayOfDataVal = this._getProperty(fieldId, []);
    const field = this._getFieldById(fieldId);

    if (field === undefined || field.objectArrayToSubFieldKey === undefined) {
      Log.unexpectedUndefined("DFKOASFC3");
      return;
    }

    const dataVal = this.getObjectWithFieldIndex(arrayOfDataVal, field.objectArrayToSubFieldKey, objectFieldIndex);

    if (dataVal === undefined) {
      Log.unexpectedUndefined("DFKOASFC4");
      return;
    }

    //  dataVal[property.id] = newValue;

    if (this.props.onPropertyChanged !== undefined) {
      //     this.props.onPropertyChanged(this.props, { id: fieldId, value: newValue }, newValue);
    }
  }

  _handleKeyedObjectArraySubFormPropertyChange(props: IDataFormProps, property: IProperty, newValue: any) {
    const formId = props.formId;

    if (formId === undefined || property.id === undefined) {
      Log.unexpectedState("DFKOASFPC1");
      return;
    }

    const lastPeriod = formId.lastIndexOf(".");

    if (lastPeriod < 0) {
      Log.unexpectedState("DFKOASFPC2");
      return;
    }

    const objectFieldIndex: string = formId.substring(lastPeriod + 1);
    const fieldId = formId.substring(0, lastPeriod);

    if (fieldId === undefined || objectFieldIndex === undefined) {
      Log.unexpectedUndefined("DFKOASFPC3");
      return;
    }

    const arrayOfDataVal = this._getProperty(fieldId, []);
    const field = this._getFieldById(fieldId);

    if (field === undefined || field.objectArrayToSubFieldKey === undefined) {
      Log.unexpectedUndefined("DFKOASFPC5");
      return;
    }

    const dataVal = this.getObjectWithFieldIndex(arrayOfDataVal, field.objectArrayToSubFieldKey, objectFieldIndex);

    if (dataVal === undefined) {
      Log.unexpectedUndefined("DFKOASFPC4");
      return;
    }

    dataVal[property.id] = newValue;

    if (this.props.onPropertyChanged !== undefined) {
      this.props.onPropertyChanged(this.props, { id: fieldId, value: newValue }, newValue);
    }
  }

  _handleIndexedArraySubFormClose(props: IDataFormProps) {
    const formId = props.formId;

    if (formId === undefined) {
      Log.unexpectedState("DFIASFC1");
      return;
    }

    const lastPeriod = formId.lastIndexOf(".");

    if (lastPeriod < 0) {
      Log.unexpectedState("DFIASFC6");
      return;
    }

    const objectFieldIndex: string = formId.substring(lastPeriod + 1);
    const fieldId = formId.substring(0, lastPeriod);

    if (fieldId === undefined || objectFieldIndex === undefined) {
      Log.unexpectedUndefined("DFIASFC2");
      return;
    }

    const arrayOfDataVal = this._getProperty(fieldId, []);
    const field = this._getFieldById(fieldId);

    if (field === undefined) {
      Log.unexpectedUndefined("DFIASFC3");
      return;
    }

    try {
      const arrayIndex = parseInt(objectFieldIndex);
      if (isNaN(arrayIndex)) {
        Log.unexpectedUndefined("DFIASFC4");
        return;
      }

      const newArr = [];

      for (let i = 0; i < arrayOfDataVal.length; i++) {
        if (i !== arrayIndex) {
          newArr.push(arrayOfDataVal[i]);
        }
      }

      this._setPropertyValue(fieldId, newArr);
      this._incrementObjectState();
    } catch (e) {
      Log.unexpectedUndefined("DFIASFC5");

      return;
    }
  }

  _handleIndexedArraySubFormPropertyChange(props: IDataFormProps, property: IProperty, newValue: any) {
    const propId = props.formId;

    if (!propId) {
      return;
    }

    const lastPeriod = propId.lastIndexOf(".");

    if (lastPeriod < 0) {
      return;
    }

    let propertyIndex: string | number = propId.substring(lastPeriod + 1);
    const propertyName = propId.substring(0, lastPeriod);
    let propertyIndexNum = undefined;

    try {
      propertyIndexNum = parseInt(propertyIndex);
    } catch (e) {}

    if (propertyIndexNum !== undefined && !isNaN(propertyIndexNum)) {
      propertyIndex = propertyIndexNum;
    }

    if (propertyName) {
      let directO = this.props.directObject;

      if (directO !== undefined) {
        directO = this._upscaleDirectObject(directO);

        if (Utilities.isUsableAsObjectKey(propertyName)) {
          if (!directO[propertyName]) {
            directO[propertyName] = {};
          }

          if (newValue !== directO[propertyName][propertyIndex]) {
            const obj = directO[propertyName];

            if (this.props.onPropertyChanged !== undefined) {
              this.props.onPropertyChanged(this.props, { id: props.formId, value: newValue }, obj[propertyIndex]);
            }
          }
        }

        directO = this._downscaleDirectObject(directO);

        this.setState({
          updatedDirectObject: directO,
          objectIncrement: this.state.objectIncrement + 1,
          subFormLoadState: this.state.subFormLoadState,
          keyAliases: this.state.keyAliases,
        });
      }
    }
  }

  _handleObjectSubFormPropertyChange(
    props: IDataFormProps,
    property: IProperty,
    newValue: any,
    updatedDirectObject: any
  ) {
    let propId = props.formId;

    if (!propId) {
      return;
    }

    const firstPeriod = propId.indexOf(".");

    if (firstPeriod >= 0) {
      propId = propId.substring(firstPeriod + 1);
    }

    this._setPropertyValue(propId, updatedDirectObject);
  }

  _handleRangePropertyChange(
    event: SyntheticEvent<HTMLElement, Event> | React.KeyboardEvent<Element> | null,
    props: IRangeProps
  ) {
    this._setPropertyValue(props.field.id, props.data);
  }

  _handlePoint3PropertyChange(
    event: SyntheticEvent<HTMLElement, Event> | React.KeyboardEvent<Element> | null,
    props: IPoint3Props
  ) {
    this._setPropertyValue(props.field.id, props.data);
  }

  _handleVersionPropertyChange(
    event: SyntheticEvent<HTMLElement, Event> | React.KeyboardEvent<Element> | null,
    props: IVersionProps
  ) {
    this._setPropertyValue(props.field.id, props.data);
  }

  _handleStringArrayPropertyChange(props: IScalarArrayProps) {
    this._setPropertyValue(props.field.id, props.data);
  }

  _handleMinecraftFilterPropertyChange(
    event: SyntheticEvent<HTMLElement, Event> | React.KeyboardEvent<Element> | null,
    props: IMinecraftFilterEditorProps
  ) {
    //  this._setPropertyValue(props.field.id, props.data);
  }

  _handleMinecraftEventTriggerPropertyChange(field: IField, data: MinecraftEventTrigger) {
    if (field.dataType === FieldDataType.minecraftEventReference) {
      this._setPropertyValue(field.id, data.event);
    } else {
      this._setPropertyValue(field.id, data);
    }
  }

  _handleCloseClick(event: React.SyntheticEvent<HTMLElement>, data?: ButtonProps) {
    if (!data) {
      return;
    }

    if (this.props.onClose) {
      this.props.onClose(this.props);
    }
  }

  _getSourceForm() {
    let def = this.props.definition;

    if (this.props.select) {
      def = DataFormUtilities.selectSubForm(def, this.props.select);
    }

    return def;
  }

  getCssClassName(className: string) {
    if (this.props.displayNarrow) {
      return "df-" + className + " dfn-" + className;
    }

    return "df-" + className + " dfw-" + className;
  }

  render() {
    const formInterior = [];

    this.dropdownNames = [];
    this.dropdownItems = [];

    this.checkboxItems = [];
    this.checkboxNames = [];

    if (this.props.definition !== undefined) {
      const formDef = this._getSourceForm();

      const allFields = formDef.fields.slice();

      allFields.sort(DataFormUtilities.sortFieldsByPriority);

      if (
        formDef.scalarField &&
        !formDef.scalarFieldUpgradeName &&
        (formDef.scalarField.dataType !== FieldDataType.boolean ||
          !formDef.scalarField.tags ||
          !formDef.scalarField.tags.includes("presence"))
      ) {
        formDef.scalarField.id = "__scalar";
        allFields.push(formDef.scalarField);
      }

      for (let propIndex = 0; propIndex < allFields.length; propIndex++) {
        const field = allFields[propIndex];

        if (
          (!field.visibility || FieldUtilities.evaluate(formDef, field.visibility, this.props)) &&
          !field.isDeprecated &&
          !field.isInternal
        ) {
          let curVal = this._getProperty(field.id, field.defaultValue);
          const defaultVal = curVal ? curVal : field.defaultValue;

          let baseKey = this._getObjectId() + "." + field.id;

          let isValid = true;

          if (field.validity) {
            isValid = FieldUtilities.evaluate(formDef, field.validity, this.props, field);
          }

          let descriptionElements = [];
          let sampleElements = [];

          if (field.description) {
            let descrip = field.description.replace(/\\\\/gi, "\\");
            descrip = descrip.replace(/\r/gi, "");

            const fieldDescripElts = field.description.split("\n");

            const divDescrips = [];
            for (let descrip of fieldDescripElts) {
              descrip = descrip.trim();
              if (descrip.startsWith("\\n-")) {
                divDescrips.push(<li>{descrip.substring(3)}</li>);
              } else {
                if (descrip.length > 0) {
                  divDescrips.push(<div>{descrip}</div>);
                }
              }
            }

            descriptionElements.push(
              <div key={baseKey + "desc"} className={this.getCssClassName("fieldDescription")}>
                {divDescrips}
              </div>
            );
          }

          if (field.defaultValue) {
            let defVal = Utilities.humanify(field.defaultValue, field.humanifyValues);

            sampleElements.push(
              <div key={baseKey + "defValHeader"} className={this.getCssClassName("defaultValueDescription")}>
                Default Value: {defVal}
              </div>
            );
          }

          if (
            field.samples &&
            !field.hideSamples &&
            field.subForm === undefined &&
            field.subFormId === undefined &&
            field.dataType !== FieldDataType.minecraftEventTrigger &&
            field.dataType !== FieldDataType.minecraftEventReference &&
            field.dataType !== FieldDataType.minecraftFilter
          ) {
            sampleElements.push(
              <div key={baseKey + "sampHeader"} className={this.getCssClassName("sampleDescription")}>
                Example Values:
              </div>
            );

            const sampleRows = [];

            for (const path in field.samples) {
              const sampeList = field.samples[path];

              if (sampeList) {
                let name = Utilities.humanifyMinecraftName(
                  StorageUtilities.getBaseFromName(StorageUtilities.getLeafName(path))
                );

                let sampleVals = "";

                for (const sample of sampeList) {
                  let sampVal = Utilities.humanify(sample.content, field.humanifyValues);

                  if (sampleVals.length > 0) {
                    sampleVals += ", ";
                  }

                  sampleVals += sampVal;
                }

                sampleRows.push(
                  <div className={this.getCssClassName("sampleRow")} key={baseKey + "descHeaderA" + name + path}>
                    <div className={this.getCssClassName("ro-value")}>{name}</div>
                    <div className={this.getCssClassName("ro-sampleValue")}>{sampleVals}</div>
                  </div>
                );
              }
            }

            sampleElements.push(<div className={this.getCssClassName("sampleTable")}>{sampleRows}</div>);
          }

          const title = FieldUtilities.getFieldTitle(field);

          if (this.props.readOnly || field.readOnly) {
            if (field.defaultValue === undefined || field.defaultValue !== curVal) {
              if (typeof curVal === "object") {
                curVal = JSON.stringify(curVal, null, 2);
              }
              formInterior.push(
                <div className={this.getCssClassName("ro-row")} key={baseKey + "row" + title}>
                  <div className={this.getCssClassName("ro-title")}>{title}</div>
                  <div className={this.getCssClassName("ro-value")}>{curVal}</div>
                </div>
              );
            }
          } else {
            if (
              (field.dataType === FieldDataType.stringEnum ||
                field.dataType === FieldDataType.intEnum ||
                field.dataType === FieldDataType.boolean) &&
              field.choices !== undefined
            ) {
              const items: DropdownItemProps[] = [];

              let dropdownValue = curVal;
              let lookupSet: ISimpleReference[] | undefined;

              if (field.choices) {
                lookupSet = field.choices;
              } else if (field.lookupId && this.props.lookupSets) {
                lookupSet = this.props.lookupSets[field.lookupId];
              }

              if (lookupSet) {
                for (let i = 0; i < lookupSet.length; i++) {
                  items.push({
                    content: lookupSet[i].title,
                    selected: lookupSet[i].id === curVal,
                  });

                  if (curVal === lookupSet[i].id) {
                    let title = lookupSet[i].title;

                    if (!title) {
                      title = Utilities.humanify(lookupSet[i].id, field.humanifyValues);
                    }

                    dropdownValue = title;
                  }
                }
              }

              const dropdown = (
                <FormDropdown
                  label={title}
                  id={propIndex.toString()}
                  items={items}
                  key={"frs" + baseKey + title + propIndex}
                  fluid={true}
                  onChange={this._handleDropdownChange}
                  value={[dropdownValue]}
                />
              );

              this.dropdownNames.push(field.id);
              this.dropdownItems.push(items);
              formInterior.push(
                <div
                  className={this.getCssClassName("fieldWrap")}
                  key={"fwg" + baseKey}
                  style={{
                    borderTopColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
                    borderBottomColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
                  }}
                >
                  {descriptionElements}
                  {dropdown}
                  {sampleElements}
                </div>
              );
            } else if (
              field.dataType === FieldDataType.point3 ||
              field.dataType === FieldDataType.intPoint3 ||
              field.dataType === FieldDataType.location ||
              field.dataType === FieldDataType.locationOffset
            ) {
              const val = this._getProperty(field.id, [0, 0, 0]);
              let objKey = field.id;

              if (this.props.objectKey) {
                objKey += this.props.objectKey;
              }

              const point3 = (
                <Point3
                  data={val}
                  objectKey={objKey}
                  key={"p3" + baseKey}
                  label={title}
                  ambientPoint={this.props.ambientSelectedPoint}
                  onChange={this._handlePoint3PropertyChange}
                  form={formDef}
                  field={field}
                />
              );

              this.formComponentNames.push(field.id);
              this.formComponents.push(point3);
              formInterior.push(
                <div
                  className={this.getCssClassName("fieldWrap")}
                  key={"fwh" + baseKey}
                  style={{
                    borderTopColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
                    borderBottomColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
                  }}
                >
                  {point3}
                  {descriptionElements}
                  {sampleElements}
                </div>
              );
            } else if (field.dataType === FieldDataType.version) {
              const val = this._getProperty(field.id, [0, 0, 1]);
              let objKey = field.id;
              if (this.props.objectKey) {
                objKey += this.props.objectKey;
              }

              const version = (
                <Version
                  data={val}
                  objectKey={objKey}
                  key={"ver" + baseKey}
                  label={title}
                  onChange={this._handleVersionPropertyChange}
                  form={formDef}
                  field={field}
                />
              );

              this.formComponentNames.push(field.id);
              this.formComponents.push(version);

              formInterior.push(
                <div
                  className={this.getCssClassName("fieldWrap")}
                  key={"fwj" + baseKey}
                  style={{
                    borderTopColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
                    borderBottomColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
                  }}
                >
                  {descriptionElements}
                  {version}
                  {sampleElements}
                </div>
              );
            } else if (
              field.dataType === FieldDataType.stringArray ||
              field.dataType === FieldDataType.longFormStringArray ||
              field.dataType === FieldDataType.numberArray ||
              field.dataType === FieldDataType.checkboxListAsStringArray
            ) {
              const val = this._getProperty(field.id, []);

              let objKey = field.id;

              if (this.props.objectKey) {
                objKey += this.props.objectKey;
              }

              const sarrt = (
                <ScalarArray
                  data={val}
                  objectKey={objKey}
                  key={"sarr" + baseKey}
                  lookups={this.state.lookups}
                  longForm={field.dataType === FieldDataType.longFormStringArray}
                  isNumber={field.dataType === FieldDataType.numberArray}
                  label={title}
                  allowCreateDelete={field.allowCreateDelete}
                  onChange={this._handleStringArrayPropertyChange}
                  form={this.props.definition}
                  field={field}
                />
              );

              this.formComponentNames.push(field.id);
              this.formComponents.push(sarrt);

              formInterior.push(
                <div
                  className={this.getCssClassName("fieldWrap")}
                  key={"fwk" + baseKey}
                  style={{
                    borderTopColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
                    borderBottomColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
                  }}
                >
                  <div className={this.getCssClassName(isValid ? "elementTitle" : "elementTitleInvalid")}>{title}</div>
                  {descriptionElements}
                  {sarrt}
                  {sampleElements}
                </div>
              );
            } else if (field.dataType === FieldDataType.intRange || field.dataType === FieldDataType.floatRange) {
              const val = this._getProperty(field.id, [0, 100]);

              let objKey = field.id;

              if (this.props.objectKey) {
                objKey += this.props.objectKey;
              }

              const range = (
                <Range
                  data={val}
                  objectKey={objKey}
                  key={"ra" + baseKey}
                  label={title}
                  isInt={field.dataType === FieldDataType.intRange}
                  onChange={this._handleRangePropertyChange}
                  form={this.props.definition}
                  field={field}
                />
              );

              this.formComponentNames.push(field.id);
              this.formComponents.push(range);

              formInterior.push(
                <div
                  className={this.getCssClassName("fieldWrap")}
                  key={"fwl" + baseKey}
                  style={{
                    borderTopColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
                    borderBottomColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
                  }}
                >
                  {descriptionElements}
                  {range}
                  {sampleElements}
                </div>
              );
            } else if (field.dataType === FieldDataType.minecraftFilter) {
              const val = this._getProperty(field.id, {});

              const sarr = (
                <MinecraftFilterEditor
                  data={val}
                  key={"mifi" + baseKey}
                  filterContextId={(this.props.definition.id ? this.props.definition.id : "") + "." + field.id}
                  onChange={this._handleMinecraftFilterPropertyChange}
                />
              );

              this.formComponentNames.push(field.id);
              this.formComponents.push(sarr);

              formInterior.push(
                <div
                  className={this.getCssClassName("fieldWrap")}
                  key={"fwm" + baseKey}
                  style={{
                    borderTopColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
                    borderBottomColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
                  }}
                >
                  <div className={this.getCssClassName("elementTitle")}>{title}</div>
                  {descriptionElements}
                  {sarr}
                  {sampleElements}
                </div>
              );
            } else if (
              field.dataType === FieldDataType.minecraftEventTrigger ||
              field.dataType === FieldDataType.minecraftEventReference
            ) {
              const val = this._getProperty(
                field.id,
                field.dataType === FieldDataType.minecraftEventTrigger ? {} : undefined
              );

              let objKey = field.id;

              if (this.props.objectKey) {
                objKey += this.props.objectKey;
              }

              if (this.props.carto && this.props.project) {
                const sarr = (
                  <MinecraftEventTriggerEditor
                    data={field.dataType === FieldDataType.minecraftEventTrigger ? val : { event: val }}
                    objectKey={objKey}
                    carto={this.props.carto}
                    project={this.props.project}
                    readOnly={this.props.readOnly}
                    constrainHeight={false}
                    entityTypeDefinition={this.props.itemDefinition as EntityTypeDefinition}
                    theme={this.props.theme}
                    key={"miet" + baseKey}
                    heightOffset={300}
                    onChange={this._handleMinecraftEventTriggerPropertyChange}
                    form={this.props.definition}
                    field={field}
                  />
                );

                this.formComponentNames.push(field.id);
                this.formComponents.push(sarr);

                formInterior.push(
                  <div
                    className={this.getCssClassName("fieldWrap")}
                    key={"fwm" + baseKey}
                    style={{
                      borderTopColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
                      borderBottomColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
                    }}
                  >
                    <div className={this.getCssClassName("elementTitle")}>{title}</div>
                    {descriptionElements}
                    {sarr}
                    {sampleElements}
                  </div>
                );
              }
            } else if (field.dataType === FieldDataType.keyedObjectCollection) {
              this.addKeyedObjectComponent(field, formInterior, descriptionElements, sampleElements);
            } else if (field.dataType === FieldDataType.keyedStringArrayCollection) {
              this.addKeyedStringArrayCollectionComponent(field, formInterior, descriptionElements, sampleElements);
            } else if (field.dataType === FieldDataType.arrayOfKeyedStringCollection) {
              this.addArrayOfKeyedStringCollectionComponent(field, formInterior, descriptionElements, sampleElements);
            } else if (field.dataType === FieldDataType.keyedStringCollection) {
              this.addKeyedStringComponent(field, formInterior, descriptionElements, sampleElements);
            } else if (field.dataType === FieldDataType.keyedBooleanCollection) {
              this.addKeyedBooleanComponent(field, formInterior, descriptionElements, sampleElements);
            } else if (field.dataType === FieldDataType.objectArray) {
              this.addObjectArrayComponent(field, formInterior, descriptionElements, sampleElements);
            } else if (field.dataType === FieldDataType.object) {
              this.addObjectComponent(field, formInterior, descriptionElements, sampleElements);
            } else if (field.dataType === FieldDataType.intBoolean || field.dataType === FieldDataType.boolean) {
              this.addCheckboxComponent(field, formInterior, descriptionElements, sampleElements);
            } else if (field.dataType === FieldDataType.longFormString) {
              const fieldInput = (
                <TextArea
                  fluid={true}
                  key={"txa" + baseKey}
                  id={field.id}
                  value={curVal as string}
                  defaultValue={defaultVal as string}
                  spellCheck={true}
                  onChange={this._handleTextAreaChange}
                />
              );

              formInterior.push(
                <div
                  className={this.getCssClassName("fieldWrap")}
                  key={"fwn" + baseKey}
                  style={{
                    borderTopColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
                    borderBottomColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
                  }}
                >
                  {descriptionElements}
                  <div key={baseKey + "titleA"} className={this.getCssClassName("fieldTitle")}>
                    <div className={this.getCssClassName(isValid ? "elementTitle" : "elementTitleInvalid")}>
                      {title}
                    </div>
                    {fieldInput}
                  </div>
                  {sampleElements}
                </div>
              );
            } else if (
              (field.dataType === FieldDataType.int || field.dataType === FieldDataType.float) &&
              field.experienceType === FieldExperienceType.slider &&
              !this.props.readOnly &&
              (field.minValue !== undefined || field.suggestedMinValue !== undefined) &&
              (field.maxValue !== undefined || field.suggestedMaxValue !== undefined)
            ) {
              formInterior.push(
                <div
                  className={this.getCssClassName("fieldWrap")}
                  key={"fwa" + baseKey}
                  style={{
                    borderTopColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
                    borderBottomColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
                  }}
                >
                  <div className={this.getCssClassName("sliderTitle")}>{title}</div>
                  {descriptionElements}
                  <div className="df-sliderSet" key={baseKey + "W"}>
                    <Slider
                      key={"sli" + baseKey}
                      id={field.id}
                      fluid={true}
                      className={this.getCssClassName("slider")}
                      step={field.step ? field.step : 1}
                      min={field.minValue ? field.minValue : field.suggestedMinValue}
                      max={field.maxValue ? field.maxValue : field.suggestedMaxValue}
                      value={curVal as string}
                      defaultValue={defaultVal as string}
                      onChange={this._handleSliderChange}
                    />
                    <FormInput
                      className={this.getCssClassName("sliderInput")}
                      key={baseKey + "TSL"}
                      id={field.id}
                      fluid={true}
                      value={curVal as string}
                      defaultValue={defaultVal as string}
                      onChange={this._handleTextboxChange}
                    />
                  </div>
                  {sampleElements}
                </div>
              );
            } else if (field.dataType === FieldDataType.minecraftEventTriggerArray) {
              this.addMinecraftEventTriggerArrayComponent(field, formInterior, descriptionElements, sampleElements);
            } else {
              this.addTextboxComponent(field, formInterior, descriptionElements, sampleElements, curVal, defaultVal);
            }
          }
        }
      }
    }

    let headerOuter = <></>;
    const header = [];
    const subheader = [];

    if (this.props.displayTitle) {
      let title = this.props.definition?.title;

      if (!title) {
        if (this.props.definition.id) {
          title = Utilities.humanifyMinecraftName(this.props.definition.id);
        } else {
          title = "(untitled)";
        }
      }

      if (this.props.title) {
        title = this.props.title;
      }

      if (this.props.titleFieldBinding) {
        title = this._getProperty(this.props.titleFieldBinding, title);
      }

      if (this.props.indentLevel || this.props.defaultVisualExperience === FieldVisualExperience.deemphasized) {
        header.push(
          <div key={"header"} className={this.getCssClassName("subHeaderTitle")}>
            {title}
          </div>
        );
      } else {
        header.push(
          <div key="headera" className={this.getCssClassName("headerTitle")}>
            {title}
          </div>
        );
      }
    }

    if (this.props.displaySubTitle) {
      let subTitle = "";

      if (this.props.subTitle) {
        subTitle = this.props.subTitle;
      }

      if (this.props.indentLevel || this.props.defaultVisualExperience === FieldVisualExperience.deemphasized) {
        header.push(
          <div key="stheader" className={this.getCssClassName("subHeaderSubTitle")}>
            {subTitle}
          </div>
        );
      } else {
        header.push(
          <div key="stheadera" className={this.getCssClassName("headerSubTitle")}>
            {subTitle}
          </div>
        );
      }
    }

    if (this.props.closeButton) {
      const accessoryToolbar = [];

      accessoryToolbar.push({
        icon: <FontAwesomeIcon key="closeClick" icon={faXmark} className="fa-lg" />,
        key: "dfClose",
        onClick: this._handleCloseClick,
        title: "Close",
      });

      header.push(
        <div className={this.getCssClassName("closeArea")} key="closeArea">
          <Toolbar aria-label="Form accesory" items={accessoryToolbar} />
        </div>
      );
    }
    if (this.props.displayDescription) {
      subheader.push(
        <div key="description" className={this.getCssClassName("description")}>
          {this.props.definition.description}
        </div>
      );
    }

    let contents = <></>;

    if (!this.props.readOnly) {
      contents = (
        <div
          className={this.getCssClassName("form")}
          style={{
            borderTopColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
            borderBottomColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
          }}
        >
          {formInterior}
        </div>
      );
    } else {
      contents = <div className={this.getCssClassName("ro-table")}>{formInterior}</div>;
    }

    if (header.length > 0) {
      headerOuter = <div className={this.getCssClassName("headerOuter")}>{header}</div>;
    }

    return (
      <div className={this.getCssClassName("outer")}>
        <div
          className={this.getCssClassName(
            this.props.indentLevel || this.props.defaultVisualExperience === FieldVisualExperience.deemphasized
              ? "cardWrapper"
              : "wrapper"
          )}
          style={
            this.props.indentLevel || this.props.defaultVisualExperience === FieldVisualExperience.deemphasized
              ? {
                  backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background2,
                  color: this.props.theme.siteVariables?.colorScheme.brand.foreground2,
                }
              : {}
          }
        >
          {headerOuter}
          {subheader}
          <div className={this.getCssClassName("formArea")}>{contents}</div>
        </div>
      </div>
    );
  }

  addTextboxComponent(
    field: IField,
    formInterior: any[],
    descriptionElements: JSX.Element[],
    sampleElements: JSX.Element[],
    curVal: any,
    defaultVal: any
  ) {
    const title = FieldUtilities.getFieldTitle(field);

    let baseKey = this._getObjectId() + "." + field.id;

    let strVal = curVal ? String(curVal) : "";
    let cssClass = this.getCssClassName("fieldWrap");

    // if the user is dealing with floating point numbers and has typed in "3." on their way to
    // typing in "3.5", using _workingValues to "remember" that and substitute it back in.
    // otherwise we'd always replace "3." with "3" and you wouldn't be able to add decimal vals
    if (field.dataType === FieldDataType.float || field.dataType === FieldDataType.number) {
      cssClass += " " + this.getCssClassName("fieldWrapNumber");
      if (this._workingValues[field.id]) {
        const val = this._getTypedData(field, this._workingValues[field.id]);

        if (val === curVal) {
          strVal = this._workingValues[field.id];
        }
      }
    }

    let interior = <></>;
    let choiceDescriptionArea = <></>;

    let choices = field.choices;

    if (!choices && field.lookupId) {
      if (this.state && this.state.lookups) {
        choices = this.state.lookups[field.lookupId];
      }
    }

    if (choices && choices.length > 0) {
      const items: (DropdownItemProps & { id: string | number | boolean })[] = [];
      let selectedIndex = 0;
      let dropdownValue = strVal;

      for (let i = 0; i < choices.length; i++) {
        const title = choices[i].title;
        const id = choices[i].id;

        if (strVal.toString() === id.toString()) {
          selectedIndex = i;

          if (title || id) {
            dropdownValue = title ? title : id.toString();
          }
        }

        items.push({
          header: title ? title : id,
          content: choices[i].description,
          id: choices[i].id,
          selected: choices[i].id === curVal,
        });

        if (id === curVal && choices[i].description) {
          choiceDescriptionArea = <div>{choices[i].description}</div>;
        }
      }

      interior = (
        <FormDropdown
          search={!field.mustMatchChoices}
          activeSelectedIndex={selectedIndex}
          label={title}
          id={field.id}
          items={items}
          key={"frs" + baseKey + title + field.id}
          fluid={true}
          onChange={this._handleDropdownTextChange}
          value={dropdownValue}
        />
      );
    } else {
      interior = (
        <FormInput
          label={title}
          key={"fri" + baseKey}
          id={field.id}
          value={strVal}
          defaultValue={defaultVal as string}
          onChange={this._handleTextboxChange}
        />
      );
    }

    formInterior.push(
      <div
        className={cssClass}
        key={"fz" + baseKey}
        style={{
          borderTopColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
          borderBottomColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
        }}
      >
        {interior}
        {choiceDescriptionArea}
        {descriptionElements}
        {sampleElements}
      </div>
    );
  }

  addCheckboxComponent(
    field: IField,
    formInterior: any[],
    descriptionElements: JSX.Element[],
    sampleElements: JSX.Element[]
  ) {
    const bool = this._getPropertyAsBoolean(field.id, field.defaultValue === true || field.defaultValue === 1);

    const title = FieldUtilities.getFieldTitle(field);

    const seedId = this._getObjectId();

    const checkbox = (
      <FormCheckbox
        key={seedId + field.id}
        label={title}
        id={field.id}
        checked={bool}
        toggle={true}
        onChange={this._handleCheckboxChange}
      />
    );

    this.checkboxNames.push(field.id);
    this.checkboxItems.push(checkbox);

    formInterior.push(
      <div
        className={this.getCssClassName("fieldWrap")}
        key={"fwc" + field.id}
        style={{
          borderTopColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
          borderBottomColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
        }}
      >
        {checkbox}
        {descriptionElements}
        {sampleElements}
      </div>
    );
  }

  getFieldSubForm(field: IField) {
    if (field.subForm) {
      return field.subForm;
    }

    if (field.subFormId) {
      return Database.getFormByPath(field.subFormId);
    }

    return undefined;
  }

  addKeyedObjectComponent(
    field: IField,
    formInterior: any[],
    descriptionElements: JSX.Element[],
    sampleElements: JSX.Element[]
  ) {
    const val = this._getProperty(field.id, {});
    const fieldInterior = [];
    const childElements = [];
    Log.assert(val !== undefined, "Keyed object is not available in DataForm.");

    let fieldList = field.subFields;

    if (!fieldList) {
      fieldList = {};

      for (const key in val) {
        fieldList[key] = {
          id: key,
          title: key,
          dataType: 2,
        };
      }
    }

    let baseKey = this._getObjectId() + "." + field.id;

    const fieldSubForm = this.getFieldSubForm(field);

    if (val && fieldSubForm && fieldList) {
      const keys = [];

      if (field.displayTitle !== false) {
        const headerElement = (
          <div className="df-elementBinTitle" key={baseKey + "h"}>
            {FieldUtilities.getFieldTitle(field)}
          </div>
        );
        this.formComponentNames.push(field.id);
        this.formComponents.push(headerElement);
        fieldInterior.push(headerElement);
      }

      for (const key in fieldList) {
        keys.push(key);

        let title = key;

        if (field.subFields && field.subFields[key]) {
          const subField = field.subFields[key];

          if (subField.title) {
            title = subField.title;
          }
        }

        let propertyId = baseKey;

        propertyId += "." + key;

        let indentLevel = 1;

        if (this.props.indentLevel) {
          indentLevel = this.props.indentLevel + 1;
        }

        let obj = val[key];

        if (!obj) {
          obj = {};
          val[key] = obj;
        }

        const subForm = (
          <DataForm
            directObject={obj}
            objectKey={propertyId}
            key={propertyId}
            formId={propertyId}
            theme={this.props.theme}
            title={title}
            project={this.props.project}
            lookupProvider={this.props.lookupProvider}
            carto={this.props.carto}
            itemDefinition={this.props.itemDefinition}
            defaultVisualExperience={field.visualExperience}
            displayTitle={true}
            indentLevel={indentLevel}
            constrainHeight={this.props.constrainHeight}
            onClose={this._handleIndexedArraySubFormClose}
            definition={fieldSubForm}
            readOnly={this.props.readOnly}
          />
        );

        this.formComponentNames.push(propertyId);
        this.formComponents.push(subForm);

        childElements.push(subForm);
      }

      let binClassName = "df-elementBin";

      if (this.props.constrainHeight === false) {
        binClassName = "df-elementBinNoScroll";
      }

      fieldInterior.push(
        <div
          className={binClassName}
          key="dfeltbin"
          style={{
            backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
            borderColor: this.props.theme.siteVariables?.colorScheme.brand.background4,
          }}
        >
          {childElements}
        </div>
      );
    }

    formInterior.push(
      <div
        className={this.getCssClassName("fieldWrap")}
        key={"fwd" + field.id}
        style={{
          borderTopColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
          borderBottomColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
        }}
      >
        {descriptionElements}
        {fieldInterior}
        {sampleElements}
      </div>
    );
  }

  addArrayOfKeyedStringCollectionComponent(
    field: IField,
    formInterior: any[],
    descriptionElements: JSX.Element[],
    sampleElements: JSX.Element[]
  ) {
    const val = this._getProperty(field.id, {});
    const fieldInterior = [];
    const childElements = [];

    Log.assert(val !== undefined, "Keyed string array not available in data form.");

    let baseKey = this._getObjectId() + "." + field.id;

    if (val) {
      const keys = [];

      if (field.displayTitle !== false) {
        const headerElement = (
          <div className="df-elementBinTitle" key={baseKey + "akscch"}>
            {FieldUtilities.getFieldTitle(field)}
          </div>
        );
        this.formComponentNames.push(field.id);
        this.formComponents.push(headerElement);
        fieldInterior.push(headerElement);
      }

      fieldInterior.push(descriptionElements);
      fieldInterior.push(sampleElements);

      for (const keyValuePairs of val) {
        const kvpArea = [];

        for (const key in keyValuePairs) {
          keys.push(key);

          let title = key;

          let objKey = baseKey;

          objKey += "." + key;

          let propertyId = field.id;

          propertyId += "." + key;

          const objStr = keyValuePairs[key];

          const subForm = (
            <FormInput
              className="df-keyedSarrText"
              key={objKey + "TKS"}
              id={objKey}
              fluid={true}
              value={objStr as string}
              onChange={this._handleTextboxChange}
            />
          );

          this.formComponentNames.push(propertyId);
          this.formComponents.push(subForm);

          kvpArea.push(
            <div className="df-stringArray" key={objKey + "aksccs"}>
              <div className="df-stringArrayTitle">{title}</div>
              <div className="df-stringArrayData">{subForm}</div>
            </div>
          );
        }

        childElements.push(
          <div className="df-arrayOfKeyedStringSet" key={baseKey + "akss"}>
            {kvpArea}
          </div>
        );
      }
    }

    let binClassName = "df-elementBin";

    if (this.props.constrainHeight === false) {
      binClassName = "df-elementBinNoScroll";
    }

    fieldInterior.push(
      <div
        className={binClassName}
        key={baseKey + "dfelb2"}
        style={{
          backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
          borderColor: this.props.theme.siteVariables?.colorScheme.brand.background4,
        }}
      >
        {childElements}
      </div>
    );

    formInterior.push(
      <div
        className={this.getCssClassName("fieldWrap")}
        key={"fwe" + baseKey}
        style={{
          borderTopColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
          borderBottomColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
        }}
      >
        {fieldInterior}
      </div>
    );
  }

  addKeyedStringArrayCollectionComponent(
    field: IField,
    formInterior: any[],
    descriptionElements: JSX.Element[],
    sampleElements: JSX.Element[]
  ) {
    const val = this._getProperty(field.id, {});
    const fieldInterior = [];
    const childElements = [];

    Log.assert(val !== undefined, "Keyed string array not available in data form.");

    let baseKey = this._getObjectId() + "." + field.id;

    if (val) {
      const keys = [];

      if (field.displayTitle !== false) {
        const headerElement = (
          <div className="df-elementBinTitle" key={baseKey + "ksacc"}>
            {FieldUtilities.getFieldTitle(field)}
          </div>
        );
        this.formComponentNames.push(field.id);
        this.formComponents.push(headerElement);
        fieldInterior.push(headerElement);
      }

      fieldInterior.push(descriptionElements);
      fieldInterior.push(sampleElements);

      for (const key in val) {
        keys.push(key);

        let title = key;

        let objKey = baseKey;

        objKey += "." + key;

        let propertyId = field.id;

        propertyId += "." + key;

        const stringArr = val[key];

        const textElts = [];

        if (stringArr) {
          let index = 0;
          for (const stringArrStr of stringArr) {
            textElts.push(
              <FormInput
                className="df-keyedSarrText"
                key={objKey + "TKSA" + index}
                id={objKey}
                fluid={true}
                value={stringArrStr as string}
                onChange={this._handleTextboxChange}
              />
            );
            index++;
          }
        }

        this.formComponentNames.push(propertyId);
        this.formComponents.push(textElts);

        childElements.push(
          <div className="df-stringArray" key={objKey + "SA"}>
            <div className="df-stringArrayTitle">{title}</div>
            <div className="df-stringArrayData">{textElts}</div>
          </div>
        );
      }
    }

    let binClassName = "df-elementBin";

    if (this.props.constrainHeight === false) {
      binClassName = "df-elementBinNoScroll";
    }

    fieldInterior.push(
      <div
        className={binClassName}
        key={baseKey + "dfelb2"}
        style={{
          backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
          borderColor: this.props.theme.siteVariables?.colorScheme.brand.background4,
        }}
      >
        {childElements}
      </div>
    );

    formInterior.push(
      <div
        className={this.getCssClassName("fieldWrap")}
        key={baseKey + "fwf"}
        style={{
          borderTopColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
          borderBottomColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
        }}
      >
        {fieldInterior}
      </div>
    );
  }

  addKeyedStringComponent(
    field: IField,
    formInterior: any[],
    descriptionElements: JSX.Element[],
    sampleElements: JSX.Element[]
  ) {
    const val = this._getProperty(field.id, {});
    const fieldInterior = [];
    const childElements = [];
    const fieldTopper = [];
    const fieldBottom = [];

    Log.assert(val !== undefined, "Keyed string boolean not available in data form.");

    let baseKey = this._getObjectId() + "." + field.id;

    if (val) {
      const keys = [];

      if (field.displayTitle !== false) {
        const headerElement = (
          <div className="df-elementBinTitle" key={baseKey + "ksch"}>
            {FieldUtilities.getFieldTitle(field)}
          </div>
        );
        this.formComponentNames.push(field.id);
        this.formComponents.push(headerElement);
        fieldTopper.push(headerElement);
      }

      fieldBottom.push(descriptionElements);
      fieldBottom.push(sampleElements);

      if (!this.props.readOnly) {
        const toolbarItems = [];

        if (field.allowCreateDelete !== false) {
          toolbarItems.push({
            icon: <FontAwesomeIcon icon={faPlus} className="fa-lg" />,
            key: "add",
            tag: field.id,
            onClick: this._addKeyedStringItem,
            title: "Add item",
          });
        }

        const toolBarElement = (
          <div key={baseKey + "tb"}>
            <Toolbar aria-label="Keyed strings actions" items={toolbarItems} />
          </div>
        );
        this.formComponentNames.push(field.id + "toolbar");
        this.formComponents.push(toolBarElement);
        fieldTopper.push(toolBarElement);
      }

      let index = 0;

      const valList = [];

      for (const key in val) {
        if (this.state.keyAliases[key]) {
          valList.push(this.state.keyAliases[key] + "     |" + key);
        } else {
          valList.push(key);
        }
      }

      valList.sort();

      for (let key of valList) {
        const lastPeriod = key.lastIndexOf("|");

        if (lastPeriod >= 0) {
          key = key.substring(lastPeriod + 1);
        }

        let strVal = val[key] as string | undefined;

        if (strVal !== undefined) {
          keys.push(key);

          const objKey = baseKey + "." + index;

          let title = <div>{key}</div>;

          if (!this.props.readOnly) {
            title = (
              <FormInput
                key={objKey + ".title.text"}
                id={field.id + "." + key + ".text"}
                value={key as string}
                defaultValue={key as string}
                onChange={this._handleKeyedStringTextChange}
              />
            );
          }

          let propertyId = field.id;

          propertyId += "." + key;

          const inputControl = (
            <FormInput
              key={baseKey + ".input"}
              id={field.id + "." + key + ".input"}
              value={strVal}
              onChange={this._handleKeyedStringValueChange}
            />
          );

          this.formComponentNames.push(propertyId);
          this.formComponents.push(inputControl);

          const closeRow = (
            <Button
              icon={<FontAwesomeIcon key="closeClick" icon={faXmark} className="fa-lg" />}
              key={field.id + propertyId + objKey + ".close"}
              id={field.id + "." + key + ".close"}
              onClick={this._handleKeyedStringValueClose}
              title="Close"
            />
          );

          childElements.push(
            <div className="df-keyedStringCollection" key={objKey}>
              <div className="df-keyedStringCollectionTitle">{title}</div>
              <div className="df-keyedStringCollectionData">{inputControl}</div>
              <div className="df-keyedStringCollectionClose">{closeRow}</div>
            </div>
          );

          index++;
        }
      }
    }

    let binClassName = "df-elementBin";

    if (this.props.constrainHeight === false) {
      binClassName = "df-elementBinNoScroll";
    }

    fieldInterior.push(
      <div
        className={binClassName}
        key={baseKey + "dfelf3"}
        style={{
          backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
          borderColor: this.props.theme.siteVariables?.colorScheme.brand.background4,
        }}
      >
        {childElements}
      </div>
    );

    formInterior.push(
      <div
        className={this.getCssClassName("fieldWrap")}
        key={"fwg" + baseKey}
        style={{
          borderTopColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
          borderBottomColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
        }}
      >
        {fieldTopper}
        {fieldInterior}
        {fieldBottom}
      </div>
    );
  }

  addKeyedBooleanComponent(
    field: IField,
    formInterior: any[],
    descriptionElements: JSX.Element[],
    sampleElements: JSX.Element[]
  ) {
    const val = this._getProperty(field.id);
    const fieldInterior = [];
    const childElements = [];
    const fieldTopper = [];

    let baseKey = this._getObjectId() + "." + field.id;

    const keys = [];

    if (field.displayTitle !== false) {
      const headerElement = (
        <div className="df-elementBinTitle" key={baseKey + "kbch"}>
          {FieldUtilities.getFieldTitle(field)}
        </div>
      );
      this.formComponentNames.push(field.id);
      this.formComponents.push(headerElement);
      fieldTopper.push(headerElement);
    }

    fieldTopper.push(descriptionElements);
    fieldTopper.push(sampleElements);

    if (!this.props.readOnly) {
      const toolbarItems = [];

      if (field.allowCreateDelete !== false) {
        toolbarItems.push({
          icon: <FontAwesomeIcon icon={faPlus} className="fa-lg" />,
          key: "add",
          tag: field.id,
          onClick: this._addKeyedBooleanItem,
          title: "Add item",
        });
      }

      const toolBarElement = (
        <div>
          <Toolbar aria-label="Keyed true/false actions" items={toolbarItems} />
        </div>
      );
      this.formComponentNames.push(field.id + "toolbar");
      this.formComponents.push(toolBarElement);
      fieldTopper.push(toolBarElement);
    }

    let index = 0;

    const valList = [];

    if (val) {
      for (const key in val) {
        if (this.state.keyAliases[key]) {
          valList.push(this.state.keyAliases[key] + "     |" + key);
        } else {
          valList.push(key);
        }
      }
    }

    valList.sort();

    for (let key of valList) {
      const lastPeriod = key.lastIndexOf("|");

      if (lastPeriod >= 0) {
        key = key.substring(lastPeriod + 1);
      }

      const boolVal = val[key] as boolean | undefined;

      if (boolVal !== undefined) {
        keys.push(key);

        let objKey = field.id;

        if (this.props.objectKey) {
          objKey += this.props.objectKey;
        }

        objKey += "." + index;

        let title = <div>{key}</div>;

        if (!this.props.readOnly) {
          title = (
            <FormInput
              key={objKey + ".title.text"}
              id={field.id + "." + key + ".text"}
              value={key as string}
              defaultValue={key as string}
              onChange={this._handleKeyedBooleanTextChange}
            />
          );
        }

        let propertyId = field.id;

        propertyId += "." + key;

        const checkboxControl = (
          <FormCheckbox
            key={objKey + ".check"}
            label="On/off"
            id={field.id + "." + key + ".check"}
            checked={boolVal}
            toggle={true}
            onChange={this._handleKeyedBooleanValueChange}
          />
        );

        this.formComponentNames.push(propertyId);
        this.formComponents.push(checkboxControl);

        const closeRow = (
          <Button
            icon={<FontAwesomeIcon key="closeClick" icon={faXmark} className="fa-lg" />}
            key={objKey + ".close"}
            id={field.id + "." + key + ".close"}
            onClick={this._handleKeyedBooleanValueClose}
            title="Close"
          />
        );

        childElements.push(
          <div className="df-keyedBooleanCollection" key={objKey}>
            <div className="df-keyedBooleanCollectionTitle">{title}</div>
            <div className="df-keyedBooleanCollectionData">{checkboxControl}</div>
            <div className="df-keyedBooleanCollectionClose">{closeRow}</div>
          </div>
        );

        index++;
      }
    }

    let binClassName = "df-elementBin";

    if (this.props.constrainHeight === false) {
      binClassName = "df-elementBinNoScroll";
    }

    fieldInterior.push(
      <div
        className={binClassName}
        key="dfelfb4"
        style={{
          backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
          borderColor: this.props.theme.siteVariables?.colorScheme.brand.background4,
        }}
      >
        {childElements}
      </div>
    );

    formInterior.push(
      <div
        className={this.getCssClassName("fieldWrap")}
        key={"fwo" + field.id}
        style={{
          borderTopColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
          borderBottomColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
        }}
      >
        {fieldTopper}
        {fieldInterior}
        {sampleElements}
      </div>
    );
  }

  getObjectWithFieldIndex(objArr: any[], fieldToMap: string, val: number | string) {
    if (typeof val === "string") {
      let fieldNum: number | undefined;

      try {
        fieldNum = parseInt(val);
      } catch (e) {
        fieldNum = undefined;
      }

      if (fieldNum !== undefined && !isNaN(fieldNum)) {
        val = fieldNum;
      }
    }

    for (const objInArray of objArr) {
      if (objInArray[fieldToMap] === val) {
        return objInArray;
      }
    }
    return undefined;
  }

  _addObjectArrayItem(event: React.SyntheticEvent<HTMLElement>, data?: any) {
    if (data && data.tag) {
      const field = this._getFieldById(data.tag);

      if (field) {
        let arrayOfDataVal = this._getProperty(field.id, []);

        if (!Array.isArray(arrayOfDataVal)) {
          arrayOfDataVal = [arrayOfDataVal];
          this._setPropertyValue(field.id, arrayOfDataVal);
        }

        if (field.newItemPrototype) {
          arrayOfDataVal.push(JSON.parse(JSON.stringify(field.newItemPrototype)));
        } else {
          arrayOfDataVal.push({});
        }

        this._setPropertyValue(field.id, arrayOfDataVal);

        this._incrementObjectState();
      }
    }
  }

  _addKeyedBooleanItem(event: React.SyntheticEvent<HTMLElement>, data?: any) {
    if (data && data.tag) {
      const field = this._getFieldById(data.tag);

      if (field) {
        const arrayOfDataVal = this._getProperty(field.id, {});

        let newName = "a new value";
        let iter = 0;
        while (arrayOfDataVal[newName] !== undefined) {
          iter++;

          newName = "a new value " + String(iter);
        }

        arrayOfDataVal[newName] = true;

        this._setPropertyValue(field.id, arrayOfDataVal);

        this._incrementObjectState();
      }
    }
  }

  _addKeyedStringItem(event: React.SyntheticEvent<HTMLElement>, data?: any) {
    if (data && data.tag) {
      const field = this._getFieldById(data.tag);

      if (field) {
        const arrayOfDataVal = this._getProperty(field.id, {});

        let newName = "a new value";
        let iter = 0;

        while (arrayOfDataVal[newName] !== undefined) {
          iter++;
          newName = "a new value " + String(iter);
        }

        arrayOfDataVal[newName] = "value";

        this._setPropertyValue(field.id, arrayOfDataVal);

        this._incrementObjectState();
      }
    }
  }

  addObjectArrayComponent(
    field: IField,
    formInterior: any[],
    descriptionElements: JSX.Element[],
    sampleElements: JSX.Element[]
  ) {
    let arrayOfDataVal = this._getProperty(field.id, []);

    if (!Array.isArray(arrayOfDataVal)) {
      arrayOfDataVal = [arrayOfDataVal];
    }

    const fieldTopper = [];
    const fieldInterior = [];
    const childElements = [];

    let baseKey = this._getObjectId() + "." + field.id;

    Log.assert(arrayOfDataVal, "DFAOAC");

    const fieldSubForm = this.getFieldSubForm(field);

    if (arrayOfDataVal !== undefined && fieldSubForm && arrayOfDataVal instanceof Array) {
      if (field.displayTitle !== false) {
        const headerElement = <div className="df-elementBinTitle">{FieldUtilities.getFieldTitle(field)}</div>;
        this.formComponentNames.push(field.id);
        this.formComponents.push(headerElement);
        fieldTopper.push(headerElement);
      }

      fieldTopper.push(descriptionElements);
      fieldTopper.push(sampleElements);

      if (!this.props.readOnly) {
        const toolbarItems = [];

        if (field.allowCreateDelete !== false) {
          toolbarItems.push({
            icon: (
              <CustomLabel
                isCompact={false}
                icon={<FontAwesomeIcon icon={faPlus} className="fa-lg" />}
                text={field.noun ? "Add " + field.noun.toLowerCase() : "Add"}
              />
            ),
            key: "add",
            tag: field.id,
            onClick: this._addObjectArrayItem,
            title: "Add item",
          });
        }

        const toolBarElement = (
          <div>
            <Toolbar aria-label="List of items actions" items={toolbarItems} />
          </div>
        );
        this.formComponentNames.push(field.id + "toolbar");
        this.formComponents.push(toolBarElement);
        fieldTopper.push(toolBarElement);
      }

      if (
        field.matchObjectArrayToSubFieldKey === true &&
        field.objectArrayToSubFieldKey !== undefined &&
        field.subFields &&
        field.objectArrayToSubFieldKey
      ) {
        for (const fieldName in field.subFields) {
          let dataVal = this.getObjectWithFieldIndex(arrayOfDataVal, field.objectArrayToSubFieldKey, fieldName);
          let fieldNum: number | undefined;
          let fieldBroad: number | string | undefined = fieldName;

          try {
            fieldNum = parseInt(fieldName);

            if (fieldNum !== undefined && !isNaN(fieldNum)) {
              fieldBroad = fieldNum;
            }
          } catch (e) {
            fieldNum = undefined;
          }

          let indentLevel = 1;

          if (this.props.indentLevel) {
            indentLevel = this.props.indentLevel + 1;
          }

          if (dataVal === undefined) {
            dataVal = {};

            dataVal[field.objectArrayToSubFieldKey] = fieldBroad;

            arrayOfDataVal.push(dataVal);
          }

          let propertyId = baseKey;

          propertyId += "." + fieldName;

          const subForm = (
            <DataForm
              directObject={dataVal}
              objectKey={propertyId}
              key={fieldName}
              formId={propertyId}
              theme={this.props.theme}
              project={this.props.project}
              lookupProvider={this.props.lookupProvider}
              carto={this.props.carto}
              itemDefinition={this.props.itemDefinition}
              title={field.subFields[fieldName]?.title}
              defaultVisualExperience={field.visualExperience}
              displayTitle={true}
              indentLevel={indentLevel}
              constrainHeight={this.props.constrainHeight}
              onClose={this._handleKeyedObjectArraySubFormClose}
              onPropertyChanged={this._handleKeyedObjectArraySubFormPropertyChange}
              definition={fieldSubForm}
              readOnly={this.props.readOnly}
              closeButton={!this.props.readOnly && field.allowCreateDelete !== false}
            />
          );

          this.formComponentNames.push(fieldName);
          this.formComponents.push(subForm);

          childElements.push(subForm);
        }
      } else {
        for (const index in arrayOfDataVal) {
          let visualIndex = 0;
          let title = index;

          try {
            visualIndex = parseInt(index);
          } catch (e) {}

          if (!isNaN(visualIndex)) {
            title = String(visualIndex + 1);
          }

          let objKey = field.id;

          if (this.props.objectKey) {
            objKey += this.props.objectKey;
          }

          objKey += "." + index;

          let propertyId = field.id;

          propertyId += "." + index;

          let indentLevel = 1;

          if (this.props.indentLevel) {
            indentLevel = this.props.indentLevel + 1;
          }

          let obj = arrayOfDataVal[index];

          if (!obj) {
            obj = {};
            arrayOfDataVal[index] = obj;
          }

          if (field.objectArrayTitleFieldKey) {
            const val = obj[field.objectArrayTitleFieldKey];

            if (val) {
              title = val;
            }
          } else if (field.objectArrayToSubFieldKey) {
            const val = obj[field.objectArrayToSubFieldKey];

            if (field.subFields && val) {
              const subField = field.subFields[val];

              if (subField && subField.title) {
                title = subField.title;
              }
            }
          } else if (field.noun) {
            title = field.noun + " " + title;
          }

          const subForm = (
            <DataForm
              directObject={obj}
              objectKey={objKey}
              key={propertyId}
              formId={propertyId}
              title={title}
              project={this.props.project}
              lookupProvider={this.props.lookupProvider}
              carto={this.props.carto}
              itemDefinition={this.props.itemDefinition}
              titleFieldBinding={field.objectArrayTitleFieldKey}
              theme={this.props.theme}
              defaultVisualExperience={field.visualExperience}
              displayTitle={true}
              indentLevel={indentLevel}
              constrainHeight={this.props.constrainHeight}
              onPropertyChanged={this._handleIndexedArraySubFormPropertyChange}
              onClose={this._handleIndexedArraySubFormClose}
              definition={fieldSubForm}
              readOnly={this.props.readOnly}
              closeButton={!this.props.readOnly}
            />
          );

          this.formComponentNames.push(propertyId);
          this.formComponents.push(subForm);

          childElements.push(subForm);
        }
      }
    }

    let binClassName = "df-elementBinNoScroll";

    fieldInterior.push(
      <div
        className={binClassName}
        key="dfelfb5"
        style={{
          backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
          borderColor: this.props.theme.siteVariables?.colorScheme.brand.background4,
        }}
      >
        {childElements}
      </div>
    );

    formInterior.push(
      <div
        className={this.getCssClassName("fieldWrap")}
        key={"fwp" + field.id}
        style={{
          borderTopColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
          borderBottomColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
        }}
      >
        {fieldTopper}
        {fieldInterior}
      </div>
    );
  }

  addMinecraftEventTriggerArrayComponent(
    field: IField,
    formInterior: any[],
    descriptionElements: JSX.Element[],
    sampleElements: JSX.Element[]
  ) {
    let arrayOfDataVal = this._getProperty(field.id, []);

    if (!Array.isArray(arrayOfDataVal)) {
      arrayOfDataVal = [arrayOfDataVal];
    }

    const fieldTopper = [];
    const fieldInterior = [];
    const childElements = [];

    Log.assert(arrayOfDataVal, "DFAOAC");

    const fieldSubForm = this.getFieldSubForm(field);

    if (arrayOfDataVal !== undefined && fieldSubForm && arrayOfDataVal instanceof Array) {
      if (field.displayTitle !== false) {
        const headerElement = <div className="df-elementBinTitle">{FieldUtilities.getFieldTitle(field)}</div>;
        this.formComponentNames.push(field.id);
        this.formComponents.push(headerElement);
        fieldTopper.push(headerElement);
      }

      fieldTopper.push(descriptionElements);
      fieldTopper.push(sampleElements);

      if (!this.props.readOnly) {
        const toolbarItems = [];

        if (field.allowCreateDelete !== false) {
          toolbarItems.push({
            icon: (
              <CustomLabel
                isCompact={false}
                icon={<FontAwesomeIcon icon={faPlus} className="fa-lg" />}
                text={field.noun ? "Add " + field.noun.toLowerCase() : "Add"}
              />
            ),
            key: "add",
            tag: field.id,
            onClick: this._addObjectArrayItem,
            title: "Add item",
          });
        }

        const toolBarElement = (
          <div>
            <Toolbar aria-label="Minecraft event trigger list actions" items={toolbarItems} />
          </div>
        );
        this.formComponentNames.push(field.id + "toolbar");
        this.formComponents.push(toolBarElement);
        fieldTopper.push(toolBarElement);
      }

      for (const index in arrayOfDataVal) {
        let visualIndex = 0;
        let title = index;

        try {
          visualIndex = parseInt(index);
        } catch (e) {}

        if (!isNaN(visualIndex)) {
          title = String(visualIndex + 1);
        }

        let objKey = field.id;

        if (this.props.objectKey) {
          objKey += this.props.objectKey;
        }

        objKey += "." + index;

        let propertyId = field.id;

        propertyId += "." + index;

        let obj = arrayOfDataVal[index];

        if (!obj) {
          obj = {};
          arrayOfDataVal[index] = obj;
        }

        if (field.objectArrayTitleFieldKey) {
          const val = obj[field.objectArrayTitleFieldKey];

          if (val) {
            title = val;
          }
        } else if (field.objectArrayToSubFieldKey) {
          const val = obj[field.objectArrayToSubFieldKey];

          if (field.subFields && val) {
            const subField = field.subFields[val];

            if (subField && subField.title) {
              title = subField.title;
            }
          }
        } else if (field.noun) {
          title = field.noun + " " + title;
        }

        if (this.props.carto && this.props.project) {
          const subForm = (
            <MinecraftEventTriggerEditor
              data={obj}
              objectKey={objKey}
              key={propertyId}
              heightOffset={30}
              form={this.props.definition}
              field={field}
              entityTypeDefinition={this.props.itemDefinition as EntityTypeDefinition}
              carto={this.props.carto}
              project={this.props.project}
              theme={this.props.theme}
              constrainHeight={true}
              readOnly={this.props.readOnly}
            />
          );

          this.formComponentNames.push(propertyId);
          this.formComponents.push(subForm);

          childElements.push(subForm);
        }
      }
    }

    let binClassName = "df-elementBinNoScroll";

    fieldInterior.push(
      <div
        className={binClassName}
        key="dfelfb5"
        style={{
          backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
          borderColor: this.props.theme.siteVariables?.colorScheme.brand.background4,
        }}
      >
        {childElements}
      </div>
    );

    formInterior.push(
      <div
        className={this.getCssClassName("fieldWrap")}
        key={"fwp" + field.id}
        style={{
          borderTopColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
          borderBottomColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
        }}
      >
        {fieldTopper}
        {fieldInterior}
      </div>
    );
  }

  addStringArrayComponent(
    field: IField,
    formInterior: any[],
    descriptionElement: JSX.Element,
    sampleElements: JSX.Element[]
  ) {
    let val = this._getProperty(field.id, []);

    if (!Array.isArray(val)) {
      val = [val];
    }

    const fieldInterior = [];
    Log.assertDefined(val, "DFASAC");

    let baseKey = this._getObjectId() + "." + field.id;

    if (val) {
      const headerElement = <div key={"sarry" + baseKey}>{FieldUtilities.getFieldTitle(field)}</div>;

      this.formComponentNames.push(field.id);
      this.formComponents.push(headerElement);

      fieldInterior.push(headerElement);
      /*
  const keys = [];

      for (const key in field.subFields) {
        keys.push(key);

        const title = key;

        if (field.subFields && field.subFields[key]) {
          const subField = field.subFields[key];

          if (subField.title) {
            title = subField.title;
          }
        }

        const objKey = field.id;

        if (this.props.objectKey) {
          objKey += this.props.objectKey;
        }

        objKey += "." + key;

        const propertyId = field.id;

        propertyId += "." + key;

        const indentLevel = 1;

        if (this.props.indentLevel) {
          indentLevel = this.props.indentLevel + 1;
        }

        const obj = val[key];

        if (!obj) {
          obj = {};
          val[key] = obj;
        }

        const subForm = (
          <DataForm
            directObject={obj}
            objectKey={objKey}
            key={propertyId}
            formId={propertyId}
            title={title}
            theme={this.props.theme}
            defaultVisualExperience={field.visualExperience}
            displayTitle={true}
            indentLevel={indentLevel}
            onPropertyChanged={this._handleIndexedArraySubFormPropertyChange}
            definition={field.subForm}
            readOnly={this.props.readOnly}
          />
        );

        this.formComponentNames.push(propertyId);
        this.formComponents.push(subForm);

        formInterior.push(subForm);
      }*/
    }
    formInterior.push(
      <div
        className={this.getCssClassName("fieldWrap")}
        key={"fwq" + field.id}
        style={{
          borderTopColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
          borderBottomColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
        }}
      >
        {fieldInterior}
        {descriptionElement}
        {sampleElements}
      </div>
    );
  }

  addObjectComponent(
    field: IField,
    formInterior: any[],
    descriptionElements: JSX.Element[],
    sampleElements: JSX.Element[]
  ) {
    const val = this._getProperty(field.id);
    const fieldInterior = [];

    let baseKey = this._getObjectId() + "." + field.id;

    const fieldSubForm = this.getFieldSubForm(field);

    if (fieldSubForm) {
      if (field.displayTitle !== false) {
        const headerElement = (
          <div className="df-elementBinTitle" key={baseKey + "och"}>
            {FieldUtilities.getFieldTitle(field)}
          </div>
        );
        this.formComponentNames.push(field.id);
        this.formComponents.push(headerElement);
        fieldInterior.push(headerElement);
      }

      fieldInterior.push(descriptionElements);
      fieldInterior.push(sampleElements);

      const subForm = (
        <DataForm
          directObject={val}
          objectKey={baseKey}
          key={"dfp" + baseKey}
          formId={baseKey}
          parentField={field}
          theme={this.props.theme}
          project={this.props.project}
          lookupProvider={this.props.lookupProvider}
          carto={this.props.carto}
          itemDefinition={this.props.itemDefinition}
          defaultVisualExperience={FieldVisualExperience.normal}
          displayTitle={false}
          indentLevel={0}
          constrainHeight={false}
          onPropertyChanged={this._handleObjectSubFormPropertyChange}
          definition={fieldSubForm}
          readOnly={this.props.readOnly}
        />
      );

      this.formComponentNames.push(baseKey);
      this.formComponents.push(subForm);

      fieldInterior.push(subForm);
    }

    formInterior.push(
      <div
        className={this.getCssClassName("fieldWrap")}
        key={baseKey + "fwr"}
        style={{
          borderTopColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
          borderBottomColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
        }}
      >
        {fieldInterior}
      </div>
    );
  }
}
