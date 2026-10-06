import { Component, ChangeEvent } from "react";
import "./ScalarArray.css";
import IFormComponentProps from "./../dataform/IFormComponentProps.js";
import { TextField, Button, Autocomplete, Box, Alert, InputAdornment } from "@mui/material";
import { faPlus } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import ILookupProvider from "./../dataform/ILookupProvider";
import ISimpleReference from "./../dataform/ISimpleReference";
import Utilities from "../core/Utilities";

/**
 * ScalarArray — list editor for array-of-scalar fields (string, number and
 * primitive arrays), with an autocomplete variant when the field has choices.
 *
 * Values are only ever edited as a list. If the stored value is not an array
 * (a form declares a field as an array while the JSON holds, say, a keyed
 * object), the control shows what it found and offers no editing at all:
 * turning such a value into an empty list and letting the user add to it
 * would replace the original data on the first keystroke. That check follows
 * the value, not the mount: a field that starts out empty and later receives
 * a keyed object under the same key locks down the moment the object arrives,
 * and every edit is checked against what the field holds right then before
 * anything is written back.
 *
 * With `preserveScalarTypes` (FieldDataType.primitiveArray) every element
 * keeps the JSON type it has, whatever the new text spells: an existing 5
 * edited to 2 stays a number, and the text "7" edited to "8" stays text. The
 * game reads text, number and boolean values differently (a text value picks
 * an enum property), so changing the type would change what the value does.
 * Text that does not spell a value of the element's type ("abc" for a number)
 * is shown as typed but not committed. A new element takes the type chosen
 * next to the add button (text unless changed), so "7" or "true" can be
 * authored as text on purpose. The text being typed is kept separately from
 * the typed value so "1." can be completed to "1.5".
 *
 * A number or boolean row is a complete value (0 / false) the moment it is
 * added, so adding one reports the new list right away; a blank text row is
 * reported once something is typed into it. Until then it lives only in
 * this control, which is why a fresh empty list from a parent whose field
 * is still empty is not taken as a new value (see componentDidUpdate).
 */

/** A JSON scalar an array element can hold. */
export type ScalarArrayValue = string | number | boolean;

/** The JSON type of an element. */
export type ScalarArrayValueType = "string" | "number" | "boolean";

const NUMBER_TEXT = /^-?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/;

/** What a freshly added element of each type starts out as. */
const BLANK_VALUES: { [type in ScalarArrayValueType]: ScalarArrayValue } = { string: "", number: 0, boolean: false };

const TYPE_LABELS: { [type in ScalarArrayValueType]: string } = {
  string: "text",
  number: "number",
  boolean: "boolean",
};

interface IScalarArrayItem {
  key?: string;
  header: string;
  image?: string;
}

export interface IScalarArrayProps extends IFormComponentProps {
  data: ScalarArrayValue[] | undefined;
  objectKey: string | undefined;
  label: string | undefined;
  lookupProvider?: ILookupProvider;
  displayAsList?: boolean;
  lookups: { [name: string]: ISimpleReference[] | undefined } | undefined;
  allowCreateDelete?: boolean | undefined;
  isNumber: boolean;
  longForm: boolean;
  /** Keep each element's JSON type (number / boolean / string) instead of storing text. */
  preserveScalarTypes?: boolean;
  onChange?: (data: IScalarArrayProps) => void;
  canAddItem?: (lookupId: string) => boolean;
  onAddItem?: (lookupId: string) => Promise<string | undefined>;
}

interface IScalarArrayState {
  data: ScalarArrayValue[];
  /** Text being typed per index, shown until it is committed as a typed value. */
  drafts: { [index: number]: string };
  searchQuery?: string;
  objectKey: string | undefined;
  /** The non-array value the field holds; editing is disabled while set. */
  mismatchedValue?: unknown;
  /** The type the next added element gets, when types are preserved. */
  newValueType: ScalarArrayValueType;
}

