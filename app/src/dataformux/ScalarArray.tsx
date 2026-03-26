import { Component, ChangeEvent } from "react";
import "./ScalarArray.css";
import IFormComponentProps from "./../dataform/IFormComponentProps.js";
import { TextField, Button, Autocomplete, Box } from "@mui/material";
import { faPlus } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import ILookupProvider from "./../dataform/ILookupProvider";
import ISimpleReference from "./../dataform/ISimpleReference";
import Utilities from "../core/Utilities";

interface IScalarArrayItem {
  key?: string;
  header: string;
  image?: string;
}

export interface IScalarArrayProps extends IFormComponentProps {
  data: string[] | undefined;
  objectKey: string | undefined;
  label: string | undefined;
  lookupProvider?: ILookupProvider;
  displayAsList?: boolean;
  lookups: { [name: string]: ISimpleReference[] | undefined } | undefined;
  allowCreateDelete?: boolean | undefined;
  isNumber: boolean;
  longForm: boolean;
  onChange?: (data: IScalarArrayProps) => void;
  canAddItem?: (lookupId: string) => boolean;
  onAddItem?: (lookupId: string) => Promise<string | undefined>;
}

interface IScalarArrayState {
  data: string[];
  searchQuery?: string;
  objectKey: string | undefined;
}

export default class ScalarArray extends Component<IScalarArrayProps, IScalarArrayState> {
  constructor(props: IScalarArrayProps) {
    super(props);

    this._handleValChange = this._handleValChange.bind(this);
    this._handleDrodownValChange = this._handleDrodownValChange.bind(this);
    this._handleDrodownSearchQueryChange = this._handleDrodownSearchQueryChange.bind(this);
    this._handleTextAreaChange = this._handleTextAreaChange.bind(this);
    this._handleAddItemButton = this._handleAddItemButton.bind(this);
    this._handleAddLookupItemButton = this._handleAddLookupItemButton.bind(this);

    if (props.data) {
      this.state = {
        data: props.data,
        objectKey: props.objectKey,
      };
    } else {
      this.state = {
        data: [],
        objectKey: undefined,
      };
    }
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
    if (value && Array.isArray(value)) {
      const strResults: string[] = [];

      for (const di of value) {
        const val = di.key ? di.key : Utilities.dehumanify(di.header, this.props.field.humanifyValues);
        strResults.push(String(val));
      }

      if (this.props.onChange) {
        const newProps = {
          data: strResults,
          form: this.props.form,
          field: this.props.field,
          isNumber: this.props.isNumber,
          label: this.props.label,
          longForm: this.props.longForm,
          lookups: this.props.lookups,
          allowCreateDelete: this.props.allowCreateDelete,
          objectKey: this.props.objectKey,
        };

        this.props.onChange(newProps);
      }

      this.setState({
        data: strResults,
        objectKey: this.state.objectKey,
        searchQuery: this.state.searchQuery,
      });
    }
  }

  _handleDrodownSearchQueryChange(event: React.SyntheticEvent, value: string) {
    if (value) {
      this.setState({
        data: this.state.data,
        objectKey: this.state.objectKey,
        searchQuery: value,
      });
    }
  }

  _handleValChange(event: ChangeEvent<HTMLInputElement>) {
    this.processInputUpdate(event.target.id, event.target.value);
  }

  processInputUpdate(id: string | undefined, data: string | undefined) {
    if (data === null || data === undefined || !this.state || !id) {
      return;
    }

    let index = -1;

    try {
      index = parseInt(id, 10);
    } catch (e) {
      return;
    }

    if (isNaN(index) || index < 0) {
      return;
    }

    const dataArr = this.state.data;

    dataArr[index] = data;

    if (this.props.onChange) {
      const newProps = {
        data: dataArr,
        form: this.props.form,
        field: this.props.field,
        isNumber: this.props.isNumber,
        label: this.props.label,
        longForm: this.props.longForm,
        lookups: this.props.lookups,
        allowCreateDelete: this.props.allowCreateDelete,
        objectKey: this.props.objectKey,
      };

      this.props.onChange(newProps);
    }

    this.setState({
      data: this.state.data,
      objectKey: this.state.objectKey,
      searchQuery: this.state.searchQuery,
    });
  }

  _handleAddItemButton() {
    this.state.data.push("");
    this.forceUpdate();
  }

  async _handleAddLookupItemButton() {
    if (!this.props.field.lookupId || !this.props.onAddItem) {
      return;
    }

    const newItemId = await this.props.onAddItem(this.props.field.lookupId);
    if (newItemId) {
      // Add the new item to the array
      this.state.data.push(newItemId);

      if (this.props.onChange) {
        this.props.onChange({
          data: this.state.data,
          objectKey: this.props.objectKey,
          lookups: this.props.lookups,
          form: this.props.form,
          field: this.props.field,
          isNumber: this.props.isNumber,
          longForm: this.props.longForm,
          label: this.props.label,
        });
      }

      this.forceUpdate();
    }
  }

  render() {
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
        const val = this.state.data[i].toString();
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
        const val = this.state.data[i].toString();

        if (this.props.longForm) {
          const ta = (
            <div className="sarr-input" key={"si" + i}>
              <TextField
                fullWidth
                multiline
                minRows={2}
                key={"inpt" + i.toString()}
                className={"sarr-textArea tatmpdata-" + i.toString()}
                value={val as string}
                onChange={this._handleTextAreaChange}
              />
            </div>
          );

          inputAreas.push(ta);
        } else {
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
