import { Component } from "react";
import IFile from "../storage/IFile";
import "./AutoScriptEditor.css";
import IPersistable from "./IPersistable";
import Database from "../minecraft/Database";
import AutoScriptManager from "../script/AutoScriptManager";
import AutoScriptGroupEditor from "./AutoScriptGroupEditor";
import AutoScript from "../autoscript/AutoScript";
import Log from "../core/Log";
import Carto from "../app/Carto";

interface IAutoScriptEditorProps {
  heightOffset: number;
  readOnly: boolean;
  script?: AutoScript;
  file?: IFile;
  carto: Carto;
  ambientSelectedPoint?: number[] | undefined;
  setActivePersistable?: (persistObject: IPersistable) => void;
}

interface IAutoScriptEditorState {
  fileToEdit: IFile | undefined;
  script: AutoScript | undefined;
}

export default class AutoScriptEditor
  extends Component<IAutoScriptEditorProps, IAutoScriptEditorState>
  implements IPersistable
{
  private _lastFileEdited?: IFile;

  constructor(props: IAutoScriptEditorProps) {
    super(props);

    this._handleAutoScriptLoaded = this._handleAutoScriptLoaded.bind(this);

    this.state = {
      fileToEdit: undefined,
      script: undefined,
    };
  }

  static getDerivedStateFromProps(props: IAutoScriptEditorProps, inState: IAutoScriptEditorState) {
    if (props.file) {
      if (inState === undefined || inState === null) {
        const state = {
          fileToEdit: props.file,
          script: undefined,
        };

        return state;
      }

      if (props.file !== inState.fileToEdit) {
        inState.fileToEdit = props.file;

        return inState;
      }
    }

    return null; // No change to state
  }

  componentDidUpdate(prevProps: IAutoScriptEditorProps, prevState: IAutoScriptEditorState) {
    this._updateManager();
  }

  async _updateManager() {
    if (this.state && this.state.fileToEdit) {
      if (this.state.fileToEdit !== this._lastFileEdited) {
        this._lastFileEdited = this.state.fileToEdit;

        await AutoScriptManager.ensureAutoScriptOnFile(this.state.fileToEdit, this._handleAutoScriptLoaded);

        this._doUpdate();
      }
    }
  }

  _handleAutoScriptLoaded(autoScript: AutoScriptManager, autoScriptA: AutoScriptManager) {
    this.forceUpdate();
  }

  async _doUpdate() {
    if (Database.uxCatalog === null) {
      await Database.loadUx();

      Log.assert(Database.uxCatalog !== null);

      this.forceUpdate();
    }
  }

  async persist() {
    if (this.state !== undefined && this.state.fileToEdit != null) {
      const file = this.state.fileToEdit;

      if (file.manager !== null) {
        const asm = file.manager as AutoScriptManager;

        await asm.persist();
      }
    }
  }

  render() {
    const height = "calc(100vh - " + this.props.heightOffset + "px)";

    if (
      (!this.props.script &&
        (this.state === null ||
          this.state.fileToEdit === null ||
          this.state.fileToEdit === undefined ||
          this.state.fileToEdit.manager === undefined)) ||
      Database.uxCatalog === null
    ) {
      if (this.state && this.state.fileToEdit) {
        if (this.state.fileToEdit.manager === undefined) {
          this._updateManager();
        }
      }

      return <div>Loading...</div>;
    }

    if (this.props.setActivePersistable !== undefined) {
      this.props.setActivePersistable(this);
    }

    let autoScript = this.props.script;

    if (!autoScript && this.state.fileToEdit) {
      const autosManager = this.state.fileToEdit.manager as AutoScriptManager;

      if (autosManager.autoScript === undefined) {
        return <div>(could not find script)...</div>;
      }

      autoScript = autosManager.autoScript;
    }

    if (!autoScript) {
      return <div>(could not find script)...</div>;
    }

    return (
      <div
        className="ase-area"
        style={{
          minHeight: height,
          maxHeight: height,
        }}
      >
        <div className="ase-header">{autoScript.name}</div>
        <div className="ase-componentBin">
          <AutoScriptGroupEditor
            group={autoScript}
            heightOffset={this.props.heightOffset + 40}
            ambientSelectedPoint={this.props.ambientSelectedPoint}
            displayBaseActionEditor={false}
            displayConditionEditor={false}
            carto={this.props.carto}
          />
        </div>
      </div>
    );
  }
}
