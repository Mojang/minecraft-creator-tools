/**
 * ========================================================================
 * ARCHITECTURE: DataForm.tsx
 * ========================================================================
 *
 * DataForm is the core form-based editor for Minecraft data structures.
 * It renders form fields based on IFormDefinition schemas and manages
 * property values across multiple backing stores.
 *
 * KEY CONCEPTS:
 *
 * 1. FORM DEFINITION:
 *    IFormDefinition describes the structure of the data being edited.
 *    It contains an array of IField definitions, each specifying:
 *    - id: The property name in the data object
 *    - dataType: FieldDataType enum (string, int, boolean, point3, etc.)
 *    - title: Human-readable label
 *    - defaultValue, choices, subForm, etc.
 *
 * 2. BACKING STORES:
 *    DataForm supports three ways to provide data:
 *    - dataPropertyObject: Uses getProperty()/ensureProperty() pattern
 *    - getsetPropertyObject: Uses getProperty()/setProperty() pattern
 *    - directObject: Plain JavaScript object (most common)
 *
 *    Property management is delegated to FormPropertyManager.
 *
 * 3. FIELD RENDERING:
 *    The render() method iterates through fields and renders appropriate
 *    controls based on FieldDataType. Each field type has its own
 *    rendering logic (textbox, checkbox, dropdown, subform, etc.)
 *
 * 4. SCALAR VS OBJECT:
 *    Some forms can represent data as either a scalar or object.
 *    E.g., damage could be "5" or { amount: 5, type: "fire" }.
 *    FormPropertyManager handles upscaling/downscaling between these.
 *
 * ========================================================================
 * UPSCALE/DOWNSCALE PATTERN
 * ========================================================================
 *
 * Minecraft JSON often supports multiple representations of the same data.
 * For example, `repair_items` in `minecraft:repairable` can be:
 *
 *   - Simple string: "minecraft:iron_ingot"
 *   - Array of strings: ["minecraft:iron_ingot", "minecraft:gold_ingot"]
 *   - Array of objects: [{ items: [...], repair_amount: 50 }]
 *
 * THE PATTERN: Upscale → Edit → Downscale
 *
 *   ┌────────────────┐     upscale()      ┌────────────────┐
 *   │  File/Stored   │  ───────────────▶  │  Edit Form     │
 *   │  (simplest)    │                    │  (canonical)   │
 *   └────────────────┘                    └────────────────┘
 *           ▲                                      │
 *           │            downscale()               │
 *           └──────────────────────────────────────┘
 *
 * UPSCALING (on read):
 *   Convert to the MOST COMPLEX/CANONICAL representation so the editor
 *   can always use the same UI regardless of how data was stored.
 *
 * DOWNSCALING (on persist):
 *   Convert back to the SIMPLEST representation that preserves all info.
 *   This keeps files clean and follows Minecraft conventions.
 *
 * TWO LAYERS OF IMPLEMENTATION:
 *
 * 1. DATA LAYER: FormPropertyManager (src/dataform/FormPropertyManager.ts)
 *    - upscaleDirectObject(): Converts scalar to object representation
 *    - downscaleDirectObject(): Converts object back to scalar if possible
 *    - setPropertyValue(): Automatically applies the pattern
 *    - Uses form definition's `scalarFieldUpgradeName` to determine
 *      which field name to use when upgrading a scalar to object
 *
 * 2. UI LAYER: DataFormUtilities.selectFieldForValue()
 *    Field definitions can have ALTERNATES - multiple representations
 *    with different data types. selectFieldForValue() examines the actual
 *    data and selects the field variant that best matches.
 *
 *    Example field definition with alternates:
 *      {
 *        id: "repair_items",
 *        dataType: FieldDataType.stringArray,  // Primary: simple array
 *        alternates: [
 *          {
 *            dataType: FieldDataType.objectArray,  // Alternate: objects
 *            subForm: repairItemsSubForm
 *          }
 *        ]
 *      }
 *
 *    Usage in render():
 *      const effectiveField = DataFormUtilities.selectFieldForValue(field, curVal);
 *      // effectiveField is now the variant that best represents curVal
 *
 *    Scoring rules:
 *    - Array values → prefer stringArray, numberArray, objectArray
 *    - Object values → prefer object types, especially with subForms (+15)
 *    - Scalar values → prefer matching primitive types
 *
 * WHEN TO APPLY:
 *   - Field can be scalar OR object: use `scalarFieldUpgradeName`
 *   - Field can be multiple types: use `alternates` in field definition
 *   - Editing should be uniform regardless of underlying format
 *
 * RELATED FILES:
 *   - src/dataform/FormPropertyManager.ts - Data-layer upscale/downscale
 *   - src/dataform/DataFormUtilities.ts - UI-layer field selection
 *   - src/dataform/IField.ts - Field definitions with alternates
 *   - src/test/FormPropertyManagerTest.ts - Unit tests for selectFieldForValue
 *
 * ========================================================================
 *
 * RELATED FILES:
 *    - src/dataform/FormPropertyManager.ts - Property get/set logic
 *    - src/dataform/IField.ts - Field definitions
 *    - src/dataform/IFormDefinition.ts - Form structure
 *    - src/dataform/DataFormUtilities.ts - Static utilities
 *
 * FUTURE REFACTORING:
 *    This file is being incrementally refactored to:
 *    - Extract field renderers into separate components
 *    - Use a registry pattern for field type → renderer mapping
 *    - Convert to functional component with hooks
 *
 * ========================================================================
 */

import { Component, SyntheticEvent } from "react";
import "./DataForm.css";
import IField, { FieldDataType, FieldExperienceType, FieldVisualExperience } from "./../dataform/IField";
import IFormDefinition, { FieldGroupLayout, IFieldGroup } from "./../dataform/IFormDefinition";
import IProperty from "./../dataform/IProperty";
import FormPropertyManager from "./../dataform/FormPropertyManager";
import { Button, IconButton, Stack, TextField, Checkbox, FormControlLabel } from "@mui/material";
import { getThemeColors } from "../UX/hooks/theme/useThemeColors";
import Log from "./../core/Log";
import { IPoint3Props } from "./Point3";
import { IVersionProps } from "./Version";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faXmark, faArrowUpRightFromSquare } from "@fortawesome/free-solid-svg-icons";
import { IScalarArrayProps } from "./ScalarArray";
import { IRangeProps } from "./Range";
import MinecraftFilterEditor, { IMinecraftFilterEditorProps } from "./MinecraftFilterEditor";
import SimplifiedBiomeFilterEditor from "./SimplifiedBiomeFilterEditor";
import ISimpleReference from "./../dataform/ISimpleReference";
import Utilities from "../core/Utilities";
import IDataContainer from "./../dataform/IDataContainer";
import FieldUtilities from "./../dataform/FieldUtilities";
import StorageUtilities from "../storage/StorageUtilities";
import CreatorTools from "../app/CreatorTools";
import Project from "../app/Project";
import EntityTypeDefinition from "../minecraft/EntityTypeDefinition";
import BlockTypeDefinition from "../minecraft/BlockTypeDefinition";
import ItemTypeDefinition from "../minecraft/ItemTypeDefinition";
import MinecraftEventTriggerEditor from "./MinecraftEventTriggerEditor";
import Database from "../minecraft/Database";
import DataFormUtilities from "./../dataform/DataFormUtilities";
import ILookupProvider from "./../dataform/ILookupProvider";
import { MinecraftEventTrigger } from "../minecraft/jsoncommon";
import VanillaProjectManager from "../minecraft/VanillaProjectManager";
import TextboxField from "./fields/TextboxField";
import CheckboxField from "./fields/CheckboxField";
import LongFormStringField from "./fields/LongFormStringField";
import SliderField from "./fields/SliderField";
import DropdownField, { getDropdownItems } from "./fields/DropdownField";
import Point3Field from "./fields/Point3Field";
import VersionField from "./fields/VersionField";
import RangeField from "./fields/RangeField";
import ScalarArrayField from "./fields/ScalarArrayField";
import { ICssClassConfig } from "./fields/IFieldRendererProps";
import Summarizer from "./Summarizer";
import ISummarizer from "../dataform/ISummarizer";
import IProjectTheme from "../UX/types/IProjectTheme";

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
  carto?: CreatorTools;
  project?: Project;
  select?: string;
  lookupProvider?: ILookupProvider;
  itemDefinition?: EntityTypeDefinition | BlockTypeDefinition | ItemTypeDefinition | undefined;
  formId?: string;
  /**
   * Category subfolder for the form definition (e.g., "entity", "block", "item").
   * Used to resolve relative paths like summarizerPath.
   */
  formCategory?: string;
  /**
   * Noun for summarizer prefix (e.g., "entity", "block", "item").
   * If provided, summarizer displays "This <noun> ..." prefix.
   */
  summarizerNoun?: string;
  theme: IProjectTheme;
  closeButton?: boolean;
  constrainHeight?: boolean;
  defaultVisualExperience?: FieldVisualExperience;
  displayDescription?: boolean;
  ambientSelectedPoint?: number[] | undefined;
  tagData?: any;
  readOnly: boolean;
  onClose?: (props: IDataFormProps) => void;
  onPropertyChanged?: (props: IDataFormProps, property: IProperty, newValue: any, updatingObject?: any) => void;
  onAddItem?: (lookupId: string) => Promise<string | undefined>;
  onValueAction?: (action: string, field: IField, value: string) => void;
}

