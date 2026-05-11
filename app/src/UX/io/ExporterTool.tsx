import { Component } from "react";
import "./ExporterTool.css";
import { Stack, Button, TextField, RadioGroup, FormControlLabel, Radio } from "@mui/material";
import IAppProps from "../appShell/IAppProps";
import { AppMode } from "../appShell/App";
import Log from "../../core/Log";
import Project from "../../app/Project";

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
    // NOTE: Export functionality is handled via ProjectActions / ShareProject.
    // This tool is a legacy UI stub that is not fully wired up.
    // Transition to done state so the dialog does not remain stuck in "executing".
    this.setState({
      importPath: this.state.importPath,
      exportPath: this.state.exportPath,
      mode: ExporterToolMode.done,
    });
  }

  _handleImportPathUpdate = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (this.state == null) {
      return;
    }

    this.setState({
      importPath: e.target.value,
      exportPath: this.state.exportPath,
    });
  };

  _handleTypeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value === undefined) {
      Log.unexpectedUndefined("HTC");
      return;
    }

    //const result = e.target.value;
  };

  _handleExportPathUpdate = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (this.state == null) {
      return;
    }

    this.setState({
      importPath: this.state.importPath,
      exportPath: e.target.value,
    });
  };

  render() {
    let dialogInterior = <></>;

    dialogInterior = (
      <div className="et-optionsGrid">
        <div className="et-type-label">Type</div>
        <div className="et-type-options">
          <RadioGroup defaultValue="exportMCWorldWithPackRefs" onChange={this._handleTypeChange}>
            <FormControlLabel
              value="exportMCWorldWithPackRefs"
              control={<Radio />}
              label="Minecraft World with Pack References"
            />
            <FormControlLabel
              value="exportMCWorldWithPacksEmbedded"
              control={<Radio />}
              label="Minecraft World with Packs Embedded"
            />
            <FormControlLabel value="exportMCPack" control={<Radio />} label="Minecraft Add-On" />
          </RadioGroup>
        </div>
        <div className="et-import-label" id="et-import-label">
          Import path
        </div>
        <div className="et-import-input">
          <TextField
            size="small"
            fullWidth
            aria-labelledby="et-import-label"
            placeholder="Import path"
            value={this.state.importPath || ""}
            onChange={this._handleImportPathUpdate}
          />
        </div>
        <div className="et-export-label" id="et-export-label">
          Export file
        </div>
        <div className="et-export-input">
          <TextField
            size="small"
            fullWidth
            aria-labelledby="et-export-label"
            placeholder="Export path"
            value={this.state.exportPath || ""}
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
            <Stack direction="row" spacing={1} aria-label="Export" />
          </div>
          {dialogInterior}
          <div className="et-buttonArea">
            <Button onClick={this._handleCancelClick}>Cancel</Button>
            <Button onClick={this._handleOkClick} variant="contained" color="primary">
              OK
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
