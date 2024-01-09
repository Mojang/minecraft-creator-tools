import { Component } from "react";
import IFileProps from "./IFileProps";
import IFile from "../storage/IFile";
import "./NpmPackageJsonEditor.css";
import NpmPackageJson from "../devproject/NpmPackageJson";
import Database from "../minecraft/Database";
import { ThemeInput } from "@fluentui/styles";
import { ListProps } from "@fluentui/react-northstar";
import ManagedComponentGroup from "../minecraft/ManagedComponentGroup";
import DataForm, { IDataFormProps } from "../dataform/DataForm";
import IProperty from "../dataform/IProperty";

interface INpmPackageJsonEditorProps extends IFileProps {
  heightOffset: number;
  readOnly: boolean;
  theme: ThemeInput<any>;
}

interface INpmPackageJsonEditorState {
  fileToEdit: IFile;
  isLoaded: boolean;
  selectedItem: NpmPackageJson | ManagedComponentGroup | undefined;
}

export default class NpmPackageJsonEditor extends Component<INpmPackageJsonEditorProps, INpmPackageJsonEditorState> {
  private _lastFileEdited?: IFile;

  constructor(props: INpmPackageJsonEditorProps) {
    super(props);

    this._handleNpmPackageJsonLoaded = this._handleNpmPackageJsonLoaded.bind(this);
    this._handleItemSelected = this._handleItemSelected.bind(this);
    this._handleDataFormPropertyChange = this._handleDataFormPropertyChange.bind(this);

    this.state = {
      fileToEdit: props.file,
      isLoaded: false,
      selectedItem: undefined,
    };

    this._updateManager(true);
  }

  static getDerivedStateFromProps(props: INpmPackageJsonEditorProps, state: INpmPackageJsonEditorState) {
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

  componentDidUpdate(prevProps: INpmPackageJsonEditorProps, prevState: INpmPackageJsonEditorState) {
    this._updateManager(true);
  }

  async _updateManager(setState: boolean) {
    if (this.state !== undefined && this.state.fileToEdit !== undefined) {
      if (this.state.fileToEdit !== this._lastFileEdited) {
        this._lastFileEdited = this.state.fileToEdit;

        await NpmPackageJson.ensureOnFile(this.state.fileToEdit, this._handleNpmPackageJsonLoaded);
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

  _handleNpmPackageJsonLoaded(npmPackageJson: NpmPackageJson, typeA: NpmPackageJson) {
    this._doUpdate(true);
  }

  async _doUpdate(setState: boolean) {
    await Database.ensureFormLoaded("package_json");

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
      if (key === "defaultNpmPackageJson") {
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

    // const npme = this.state.fileToEdit.manager as NpmPackageJson;

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

    const npmJsonFile = this.state.fileToEdit.manager as NpmPackageJson;
    const def = npmJsonFile.definition;

    if (def === undefined) {
      return <div>Loading definition...</div>;
    }

    const form = Database.getForm("package_json");

    return (
      <div
        className="npme-area"
        style={{
          minHeight: height,
          maxHeight: height,
        }}
      >
        <div className="npme-header">{npmJsonFile.id}</div>
        <div className="npme-mainArea">
          <div className="npme-form">
            <DataForm
              definition={form}
              directObject={def}
              readOnly={false}
              theme={this.props.theme}
              objectKey={this.props.file.storageRelativePath}
              onPropertyChanged={this._handleDataFormPropertyChange}
            ></DataForm>
          </div>
        </div>
      </div>
    );
  }
}
