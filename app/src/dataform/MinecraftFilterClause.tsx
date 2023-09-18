import { Component, SyntheticEvent } from "react";
import "./MinecraftFilterClause.css";
import IFormComponentProps from "./IFormComponentProps.js";
import { FormInput, InputProps } from "@fluentui/react-northstar";
import { IFilterClause } from "../minecraft/IFilterClause";

export interface IMinecraftFilterClauseProps extends IFormComponentProps {
  data: IFilterClause;
  objectKey: string | undefined;
  displayCloseButton: boolean;

  onChange?: (
    event: SyntheticEvent<HTMLElement, Event> | React.KeyboardEvent<Element> | null,
    data: IMinecraftFilterClauseProps
  ) => void;
}

interface IMinecraftFilterClauseState {
  test: string;
  subject: string;
  value: string;
  objectKey: string | undefined;
}

export default class MinecraftFilterClause extends Component<IMinecraftFilterClauseProps, IMinecraftFilterClauseState> {
  constructor(props: IMinecraftFilterClauseProps) {
    super(props);

    this._handleTestChange = this._handleTestChange.bind(this);

    if (props.data) {
      this.state = {
        test: props.data.test,
        subject: props.data.subject,
        value: props.data.value,
        objectKey: props.objectKey,
      };
    } else {
      this.state = {
        test: "",
        subject: "",
        value: "",
        objectKey: "",
      };
    }
  }

  _handleTestChange(
    event: SyntheticEvent<HTMLElement, Event> | React.KeyboardEvent<Element> | null,
    data: (InputProps & { value: string }) | undefined
  ) {
    if (event === null || data === null || data === undefined || !this.state) {
      return;
    }

    const newMin = data.value;

    this._updateProp(event, newMin, this.state.subject, this.state.value);

    this.setState({
      test: newMin,
      subject: this.state.subject,
      value: this.state.value,
      objectKey: this.state.objectKey,
    });
  }

  _updateProp(
    event: SyntheticEvent<HTMLElement, Event> | React.KeyboardEvent<Element> | null,
    test: string,
    subject: string,
    value: string
  ) {
    if (this.props.onChange) {
      const newProps = {
        data: {
          test: test,
          subject: subject,
          value: value,
        },
        form: this.props.form,
        field: this.props.field,
        displayCloseButton: this.props.displayCloseButton,
        objectKey: this.props.objectKey,
      };

      this.props.onChange(event, newProps);
    }
  }

  render() {
    let curTest = "";

    if (this.state) {
      curTest = this.state.test;
    } else if (this.props && this.props.data) {
      curTest = this.props.data.test;
    }

    return (
      <div className="mificl-outer">
        <div className="mificl-inner">
          <div className="mificl-cell">
            <FormInput
              id="test"
              className="mificl-input"
              defaultValue={curTest}
              value={curTest}
              onChange={this._handleTestChange}
            />
          </div>
        </div>
      </div>
    );
  }
}