/** The JSON type of an element; anything that is not a number or boolean counts as text. */
export function scalarArrayValueType(value: unknown): ScalarArrayValueType {
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  return "string";
}

/**
 * Typed text as a value of the given type, or undefined when it does not
 * spell one (for a number: "abc", or a bare "-" on the way to "-1").
 */
export function scalarArrayValueOfType(text: string, type: ScalarArrayValueType): ScalarArrayValue | undefined {
  if (type === "number") {
    const trimmed = text.trim();
    if (NUMBER_TEXT.test(trimmed)) {
      const num = Number(trimmed);
      if (Number.isFinite(num)) return num;
    }
    return undefined;
  }

  if (type === "boolean") {
    const trimmed = text.trim().toLowerCase();
    if (trimmed === "true") return true;
    if (trimmed === "false") return false;
    return undefined;
  }

  return text;
}

/** Interpret typed text as the JSON scalar it spells: booleans, finite numbers, otherwise text. */
export function parseScalarArrayValue(text: string): ScalarArrayValue {
  const asBoolean = scalarArrayValueOfType(text, "boolean");
  if (asBoolean !== undefined) return asBoolean;

  const asNumber = scalarArrayValueOfType(text, "number");
  if (asNumber !== undefined) return asNumber;

  return text;
}

type IncomingState = Pick<IScalarArrayState, "data" | "drafts" | "objectKey" | "mismatchedValue">;

export default class ScalarArray extends Component<IScalarArrayProps, IScalarArrayState> {
  constructor(props: IScalarArrayProps) {
    super(props);

    this._handleValChange = this._handleValChange.bind(this);
    this._handleDrodownValChange = this._handleDrodownValChange.bind(this);
    this._handleDrodownSearchQueryChange = this._handleDrodownSearchQueryChange.bind(this);
    this._handleTextAreaChange = this._handleTextAreaChange.bind(this);
    this._handleAddItemButton = this._handleAddItemButton.bind(this);
    this._handleAddLookupItemButton = this._handleAddLookupItemButton.bind(this);
    this._handleNewValueTypeChange = this._handleNewValueTypeChange.bind(this);

    this.state = {
      ...ScalarArray._stateFor(props.data, props.objectKey),
      newValueType: "string",
    };
  }

  /** The list state a field value calls for: the list itself, or a locked-down control showing what was found. */
  private static _stateFor(data: unknown, objectKey: string | undefined): IncomingState {
    if (Array.isArray(data)) {
      return { data: data, drafts: {}, objectKey: objectKey, mismatchedValue: undefined };
    }

    return {
      data: [],
      drafts: {},
      objectKey: objectKey,
      mismatchedValue: data === undefined || data === null ? undefined : data,
    };
  }

  /**
   * Follow the value the field holds when it changes under a mounted control.
   * A list this control itself just reported (or one spelling the same
   * values) keeps the rows and any half-typed drafts; anything else replaces
   * them, and a non-list value locks the control down even if rows were
   * being added while the field was still empty.
   */
  componentDidUpdate(prevProps: IScalarArrayProps) {
    if (prevProps.data === this.props.data && prevProps.objectKey === this.props.objectKey) {
      return;
    }

    const incoming = this.props.data;

    if (Array.isArray(incoming)) {
      // An absent field is handed a fresh empty list on every render of the
      // parent form. That is the field still being empty, not a new value,
      // so rows added here that have not been reported yet stay put.
      const stillEmpty = incoming.length === 0 && ScalarArray._isEmptyValue(prevProps.data);

      this.setState((prevState) => {
        const sameList =
          prevProps.objectKey === this.props.objectKey &&
          (stillEmpty || incoming === prevState.data || JSON.stringify(incoming) === JSON.stringify(prevState.data));
        if (prevState.mismatchedValue === undefined && sameList) {
          return null;
        }
        return ScalarArray._stateFor(incoming, this.props.objectKey);
      });
      return;
    }

    if (incoming === undefined || incoming === null) {
      // Rows added to an empty field that were never reported are the
      // user's work in progress and stay; a list that was there and is now
      // gone, or a lock-down that no longer applies, does not.
      const hadValue = prevProps.data !== undefined && prevProps.data !== null;
      this.setState((prevState) => {
        if (prevState.mismatchedValue !== undefined || hadValue) {
          return ScalarArray._stateFor(incoming, this.props.objectKey);
        }
        return null;
      });
      return;
    }

    this.setState((prevState) => {
      if (prevState.mismatchedValue === incoming) {
        return null;
      }
      return ScalarArray._stateFor(incoming, this.props.objectKey);
    });
  }

