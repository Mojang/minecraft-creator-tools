import { Component, SyntheticEvent } from "react";
import "./Version.css";
import IFormComponentProps from "./../dataform/IFormComponentProps";
import { FormInput, InputProps, Button } from "@fluentui/react-northstar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBullseye } from "@fortawesome/free-solid-svg-icons";

export interface IVersionProps extends IFormComponentProps {
  data: number[] | string | undefined;
  defaultVersion?: number[] | string;
  objectKey: string | undefined;
  label?: string;
  forceString?: boolean;
  onChange?: (
    event: SyntheticEvent<HTMLElement, Event> | React.KeyboardEvent<Element> | null,
    data: IVersionProps
  ) => void;
}

interface IVersionState {
  major: number;
  minor: number;
  patch: number;
  objectKey: string | undefined;
}

export default class Version extends Component<IVersionProps, IVersionState> {
  constructor(props: IVersionProps) {
    super(props);

    this._handleMajorChange = this._handleMajorChange.bind(this);
    this._handleMinorChange = this._handleMinorChange.bind(this);
    this._handlePatchChange = this._handlePatchChange.bind(this);
    this._handleSetFromDefault = this._handleSetFromDefault.bind(this);

    if (props.data) {
      if (typeof props.data === "string") {
      } else {
        this.state = {
          major: props.data[0],
          minor: props.data[1],
          patch: props.data[2],
          objectKey: props.objectKey,
        };
      }
    } else {
      this.state = {
        major: 0,
        minor: 0,
        patch: 0,
        objectKey: undefined,
      };
    }
  }

  static getDerivedStateFromProps(props: IVersionProps, state: IVersionState) {
    if (
      props.data &&
      props.data instanceof Array &&
      props.data.length === 3 &&
      state &&
      state.objectKey !== props.objectKey
    ) {
      return {
        major: props.data[0],
        minor: props.data[1],
        patch: props.data[2],
        objectKey: props.objectKey,
      };
    }

    if (state && state.major !== undefined && state.minor !== undefined && state.patch !== undefined) {
      return null;
    }

    if (props.data && props.data instanceof Array && props.data.length === 3) {
      return {
        major: props.data[0],
        minor: props.data[1],
        patch: props.data[2],
        objectKey: props.objectKey,
      };
    }

    return null;
  }

  _handleMajorChange(
    event: SyntheticEvent<HTMLElement, Event> | React.KeyboardEvent<Element> | null,
    data: (InputProps & { value: string }) | undefined
  ) {
    if (event === null || data === null || data === undefined || !this.state) {
      return;
    }

    let newMajor = this.state.major;

    try {
      newMajor = parseInt(data.value);
    } catch (e) {}

    this._updateProp(event, newMajor, this.state.minor, this.state.patch);

    this.setState({
      major: newMajor,
      minor: this.state.minor,
      patch: this.state.patch,
      objectKey: this.state.objectKey,
    });
  }

  _handleMinorChange(
    event: SyntheticEvent<HTMLElement, Event> | React.KeyboardEvent<Element> | null,
    data: (InputProps & { value: string }) | undefined
  ) {
    if (event === null || data === null || data === undefined || !this.state) {
      return;
    }

    let newMinor = this.state.minor;

    try {
      newMinor = parseInt(data.value);
    } catch (e) {}

    this._updateProp(event, this.state.major, newMinor, this.state.patch);

    this.setState({
      major: this.state.major,
      minor: newMinor,
      patch: this.state.patch,
      objectKey: this.state.objectKey,
    });
  }

  _handlePatchChange(
    event: SyntheticEvent<HTMLElement, Event> | React.KeyboardEvent<Element> | null,
    data: (InputProps & { value: string }) | undefined
  ) {
    if (event === null || data === null || data === undefined || !this.state) {
      return;
    }

    let newPatch = this.state.patch;

    try {
      newPatch = parseInt(data.value);
    } catch (e) {}

    this._updateProp(event, this.state.major, this.state.minor, newPatch);

    this.setState({
      major: this.state.major,
      minor: this.state.minor,
      patch: newPatch,
      objectKey: this.state.objectKey,
    });
  }

  _updateProp(
    event: SyntheticEvent<HTMLElement, Event> | React.KeyboardEvent<Element> | null,
    major: number,
    minor: number,
    patch: number
  ) {
    if (this.props.onChange) {
      let newData: number[] | string = [major, minor, patch];
      if (this.props.forceString) {
        newData = major + "." + minor + "." + patch;
      }

      const newProps = {
        data: newData,
        defaultVersion: this.props.defaultVersion,
        form: this.props.form,
        field: this.props.field,
        objectKey: this.props.objectKey,
      };

      this.props.onChange(event, newProps);
    }
  }

  _handleSetFromDefault(event: SyntheticEvent<HTMLElement, Event> | React.KeyboardEvent<Element> | null) {
    if (!this.state || !this.props.defaultVersion || this.props.defaultVersion.length !== 3) {
      return;
    }

    const data = Version.getVersionArray(this.props.defaultVersion);
    this._updateProp(event, data[0], data[1], data[2]);

    this.setState({
      major: data[0],
      minor: data[1],
      patch: data[2],
      objectKey: this.state.objectKey,
    });
  }

  static getVersionArray(data: string | number[]) {
    let curMajor = 0;
    let curMinor = 0;
    let curPatch = 1;

    if (typeof data === "string") {
      let end = data.indexOf("-");

      if (end < 1) {
        end = data.length;
      }

      const intArr = data.split(".");

      try {
        curMajor = intArr.length > 0 ? parseInt(intArr[0]) : 0;
        curMinor = intArr.length > 1 ? parseInt(intArr[1]) : 0;
        curPatch = intArr.length > 2 ? parseInt(intArr[2]) : 1;
      } catch (e) {}
    } else {
      curMajor = data.length > 0 ? data[0] : 0;
      curMinor = data.length > 1 ? data[1] : 0;
      curPatch = data.length > 2 ? data[2] : 1;
    }

    return [curMajor, curMinor, curPatch];
  }

  render() {
    let curMajor = 0;
    let curMinor = 0;
    let curPatch = 0;

    if (this.state) {
      curMajor = this.state.major;
      curMinor = this.state.minor;
      curPatch = this.state.patch;
    } else if (this.props && this.props.data) {
      const data = Version.getVersionArray(this.props.data);

      curMajor = data[0];
      curMinor = data[1];
      curPatch = data[2];
    }

    let ambientSet = <></>;

    if (this.props.defaultVersion && this.props.defaultVersion.length === 3) {
      ambientSet = (
        <div className="ver-ambient">
          <Button onClick={this._handleSetFromDefault}>
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
      <div className="ver-outer">
        {header}
        <div className="ver-data">
          <div className="ver-inner">
            <div className="ver-cell">
              <FormInput
                id="major"
                className="ver-input"
                defaultValue={curMajor.toString()}
                value={curMajor.toString()}
                onChange={this._handleMajorChange}
              />
            </div>
            <div className="ver-cell">
              <FormInput
                id="minor"
                className="ver-input"
                defaultValue={curMinor.toString()}
                value={curMinor.toString()}
                onChange={this._handleMinorChange}
              />
            </div>
            <div className="ver-cell">
              <FormInput
                id="patch"
                className="ver-input"
                defaultValue={curPatch.toString()}
                value={curPatch.toString()}
                onChange={this._handlePatchChange}
              />
            </div>
            {ambientSet}
          </div>
        </div>
      </div>
    );
  }
}