interface IDataFormState {
  objectIncrement: number;
  updatedDirectObject?: any;
  subFormLoadState: string | undefined;
  keyAliases: { [name: string]: string };
  lookups: { [name: string]: ISimpleReference[] | undefined };
  summarizer?: ISummarizer;
}

export default class DataForm extends Component<IDataFormProps, IDataFormState> {
  private dropdownNames: string[] = [];
  private dropdownItems: { content: string }[][] = [];
  private checkboxNames: string[] = [];
  private checkboxItems: any[] = [];
  private formComponentNames: string[] = [];
  private formComponents: any[] = [];

  private _workingValues: { [name: string]: string } = {};

  private static _defaultFieldDescriptions: { [fieldId: string]: string } = {
    format_version:
      "The data format version. Determines which features and components are available. Use the latest version unless targeting older Minecraft versions.",
    min_engine_version:
      "The minimum Minecraft engine version required to load this content. Players on older versions won't be able to use this pack.",
    identifier: "A unique name for this item, in the format 'namespace:name' (e.g., 'mypack:custom_mob').",
    is_spawnable: "Whether this entity can be spawned using a spawn egg in creative mode.",
    is_summonable: "Whether this entity can be summoned using the /summon command.",
    is_experimental: "Whether this entity requires experimental gameplay to be enabled.",
  };

  static _getDefaultFieldDescription(fieldId: string): string | undefined {
    return DataForm._defaultFieldDescriptions[fieldId];
  }

  /**
   * FormPropertyManager handles all property get/set operations.
   * This abstracts the complexity of multiple backing stores and
   * scalar/object conversions.
   */
  private _propertyManager: FormPropertyManager;

  constructor(props: IDataFormProps) {
    super(props);

    this._addObjectArrayItem = this._addObjectArrayItem.bind(this);
    this._handleCheckboxChange = this._handleCheckboxChange.bind(this);
    this._handleDropdownChange = this._handleDropdownChange.bind(this);
    this._handleSimpleDropdownChange = this._handleSimpleDropdownChange.bind(this);
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
    this._addKeyedObjectItem = this._addKeyedObjectItem.bind(this);
    this._handleKeyedObjectCollectionSubFormClose = this._handleKeyedObjectCollectionSubFormClose.bind(this);
    this._handleKeyedBooleanTextChange = this._handleKeyedBooleanTextChange.bind(this);
    this._handleKeyedBooleanValueChange = this._handleKeyedBooleanValueChange.bind(this);
    this._handleKeyedBooleanValueClose = this._handleKeyedBooleanValueClose.bind(this);
    this._handleKeyedStringTextChange = this._handleKeyedStringTextChange.bind(this);
    this._handleKeyedStringValueChange = this._handleKeyedStringValueChange.bind(this);
    this._handleKeyedStringValueClose = this._handleKeyedStringValueClose.bind(this);
    this._load = this._load.bind(this);
    this._handleDropdownTextChange = this._handleDropdownTextChange.bind(this);

    // Initialize the property manager with the form definition and backing stores
    this._propertyManager = new FormPropertyManager(props.definition, {
      dataPropertyObject: props.dataPropertyObject,
      getsetPropertyObject: props.getsetPropertyObject,
    });

    this.state = {
      objectIncrement: 0,
      subFormLoadState: undefined,
      keyAliases: {},
      lookups: {},
      summarizer: undefined,
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
      // Update the property manager when definition changes
      this._propertyManager.definition = this.props.definition;
      this._load();
    }

    // Keep property manager backing stores in sync with props
    if (
      prevProps.dataPropertyObject !== this.props.dataPropertyObject ||
      prevProps.getsetPropertyObject !== this.props.getsetPropertyObject
    ) {
      this._propertyManager.updateBackingStores({
        dataPropertyObject: this.props.dataPropertyObject,
        getsetPropertyObject: this.props.getsetPropertyObject,
      });
    }
  }

  async _load() {
    const subFormLoadState = await DataFormUtilities.loadSubForms(this.props.definition);

    // Load summarizer from definition if available
    let summarizer: ISummarizer | undefined = this.props.definition?.summarizer;

    // If no inline summarizer, try to load from path
    if (!summarizer && this.props.definition?.summarizerId) {
      summarizer = await DataFormUtilities.loadSummarizerById(
        this.props.definition.summarizerId,
        this.props.formCategory
      );
    }

    this.setState({
      updatedDirectObject: undefined,
      objectIncrement: this.state.objectIncrement,
      keyAliases: this.state.keyAliases,
      subFormLoadState: subFormLoadState,
      lookups: this.state.lookups,
      summarizer: summarizer,
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
        summarizer: summarizer,
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

  /**
   * Gets the current direct object, preferring state over props.
   */
  _getCurrentDirectObject(): any {
    if (this.state.updatedDirectObject !== undefined) {
      return this.state.updatedDirectObject;
    }
    return this.props.directObject;
  }

  /**
   * Gets a property value.
   * Delegates to FormPropertyManager, passing the current direct object.
   */
  _getProperty(name: string, defaultValue?: any) {
    return this._propertyManager.getProperty(name, defaultValue, this._getCurrentDirectObject());
  }

  /**
   * Gets a property value as an integer.
   * Delegates to FormPropertyManager.
   */
  _getPropertyAsInt(name: string, defaultValue?: number) {
    return this._propertyManager.getPropertyAsInt(name, defaultValue, this._getCurrentDirectObject());
  }

  /**
   * Gets a property value as a boolean.
   * Delegates to FormPropertyManager.
   */
  _getPropertyAsBoolean(name: string, defaultValue?: boolean) {
    return this._propertyManager.getPropertyAsBoolean(name, defaultValue, this._getCurrentDirectObject());
  }

  /**
   * Gets a field definition by ID.
   * Delegates to FormPropertyManager.
   */
  _getFieldById(id: string) {
    return this._propertyManager.getFieldById(id);
  }

  /**
   * Processes an input update from a form control.
   * Delegates to FormPropertyManager and updates component state.
   */
  processInputUpdate(id: string | undefined, data: string | undefined) {
    if (!id || data === undefined) {
      return;
    }

    // Store working value for floating point input handling
    this._workingValues[id] = data;

    const result = this._propertyManager.processInputUpdate(id, data, this._getCurrentDirectObject());

    if (!result) {
      return;
    }

    if (this.props.onPropertyChanged !== undefined) {
      this.props.onPropertyChanged(this.props, result.property, result.newValue, result.updatedDirectObject);
    }

    this.setState({
      updatedDirectObject: result.updatedDirectObject,
      objectIncrement: this.state.objectIncrement + 1,
      subFormLoadState: this.state.subFormLoadState,
      keyAliases: this.state.keyAliases,
    });
  }

  /**
   * Checks if the object has values besides scalar and default values.
   * Delegates to FormPropertyManager.
   */
  _directObjectHasUniqueValuesBesidesScalar(directObject: { [propName: string]: any }) {
    return this._propertyManager.directObjectHasUniqueValuesBesidesScalar(directObject);
  }

  /**
   * Converts a scalar value to an object representation.
   * Delegates to FormPropertyManager.
   */
  _upscaleDirectObject(directObject: { [propName: string]: any } | string | number | boolean): { [name: string]: any } {
    return this._propertyManager.upscaleDirectObject(directObject);
  }

  /**
   * Converts an object back to a scalar if possible.
   * Delegates to FormPropertyManager.
   */
  _downscaleDirectObject(directObject: { [propName: string]: any }) {
    return this._propertyManager.downscaleDirectObject(directObject);
  }

  _handleSliderChange(event: Event, value: number | number[]) {
    const target = event?.target as HTMLInputElement | null;
    this.processInputUpdate(target?.id, String(value));
  }

  _handleTextboxChange(event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    this.processInputUpdate(event?.target?.id, event?.target?.value);
  }

  _handleDropdownTextChange(event: React.ChangeEvent<HTMLInputElement>) {
    if (event?.target?.id && event?.target?.value) {
      this.processInputUpdate(event.target.id, event.target.value);
    }
  }

  _handleTextAreaChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    this.processInputUpdate(event?.target?.id, event?.target?.value);
  }

  _handleKeyedBooleanTextChange(event: React.ChangeEvent<HTMLInputElement>) {
    if (!event?.target?.id) {
      return;
    }

    const keySplit = event.target.id.split(".");

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

      if (Utilities.isUsableAsObjectKey(event.target.value)) {
        arrayOfDataVal[event.target.value] = val;
        keyAliases[event.target.value] = this.state.keyAliases[keySplit[1]]
          ? this.state.keyAliases[keySplit[1]]
          : keySplit[1];
      }
    }
    this._setPropertyValue(keySplit[0], arrayOfDataVal);

    this.setState({
      objectIncrement: this.state.objectIncrement,
      subFormLoadState: this.state.subFormLoadState,
      keyAliases: keyAliases,
    });
  }

  _handleKeyedBooleanValueChange(event: React.ChangeEvent<HTMLInputElement>) {
    if (!event?.target?.id) {
      return;
    }

    const keySplit = event.target.id.split(".");

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
      arrayOfDataVal[keySplit[1]] = event.target.checked;
    }
    this._setPropertyValue(keySplit[0], arrayOfDataVal);
  }