  /** Nothing, or a list with nothing in it. */
  private static _isEmptyValue(value: unknown): boolean {
    return value === undefined || value === null || (Array.isArray(value) && value.length === 0);
  }

  /**
   * Whether what the field holds right now can be edited as a list. Checked
   * on every edit, not just at mount, so a keyed object that arrived after
   * the control was created is never written over with a list.
   */
  private _canEditList(): boolean {
    const held = this.props.data;

    return this.state.mismatchedValue === undefined && (held === undefined || held === null || Array.isArray(held));
  }

  _handleTextAreaChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const className = event.target.className;

    if (className) {
      const index = className.indexOf("tatmpdata-");
      if (index >= 0) {
        let end = className.indexOf(" ", index);
        if (end < index) {
          end = className.length;
        }

        this.processInputUpdate(className.substring(index + 10, end), event.target.value);
      }
    }
  }

  _handleDrodownValChange(event: React.SyntheticEvent, value: IScalarArrayItem[]) {
    if (value && Array.isArray(value) && this._canEditList()) {
      const strResults: string[] = [];

      for (const di of value) {
        const val = di.key ? di.key : Utilities.dehumanify(di.header, this.props.field.humanifyValues);
        strResults.push(String(val));
      }

      this._notifyChange(strResults);

      this.setState({
        data: strResults,
        drafts: {},
      });
    }
  }

  _handleDrodownSearchQueryChange(event: React.SyntheticEvent, value: string) {
    if (value) {
      this.setState({
        searchQuery: value,
      });
    }
  }

  _handleValChange(event: ChangeEvent<HTMLInputElement>) {
    this.processInputUpdate(event.target.id, event.target.value);
  }

  _handleNewValueTypeChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const type = event.target.value;

    if (type === "string" || type === "number" || type === "boolean") {
      this.setState({ newValueType: type });
    }
  }

  _notifyChange(data: ScalarArrayValue[]) {
    if (this.props.onChange) {
      this.props.onChange({
        data: data,
        form: this.props.form,
        field: this.props.field,
        isNumber: this.props.isNumber,
        label: this.props.label,
        longForm: this.props.longForm,
        lookups: this.props.lookups,
        allowCreateDelete: this.props.allowCreateDelete,
        objectKey: this.props.objectKey,
        preserveScalarTypes: this.props.preserveScalarTypes,
      });
    }
  }

  processInputUpdate(id: string | undefined, text: string | undefined) {
    if (text === null || text === undefined || !this.state || !this._canEditList() || !id) {
      return;
    }

    const index = parseInt(id, 10);

    if (isNaN(index) || index < 0) {
      return;
    }

    const drafts = { ...this.state.drafts, [index]: text };

    // The element keeps the type it has; only text that spells a value of
    // that type is committed, the rest is shown while it is being typed.
    const value: ScalarArrayValue | undefined = this.props.preserveScalarTypes
      ? scalarArrayValueOfType(text, scalarArrayValueType(this.state.data[index]))
      : text;

    if (value === undefined) {
      this.setState({ drafts: drafts });
      return;
    }

    const dataArr = [...this.state.data];
    dataArr[index] = value;

    this._notifyChange(dataArr);

    this.setState({
      data: dataArr,
      drafts: drafts,
    });
  }

  /**
   * Add a row of the chosen type. A number or boolean row shows a value the
   * user will expect to find saved (0 / false), so the new list is reported
   * at once; a blank text row is reported when something is typed into it.
   */
  _handleAddItemButton() {
    if (!this._canEditList()) {
      return;
    }

    const value: ScalarArrayValue = this.props.preserveScalarTypes ? BLANK_VALUES[this.state.newValueType] : "";
    const dataArr = [...this.state.data, value];

    if (typeof value !== "string") {
      this._notifyChange(dataArr);
    }

    this.setState({ data: dataArr });
  }

  async _handleAddLookupItemButton() {
    if (!this.props.field.lookupId || !this.props.onAddItem || !this._canEditList()) {
      return;
    }

    const newItemId = await this.props.onAddItem(this.props.field.lookupId);
    if (newItemId && this._canEditList()) {
      this.setState((prevState) => {
        const dataArr = [...prevState.data, newItemId];

        this._notifyChange(dataArr);

        return {
          data: dataArr,
        };
      });
    }
  }

  _displayText(index: number): string {
    const draft = this.state.drafts[index];

    if (draft !== undefined) {
      return draft;
    }

    const value = this.state.data[index];

    return value === undefined || value === null ? "" : String(value);
  }

  render() {
    if (this.state.mismatchedValue !== undefined) {
      const stored = this.state.mismatchedValue;
      const kind = Array.isArray(stored) ? "an array" : typeof stored === "object" ? "an object" : "a " + typeof stored;

      return (
        <div className="sarr-outer">
          <Alert severity="warning" className="sarr-mismatch">
            This value is stored as {kind}, not as a list, so it can't be edited here. Edit the JSON directly to change
            it; the stored value has been left as is.
          </Alert>
        </div>
      );
    }

    const inputAreas: any[] = [];

    let choices = this.props.field.choices;

    if (!choices && this.props.field.lookupId && this.props.lookups) {
      choices = this.props.lookups[this.props.field.lookupId];
    }

    if (choices && !this.props.displayAsList) {
      const items: IScalarArrayItem[] = [];

      const vals: IScalarArrayItem[] = [];

      let hasImages = false;

      for (let i = 0; i < choices.length; i++) {
        if (choices[i].iconImage) {
          hasImages = true;
          break;
        }
      }

      for (let i = 0; i < this.state.data.length; i++) {
        const val = String(this.state.data[i]);
        let foundChoiceMatch = false;

        for (let j = 0; j < choices.length; j++) {
          const data = choices[j].id;

          if (data === val) {
            foundChoiceMatch = true;

            vals.push({
              key: val,
              header: Utilities.humanify(val, this.props.field.humanifyValues),
              image: choices[j].iconImage,
            });
            break;
          }
        }

        if (!foundChoiceMatch) {
          items.push({ header: val });
          vals.push({
            key: val,
            header: Utilities.humanify(val, this.props.field.humanifyValues),
            image: hasImages ? "/res/images/onepx.png" : undefined,
          });
        }
      }

      let searchQueryMatchesExisting = false;

      for (let i = 0; i < choices.length; i++) {
        const data = choices[i].id;

        if (data && typeof data === "string") {
          items.push({
            header: Utilities.humanify(data, this.props.field.humanifyValues),
            key: data,
            image: choices[i].iconImage,
          });
        }

        if (this.state.searchQuery && this.state.searchQuery === data) {
          searchQueryMatchesExisting = true;
        }
      }

      if (
        !searchQueryMatchesExisting &&
        this.state.searchQuery &&
        this.state.searchQuery.length >= (this.props.field.minLength ? this.props.field.minLength : 4)
      ) {
        items.push({ key: this.state.searchQuery, header: this.state.searchQuery });
      }

      inputAreas.push(
        <div key="sarr-dropdown-wrap">
          <Autocomplete
            multiple
            freeSolo
            id="inptDrop"
            value={vals}
            options={items}
            getOptionLabel={(option) => (typeof option === "string" ? option : option.header)}
            isOptionEqualToValue={(option, value) => option.key === value.key || option.header === value.header}
            onChange={(event, newValue) => this._handleDrodownValChange(event, newValue as IScalarArrayItem[])}
            onInputChange={this._handleDrodownSearchQueryChange}
            renderOption={(props, option) => (
              <Box component="li" {...props} key={option.key || option.header}>
                {option.image && <img src={option.image} alt="" style={{ width: 20, height: 20, marginRight: 8 }} />}
                {option.header}
              </Box>
            )}
            renderInput={(params) => <TextField {...params} size="small" variant="outlined" />}
            fullWidth
          />
        </div>
      );
    } else {
      for (let i = 0; i < this.state.data.length; i++) {
        const val = this._displayText(i);

        if (this.props.longForm) {
          const ta = (
            <div className="sarr-input" key={"si" + i}>
              <TextField
                fullWidth
                multiline
                minRows={2}
                key={"inpt" + i.toString()}
                className={"sarr-textArea tatmpdata-" + i.toString()}
                value={val}
                onChange={this._handleTextAreaChange}
              />
            </div>
          );

          inputAreas.push(ta);
        } else {
          // With preserved types the element's type is part of its meaning,
          // so each row says which one it is.
          const typeAdornment = this.props.preserveScalarTypes
            ? {
                endAdornment: (
                  <InputAdornment position="end">
                    <span className="sarr-type">{TYPE_LABELS[scalarArrayValueType(this.state.data[i])]}</span>
                  </InputAdornment>
                ),
              }
            : undefined;

          inputAreas.push(
            <div className="sarr-input" key={"sj" + i}>
              <TextField
                id={i.toString()}
                key={"inpt" + i.toString()}
                className="sarr-input"
                size="small"
                variant="outlined"
                value={val}
                onChange={this._handleValChange}
                InputProps={typeAdornment}
              />
            </div>
          );
        }
      }
    }

    if (inputAreas.length === 0) {
      inputAreas.push(
        <div className="sarr-none" key={"sjn"}>
          (No items.)
        </div>
      );
    }

    let addArea = <></>;

    // Show add button for free-form text input (no lookup choices)
    if (this.props.allowCreateDelete !== false && !choices) {
      addArea = (
        <div className="sarr-add" key={"sjn-add"}>
          {this.props.preserveScalarTypes && (
            <TextField
              select
              SelectProps={{ native: true }}
              size="small"
              variant="outlined"
              className="sarr-newType"
              value={this.state.newValueType}
              onChange={this._handleNewValueTypeChange}
              inputProps={{ "aria-label": "Type of the next value" }}
            >
              <option value="string">Text</option>
              <option value="number">Number</option>
              <option value="boolean">Boolean</option>
            </TextField>
          )}
          <Button onClick={this._handleAddItemButton} key="addString" size="small" variant="text">
            <FontAwesomeIcon icon={faPlus} className="fa-lg" />
          </Button>
        </div>
      );
    }

    // Show add button for lookup fields that support adding new items
    if (
      choices &&
      this.props.field.lookupId &&
      this.props.canAddItem &&
      this.props.canAddItem(this.props.field.lookupId) &&
      this.props.onAddItem
    ) {
      addArea = (
        <div className="sarr-add" key={"sjn-add-lookup"}>
          <Button
            onClick={this._handleAddLookupItemButton}
            key="addLookupItem"
            title="Add new feature"
            size="small"
            variant="text"
          >
            <FontAwesomeIcon icon={faPlus} className="fa-lg" />
          </Button>
        </div>
      );
    }

    return (
      <div className="sarr-outer">
        {addArea}
        <div className="sarr-inner">{inputAreas}</div>
      </div>
    );
  }
}
