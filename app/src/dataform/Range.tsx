import { Component, SyntheticEvent } from "react";
import "./Range.css";
import IFormComponentProps from "./IFormComponentProps.js";
import { FormInput, InputProps } from "@fluentui/react-northstar";

export interface IRangeProps extends IFormComponentProps {
  data: number[] | undefined;
  objectKey: string | undefined;
  isInt: boolean;
  label?: string;
  onChange?: (
    event: SyntheticEvent<HTMLElement, Event> | React.KeyboardEvent<Element> | null,
    data: IRangeProps
  ) => void;
}

interface IRangeState {
  min: number;
  max: number;
  objectKey: string | undefined;
}

export default class Range extends Component<IRangeProps, IRangeState> {
  constructor(props: IRangeProps) {
    super(props);

    this._handleMinChange = this._handleMinChange.bind(this);
    this._handleMaxChange = this._handleMaxChange.bind(this);

    if (props.data) {
      this.state = {
        min: props.data[0],
        max: props.data[1],
        objectKey: props.objectKey,
      };
    } else {
      this.state = {
        min: 0,
        max: 0,
        objectKey: undefined,
      };
    }
  }

  static getDerivedStateFromProps(props: IRangeProps, state: IRangeState) {
    if (
      props.data &&
      props.data instanceof Array &&
      props.data.length === 2 &&
      state &&
      state.objectKey !== props.objectKey
    ) {
      return {
        min: props.data[0],
        max: props.data[1],
        objectKey: props.objectKey,
      };
    }

    if (state && state.min !== undefined && state.max !== undefined) {
      return null;
    }

    if (props.data && props.data instanceof Array && props.data.length === 2) {
      return {
        min: props.data[0],
        max: props.data[1],
        objectKey: props.objectKey,
      };
    }

    return null;
  }

  _handleMinChange(
    event: SyntheticEvent<HTMLElement, Event> | React.KeyboardEvent<Element> | null,
    data: (InputProps & { value: string }) | undefined
  ) {
    if (event === null || data === null || data === undefined || !this.state) {
      return;
    }

    let newMin = this.state.min;

    try {
      newMin = parseInt(data.value);
    } catch (e) {}

    this._updateProp(event, newMin, this.state.max);

    this.setState({
      min: newMin,
      max: this.state.max,
      objectKey: this.state.objectKey,
    });
  }

  _handleMaxChange(
    event: SyntheticEvent<HTMLElement, Event> | React.KeyboardEvent<Element> | null,
    data: (InputProps & { value: string }) | undefined
  ) {
    if (event === null || data === null || data === undefined || !this.state) {
      return;
    }

    let newMax = this.state.max;

    try {
      newMax = parseInt(data.value);
    } catch (e) {}

    this._updateProp(event, this.state.min, newMax);

    this.setState({
      min: this.state.min,
      max: newMax,
      objectKey: this.state.objectKey,
    });
  }

  _updateProp(
    event: SyntheticEvent<HTMLElement, Event> | React.KeyboardEvent<Element> | null,
    min: number,
    max: number
  ) {
    if (this.props.onChange) {
      const newProps = {
        data: [min, max],
        isInt: this.props.isInt,
        form: this.props.form,
        field: this.props.field,
        label: this.props.label,
        objectKey: this.props.objectKey,
      };

      this.props.onChange(event, newProps);
    }
  }

  render() {
    let curMin = 0;
    let curMax = 0;

    if (this.state) {
      curMin = this.state.min;
      curMax = this.state.max;
    } else if (this.props && this.props.data && this.props.data.length && this.props.data.length === 2) {
      curMin = this.props.data[0];
      curMax = this.props.data[1];
    }

    if (curMin === undefined || curMin === null) {
      curMin = 0;
    }

    if (curMax === undefined || curMax === null) {
      curMax = 100;
    }

    let header = <></>;

    if (this.props.label) {
      header = <div className="rng-label">{this.props.label}</div>;
    }

    return (
      <div className="rng-outer">
        {header}
        <div className="rng-data">
          <div className="rng-inner">
            <span className="rng-intro">Random number between </span>
            <div className="rng-cell">
              <FormInput
                id="min"
                className="rng-input"
                defaultValue={curMin.toString()}
                value={curMin.toString()}
                onChange={this._handleMinChange}
              />
            </div>
            <span className="rng-joiner">and</span>
            <div className="rng-cell">
              <FormInput
                id="max"
                className="rng-input"
                defaultValue={curMax.toString()}
                value={curMax.toString()}
                onChange={this._handleMaxChange}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }
}