  _handleKeyedBooleanValueClose(event: React.MouseEvent<HTMLButtonElement>) {
    const id = event.currentTarget?.id;
    if (!id) {
      return;
    }

    if (this.props.onClose) {
      this.props.onClose(this.props);
    }

    const keySplit = id.split(".");

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
      const index = parseInt(keySplit[1], 10);
      if (!isNaN(index) && index >= 0 && index < arrayOfDataVal.length) {
        arrayOfDataVal.splice(index, 1);
      } else {
        Log.debug("Array splice index out of bounds: " + keySplit[1]);
      }
    }

    this._setPropertyValue(keySplit[0], arrayOfDataVal);
  }

  _handleKeyedStringTextChange(event: React.ChangeEvent<HTMLInputElement>) {
    if (!event?.target?.id) {
      return;
    }

    const keySplit = event.target.id.split(".");

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

    if (Utilities.isUsableAsObjectKey(keySplit[1]) && Utilities.isUsableAsObjectKey(event.target.value)) {
      const index = parseInt(keySplit[1], 10);
      if (!isNaN(index) && index >= 0 && index < arrayOfDataVal.length) {
        arrayOfDataVal.splice(index, 1);
      } else {
        Log.debug("Array splice index out of bounds: " + keySplit[1]);
      }

      arrayOfDataVal[event.target.value] = val;

      keyAliases[event.target.value] = this.state.keyAliases[keySplit[1]]
        ? this.state.keyAliases[keySplit[1]]
        : keySplit[1];
    }

    this.setState({
      objectIncrement: this.state.objectIncrement,
      subFormLoadState: this.state.subFormLoadState,
      keyAliases: keyAliases,
    });

    this.forceUpdate();
  }

  _handleKeyedStringValueChange(event: React.ChangeEvent<HTMLInputElement>) {
    if (!event?.target?.id) {
      return;
    }

    const keySplit = event.target.id.split(".");

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
      arrayOfDataVal[keySplit[1]] = event.target.value;
    }

    this.forceUpdate();
  }

  _handleKeyedStringValueClose(event: React.MouseEvent<HTMLButtonElement>) {
    const id = event.currentTarget?.id;
    if (!id) {
      return;
    }

    if (this.props.onClose) {
      this.props.onClose(this.props);
    }

    const keySplit = id.split(".");

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

  /**
   * Converts a value to the appropriate type based on field data type.
   * Delegates to FormPropertyManager.
   */
  _getTypedData(field: IField, value: any) {
    return this._propertyManager.getTypedData(field, value);
  }

  /**
   * Handles checkbox toggle.
   * Uses FormPropertyManager.toggleBooleanProperty for the toggle logic.
   */
  _handleCheckboxChange(event: React.SyntheticEvent<HTMLElement> | null) {
    if (event === null) {
      return;
    }

    const id = event.currentTarget.id;
    // Get the field to determine the correct default value
    const field = this._getFieldById(id);
    const fieldDefaultValue = field?.defaultValue === true || field?.defaultValue === 1;
    const result = this._propertyManager.toggleBooleanProperty(id, fieldDefaultValue, this._getCurrentDirectObject());

    if (this.props.onPropertyChanged !== undefined) {
      this.props.onPropertyChanged(this.props, result.property, result.newValue, result.updatedDirectObject);
    }

    this.setState({
      updatedDirectObject: result.updatedDirectObject,
      objectIncrement: this.state.objectIncrement + 1,
      subFormLoadState: this.state.subFormLoadState,
      keyAliases: this.state.keyAliases,
    });
  }

  _handleDropdownChange(
    event: React.ChangeEvent<HTMLSelectElement> | null,
    data: { value: string | null | undefined }
  ) {
    if (data.value !== null && data.value !== undefined) {
      const val = data.value as string;

      if (val !== undefined) {
        const content = val;

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
            let matched = false;
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
                    matched = true;
                  }
                }
              }
            }

            if (!matched) {
              this._setPropertyValue(propDef.id, content);
            }
          } else {
            this._setPropertyValue(propDef.id, content);
          }
        }
      }

      this._incrementObjectState();
    }
  }

  /**
   * Simplified dropdown change handler for DropdownField component.
   * Receives field ID and selected value directly (no event object).
   */
  _handleSimpleDropdownChange(fieldId: string, value: string) {
    this._setPropertyValue(fieldId, value);
    this._incrementObjectState();
  }

  /**
   * Sets a property value.
   * Delegates to FormPropertyManager and updates component state.
   */
  _setPropertyValue(id: string, val: any) {
    const result = this._propertyManager.setPropertyValue(id, val, this._getCurrentDirectObject());

    if (this.props.onPropertyChanged !== undefined) {
      this.props.onPropertyChanged(this.props, result.property, result.newValue, result.updatedDirectObject);
    }

    if (result.updatedDirectObject !== undefined) {
      this.setState({
        updatedDirectObject: result.updatedDirectObject,
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

  _addKeyedObjectItem(event: React.SyntheticEvent<HTMLElement>, data?: any) {
    if (data && data.tag) {
      const field = this._getFieldById(data.tag);

      if (field) {
        const val = this._getProperty(field.id, {});

        let newName = "new_event";
        let iter = 0;

        while (val[newName] !== undefined) {
          iter++;
          newName = "new_event_" + String(iter);
        }

        val[newName] = {};

        this._setPropertyValue(field.id, val);
        this._incrementObjectState();
      }
    }
  }

  _handleKeyedObjectCollectionSubFormClose(props: IDataFormProps) {
    const formId = props.formId;

    if (formId === undefined) {
      Log.unexpectedState("DFKOCFC1");
      return;
    }

    const lastPeriod = formId.lastIndexOf(".");

    if (lastPeriod < 0) {
      Log.unexpectedState("DFKOCFC2");
      return;
    }

    const objectKey: string = formId.substring(lastPeriod + 1);
    const fieldId = formId.substring(0, lastPeriod);

    if (fieldId === undefined || objectKey === undefined) {
      Log.unexpectedUndefined("DFKOCFC3");
      return;
    }

    const val = this._getProperty(fieldId, {});

    if (val && Utilities.isUsableAsObjectKey(objectKey)) {
      delete val[objectKey];
      this._setPropertyValue(fieldId, val);
      this._incrementObjectState();
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
    } catch (e) {
      Log.debug("DataForm property index parse error: " + e);
    }

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

  _handleCloseClick(event: React.MouseEvent<HTMLButtonElement>) {
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

      // Build a map of groupId -> fields for field grouping
      const fieldGroupMap = new Map<string, IField[]>();
      const renderedGroups = new Set<string>();

      if (formDef.fieldGroups) {
        for (const field of allFields) {
          if (field.groupId) {
            const group = fieldGroupMap.get(field.groupId);
            if (group) {
              group.push(field);
            } else {
              fieldGroupMap.set(field.groupId, [field]);
            }
          }
        }
      }

      for (let propIndex = 0; propIndex < allFields.length; propIndex++) {
        const field = allFields[propIndex];

        // Handle grouped fields: render the entire group when we encounter the first field
        if (field.groupId && formDef.fieldGroups && !this.props.readOnly) {
          if (renderedGroups.has(field.groupId)) {
            // Already rendered this group, skip this field
            continue;
          }

          // Find the group definition
          const groupDef = formDef.fieldGroups.find((g) => g.id === field.groupId);
          const groupFields = fieldGroupMap.get(field.groupId);

          if (groupDef && groupFields && groupFields.length > 0) {
            // Mark group as rendered
            renderedGroups.add(field.groupId);

            // Render the entire group
            const groupElement = this.renderFieldGroup(groupDef, groupFields, formDef);
            if (groupElement) {
              formInterior.push(groupElement);
            }
            continue;
          }
        }

        if (
          (!field.visibility || FieldUtilities.evaluate(formDef, field.visibility, this.props)) &&
          !field.isDeprecated &&
          !field.isInternal
        ) {
          let curVal = this._getProperty(field.id, field.defaultValue);

          // Select the most appropriate field variant (primary or alternate) based on actual value type
          const effectiveField = DataFormUtilities.selectFieldForValue(field, curVal);

          const defaultVal = curVal ? curVal : effectiveField.defaultValue;

          let baseKey = this._getObjectId() + "." + field.id;

          let isValid = true;

          if (field.validity) {
            isValid = FieldUtilities.evaluate(formDef, field.validity, this.props, field);
          }

          let descriptionElements = [];
          let sampleElements = [];

          // Use field description, or fall back to well-known field defaults
          const fieldDescription = field.description || DataForm._getDefaultFieldDescription(field.id);

          if (fieldDescription) {
            let descrip = fieldDescription.replace(/\\\\/gi, "\\");
            descrip = descrip.replace(/\r/gi, "");

            const fieldDescripElts = fieldDescription.split("\n");

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

          if (field.defaultValue !== undefined && field.defaultValue !== null) {
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

                const sampleChips: React.ReactNode[] = [];

                for (const sample of sampeList) {
                  const content = sample.content;

                  if (Array.isArray(content)) {
                    for (let ci = 0; ci < content.length; ci++) {
                      const item = content[ci];
                      if (item !== undefined && typeof item !== "object") {
                        sampleChips.push(
                          <span
                            key={baseKey + name + path + "chip" + ci}
                            className={this.getCssClassName("sampleChip")}
                          >
                            {String(item)}
                          </span>
                        );
                      }
                    }
                  } else {
                    const sampVal = Utilities.humanify(content, field.humanifyValues);
                    sampleChips.push(
                      <span key={baseKey + name + path + "chip-single"} className={this.getCssClassName("sampleChip")}>
                        {String(sampVal)}
                      </span>
                    );
                  }
                }

                sampleRows.push(
                  <div className={this.getCssClassName("sampleRow")} key={baseKey + "descHeaderA" + name + path}>
                    <div className={this.getCssClassName("ro-value")}>{name}</div>
                    <div className={this.getCssClassName("ro-sampleValue")}>{sampleChips}</div>
                  </div>
                );
              }
            }

            sampleElements.push(
              <div key={baseKey + "sampleTable"} className={this.getCssClassName("sampleTable")}>
                {sampleRows}
              </div>
            );
          }

          const title = FieldUtilities.getFieldTitle(effectiveField);

          if (this.props.readOnly || effectiveField.readOnly) {
            if (effectiveField.defaultValue === undefined || effectiveField.defaultValue !== curVal) {
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
              (effectiveField.dataType === FieldDataType.stringEnum ||
                effectiveField.dataType === FieldDataType.intEnum ||
                effectiveField.dataType === FieldDataType.boolean) &&
              effectiveField.choices !== undefined
            ) {
              this.addDropdownComponent(
                effectiveField,
                formInterior,
                descriptionElements,
                sampleElements,
                curVal,
                propIndex
              );
            } else if (
              effectiveField.dataType === FieldDataType.point3 ||
              effectiveField.dataType === FieldDataType.intPoint3 ||
              effectiveField.dataType === FieldDataType.location ||
              effectiveField.dataType === FieldDataType.locationOffset
            ) {
              this.addPoint3Component(effectiveField, formInterior, descriptionElements, sampleElements);
            } else if (effectiveField.dataType === FieldDataType.version) {
              this.addVersionComponent(effectiveField, formInterior, descriptionElements, sampleElements);
            } else if (
              effectiveField.dataType === FieldDataType.stringArray ||
              effectiveField.dataType === FieldDataType.longFormStringArray ||
              effectiveField.dataType === FieldDataType.numberArray ||
              effectiveField.dataType === FieldDataType.checkboxListAsStringArray
            ) {
              this.addScalarArrayComponent(effectiveField, formInterior, descriptionElements, sampleElements, isValid);
            } else if (
              effectiveField.dataType === FieldDataType.intRange ||
              effectiveField.dataType === FieldDataType.floatRange
            ) {
              this.addRangeComponent(effectiveField, formInterior, descriptionElements, sampleElements);
            } else if (effectiveField.dataType === FieldDataType.minecraftFilter) {
              const val = this._getProperty(effectiveField.id, {});

              // Use simplified biome filter editor if uxVariant is "biome"
              const filterEditor =
                effectiveField.uxVariant === "biome" ? (
                  <SimplifiedBiomeFilterEditor
                    data={val}
                    key={"sbfe" + baseKey}
                    filterContextId={
                      (this.props.definition.id ? this.props.definition.id : "") + "." + effectiveField.id
                    }
                    onChange={this._handleMinecraftFilterPropertyChange}
                  />
                ) : (
                  <MinecraftFilterEditor
                    data={val}
                    key={"mifi" + baseKey}
                    filterContextId={
                      (this.props.definition.id ? this.props.definition.id : "") + "." + effectiveField.id
                    }
                    onChange={this._handleMinecraftFilterPropertyChange}
                  />
                );

              this.formComponentNames.push(effectiveField.id);
              this.formComponents.push(filterEditor);

              formInterior.push(
                <div
                  className={this.getCssClassName("fieldWrap")}
                  key={"fwm" + baseKey}
                  style={{
                    borderTopColor: getThemeColors().background3,
                    borderBottomColor: getThemeColors().background1,
                  }}
                >
                  <div className={this.getCssClassName("elementTitle")}>{title}</div>
                  {descriptionElements}
                  {filterEditor}
                  {sampleElements}
                </div>
              );
            } else if (
              effectiveField.dataType === FieldDataType.minecraftEventTrigger ||
              effectiveField.dataType === FieldDataType.minecraftEventReference
            ) {
              const val = this._getProperty(
                effectiveField.id,
                effectiveField.dataType === FieldDataType.minecraftEventTrigger ? {} : undefined
              );

              let objKey = effectiveField.id;

              if (this.props.objectKey) {
                objKey += this.props.objectKey;
              }

              if (this.props.carto && this.props.project) {
                const sarr = (
                  <MinecraftEventTriggerEditor
                    data={effectiveField.dataType === FieldDataType.minecraftEventTrigger ? val : { event: val }}
                    objectKey={objKey}
                    creatorTools={this.props.carto}
                    project={this.props.project}
                    readOnly={this.props.readOnly}
                    constrainHeight={false}
                    entityTypeDefinition={this.props.itemDefinition as EntityTypeDefinition}
                    theme={this.props.theme}
                    key={"miet" + baseKey}
                    heightOffset={300}
                    onChange={this._handleMinecraftEventTriggerPropertyChange}
                    form={this.props.definition}
                    field={effectiveField}
                  />
                );

                this.formComponentNames.push(effectiveField.id);
                this.formComponents.push(sarr);

                formInterior.push(
                  <div
                    className={this.getCssClassName("fieldWrap")}
                    key={"fwm" + baseKey}
                    style={{
                      borderTopColor: getThemeColors().background3,
                      borderBottomColor: getThemeColors().background1,
                    }}
                  >
                    <div className={this.getCssClassName("elementTitle")}>{title}</div>
                    {descriptionElements}
                    {sarr}
                    {sampleElements}
                  </div>
                );
              }
            } else if (effectiveField.dataType === FieldDataType.keyedObjectCollection) {
              this.addKeyedObjectComponent(effectiveField, formInterior, descriptionElements, sampleElements);
            } else if (effectiveField.dataType === FieldDataType.keyedStringArrayCollection) {
              this.addKeyedStringArrayCollectionComponent(
                effectiveField,
                formInterior,
                descriptionElements,
                sampleElements
              );
            } else if (effectiveField.dataType === FieldDataType.arrayOfKeyedStringCollection) {
              this.addArrayOfKeyedStringCollectionComponent(
                effectiveField,
                formInterior,
                descriptionElements,
                sampleElements
              );
            } else if (effectiveField.dataType === FieldDataType.keyedStringCollection) {
              this.addKeyedStringComponent(effectiveField, formInterior, descriptionElements, sampleElements);
            } else if (effectiveField.dataType === FieldDataType.keyedBooleanCollection) {
              this.addKeyedBooleanComponent(effectiveField, formInterior, descriptionElements, sampleElements);
            } else if (effectiveField.dataType === FieldDataType.objectArray) {
              this.addObjectArrayComponent(effectiveField, formInterior, descriptionElements, sampleElements);
            } else if (effectiveField.dataType === FieldDataType.object) {
              this.addObjectComponent(effectiveField, formInterior, descriptionElements, sampleElements);
            } else if (
              effectiveField.dataType === FieldDataType.intBoolean ||
              effectiveField.dataType === FieldDataType.boolean
            ) {
              this.addCheckboxComponent(effectiveField, formInterior, descriptionElements, sampleElements);
            } else if (effectiveField.dataType === FieldDataType.longFormString) {
              this.addLongFormStringComponent(
                effectiveField,
                formInterior,
                descriptionElements,
                sampleElements,
                curVal,
                defaultVal,
                isValid
              );
            } else if (
              (effectiveField.dataType === FieldDataType.int || effectiveField.dataType === FieldDataType.float) &&
              effectiveField.experienceType === FieldExperienceType.slider &&
              !this.props.readOnly &&
              (effectiveField.minValue !== undefined || effectiveField.suggestedMinValue !== undefined) &&
              (effectiveField.maxValue !== undefined || effectiveField.suggestedMaxValue !== undefined)
            ) {
              this.addSliderComponent(
                effectiveField,
                formInterior,
                descriptionElements,
                sampleElements,
                curVal,
                defaultVal
              );
            } else if (effectiveField.dataType === FieldDataType.minecraftEventTriggerArray) {
              this.addMinecraftEventTriggerArrayComponent(
                effectiveField,
                formInterior,
                descriptionElements,
                sampleElements
              );
            } else {
              this.addTextboxComponent(
                effectiveField,
                formInterior,
                descriptionElements,
                sampleElements,
                curVal,
                defaultVal
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
      header.push(
        <div className={this.getCssClassName("closeArea")} key="closeArea">
          <Stack direction="row" spacing={1} aria-label="Form accessory">
            <IconButton key="dfClose" onClick={this._handleCloseClick} title="Close" size="small">
              <FontAwesomeIcon key="closeClick" icon={faXmark} className="fa-lg" />
            </IconButton>
          </Stack>
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
            borderTopColor: getThemeColors().background1,
            borderBottomColor: getThemeColors().background3,
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
                  backgroundColor: getThemeColors().background2,
                  color: getThemeColors().foreground2,
                }
              : {}
          }
        >
          {headerOuter}
          {subheader}
          {this.state.summarizer && (
            <Summarizer
              summarizer={this.state.summarizer}
              data={this._getCurrentDirectObject()}
              dataVersion={this.state.objectIncrement}
              formDefinition={this.props.definition}
              noun={this.props.summarizerNoun || this.props.definition?.summarizerNoun}
              variant="card"
              theme={this.props.theme}
            />
          )}
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
    const baseKey = this._getObjectId() + "." + field.id;

    // Resolve choices from field or lookups
    let choices = field.choices;
    if (!choices && field.lookupId) {
      if (this.state && this.state.lookups) {
        choices = this.state.lookups[field.lookupId];
      }
    }

    // Prepare working value for float/number fields
    let workingValue: string | undefined;
    if (field.dataType === FieldDataType.float || field.dataType === FieldDataType.number) {
      if (this._workingValues[field.id]) {
        const val = this._getTypedData(field, this._workingValues[field.id]);
        if (val === curVal) {
          workingValue = this._workingValues[field.id];
        }
      }
    }

    const cssConfig: ICssClassConfig = { displayNarrow: !!this.props.displayNarrow };

    // Check if we can add items for this lookup
    const canAddItem =
      field.lookupId && this.props.lookupProvider && this.props.lookupProvider.canAddItem
        ? this.props.lookupProvider.canAddItem(field.lookupId)
        : false;

    formInterior.push(
      <TextboxField
        key={"tbf" + baseKey}
        field={field}
        value={curVal}
        defaultValue={defaultVal}
        baseKey={baseKey}
        theme={this.props.theme}
        readOnly={this.props.readOnly}
        cssConfig={cssConfig}
        choices={choices}
        workingValue={workingValue}
        descriptionElements={descriptionElements}
        sampleElements={sampleElements}
        showAddButton={canAddItem}
        onAddClick={
          canAddItem
            ? async (fieldId: string, lookupId: string) => {
                if (this.props.onAddItem) {
                  const newValue = await this.props.onAddItem(lookupId);
                  if (newValue) {
                    this._setPropertyValue(fieldId, newValue);
                  }
                }
              }
            : undefined
        }
        onChange={(newValue, f) => {
          this._setPropertyValue(f.id, newValue);
        }}
        onTextChange={(fieldId, newText) => {
          this.processInputUpdate(fieldId, newText);
        }}
        onDropdownChange={(fieldId, selectedId) => {
          this.processInputUpdate(fieldId, String(selectedId));
        }}
      />
    );
  }

  addCheckboxComponent(
    field: IField,
    formInterior: any[],
    descriptionElements: JSX.Element[],
    sampleElements: JSX.Element[]
  ) {
    const bool = this._getPropertyAsBoolean(field.id, field.defaultValue === true || field.defaultValue === 1);
    const baseKey = this._getObjectId() + "." + field.id;
    const cssConfig: ICssClassConfig = { displayNarrow: !!this.props.displayNarrow };

    // Track checkbox for legacy compatibility
    this.checkboxNames.push(field.id);

    const checkboxElement = (
      <CheckboxField
        key={"cbf" + baseKey}
        field={field}
        value={bool}
        defaultValue={field.defaultValue === true || field.defaultValue === 1}
        baseKey={baseKey}
        theme={this.props.theme}
        readOnly={this.props.readOnly}
        cssConfig={cssConfig}
        descriptionElements={descriptionElements}
        sampleElements={sampleElements}
        onChange={(newValue, f) => {
          this._setPropertyValue(f.id, newValue);
        }}
        onToggle={(fieldId) => {
          // Reuse the existing toggle handler logic via FormPropertyManager
          // Pass the field's default value so toggle works correctly when property is not set
          const fieldDefaultValue = field.defaultValue === true || field.defaultValue === 1;
          const result = this._propertyManager.toggleBooleanProperty(
            fieldId,
            fieldDefaultValue,
            this._getCurrentDirectObject()
          );

          if (this.props.onPropertyChanged !== undefined) {
            this.props.onPropertyChanged(this.props, result.property, result.newValue, result.updatedDirectObject);
          }

          this.setState({
            updatedDirectObject: result.updatedDirectObject,
            objectIncrement: this.state.objectIncrement + 1,
            subFormLoadState: this.state.subFormLoadState,
            keyAliases: this.state.keyAliases,
          });
        }}
      />
    );

    this.checkboxItems.push(checkboxElement);
    formInterior.push(checkboxElement);
  }

  addLongFormStringComponent(
    field: IField,
    formInterior: any[],
    descriptionElements: JSX.Element[],
    sampleElements: JSX.Element[],
    curVal: unknown,
    defaultVal: unknown,
    isValid: boolean
  ) {
    const baseKey = this._getObjectId() + "." + field.id;
    const cssConfig: ICssClassConfig = { displayNarrow: !!this.props.displayNarrow };

    const element = (
      <LongFormStringField
        key={"lfsr" + baseKey}
        field={field}
        value={curVal as string}
        defaultValue={defaultVal as string}
        baseKey={baseKey}
        theme={this.props.theme}
        readOnly={this.props.readOnly}
        cssConfig={cssConfig}
        descriptionElements={descriptionElements}
        sampleElements={sampleElements}
        isValid={isValid}
        onChange={(newValue, f) => {
          this._setPropertyValue(f.id, newValue);
        }}
        onTextAreaChange={(fieldId, newText) => {
          this.processInputUpdate(fieldId, newText);
        }}
      />
    );

    formInterior.push(element);
  }

  addSliderComponent(
    field: IField,
    formInterior: any[],
    descriptionElements: JSX.Element[],
    sampleElements: JSX.Element[],
    curVal: unknown,
    defaultVal: unknown
  ) {
    const baseKey = this._getObjectId() + "." + field.id;
    const cssConfig: ICssClassConfig = { displayNarrow: !!this.props.displayNarrow };

    // Resolve dynamic max/min from sibling field values
    let dynamicMax: number | undefined;
    let dynamicMin: number | undefined;

    if (field.maxValueField) {
      const refVal = this._getProperty(field.maxValueField);
      if (refVal !== undefined && refVal !== null) {
        dynamicMax = typeof refVal === "string" ? parseFloat(refVal) : Number(refVal);
        if (isNaN(dynamicMax)) dynamicMax = undefined;
      }
    }

    if (field.minValueField) {
      const refVal = this._getProperty(field.minValueField);
      if (refVal !== undefined && refVal !== null) {
        dynamicMin = typeof refVal === "string" ? parseFloat(refVal) : Number(refVal);
        if (isNaN(dynamicMin)) dynamicMin = undefined;
      }
    }

    const element = (
      <SliderField
        key={"sff" + baseKey}
        field={field}
        value={curVal as string}
        defaultValue={defaultVal as string}
        baseKey={baseKey}
        theme={this.props.theme}
        readOnly={this.props.readOnly}
        cssConfig={cssConfig}
        descriptionElements={descriptionElements}
        sampleElements={sampleElements}
        dynamicMax={dynamicMax}
        dynamicMin={dynamicMin}
        onChange={(newValue, f) => {
          this._setPropertyValue(f.id, newValue);
        }}
        onSliderChange={(fieldId, newValue) => {
          this.processInputUpdate(fieldId, newValue);
        }}
        onSliderTextChange={(fieldId, newValue) => {
          this.processInputUpdate(fieldId, newValue);
        }}
      />
    );

    formInterior.push(element);
  }

  /**
   * Renders a group of fields in a compact layout.
   * Fields in the group are rendered horizontally with wrapping (flow layout).
   */
  renderFieldGroup(group: IFieldGroup, fields: IField[], formDef: IFormDefinition): JSX.Element {
    const groupKey = "fg-" + group.id;
    const layoutClass =
      group.layout === FieldGroupLayout.grid
        ? "df-fieldGroupGrid"
        : group.layout === FieldGroupLayout.compact
          ? "df-fieldGroupCompact"
          : "df-fieldGroupFlow";

    const fieldElements: JSX.Element[] = [];

    for (const field of fields) {
      const fieldKey = groupKey + "-" + field.id;
      const curVal = this._getProperty(field.id, field.defaultValue);
      const title = FieldUtilities.getFieldTitle(field);

      // For numeric types, render a compact input
      if (
        field.dataType === FieldDataType.int ||
        field.dataType === FieldDataType.float ||
        field.dataType === FieldDataType.number ||
        field.dataType === FieldDataType.long
      ) {
        fieldElements.push(
          <div className="df-groupedField" key={fieldKey}>
            <div className="df-groupedFieldInput">
              <input
                type="number"
                value={curVal !== undefined ? curVal : ""}
                placeholder={group.hideFieldTitles ? title : undefined}
                title={field.description}
                onChange={(e) => {
                  const strVal = e.target.value;
                  // Pass empty string as undefined, otherwise pass the string value
                  // (processInputUpdate handles the conversion)
                  this.processInputUpdate(field.id, strVal === "" ? undefined : strVal);
                }}
              />
            </div>
            {!group.hideFieldTitles && (
              <label className="df-groupedFieldLabel" title={field.description}>
                {title}
              </label>
            )}
          </div>
        );
      } else if (field.dataType === FieldDataType.string) {
        // String field in compact mode
        fieldElements.push(
          <div className="df-groupedField" key={fieldKey}>
            <div className="df-groupedFieldInput">
              <input
                type="text"
                value={curVal !== undefined ? String(curVal) : ""}
                placeholder={group.hideFieldTitles ? title : undefined}
                title={field.description}
                onChange={(e) => {
                  this.processInputUpdate(field.id, e.target.value);
                }}
              />
            </div>
            {!group.hideFieldTitles && (
              <label className="df-groupedFieldLabel" title={field.description}>
                {title}
              </label>
            )}
          </div>
        );
      } else {
        // Fallback: render value as text
        fieldElements.push(
          <div className="df-groupedField" key={fieldKey}>
            <div className="df-groupedFieldValue">{curVal !== undefined ? String(curVal) : "-"}</div>
            {!group.hideFieldTitles && (
              <label className="df-groupedFieldLabel" title={field.description}>
                {title}
              </label>
            )}
          </div>
        );
      }
    }

    return (
      <div
        className="df-fieldGroup"
        key={groupKey}
        style={{
          borderTopColor: getThemeColors().background3,
          borderBottomColor: getThemeColors().background1,
        }}
      >
        {group.title && <div className="df-fieldGroupTitle">{group.title}</div>}
        {group.description && <div className="df-fieldGroupDescription">{group.description}</div>}
        <div className={layoutClass}>{fieldElements}</div>
      </div>
    );
  }

  addDropdownComponent(
    field: IField,
    formInterior: any[],
    descriptionElements: JSX.Element[],
    sampleElements: JSX.Element[],
    curVal: unknown,
    propIndex: number
  ) {
    const baseKey = this._getObjectId() + "." + field.id;
    const cssConfig: ICssClassConfig = { displayNarrow: !!this.props.displayNarrow };

    // Get lookup set (choices or from lookupSets)
    let lookupSet: ISimpleReference[] | undefined;
    if (field.choices) {
      lookupSet = field.choices;
    } else if (field.lookupId && this.props.lookupSets) {
      lookupSet = this.props.lookupSets[field.lookupId];
    }

    if (!lookupSet) {
      return;
    }

    // Track dropdown for the _handleDropdownChange method
    this.dropdownNames.push(field.id);
    this.dropdownItems.push(getDropdownItems(lookupSet, curVal));

    const element = (
      <DropdownField
        key={"ddf" + baseKey}
        field={field}
        value={curVal as string | number | boolean | undefined}
        defaultValue={field.defaultValue as string | number | boolean | undefined}
        baseKey={baseKey}
        theme={this.props.theme}
        readOnly={this.props.readOnly}
        cssConfig={cssConfig}
        descriptionElements={descriptionElements}
        sampleElements={sampleElements}
        choices={lookupSet}
        propIndex={propIndex}
        onChange={(newValue, f) => {
          this._setPropertyValue(f.id, newValue);
        }}
        onDropdownChange={this._handleSimpleDropdownChange}
      />
    );

    formInterior.push(element);
  }

  addPoint3Component(
    field: IField,
    formInterior: any[],
    descriptionElements: JSX.Element[],
    sampleElements: JSX.Element[]
  ) {
    const val = this._getProperty(field.id, [0, 0, 0]);
    const baseKey = this._getObjectId() + "." + field.id;
    const cssConfig: ICssClassConfig = { displayNarrow: !!this.props.displayNarrow };

    let objKey = field.id;
    if (this.props.objectKey) {
      objKey += this.props.objectKey;
    }

    const element = (
      <Point3Field
        key={"p3f" + baseKey}
        field={field}
        value={val}
        defaultValue={[0, 0, 0]}
        baseKey={baseKey}
        theme={this.props.theme}
        readOnly={this.props.readOnly}
        cssConfig={cssConfig}
        descriptionElements={descriptionElements}
        sampleElements={sampleElements}
        form={this.props.definition}
        objectKey={objKey}
        ambientPoint={this.props.ambientSelectedPoint}
        onChange={(newValue, f) => {
          this._setPropertyValue(f.id, newValue);
        }}
        onPoint3Change={this._handlePoint3PropertyChange}
      />
    );

    this.formComponentNames.push(field.id);
    this.formComponents.push(element);
    formInterior.push(element);
  }

  addVersionComponent(
    field: IField,
    formInterior: any[],
    descriptionElements: JSX.Element[],
    sampleElements: JSX.Element[]
  ) {
    const val = this._getProperty(field.id, [0, 0, 1]);
    const baseKey = this._getObjectId() + "." + field.id;
    const cssConfig: ICssClassConfig = { displayNarrow: !!this.props.displayNarrow };

    let objKey = field.id;
    if (this.props.objectKey) {
      objKey += this.props.objectKey;
    }

    const element = (
      <VersionField
        key={"vf" + baseKey}
        field={field}
        value={val}
        defaultValue={[0, 0, 1]}
        baseKey={baseKey}
        theme={this.props.theme}
        readOnly={this.props.readOnly}
        cssConfig={cssConfig}
        descriptionElements={descriptionElements}
        sampleElements={sampleElements}
        form={this.props.definition}
        objectKey={objKey}
        onChange={(newValue, f) => {
          this._setPropertyValue(f.id, newValue);
        }}
        onVersionChange={this._handleVersionPropertyChange}
      />
    );

    this.formComponentNames.push(field.id);
    this.formComponents.push(element);
    formInterior.push(element);
  }

  addRangeComponent(
    field: IField,
    formInterior: any[],
    descriptionElements: JSX.Element[],
    sampleElements: JSX.Element[]
  ) {
    const val = this._getProperty(field.id, [0, 100]);
    const baseKey = this._getObjectId() + "." + field.id;
    const cssConfig: ICssClassConfig = { displayNarrow: !!this.props.displayNarrow };

    let objKey = field.id;
    if (this.props.objectKey) {
      objKey += this.props.objectKey;
    }

    const element = (
      <RangeField
        key={"rf" + baseKey}
        field={field}
        value={val}
        defaultValue={[0, 100]}
        baseKey={baseKey}
        theme={this.props.theme}
        readOnly={this.props.readOnly}
        cssConfig={cssConfig}
        descriptionElements={descriptionElements}
        sampleElements={sampleElements}
        form={this.props.definition}
        objectKey={objKey}
        isInt={field.dataType === FieldDataType.intRange}
        onChange={(newValue, f) => {
          this._setPropertyValue(f.id, newValue);
        }}
        onRangeChange={this._handleRangePropertyChange}
      />
    );

    this.formComponentNames.push(field.id);
    this.formComponents.push(element);
    formInterior.push(element);
  }

  addScalarArrayComponent(
    field: IField,
    formInterior: any[],
    descriptionElements: JSX.Element[],
    sampleElements: JSX.Element[],
    isValid: boolean
  ) {
    const val = this._getProperty(field.id, []);
    const baseKey = this._getObjectId() + "." + field.id;
    const cssConfig: ICssClassConfig = { displayNarrow: !!this.props.displayNarrow };

    let objKey = field.id;
    if (this.props.objectKey) {
      objKey += this.props.objectKey;
    }

    const element = (
      <ScalarArrayField
        key={"saf" + baseKey}
        field={field}
        value={val}
        defaultValue={[]}
        baseKey={baseKey}
        theme={this.props.theme}
        readOnly={this.props.readOnly}
        cssConfig={cssConfig}
        descriptionElements={descriptionElements}
        sampleElements={sampleElements}
        form={this.props.definition}
        objectKey={objKey}
        lookups={this.state.lookups}
        isValid={isValid}
        onChange={(newValue, f) => {
          this._setPropertyValue(f.id, newValue);
        }}
        onScalarArrayChange={this._handleStringArrayPropertyChange}
        canAddItem={this.props.lookupProvider?.canAddItem}
        onAddItem={this.props.onAddItem}
      />
    );

    this.formComponentNames.push(field.id);
    this.formComponents.push(element);
    formInterior.push(element);
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
    const fieldTopper = [];
    const childElements = [];
    Log.assert(val !== undefined, "Keyed object is not available in DataForm.");

    const hasDynamicKeys = !field.subFields;

    let fieldList = field.subFields;

    if (!fieldList) {
      fieldList = {};

      for (const key in val) {
        fieldList[key] = {
          id: key,
          title: key,
          dataType: FieldDataType.string,
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
        fieldTopper.push(headerElement);
      }

      if (hasDynamicKeys && !this.props.readOnly) {
        const showAddButton = field.allowCreateDelete !== false;

        const toolBarElement = (
          <div key={baseKey + "tb"}>
            <Stack direction="row" spacing={1} aria-label="Keyed objects actions">
              {showAddButton && (
                <IconButton
                  size="small"
                  title="Add item"
                  onClick={(e) => this._addKeyedObjectItem(e, { tag: field.id })}
                >
                  <FontAwesomeIcon icon={faPlus} className="fa-lg" />
                </IconButton>
              )}
            </Stack>
          </div>
        );
        this.formComponentNames.push(field.id + "toolbar");
        this.formComponents.push(toolBarElement);
        fieldTopper.push(toolBarElement);
      }

      const sortedKeys = Object.keys(fieldList).sort();

      for (const key of sortedKeys) {
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
            formId={field.id + "." + key}
            theme={this.props.theme}
            title={title}
            project={this.props.project}
            lookupProvider={this.props.lookupProvider}
            onAddItem={this.props.onAddItem}
            carto={this.props.carto}
            itemDefinition={this.props.itemDefinition}
            defaultVisualExperience={field.visualExperience}
            displayTitle={true}
            indentLevel={indentLevel}
            constrainHeight={this.props.constrainHeight}
            onClose={hasDynamicKeys ? this._handleKeyedObjectCollectionSubFormClose : this._handleIndexedArraySubFormClose}
            closeButton={hasDynamicKeys && !this.props.readOnly && field.allowCreateDelete !== false}
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
            backgroundColor: getThemeColors().background1,
            borderColor: getThemeColors().background4,
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
          borderTopColor: getThemeColors().background3,
          borderBottomColor: getThemeColors().background1,
        }}
      >
        {fieldTopper}
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
            <TextField
              className="df-keyedSarrText"
              key={objKey + "TKS"}
              id={objKey}
              fullWidth
              size="small"
              variant="outlined"
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
          backgroundColor: getThemeColors().background1,
          borderColor: getThemeColors().background4,
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
          borderTopColor: getThemeColors().background3,
          borderBottomColor: getThemeColors().background1,
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
              <TextField
                className="df-keyedSarrText"
                key={objKey + "TKSA" + index}
                id={objKey}
                fullWidth
                size="small"
                variant="outlined"
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
          backgroundColor: getThemeColors().background1,
          borderColor: getThemeColors().background4,
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
          borderTopColor: getThemeColors().background3,
          borderBottomColor: getThemeColors().background1,
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
        const showAddButton = field.allowCreateDelete !== false;

        const toolBarElement = (
          <div key={baseKey + "tb"}>
            <Stack direction="row" spacing={1} aria-label="Keyed strings actions">
              {showAddButton && (
                <IconButton
                  size="small"
                  title="Add item"
                  onClick={(e) => this._addKeyedStringItem(e, { tag: field.id })}
                >
                  <FontAwesomeIcon icon={faPlus} className="fa-lg" />
                </IconButton>
              )}
            </Stack>
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
              <TextField
                key={objKey + ".title.text"}
                id={field.id + "." + key + ".text"}
                value={key as string}
                defaultValue={key as string}
                size="small"
                variant="outlined"
                onChange={this._handleKeyedStringTextChange}
              />
            );
          }

          let propertyId = field.id;

          propertyId += "." + key;

          const inputControl = (
            <TextField
              key={baseKey + ".input"}
              id={field.id + "." + key + ".input"}
              value={strVal}
              size="small"
              variant="outlined"
              onChange={this._handleKeyedStringValueChange}
            />
          );

          this.formComponentNames.push(propertyId);
          this.formComponents.push(inputControl);

          const closeRow = (
            <IconButton
              key={field.id + propertyId + objKey + ".close"}
              id={field.id + "." + key + ".close"}
              onClick={this._handleKeyedStringValueClose}
              title="Close"
              size="small"
            >
              <FontAwesomeIcon key="closeClick" icon={faXmark} className="fa-lg" />
            </IconButton>
          );

          let actionButton: JSX.Element | undefined;

          if (field.valueAction && this.props.onValueAction) {
            const actionField = field;
            const actionValue = strVal;

            actionButton = (
              <div className="df-keyedStringCollectionAction" key={objKey + ".action"}>
                <IconButton
                  size="small"
                  title="Open in editor"
                  onClick={() => {
                    if (this.props.onValueAction && actionValue) {
                      this.props.onValueAction(actionField.valueAction!, actionField, actionValue);
                    }
                  }}
                >
                  <FontAwesomeIcon icon={faArrowUpRightFromSquare} className="fa-lg" />
                </IconButton>
              </div>
            );
          }

          childElements.push(
            <div className="df-keyedStringCollection" key={objKey}>
              <div className="df-keyedStringCollectionTitle">{title}</div>
              <div className="df-keyedStringCollectionData">{inputControl}</div>
              {actionButton}
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
          backgroundColor: getThemeColors().background1,
          borderColor: getThemeColors().background4,
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
          borderTopColor: getThemeColors().background3,
          borderBottomColor: getThemeColors().background1,
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
      const showAddButton = field.allowCreateDelete !== false;

      const toolBarElement = (
        <div>
          <Stack direction="row" spacing={1} aria-label="Keyed true/false actions">
            {showAddButton && (
              <IconButton
                size="small"
                title="Add item"
                onClick={(e) => this._addKeyedBooleanItem(e, { tag: field.id })}
              >
                <FontAwesomeIcon icon={faPlus} className="fa-lg" />
              </IconButton>
            )}
          </Stack>
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
            <TextField
              key={objKey + ".title.text"}
              id={field.id + "." + key + ".text"}
              value={key as string}
              defaultValue={key as string}
              size="small"
              variant="outlined"
              onChange={this._handleKeyedBooleanTextChange}
            />
          );
        }

        let propertyId = field.id;

        propertyId += "." + key;

        const checkboxControl = (
          <FormControlLabel
            key={objKey + ".check"}
            label="On/off"
            control={
              <Checkbox
                id={field.id + "." + key + ".check"}
                checked={boolVal}
                onChange={this._handleKeyedBooleanValueChange}
                size="small"
              />
            }
          />
        );

        this.formComponentNames.push(propertyId);
        this.formComponents.push(checkboxControl);

        const closeRow = (
          <IconButton
            key={objKey + ".close"}
            id={field.id + "." + key + ".close"}
            onClick={this._handleKeyedBooleanValueClose}
            title="Close"
            size="small"
          >
            <FontAwesomeIcon key="closeClick" icon={faXmark} className="fa-lg" />
          </IconButton>
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
          backgroundColor: getThemeColors().background1,
          borderColor: getThemeColors().background4,
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
          borderTopColor: getThemeColors().background3,
          borderBottomColor: getThemeColors().background1,
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
        const headerElement = (
          <div key={baseKey + "header"} className="df-elementBinTitle">
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
        const showAddButton = field.allowCreateDelete !== false;

        const toolBarElement = (
          <div>
            <Stack direction="row" spacing={1} aria-label="List of items actions">
              {showAddButton && (
                <Button
                  size="small"
                  title="Add item"
                  onClick={(e) => this._addObjectArrayItem(e, { tag: field.id })}
                  startIcon={<FontAwesomeIcon icon={faPlus} className="fa-lg" />}
                >
                  {field.noun ? "Add " + field.noun.toLowerCase() : "Add"}
                </Button>
              )}
            </Stack>
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
              onAddItem={this.props.onAddItem}
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
          } catch (e) {
            Log.debug("DataForm visual index parse error: " + e);
          }

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
          } else if (fieldSubForm && fieldSubForm.title) {
            title = fieldSubForm.title + " " + title;
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
              onAddItem={this.props.onAddItem}
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
          backgroundColor: getThemeColors().background1,
          borderColor: getThemeColors().background4,
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
          borderTopColor: getThemeColors().background3,
          borderBottomColor: getThemeColors().background1,
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

    const baseKey = this._getObjectId() + "." + field.id;

    Log.assert(arrayOfDataVal, "DFAOAC");

    const fieldSubForm = this.getFieldSubForm(field);

    if (arrayOfDataVal !== undefined && fieldSubForm && arrayOfDataVal instanceof Array) {
      if (field.displayTitle !== false) {
        const headerElement = (
          <div key={baseKey + "header"} className="df-elementBinTitle">
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
        const showAddButton = field.allowCreateDelete !== false;

        const toolBarElement = (
          <div>
            <Stack direction="row" spacing={1} aria-label="Minecraft event trigger list actions">
              {showAddButton && (
                <Button
                  size="small"
                  title="Add item"
                  onClick={(e) => this._addObjectArrayItem(e, { tag: field.id })}
                  startIcon={<FontAwesomeIcon icon={faPlus} className="fa-lg" />}
                >
                  {field.noun ? "Add " + field.noun.toLowerCase() : "Add"}
                </Button>
              )}
            </Stack>
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
        } catch (e) {
          Log.debug("DataForm visual index parse error: " + e);
        }

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
        } else if (fieldSubForm && fieldSubForm.title) {
          title = fieldSubForm.title + " " + title;
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
              creatorTools={this.props.carto}
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
          backgroundColor: getThemeColors().background1,
          borderColor: getThemeColors().background4,
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
          borderTopColor: getThemeColors().background3,
          borderBottomColor: getThemeColors().background1,
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
          borderTopColor: getThemeColors().background3,
          borderBottomColor: getThemeColors().background1,
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
          onAddItem={this.props.onAddItem}
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
          borderTopColor: getThemeColors().background3,
          borderBottomColor: getThemeColors().background1,
        }}
      >
        {fieldInterior}
      </div>
    );
  }
}
