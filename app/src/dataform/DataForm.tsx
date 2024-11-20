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
import StringArray, { IStringArrayProps } from "./StringArray";
import Range, { IRangeProps } from "./Range";
import MinecraftFilter, { IMinecraftFilterProps } from "./MinecraftFilter";
import ISimpleReference from "../core/ISimpleReference";
import Utilities from "../core/Utilities";
import IDataContainer from "./IDataContainer";
import FieldUtilities from "./FieldUtilities";

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
  tag?: any;
  parentField?: IField;
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
  onPropertyChanged?: (props: IDataFormProps, property: IProperty, newValue: any) => void;
}

interface IDataFormState {
  objectIncrement: number;
  keyAliases: { [name: string]: string };
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

    this.state = {
      objectIncrement: 0,
      keyAliases: {},
    };
  }

  componentDidUpdate(prevProps: IDataFormProps, prevState: IDataFormState) {
    if (prevProps !== undefined && prevProps.dataPropertyObject !== undefined) {
      prevProps.dataPropertyObject.onPropertyChanged.unsubscribe(this._handleBlockChanged);
    }

    if (this.props !== undefined && this.props.dataPropertyObject !== undefined) {
      this.props.dataPropertyObject.onPropertyChanged.unsubscribe(this._handleBlockChanged);
    }
  }

  _handleBlockChanged() {
    this._doUpdate();
  }

  _doUpdate() {
    this.setState({
      objectIncrement: this.state.objectIncrement + 1,
      keyAliases: this.state.keyAliases,
    });
  }

  _getObjectId() {
    if (this.props.objectKey) {
      return this.props.objectKey;
    }

    const fieldId = this._getProperty("id", undefined);

    if (!fieldId) {
      return fieldId;
    }

    return this.state.objectIncrement.toString();
  }

  _getProperty(name: string, defaultValue: any) {
    let value = undefined;

    if (this.props.dataPropertyObject !== undefined) {
      const prop = this.props.dataPropertyObject.getProperty(name);

      if (prop !== undefined) {
        value = prop.value;
      }
    }

    if (this.props.getsetPropertyObject !== undefined) {
      value = this.props.getsetPropertyObject.getProperty(name);
    }

    if (this.props.directObject !== undefined) {
      value = this.props.directObject[name];
    }

    if (value === undefined) {
      if (typeof defaultValue === "object") {
        if (this.props.directObject && this.props.directObject[name] === undefined) {
          this.props.directObject[name] = defaultValue;
        }

        if (this.props.getsetPropertyObject !== undefined) {
          this.props.getsetPropertyObject.setProperty(name, defaultValue);
        }
      }

      return defaultValue;
    }

    return value;
  }

  _getPropertyAsInt(name: string, defaultValue: number) {
    let value = undefined;

    if (this.props.dataPropertyObject !== undefined) {
      const prop = this.props.dataPropertyObject.getProperty(name);

      if (prop !== undefined) {
        value = prop.value;
      }
    }

    if (this.props.getsetPropertyObject !== undefined) {
      value = this.props.getsetPropertyObject.getProperty(name);
    }

    if (this.props.directObject !== undefined) {
      value = this.props.directObject[name];
    }

    if (value === undefined) {
      return defaultValue;
    }

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

  _getFieldById(id: string) {
    const fields = this.props.definition.fields;

    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];

      if (field.id === id) {
        return field;
      }
    }

    return undefined;
  }

  processInputUpdate(
    event: SyntheticEvent<HTMLElement, Event> | React.KeyboardEvent<Element> | null,
    data: string | undefined
  ) {
    if (event === null || data === null || data === undefined) {
      return;
    }

    const protoObj = this.props.dataPropertyObject;
    const id = event.currentTarget.id;

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
      protogsObj.setProperty(id, val);
    }

    const dirObj = this.props.directObject;

    if (dirObj !== undefined) {
      dirObj[id] = val;

      this._fixupDirectObject(dirObj);
    }

    Log.assert(
      dirObj !== undefined || protogsObj !== undefined || protoObj !== undefined,
      "Could not find a backing object to edit."
    );

    if (this.props.onPropertyChanged !== undefined) {
      this.props.onPropertyChanged(this.props, { id: id, value: val }, val);
    }

    this.forceUpdate();
  }

  _fixupDirectObject(directObject: { [propName: string]: any }) {
    const fields = this.props.definition.fields;

    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];

      if (field.undefinedIfEmpty) {
        let hasContent = false;

        for (const propVal in directObject[field.id]) {
          if (propVal.length !== undefined && propVal.length > 0) {
            hasContent = true;
          }
        }

        if (!hasContent) {
          directObject[field.id] = undefined;
        }
      }
    }
  }

  _handleSliderChange(
    event: SyntheticEvent<HTMLElement, Event> | React.KeyboardEvent<Element> | null,
    data: (SliderProps & { value: string }) | undefined
  ) {
    this.processInputUpdate(event, data?.value);
  }

  _handleTextboxChange(
    event: SyntheticEvent<HTMLElement, Event> | React.KeyboardEvent<Element> | null,
    data: (InputProps & { value: string }) | undefined
  ) {
    this.processInputUpdate(event, data?.value);
  }

  _handleTextAreaChange(
    event: SyntheticEvent<HTMLElement, Event> | React.KeyboardEvent<Element> | null,
    data: TextAreaProps | undefined
  ) {
    this.processInputUpdate(event, data?.value);
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
    arrayOfDataVal[keySplit[1]] = undefined;

    arrayOfDataVal[data.value] = val;

    const keyAliases = this.state.keyAliases;
    keyAliases[data.value] = this.state.keyAliases[keySplit[1]] ? this.state.keyAliases[keySplit[1]] : keySplit[1];

    this.setState({
      objectIncrement: this.state.objectIncrement,
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

    arrayOfDataVal[keySplit[1]] = data.checked;

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

    arrayOfDataVal[keySplit[1]] = undefined;

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
    arrayOfDataVal[keySplit[1]] = undefined;

    arrayOfDataVal[data.value] = val;

    const keyAliases = this.state.keyAliases;
    keyAliases[data.value] = this.state.keyAliases[keySplit[1]] ? this.state.keyAliases[keySplit[1]] : keySplit[1];

    this.setState({
      objectIncrement: this.state.objectIncrement,
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

    arrayOfDataVal[keySplit[1]] = data.value;

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
        return parseFloat(value);
      } else if (typeof value === "boolean") {
        if (value) {
          return 1;
        }

        return 0;
      }
    } else if (
      field.dataType === FieldDataType.string ||
      field.dataType === FieldDataType.longFormString ||
      field.dataType === FieldDataType.stringLookup ||
      field.dataType === FieldDataType.stringEnum
    ) {
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

    const protoObj = this.props.dataPropertyObject;
    const id = event.currentTarget.id;

    const val = FieldUtilities.getFieldValueAsBoolean(id, false, this.props);

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

      protogsObj.setProperty(id, newBoolVal);
    }

    const dirObj = this.props.directObject;

    if (dirObj !== undefined) {
      let newBoolVal: boolean | number = val;

      newBoolVal = !newBoolVal;

      dirObj[id] = newBoolVal;
    }

    if (this.props.onPropertyChanged !== undefined) {
      this.props.onPropertyChanged(this.props, { id: id, value: val }, val);
    }

    this._doUpdate();
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
                    title = Utilities.humanifyMinecraftName(lookupSet[k].id);
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

      this._doUpdate();
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
      directPropO.setProperty(id, val);
    }

    const directO = this.props.directObject;

    if (directO !== undefined) {
      directO[id] = val;
    }

    if (this.props.onPropertyChanged !== undefined) {
      this.props.onPropertyChanged(this.props, { id: id, value: val }, val);
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
      Log.unexpectedState("DFKOASFC1");
      return;
    }

    const objectFieldIndex: string = formId.substring(lastPeriod + 1);
    const fieldId = formId.substring(0, lastPeriod);

    if (fieldId === undefined || objectFieldIndex === undefined) {
      Log.unexpectedUndefined("DFKOASFC2");
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
      Log.unexpectedState("DFKOASFPC1");
      return;
    }

    const objectFieldIndex: string = formId.substring(lastPeriod + 1);
    const fieldId = formId.substring(0, lastPeriod);

    if (fieldId === undefined || objectFieldIndex === undefined) {
      Log.unexpectedUndefined("DFKOASFPC2");
      return;
    }

    const arrayOfDataVal = this._getProperty(fieldId, []);
    const field = this._getFieldById(fieldId);

    if (field === undefined || field.objectArrayToSubFieldKey === undefined) {
      Log.unexpectedUndefined("DFKOASFPC3");
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
      Log.unexpectedState("DFIASFC1");
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
      this._doUpdate();
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
      const directO = this.props.directObject;

      if (directO !== undefined) {
        if (!directO[propertyName]) {
          directO[propertyName] = {};
        }

        this._fixupDirectObject(directO);

        if (newValue !== directO[propertyName][propertyIndex]) {
          const obj = directO[propertyName];

          if (this.props.onPropertyChanged !== undefined) {
            this.props.onPropertyChanged(this.props, { id: props.formId, value: newValue }, obj[propertyIndex]);
          }
        }
      }
    }
  }

  _handleObjectSubFormPropertyChange(props: IDataFormProps, property: IProperty, newValue: any) {
    const propId = props.formId;

    if (!propId) {
      return;
    }

    const directO = this.props.directObject;

    if (directO !== undefined && property.id !== undefined) {
      let obj = directO[propId];

      if (!obj) {
        obj = {};

        directO[propId] = obj;
      }

      if (obj[property.id] !== newValue) {
        obj[property.id] = newValue;
      }

      this._fixupDirectObject(directO);

      // this might have been changed in the sub text area, but fire the onpropertychanged in any case.
      if (this.props.onPropertyChanged !== undefined) {
        this.props.onPropertyChanged(this.props, { id: props.formId, value: newValue }, newValue);
      }
    }
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

  _handleStringArrayPropertyChange(
    event: SyntheticEvent<HTMLElement, Event> | React.KeyboardEvent<Element> | null,
    props: IStringArrayProps
  ) {
    this._setPropertyValue(props.field.id, props.data);
  }

  _handleMinecraftFilterPropertyChange(
    event: SyntheticEvent<HTMLElement, Event> | React.KeyboardEvent<Element> | null,
    props: IMinecraftFilterProps
  ) {
    this._setPropertyValue(props.field.id, props.data);
  }

  _handleCloseClick(event: React.SyntheticEvent<HTMLElement>, data?: ButtonProps) {
    if (!data) {
      return;
    }

    if (this.props.onClose) {
      this.props.onClose(this.props);
    }
  }

  render() {
    const formInterior = [];

    this.dropdownNames = [];
    this.dropdownItems = [];

    this.checkboxItems = [];
    this.checkboxNames = [];

    const seedId = this._getObjectId();

    if (this.props.definition !== undefined) {
      for (const propIndex in this.props.definition.fields) {
        const field = this.props.definition.fields[propIndex];

        if (!field.visibility || FieldUtilities.evaluate(this.props.definition, field.visibility, this.props)) {
          const curVal = FieldUtilities.getFieldValue(field, this.props);
          const defaultVal = curVal ? curVal : field.defaultValue;

          let isValid = true;

          if (field.validity) {
            isValid = FieldUtilities.evaluate(this.props.definition, field.validity, this.props, field);
          }

          let descriptionElement = <></>;

          if (field.description) {
            descriptionElement = (
              <div key={seedId + field.id + "desc"} className="df-fieldDescription">
                {field.description}
              </div>
            );
          }

          const title = FieldUtilities.getFieldTitle(field);

          if (this.props.readOnly || field.readOnly) {
            if (field.defaultValue === undefined || field.defaultValue !== curVal) {
              formInterior.push(
                <div className="df-ro-row" key={seedId + "row" + title}>
                  <div className="df-ro-title">{title}</div>
                  <div className="df-ro-value">{curVal}</div>
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
                      title = Utilities.humanifyMinecraftName(lookupSet[i].id);
                    }

                    dropdownValue = title;
                  }
                }
              }

              const dropdown = (
                <FormDropdown
                  label={title}
                  id={propIndex}
                  items={items}
                  key={"frs" + seedId + title + propIndex}
                  fluid={true}
                  onChange={this._handleDropdownChange}
                  value={[dropdownValue]}
                />
              );

              this.dropdownNames.push(field.id);
              this.dropdownItems.push(items);
              formInterior.push(
                <div className="df-fieldWrap" key={"fw" + field.id}>
                  {dropdown}
                  {descriptionElement}
                </div>
              );
            } else if (field.dataType === FieldDataType.point3) {
              const val = this._getProperty(field.id, [0, 0, 0]);
              let objKey = field.id;
              if (this.props.objectKey) {
                objKey += this.props.objectKey;
              }

              const point3 = (
                <Point3
                  data={val}
                  objectKey={objKey}
                  key={"p3" + seedId + field.id}
                  label={title}
                  ambientPoint={this.props.ambientSelectedPoint}
                  onChange={this._handlePoint3PropertyChange}
                  form={this.props.definition}
                  field={field}
                />
              );

              this.formComponentNames.push(field.id);
              this.formComponents.push(point3);
              formInterior.push(
                <div className="df-fieldWrap" key={"fw" + field.id}>
                  {point3}
                  {descriptionElement}
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
                  key={"ver" + seedId + field.id}
                  label={title}
                  onChange={this._handleVersionPropertyChange}
                  form={this.props.definition}
                  field={field}
                />
              );

              this.formComponentNames.push(field.id);
              this.formComponents.push(version);

              formInterior.push(
                <div className="df-fieldWrap" key={"fw" + field.id}>
                  {version}
                  {descriptionElement}
                </div>
              );
            } else if (
              field.dataType === FieldDataType.stringArray ||
              field.dataType === FieldDataType.longFormStringArray
            ) {
              const val = this._getProperty(field.id, []);
              let objKey = field.id;
              if (this.props.objectKey) {
                objKey += this.props.objectKey;
              }

              const sarrt = (
                <StringArray
                  data={val}
                  objectKey={objKey}
                  key={"sarr" + seedId + field.id}
                  longForm={field.dataType === FieldDataType.longFormStringArray}
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
                <div className="df-fieldWrap" key={"fw" + field.id}>
                  <div className={isValid ? "df-elementTitle" : "df-elementTitleInvalid"}>{title}</div>
                  {descriptionElement}
                  {sarrt}
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
                  key={"ra" + seedId + field.id}
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
                <div className="df-fieldWrap" key={"fw" + field.id}>
                  {range}
                  {descriptionElement}
                </div>
              );
            } else if (field.dataType === FieldDataType.minecraftFilter) {
              const val = this._getProperty(field.id, {});
              let objKey = field.id;

              if (this.props.objectKey) {
                objKey += this.props.objectKey;
              }

              const sarr = (
                <MinecraftFilter
                  data={val}
                  objectKey={objKey}
                  key={"mifi" + seedId + field.id}
                  onChange={this._handleMinecraftFilterPropertyChange}
                  form={this.props.definition}
                  field={field}
                />
              );

              this.formComponentNames.push(field.id);
              this.formComponents.push(sarr);

              formInterior.push(
                <div className="df-fieldWrap" key={"fw" + field.id}>
                  {descriptionElement}
                  {sarr}
                </div>
              );
            } else if (field.dataType === FieldDataType.keyedObjectCollection) {
              this.addKeyedObjectComponent(field, formInterior, descriptionElement);
            } else if (field.dataType === FieldDataType.keyedStringArrayCollection) {
              this.addKeyedStringArrayCollectionComponent(field, formInterior, descriptionElement);
            } else if (field.dataType === FieldDataType.arrayOfKeyedStringCollection) {
              this.addArrayOfKeyedStringCollectionComponent(field, formInterior, descriptionElement);
            } else if (field.dataType === FieldDataType.keyedStringCollection) {
              this.addKeyedStringComponent(field, formInterior, descriptionElement);
            } else if (field.dataType === FieldDataType.keyedBooleanCollection) {
              this.addKeyedBooleanComponent(field, formInterior, descriptionElement);
            } else if (field.dataType === FieldDataType.objectArray) {
              this.addObjectArrayComponent(field, formInterior, descriptionElement);
            } else if (field.dataType === FieldDataType.object) {
              this.addObjectComponent(field, formInterior, descriptionElement);
            } else if (field.dataType === FieldDataType.intBoolean || field.dataType === FieldDataType.boolean) {
              this.addCheckboxComponent(field, formInterior, descriptionElement);
            } else if (field.dataType === FieldDataType.longFormString) {
              const fieldInput = (
                <TextArea
                  fluid={true}
                  key={"txa" + seedId + field.id}
                  id={field.id}
                  value={curVal as string}
                  defaultValue={defaultVal as string}
                  spellCheck={true}
                  onChange={this._handleTextAreaChange}
                />
              );

              formInterior.push(
                <div className="df-fieldWrap" key={"fw" + field.id}>
                  <div key={seedId + field.id + "titleA"} className="df-fieldTitle">
                    <div className={isValid ? "df-elementTitle" : "df-elementTitleInvalid"}>{title}</div>
                    {fieldInput}
                  </div>
                  {descriptionElement}
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
                <div className="df-fieldWrap" key={"fw" + field.id}>
                  <div className="df-sliderSet" key={seedId + field.id + "W"}>
                    <div className="df-sliderTitle">{title}</div>
                    <Slider
                      key={"sli" + seedId + field.id}
                      id={field.id}
                      fluid={true}
                      className="df-slider"
                      step={field.step ? field.step : 1}
                      min={field.minValue ? field.minValue : field.suggestedMinValue}
                      max={field.maxValue ? field.maxValue : field.suggestedMaxValue}
                      value={curVal as string}
                      defaultValue={defaultVal as string}
                      onChange={this._handleSliderChange}
                    />
                    <FormInput
                      className="df-sliderInput"
                      key={seedId + field.id + "T"}
                      id={field.id}
                      fluid={true}
                      value={curVal as string}
                      defaultValue={defaultVal as string}
                      onChange={this._handleTextboxChange}
                    />
                  </div>
                  {descriptionElement}
                </div>
              );
            } else {
              let strVal = curVal ? String(curVal) : "";
              let cssClass = "df-fieldWrap";

              // if the user is dealing with floating point numbers and has typed in "3." on their way to
              // typing in "3.5", using _workingValues to "remember" that and substitute it back in.
              // otherwise we'd always replace "3." with "3" and you wouldn't be able to add decimal vals
              if (field.dataType === FieldDataType.float || field.dataType === FieldDataType.number) {
                cssClass += " df-fieldWrapNumber";
                if (this._workingValues[field.id]) {
                  const val = this._getTypedData(field, this._workingValues[field.id]);

                  if (val === curVal) {
                    strVal = this._workingValues[field.id];
                  }
                }
              }

              formInterior.push(
                <div className={cssClass} key={"fw" + field.id}>
                  <FormInput
                    label={title}
                    key={"fri" + seedId + field.id}
                    id={field.id}
                    value={strVal}
                    defaultValue={defaultVal as string}
                    onChange={this._handleTextboxChange}
                  />
                  {descriptionElement}
                </div>
              );
            }
          }
        }
      }
    }

    let headerOuter = <></>;
    const header = [];
    const subheader = [];

    if (this.props.displayTitle) {
      let title = this.props.definition.title;

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
          <div key="header" className="df-subHeaderTitle">
            {title}
          </div>
        );
      } else {
        header.push(
          <div key="header" className="df-headerTitle">
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
          <div key="stheader" className="df-subHeaderSubTitle">
            {subTitle}
          </div>
        );
      } else {
        header.push(
          <div key="stheader" className="df-headerSubTitle">
            {subTitle}
          </div>
        );
      }
    }

    if (this.props.closeButton) {
      const accessoryToolbar = [];

      accessoryToolbar.push({
        icon: <FontAwesomeIcon key="closeClick" icon={faXmark} className="fa-lg" />,
        key: "close",
        onClick: this._handleCloseClick,
        title: "Close",
      });

      header.push(
        <div className="df-closeArea" key="closeArea">
          <Toolbar aria-label="Form accesory toolbar overflow menu" items={accessoryToolbar} />
        </div>
      );
    }
    if (this.props.displayDescription) {
      subheader.push(
        <div key="description" className="df-description">
          {this.props.definition.description}
        </div>
      );
    }

    let contents = <></>;

    if (!this.props.readOnly) {
      contents = <div className="df-form">{formInterior}</div>;
    } else {
      contents = <div className="df-ro-table">{formInterior}</div>;
    }

    if (header.length > 0) {
      headerOuter = <div className="df-headerOuter">{header}</div>;
    }

    return (
      <div className="df-outer">
        <div
          className={
            this.props.indentLevel || this.props.defaultVisualExperience === FieldVisualExperience.deemphasized
              ? "df-cardWrapper"
              : "df-wrapper"
          }
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
          <div className="df-formArea">{contents}</div>
        </div>
      </div>
    );
  }

  addCheckboxComponent(field: IField, formInterior: any[], descriptionElement: JSX.Element) {
    const bool = FieldUtilities.getFieldValueAsBoolean(field.id, false, this.props);

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
      <div className="df-fieldWrap" key={"fw" + field.id}>
        {checkbox}
        {descriptionElement}
      </div>
    );
  }

  addKeyedObjectComponent(field: IField, formInterior: any[], descriptionElement: JSX.Element) {
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

    if (val && field.subForm && fieldList) {
      const keys = [];

      if (field.displayTitle !== false) {
        const headerElement = <div className="df-elementBinTitle">{FieldUtilities.getFieldTitle(field)}</div>;
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

        let objKey = field.id;

        if (this.props.objectKey) {
          objKey += this.props.objectKey;
        }

        objKey += "." + key;

        let propertyId = field.id;

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
            objectKey={objKey}
            key={propertyId}
            formId={propertyId}
            theme={this.props.theme}
            title={title}
            defaultVisualExperience={field.visualExperience}
            displayTitle={true}
            indentLevel={indentLevel}
            constrainHeight={this.props.constrainHeight}
            onClose={this._handleIndexedArraySubFormClose}
            definition={field.subForm}
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
      <div className="df-fieldWrap" key={"fw" + field.id}>
        {descriptionElement}
        {fieldInterior}
      </div>
    );
  }

  addArrayOfKeyedStringCollectionComponent(field: IField, formInterior: any[], descriptionElement: JSX.Element) {
    const val = this._getProperty(field.id, {});
    const fieldInterior = [];
    const childElements = [];

    Log.assert(val !== undefined, "Keyed string array not available in data form.");

    if (val) {
      const keys = [];

      if (field.displayTitle !== false) {
        const headerElement = <div className="df-elementBinTitle">{FieldUtilities.getFieldTitle(field)}</div>;
        this.formComponentNames.push(field.id);
        this.formComponents.push(headerElement);
        fieldInterior.push(headerElement);
      }

      fieldInterior.push(descriptionElement);

      for (const keyValuePairs of val) {
        const kvpArea = [];

        for (const key in keyValuePairs) {
          keys.push(key);

          let title = key;

          let objKey = field.id;

          if (this.props.objectKey) {
            objKey += this.props.objectKey;
          }

          objKey += "." + key;

          let propertyId = field.id;

          propertyId += "." + key;

          const objStr = keyValuePairs[key];

          const subForm = (
            <FormInput
              className="df-keyedSarrText"
              key={objKey + "T"}
              id={objKey}
              fluid={true}
              value={objStr as string}
              onChange={this._handleTextboxChange}
            />
          );

          this.formComponentNames.push(propertyId);
          this.formComponents.push(subForm);

          kvpArea.push(
            <div className="df-stringArray">
              <div className="df-stringArrayTitle">{title}</div>
              <div className="df-stringArrayData">{subForm}</div>
            </div>
          );
        }

        childElements.push(<div className="df-arrayOfKeyedStringSet">{kvpArea}</div>);
      }
    }

    let binClassName = "df-elementBin";

    if (this.props.constrainHeight === false) {
      binClassName = "df-elementBinNoScroll";
    }

    fieldInterior.push(
      <div
        className={binClassName}
        key="dfelb2"
        style={{
          backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
          borderColor: this.props.theme.siteVariables?.colorScheme.brand.background4,
        }}
      >
        {childElements}
      </div>
    );

    formInterior.push(
      <div className="df-fieldWrap" key={"fw" + field.id}>
        {fieldInterior}
      </div>
    );
  }

  addKeyedStringArrayCollectionComponent(field: IField, formInterior: any[], descriptionElement: JSX.Element) {
    const val = this._getProperty(field.id, {});
    const fieldInterior = [];
    const childElements = [];

    Log.assert(val !== undefined, "Keyed string array not available in data form.");

    if (val) {
      const keys = [];

      if (field.displayTitle !== false) {
        const headerElement = <div className="df-elementBinTitle">{FieldUtilities.getFieldTitle(field)}</div>;
        this.formComponentNames.push(field.id);
        this.formComponents.push(headerElement);
        fieldInterior.push(headerElement);
      }

      fieldInterior.push(descriptionElement);

      for (const key in val) {
        keys.push(key);

        let title = key;

        let objKey = field.id;

        if (this.props.objectKey) {
          objKey += this.props.objectKey;
        }

        objKey += "." + key;

        let propertyId = field.id;

        propertyId += "." + key;

        const stringArr = val[key];

        const textElts = [];

        for (const stringArrStr of stringArr) {
          textElts.push(
            <FormInput
              className="df-keyedSarrText"
              key={objKey + "T"}
              id={objKey}
              fluid={true}
              value={stringArrStr as string}
              onChange={this._handleTextboxChange}
            />
          );
        }

        this.formComponentNames.push(propertyId);
        this.formComponents.push(textElts);

        childElements.push(
          <div className="df-stringArray">
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
        key="dfelb2"
        style={{
          backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
          borderColor: this.props.theme.siteVariables?.colorScheme.brand.background4,
        }}
      >
        {childElements}
      </div>
    );

    formInterior.push(
      <div className="df-fieldWrap" key={"fw" + field.id}>
        {fieldInterior}
      </div>
    );
  }

  addKeyedStringComponent(field: IField, formInterior: any[], descriptionElement: JSX.Element) {
    const val = this._getProperty(field.id, {});
    const fieldInterior = [];
    const childElements = [];
    const fieldTopper = [];

    Log.assert(val !== undefined, "Keyed string boolean not available in data form.");

    if (val) {
      const keys = [];

      if (field.displayTitle !== false) {
        const headerElement = <div className="df-elementBinTitle">{FieldUtilities.getFieldTitle(field)}</div>;
        this.formComponentNames.push(field.id);
        this.formComponents.push(headerElement);
        fieldTopper.push(headerElement);
      }

      fieldTopper.push(descriptionElement);

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
          <div>
            <Toolbar aria-label="Actions toolbar overflow menu" items={toolbarItems} />
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
                onChange={this._handleKeyedStringTextChange}
              />
            );
          }

          let propertyId = field.id;

          propertyId += "." + key;

          const inputControl = (
            <FormInput
              key={field.id + propertyId + objKey + ".input"}
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
        key="dfelf3"
        style={{
          backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
          borderColor: this.props.theme.siteVariables?.colorScheme.brand.background4,
        }}
      >
        {childElements}
      </div>
    );

    formInterior.push(
      <div className="df-fieldWrap" key={"fw" + field.id}>
        {fieldTopper}
        {fieldInterior}
      </div>
    );
  }

  addKeyedBooleanComponent(field: IField, formInterior: any[], descriptionElement: JSX.Element) {
    const val = this._getProperty(field.id, {});
    const fieldInterior = [];
    const childElements = [];
    const fieldTopper = [];

    Log.assert(val !== undefined, "Keyed string boolean not available in data form.");

    if (val) {
      const keys = [];

      if (field.displayTitle !== false) {
        const headerElement = <div className="df-elementBinTitle">{FieldUtilities.getFieldTitle(field)}</div>;
        this.formComponentNames.push(field.id);
        this.formComponents.push(headerElement);
        fieldTopper.push(headerElement);
      }

      fieldTopper.push(descriptionElement);

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
            <Toolbar aria-label="Actions toolbar overflow menu" items={toolbarItems} />
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
              key={field.id + propertyId + objKey + ".check"}
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
              key={field.id + propertyId + objKey + ".close"}
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
      <div className="df-fieldWrap" key={"fw" + field.id}>
        {descriptionElement}
        {fieldTopper}
        {fieldInterior}
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
        const arrayOfDataVal = this._getProperty(field.id, []);

        if (field.newItemPrototype) {
          arrayOfDataVal.push(JSON.parse(JSON.stringify(field.newItemPrototype)));
        } else {
          arrayOfDataVal.push({});
        }

        this._doUpdate();
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

        this._doUpdate();
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

        this._doUpdate();
      }
    }
  }

  addObjectArrayComponent(field: IField, formInterior: any[], descriptionElement: JSX.Element) {
    const arrayOfDataVal = this._getProperty(field.id, []);
    const fieldTopper = [];
    const fieldInterior = [];
    const childElements = [];

    Log.assert(arrayOfDataVal, "DFAOAC");

    if (arrayOfDataVal !== undefined && field.subForm && arrayOfDataVal instanceof Array) {
      if (field.displayTitle !== false) {
        const headerElement = <div className="df-elementBinTitle">{FieldUtilities.getFieldTitle(field)}</div>;
        this.formComponentNames.push(field.id);
        this.formComponents.push(headerElement);
        fieldTopper.push(headerElement);
      }

      fieldTopper.push(descriptionElement);

      if (!this.props.readOnly) {
        const toolbarItems = [];

        if (field.allowCreateDelete !== false) {
          toolbarItems.push({
            icon: <FontAwesomeIcon icon={faPlus} className="fa-lg" />,
            key: "add",
            tag: field.id,
            onClick: this._addObjectArrayItem,
            title: "Add item",
          });
        }

        const toolBarElement = (
          <div>
            <Toolbar aria-label="Actions  toolbar overflow menu" items={toolbarItems} />
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
          let objKey = field.id;
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

          if (this.props.objectKey) {
            objKey += this.props.objectKey;
          }

          objKey += "." + fieldName;

          let indentLevel = 1;

          if (this.props.indentLevel) {
            indentLevel = this.props.indentLevel + 1;
          }

          if (dataVal === undefined) {
            dataVal = {};

            dataVal[field.objectArrayToSubFieldKey] = fieldBroad;

            arrayOfDataVal.push(dataVal);
          }

          let propertyId = field.id;

          propertyId += "." + fieldName;

          const subForm = (
            <DataForm
              directObject={dataVal}
              objectKey={objKey}
              key={fieldName}
              formId={propertyId}
              theme={this.props.theme}
              title={field.subFields[fieldName]?.title}
              defaultVisualExperience={field.visualExperience}
              displayTitle={true}
              indentLevel={indentLevel}
              constrainHeight={this.props.constrainHeight}
              onClose={this._handleKeyedObjectArraySubFormClose}
              onPropertyChanged={this._handleKeyedObjectArraySubFormPropertyChange}
              definition={field.subForm}
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

              if (subField) {
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
              titleFieldBinding={field.objectArrayTitleFieldKey}
              theme={this.props.theme}
              defaultVisualExperience={field.visualExperience}
              displayTitle={true}
              indentLevel={indentLevel}
              constrainHeight={this.props.constrainHeight}
              onPropertyChanged={this._handleIndexedArraySubFormPropertyChange}
              onClose={this._handleIndexedArraySubFormClose}
              definition={field.subForm}
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

    let binClassName = "df-elementBin";

    if (this.props.constrainHeight === false) {
      binClassName = "df-elementBinNoScroll";
    }

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
      <div className="df-fieldWrap" key={"fw" + field.id}>
        {fieldTopper}
        {fieldInterior}
      </div>
    );
  }

  addStringArrayComponent(field: IField, formInterior: any[], descriptionElement: JSX.Element) {
    const val = this._getProperty(field.id, []);
    const fieldInterior = [];
    Log.assertDefined(val, "DFASAC");

    if (val) {
      const headerElement = <div key={"sarry" + field.id}>{FieldUtilities.getFieldTitle(field)}</div>;

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
      <div className="df-fieldWrap" key={"fw" + field.id}>
        {descriptionElement}
        {fieldInterior}
      </div>
    );
  }

  addObjectComponent(field: IField, formInterior: any[], descriptionElement: JSX.Element) {
    const val = this._getProperty(field.id, {});
    const fieldInterior = [];

    if (val && field.subForm) {
      let objKey = field.id;

      if (this.props.objectKey) {
        objKey += this.props.objectKey;
      }

      const propertyId = field.id;

      if (field.displayTitle !== false) {
        const headerElement = <div className="df-elementBinTitle">{FieldUtilities.getFieldTitle(field)}</div>;
        this.formComponentNames.push(field.id);
        this.formComponents.push(headerElement);
        fieldInterior.push(headerElement);
      }

      fieldInterior.push(descriptionElement);

      const subForm = (
        <DataForm
          directObject={val}
          objectKey={objKey}
          key={"dfp" + propertyId}
          formId={propertyId}
          parentField={field}
          theme={this.props.theme}
          defaultVisualExperience={FieldVisualExperience.normal}
          displayTitle={false}
          indentLevel={0}
          constrainHeight={this.props.constrainHeight}
          onPropertyChanged={this._handleObjectSubFormPropertyChange}
          definition={field.subForm}
          readOnly={this.props.readOnly}
        />
      );

      this.formComponentNames.push(propertyId);
      this.formComponents.push(subForm);

      fieldInterior.push(subForm);
    }

    formInterior.push(
      <div className="df-fieldWrap" key={"fw" + field.id}>
        {fieldInterior}
      </div>
    );
  }
}
