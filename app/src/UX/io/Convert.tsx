import { Component } from "react";
import IAppProps from "../appShell/IAppProps";
import Project from "../../app/Project";
import "./Convert.css";
import DataForm, { IDataFormProps } from "../../dataformux/DataForm";
import Database from "../../minecraft/Database";
import IProperty from "../../dataform/IProperty";
import IConversionSettings from "../../core/IConversionSettings";
import IProjectTheme from "../types/IProjectTheme";
import { WithLocalizationProps, withLocalization } from "../withLocalization";

interface IConvertProps extends IAppProps, WithLocalizationProps {
  project?: Project;
  theme: IProjectTheme;
  initialData: IConversionSettings;
  onDialogDataChange: (updateData: any) => void;
}

interface IConvertState {
  isLoaded: boolean;
  data: IConversionSettings;
}

class Convert extends Component<IConvertProps, IConvertState> {
  constructor(props: IConvertProps) {
    super(props);

    this._handleDataFormPropertyChange = this._handleDataFormPropertyChange.bind(this);

    this.state = {
      isLoaded: Database.getForm("tool", "convert") !== undefined,
      data: this.props.initialData,
    };
  }

  componentDidMount(): void {
    this._updateManager(true);
  }

  async _updateManager(setState: boolean) {
    if (!this.state.isLoaded) {
      await Database.ensureFormLoaded("tool", "convert");

      if (setState) {
        this.setState({
          isLoaded: true,
          data: this.state.data,
        });
      }
    }
  }

  _handleDataFormPropertyChange(props: IDataFormProps, property: IProperty, newValue: any) {
    if (props.directObject) {
      if (this.props.onDialogDataChange) {
        this.props.onDialogDataChange(props.directObject);
      }
      this.setState({
        isLoaded: this.state.isLoaded,
        data: props.directObject,
      });
    }
  }

  render() {
    if (this.state === null || !this.state.isLoaded) {
      return <div>{this.props.intl.formatMessage({ id: "convert.loading" })}</div>;
    }

    const form = Database.getForm("tool", "convert");

    if (!form) {
      return <div className="cv-loading">{this.props.intl.formatMessage({ id: "convert.form_not_found" })}</div>;
    }

    return (
      <div className={"cv-outer"}>
        <DataForm
          definition={form}
          directObject={this.state.data}
          readOnly={false}
          theme={this.props.theme}
          onPropertyChanged={this._handleDataFormPropertyChange}
        ></DataForm>
      </div>
    );
  }
}

export default withLocalization(Convert);
