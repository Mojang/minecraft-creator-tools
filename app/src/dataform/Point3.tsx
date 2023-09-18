import { Component, SyntheticEvent } from "react";
import "./Point3.css";
import IFormComponentProps from "./IFormComponentProps.js";
import { FormInput, InputProps, Button } from "@fluentui/react-northstar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBullseye } from "@fortawesome/free-solid-svg-icons";

export interface IPoint3Props extends IFormComponentProps {
  data: number[] | undefined;
  ambientPoint: number[] | undefined;
  objectKey: string | undefined;
  label?: string;
  onChange?: (
    event: SyntheticEvent<HTMLElement, Event> | React.KeyboardEvent<Element> | null,
    data: IPoint3Props
  ) => void;
}

interface IPoint3State {
  x: number;
  y: number;
  z: number;
  objectKey: string | undefined;
}

export default class Point3 extends Component<IPoint3Props, IPoint3State> {
  constructor(props: IPoint3Props) {
    super(props);

    this._handleXChange = this._handleXChange.bind(this);
    this._handleYChange = this._handleYChange.bind(this);
    this._handleZChange = this._handleZChange.bind(this);
    this._handleSetFromAmbientPoint = this._handleSetFromAmbientPoint.bind(this);

    if (props.data) {
      this.state = {
        x: props.data[0],
        y: props.data[1],
        z: props.data[2],
        objectKey: props.objectKey,
      };
    } else {
      this.state = {
        x: 0,
        y: 0,
        z: 0,
        objectKey: undefined,
      };
    }
  }

  static getDerivedStateFromProps(props: IPoint3Props, state: IPoint3State) {
    if (
      props.data &&
      props.data instanceof Array &&
      props.data.length === 3 &&
      state &&
      state.objectKey !== props.objectKey
    ) {
      return {
        x: props.data[0],
        y: props.data[1],
        z: props.data[2],
        objectKey: props.objectKey,
      };
    }

    if (state && state.x !== undefined && state.y !== undefined && state.z !== undefined) {
      return null;
    }

    if (props.data && props.data instanceof Array && props.data.length === 3) {
      return {
        x: props.data[0],
        y: props.data[1],
        z: props.data[2],
        objectKey: props.objectKey,
      };
    }

    return null;
  }

  _handleXChange(
    event: SyntheticEvent<HTMLElement, Event> | React.KeyboardEvent<Element> | null,
    data: (InputProps & { value: string }) | undefined
  ) {
    if (event === null || data === null || data === undefined || !this.state) {
      return;
    }

    let newX = this.state.x;

    try {
      newX = parseInt(data.value);
    } catch (e) {}

    this._updateProp(event, newX, this.state.y, this.state.z);

    this.setState({
      x: newX,
      y: this.state.y,
      z: this.state.z,
      objectKey: this.state.objectKey,
    });
  }

  _handleYChange(
    event: SyntheticEvent<HTMLElement, Event> | React.KeyboardEvent<Element> | null,
    data: (InputProps & { value: string }) | undefined
  ) {
    if (event === null || data === null || data === undefined || !this.state) {
      return;
    }

    let newY = this.state.y;

    try {
      newY = parseInt(data.value);
    } catch (e) {}

    this._updateProp(event, this.state.x, newY, this.state.z);

    this.setState({
      x: this.state.x,
      y: newY,
      z: this.state.z,
      objectKey: this.state.objectKey,
    });
  }
  _handleZChange(
    event: SyntheticEvent<HTMLElement, Event> | React.KeyboardEvent<Element> | null,
    data: (InputProps & { value: string }) | undefined
  ) {
    if (event === null || data === null || data === undefined || !this.state) {
      return;
    }

    let newZ = this.state.z;

    try {
      newZ = parseInt(data.value);
    } catch (e) {}

    this._updateProp(event, this.state.x, this.state.y, newZ);

    this.setState({
      x: this.state.x,
      y: this.state.y,
      z: newZ,
      objectKey: this.state.objectKey,
    });
  }

  _updateProp(
    event: SyntheticEvent<HTMLElement, Event> | React.KeyboardEvent<Element> | null,
    x: number,
    y: number,
    z: number
  ) {
    if (this.props.onChange) {
      const newProps = {
        data: [x, y, z],
        ambientPoint: this.props.ambientPoint,
        form: this.props.form,
        field: this.props.field,
        objectKey: this.props.objectKey,
      };

      this.props.onChange(event, newProps);
    }
  }

  _handleSetFromAmbientPoint(event: SyntheticEvent<HTMLElement, Event> | React.KeyboardEvent<Element> | null) {
    if (!this.state || !this.props.ambientPoint || this.props.ambientPoint.length !== 3) {
      return;
    }

    this._updateProp(event, this.props.ambientPoint[0], this.props.ambientPoint[1], this.props.ambientPoint[2]);

    this.setState({
      x: this.props.ambientPoint[0],
      y: this.props.ambientPoint[1],
      z: this.props.ambientPoint[2],
      objectKey: this.state.objectKey,
    });
  }

  render() {
    let curX = 0;
    let curY = 0;
    let curZ = 0;

    if (this.state) {
      curX = this.state.x;
      curY = this.state.y;
      curZ = this.state.z;
    } else if (this.props && this.props.data && this.props.data.length && this.props.data.length === 3) {
      curX = this.props.data[0];
      curY = this.props.data[1];
      curZ = this.props.data[2];
    }

    let ambientSet = <></>;

    if (this.props.ambientPoint && this.props.ambientPoint.length === 3) {
      ambientSet = (
        <div className="p3-ambient">
          <Button onClick={this._handleSetFromAmbientPoint}>
            <FontAwesomeIcon icon={faBullseye} className="fa-lg" />
          </Button>
        </div>
      );
    }
    let header = <></>;

    if (this.props.label) {
      header = <div>{this.props.label}</div>;
    }

    return (
      <div className="p3-outer">
        {header}
        <div className="p3-data">
          <div className="p3-inner">
            <div className="p3-cell">
              <FormInput
                id="x"
                className="p3-input"
                defaultValue={curX.toString()}
                value={curX.toString()}
                onChange={this._handleXChange}
              />
            </div>
            <div className="p3-cell">
              <FormInput
                id="y"
                className="p3-input"
                defaultValue={curY.toString()}
                value={curY.toString()}
                onChange={this._handleYChange}
              />
            </div>
            <div className="p3-cell">
              <FormInput
                id="z"
                className="p3-input"
                defaultValue={curZ.toString()}
                value={curZ.toString()}
                onChange={this._handleZChange}
              />
            </div>
            {ambientSet}
          </div>
        </div>
      </div>
    );
  }
}
