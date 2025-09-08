import { Component, SyntheticEvent } from "react";
import "./ExporterTool.css";
import { Toolbar, Button, Input, InputProps, RadioGroup, RadioGroupItemProps } from "@fluentui/react-northstar";
import IAppProps from "./IAppProps";
import { AppMode } from "./App";
import Log from "./../core/Log";
import Project from "./../app/Project";

interface IExporterToolProps extends IAppProps {
  onModeChangeRequested?: (mode: AppMode) => void;
  onProjectSelected?: (project: Project) => void;
}

interface IExporterToolState {
  importPath?: string;
  exportPath?: string;
  mode: ExporterToolMode;
}

export enum ExporterToolMode {
  configuring = 0,
  executing = 1,
  done = 2,
}

export default class ExporterToolEditor extends Component<IExporterToolProps, IExporterToolState> {
  constructor(props: IExporterToolProps) {
    super(props);

    this._handleCancelClick = this._handleCancelClick.bind(this);
    this._handleOkClick = this._handleOkClick.bind(this);

    this.state = {
      importPath: undefined,
      exportPath: undefined,
      mode: ExporterToolMode.configuring,
    };
  }

  _handleCancelClick() {
    if (this.props.onModeChangeRequested !== undefined) {
      this.props.onModeChangeRequested(AppMode.home);
    }
  }

  _handleOkClick() {
    this.setState({
      importPath: this.state.importPath,
      exportPath: this.state.exportPath,
      mode: ExporterToolMode.executing,
    });

    this.executeExport();
  }

  async executeExport() {
    this.setState({
      importPath: this.state.importPath,
      exportPath: this.state.exportPath,
      mode: ExporterToolMode.executing,
    });
  }

  _handleImportPathUpdate(e: SyntheticEvent, data: (InputProps & { value: string }) | undefined) {
    if (data === undefined || this.state == null) {
      return;
    }

    this.setState({
      importPath: data.value,
      exportPath: this.state.exportPath,
    });
  }

  _handleTypeChange(e: SyntheticEvent, data: RadioGroupItemProps | undefined) {
    if (data === undefined || data.value === undefined) {
      Log.unexpectedUndefined("HTC");
      return;
    }

    //const result = data.value;
  }

  _handleExportPathUpdate(e: SyntheticEvent, data: (InputProps & { value: string }) | undefined) {
    if (data === undefined || this.state == null) {
      return;
    }

    this.setState({
      importPath: this.state.importPath,
      exportPath: data.value,
    });
  }

  render() {
    const toolbarItems: any[] = [];

    const exportOptions = [
      {
        name: "exportMCWorldWithPackRefs",
        key: "exportMCWorldWithPackRefs",
        label: "Minecraft World with Pack References",
        value: "exportMCWorldWithPackRefs",
      },
      {
        name: "exportMCWorldWithPacksEmbedded",
        key: "exportMCWorldWithPacksEmbedded",
        label: "Minecraft World with Packs Embedded",
        value: "exportMCWorldWithPacksEmbedded",
      },
      {
        name: "exportMCPack",
        key: "exportMCPack",
        value: "exportMCPack",
        label: "Minecraft Add-On",
      },
    ];

    let dialogInterior = <></>;

    dialogInterior = (
      <div className="et-optionsGrid">
        <div className="et-type-label">Type</div>
        <div className="et-type-options">
          <RadioGroup
            vertical
            defaultCheckedValue="exportMCWorldWithPackRefs"
            items={exportOptions}
            onCheckedValueChange={this._handleTypeChange}
          />
        </div>
        <div className="et-import-label" id="et-import-label">
          Import path
        </div>
        <div className="et-import-input">
          <Input
            clearable
            aria-labelledby="et-import-label"
            placeholder="Import path"
            value={this.state.importPath}
            onChange={this._handleImportPathUpdate}
          />
        </div>
        <div className="et-export-label" id="et-export-label">
          Export file
        </div>
        <div className="et-export-input">
          <Input
            clearable
            aria-labelledby="et-export-label"
            placeholder="Export path"
            value={this.state.exportPath}
            onChange={this._handleExportPathUpdate}
          />
        </div>
      </div>
    );

    return (
      <div className="et-outer">
        <div className="et-area">
          <div className="et-actionsHeader">Export</div>
          <div className="et-actionsToolBarArea">
            <Toolbar aria-label="Export toolbar overflow menu" items={toolbarItems} />
          </div>
          {dialogInterior}
          <div className="et-buttonArea">
            <Button onClick={this._handleCancelClick} content="Cancel" />
            <Button onClick={this._handleOkClick} content="OK" primary />
          </div>
        </div>
      </div>
    );
  }
}
