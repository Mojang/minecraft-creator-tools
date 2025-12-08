import { Component, SyntheticEvent } from "react";
import "./ScalarArray.css";
import IFormComponentProps from "./../dataform/IFormComponentProps.js";
import {
  FormInput,
  InputProps,
  Button,
  TextArea,
  TextAreaProps,
  DropdownItemProps,
  DropdownProps,
  Dropdown,
} from "@fluentui/react-northstar";
import { faPlus } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import ILookupProvider from "./../dataform/ILookupProvider";
import ISimpleReference from "./../dataform/ISimpleReference";
import Utilities from "../core/Utilities";

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

  _handleTextAreaChange(
    event: SyntheticEvent<HTMLElement, Event> | React.KeyboardEvent<Element> | null,
    data: TextAreaProps | undefined
  ) {
    const className = data?.className;

    if (className) {
      const index = className.indexOf("tatmpdata-");
      if (index >= 0) {
        let end = className.indexOf(" ", index);
        if (end < index) {
          end = className.length;
        }

        this.processInputUpdate(className.substring(index + 10, end), data?.value);
      }
    }
  }

  _handleDrodownValChange(event: React.MouseEvent<Element> | React.KeyboardEvent<Element> | null, data: DropdownProps) {
    if (data.value && Array.isArray(data.value)) {
      const strResults = [];

      for (const di of (data as any).value) {
        strResults.push(di.key ? di.key : Utilities.dehumanify(di.header, this.props.field.humanifyValues));
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

  _handleDrodownSearchQueryChange(
    event: React.MouseEvent<Element> | React.KeyboardEvent<Element> | null,
    data: DropdownProps
  ) {
    if (data.searchQuery) {
      this.setState({
        data: this.state.data,
        objectKey: this.state.objectKey,
        searchQuery: data.searchQuery,
      });
    }
  }

  _handleValChange(
    event: SyntheticEvent<Element, Event> | React.MouseEvent<Element> | React.KeyboardEvent<Element> | null,
    data: (InputProps & { value: string }) | undefined
  ) {
    this.processInputUpdate(data?.id, data?.value);
  }

  processInputUpdate(id: string | undefined, data: string | undefined) {
    if (data === null || data === undefined || !this.state || !id) {
      return;
    }

    let index = -1;

    try {
      index = parseInt(id);
    } catch (e) {
      return;
    }

    if (index < 0) {
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

  render() {
    const inputAreas: any[] = [];

    let choices = this.props.field.choices;

    if (!choices && this.props.field.lookupId && this.props.lookups) {
      choices = this.props.lookups[this.props.field.lookupId];
    }

    if (choices && !this.props.displayAsList) {
      const items: (DropdownItemProps & { key?: string })[] = [];

      const vals: (DropdownItemProps & { key?: string })[] = [];

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
        <div>
          <Dropdown
            search={true}
            multiple={true}
            id={"inptDrop"}
            key={"inptDrop"}
            value={vals}
            items={items}
            fluid={true}
            onChange={this._handleDrodownValChange}
            onSearchQueryChange={this._handleDrodownSearchQueryChange}
          />
        </div>
      );
    } else {
      for (let i = 0; i < this.state.data.length; i++) {
        const val = this.state.data[i].toString();

        if (this.props.longForm) {
          const ta = (
            <div className="sarr-input" key={"si" + i}>
              <TextArea
                fluid={true}
                key={"inpt" + i.toString()}
                className={"sarr-textArea tatmpdata-" + i.toString()}
                value={val as string}
                defaultValue={val as string}
                spellCheck={true}
                onChange={this._handleTextAreaChange}
              />
            </div>
          );

          inputAreas.push(ta);
        } else {
          inputAreas.push(
            <div className="sarr-input" key={"sj" + i}>
              <FormInput
                id={i.toString()}
                key={"inpt" + i.toString()}
                className="sarr-input"
                defaultValue={val}
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

    if (this.props.allowCreateDelete !== false && !choices) {
      addArea = (
        <div className="sarr-add" key={"sjn-add"}>
          <Button
            content={<FontAwesomeIcon icon={faPlus} className="fa-lg" />}
            onClick={this._handleAddItemButton}
            key="addString"
          />
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
