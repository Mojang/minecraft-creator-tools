import { Component, SyntheticEvent } from "react";
import "./StringArray.css";
import IFormComponentProps from "./IFormComponentProps.js";
import { FormInput, InputProps, Button, TextArea, TextAreaProps } from "@fluentui/react-northstar";
import { faPlus } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

export interface IStringArrayProps extends IFormComponentProps {
  data: string[] | undefined;
  objectKey: string | undefined;
  label: string | undefined;
  longForm: boolean;
  onChange?: (
    event: SyntheticEvent<HTMLElement, Event> | React.KeyboardEvent<Element> | null,
    data: IStringArrayProps
  ) => void;
}

interface IStringArrayState {
  data: string[];
  objectKey: string | undefined;
}

export default class StringArray extends Component<IStringArrayProps, IStringArrayState> {
  constructor(props: IStringArrayProps) {
    super(props);

    this._handleValChange = this._handleValChange.bind(this);
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

  static getDerivedStateFromProps(props: IStringArrayProps, state: IStringArrayState) {
    if (props.data && props.data instanceof Array) {
      return {
        data: props.data,
        objectKey: props.objectKey,
      };
    }

    return null;
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

        this.processInputUpdate(event, className.substring(index + 10, end), data?.value);
      }
    }
  }

  _handleValChange(
    event: SyntheticEvent<HTMLElement, Event> | React.KeyboardEvent<Element> | null,
    data: (InputProps & { value: string }) | undefined
  ) {
    this.processInputUpdate(event, data?.id, data?.value);
  }

  processInputUpdate(
    event: SyntheticEvent<HTMLElement, Event> | React.KeyboardEvent<Element> | null,
    id: string | undefined,
    data: string | undefined
  ) {
    if (event === null || data === null || data === undefined || !this.state || !id) {
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
        label: this.props.label,
        longForm: this.props.longForm,
        objectKey: this.props.objectKey,
      };

      this.props.onChange(event, newProps);
    }

    this.setState({
      data: this.state.data,
      objectKey: this.state.objectKey,
    });
  }

  _handleAddItemButton() {
    this.state.data.push("");
    this.forceUpdate();
  }

  render() {
    const inputAreas: any[] = [];

    for (let i = 0; i < this.state.data.length; i++) {
      const val = this.state.data[i];

      if (this.props.longForm) {
        const ta = (
          <div className="sarr-input">
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
          <div className="sarr-input">
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

    if (inputAreas.length === 0) {
      inputAreas.push(<div className="sarr-none">(No items.)</div>);
    }

    return (
      <div className="sarr-outer">
        <div className="sarr-add">
          <Button
            content={<FontAwesomeIcon icon={faPlus} className="fa-lg" />}
            onClick={this._handleAddItemButton}
            key="addString"
          />
        </div>
        <div className="sarr-inner">{inputAreas}</div>
      </div>
    );
  }
}
