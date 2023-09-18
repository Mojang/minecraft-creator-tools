import { Component } from "react";
import IFileProps from "./IFileProps";
import IFile from "../storage/IFile";
import "./BehaviorPackManifestJsonEditor.css";
import IPersistable from "./IPersistable";
import NpmPackageJson from "../devproject/NpmPackageJson";
import Database from "../minecraft/Database";
import { ThemeInput } from "@fluentui/styles";
import { ListProps } from "@fluentui/react-northstar";
import ManagedComponentGroup from "../minecraft/ManagedComponentGroup";
import DataForm, { IDataFormProps } from "../dataform/DataForm";
import IProperty from "../dataform/IProperty";
import BehaviorManifestJson from "../minecraft/BehaviorManifestJson";
import StorageUtilities from "../storage/StorageUtilities";
import Utilities from "../core/Utilities";

interface IBehaviorPackManifestJsonEditorProps extends IFileProps {
  heightOffset: number;
  readOnly: boolean;
  theme: ThemeInput<any>;
}

interface IBehaviorPackManifestJsonEditorState {
  fileToEdit: IFile;
  isLoaded: boolean;
  selectedItem: NpmPackageJson | ManagedComponentGroup | undefined;
}

export default class BehaviorPackManifestJsonEditor
  extends Component<IBehaviorPackManifestJsonEditorProps, IBehaviorPackManifestJsonEditorState>
  implements IPersistable
{
  private _lastFileEdited?: IFile;

  constructor(props: IBehaviorPackManifestJsonEditorProps) {
    super(props);

    this._handleBehaviorManifestJsonLoaded = this._handleBehaviorManifestJsonLoaded.bind(this);
    this._handleItemSelected = this._handleItemSelected.bind(this);
    this._handleDataFormPropertyChange = this._handleDataFormPropertyChange.bind(this);

    this.state = {
      fileToEdit: props.file,
      isLoaded: false,
      selectedItem: undefined,
    };

    this._updateManager(true);
  }

  static getDerivedStateFromProps(
    props: IBehaviorPackManifestJsonEditorProps,
    state: IBehaviorPackManifestJsonEditorState
  ) {
    if (state === undefined || state === null) {
      state = {
        fileToEdit: props.file,
        isLoaded: false,
        selectedItem: undefined,
      };

      return state;
    }

    if (props.file !== state.fileToEdit) {
      state.fileToEdit = props.file;
      state.isLoaded = false;

      return state;
    }

    return null; // No change to state
  }

  componentDidUpdate(prevProps: IBehaviorPackManifestJsonEditorProps, prevState: IBehaviorPackManifestJsonEditorState) {
    this._updateManager(true);
  }

  async _updateManager(setState: boolean) {
    if (this.state !== undefined && this.state.fileToEdit !== undefined) {
      if (this.state.fileToEdit !== this._lastFileEdited) {
        this._lastFileEdited = this.state.fileToEdit;

        await NpmPackageJson.ensureOnFile(this.state.fileToEdit, this._handleBehaviorManifestJsonLoaded);
      }
    }

    if (
      this.state.fileToEdit &&
      this.state.fileToEdit.manager !== undefined &&
      this.state.fileToEdit.manager instanceof NpmPackageJson &&
      (this.state.fileToEdit.manager as NpmPackageJson).isLoaded &&
      !this.state.isLoaded
    ) {
      this._doUpdate(setState);
    }
  }

  _handleBehaviorManifestJsonLoaded(npmPackageJson: NpmPackageJson, typeA: NpmPackageJson) {
    this._doUpdate(true);
  }

  async _doUpdate(setState: boolean) {
    if (Database.uxCatalog === null) {
      await Database.loadUx();
    }
    let selItem = this.state.selectedItem;

    if (selItem === undefined && this.state && this.state.fileToEdit && this.state.fileToEdit.manager) {
      selItem = this.state.fileToEdit.manager as NpmPackageJson;
    }

    if (setState) {
      this.setState({
        fileToEdit: this.state.fileToEdit,
        isLoaded: true,
        selectedItem: this.state.selectedItem,
      });
    } else {
      this.state = {
        fileToEdit: this.props.file,
        isLoaded: true,
        selectedItem: this.state.selectedItem,
      };
    }
  }

  async persist() {
    if (this.state !== undefined && this.state.fileToEdit != null) {
      const file = this.state.fileToEdit;

      if (file.manager !== null) {
        const et = file.manager as NpmPackageJson;

        et.persist();
      }
    }
  }

  _handleItemSelected(elt: any, event: ListProps | undefined) {
    if (
      event === undefined ||
      event.selectedIndex === undefined ||
      this.state == null ||
      this.state.fileToEdit === undefined ||
      this.state.fileToEdit.manager === undefined
    ) {
      return;
    }

    const et = this.state.fileToEdit.manager as NpmPackageJson;
    const itemListings = this.getItemListings();

    const key = itemListings[event.selectedIndex].key;

    if (key) {
      if (key === "defaultBehaviorPackJson") {
        this.setState({
          fileToEdit: this.state.fileToEdit,
          isLoaded: this.state.isLoaded,
          selectedItem: et,
        });
      } else if (key.startsWith("cg.")) {
      }
    }
  }

  getItemListings() {
    if (!this.state || !this.state.fileToEdit) {
      return [];
    }

    const itemListings = [];

    itemListings.push({
      key: "defaultNpmPackageJson",
      header: "Default Components",
      headerMedia: " ",
      content: " ",
    });

    // const bpme = this.state.fileToEdit.manager as BehaviorManifestJson;

    /*    const componentGroups = et.getComponentGroups();

    for (const compGroup of componentGroups) {
      const header = compGroup.id;

      itemListings.push({
        key: "cg." + compGroup.id,
        header: header,
        headerMedia: " ",
        content: " ",
      });
    }*/

    return itemListings;
  }

  _handleDataFormPropertyChange(props: IDataFormProps, property: IProperty, newValue: any) {
    if (props.tagData && props.directObject) {
      const file = props.tagData as IFile;

      const newData = JSON.stringify(props.directObject, null, 2);

      file.setContent(newData);
    }
  }

  render() {
    const height = "calc(100vh - " + this.props.heightOffset + "px)";

    if (
      this.state === null ||
      this.state.fileToEdit === null ||
      this.state.fileToEdit.manager === undefined ||
      Database.uxCatalog === null
    ) {
      if (this.state.fileToEdit !== null) {
        if (this.state.fileToEdit.manager === undefined) {
          this._updateManager(true);
        }
      }

      return <div>Loading...</div>;
    }

    if (this.props.setActivePersistable !== undefined) {
      this.props.setActivePersistable(this);
    }

    const bpManifestJsonFile = this.state.fileToEdit.manager as BehaviorManifestJson;
    const def = bpManifestJsonFile.definition;

    if (def === undefined) {
      return <div>Loading definition...</div>;
    }

    const headerForm = Database.uxCatalog.behaviorPackHeaderJson;
    const restOfForm = Database.uxCatalog.behaviorPackRestOfFile;

    let behaviorPackTitle = "Behavior Pack";

    if (def && !def.header) {
      const baseName = StorageUtilities.getBaseFromName(this.state.fileToEdit.name);

      def.header = {
        name: baseName,
        description: baseName,
        uuid: Utilities.createUuid(),
        version: [0, 0, 1],
        min_engine_version: [1, 20, 10],
      };
    }

    if (def && def.header) {
      behaviorPackTitle = def.header.uuid;
    }

    return (
      <div
        className="bpme-area"
        style={{
          minHeight: height,
          maxHeight: height,
        }}
      >
        <div className="bpme-header">{behaviorPackTitle}</div>
        <div className="bpme-mainArea">
          <div className="bpme-form">
            <DataForm
              definition={headerForm}
              directObject={def.header}
              readOnly={false}
              objectKey={this.props.file.storageRelativePath}
              onPropertyChanged={this._handleDataFormPropertyChange}
            ></DataForm>
            <DataForm
              definition={restOfForm}
              directObject={def}
              readOnly={false}
              objectKey={this.props.file.storageRelativePath}
              onPropertyChanged={this._handleDataFormPropertyChange}
            ></DataForm>
          </div>
        </div>
      </div>
    );
  }
}
