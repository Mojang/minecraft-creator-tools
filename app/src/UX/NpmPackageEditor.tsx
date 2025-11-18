import { Component } from "react";
import IFileProps from "./IFileProps";
import IFile from "../storage/IFile";
import "./NpmPackageEditor.css";
import NpmPackageDefinition from "../devproject/NpmPackageDefinition";
import Database from "../minecraft/Database";
import { ThemeInput } from "@fluentui/styles";
import { ListProps } from "@fluentui/react-northstar";
import DataForm, { IDataFormProps } from "../dataform/DataForm";
import IProperty from "../dataform/IProperty";
import Project from "../app/Project";

interface INpmPackageEditorProps extends IFileProps {
  heightOffset: number;
  readOnly: boolean;
  project: Project;
  theme: ThemeInput<any>;
}

interface INpmPackageEditorState {
  fileToEdit: IFile;
  isLoaded: boolean;
  selectedItem: NpmPackageDefinition | undefined;
}

export default class NpmPackageEditor extends Component<INpmPackageEditorProps, INpmPackageEditorState> {
  private _lastFileEdited?: IFile;

  constructor(props: INpmPackageEditorProps) {
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

  static getDerivedStateFromProps(props: INpmPackageEditorProps, state: INpmPackageEditorState) {
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

  componentDidUpdate(prevProps: INpmPackageEditorProps, prevState: INpmPackageEditorState) {
    this._updateManager(true);
  }

  async _updateManager(setState: boolean) {
    if (this.state !== undefined && this.state.fileToEdit !== undefined) {
      if (this.state.fileToEdit !== this._lastFileEdited) {
        this._lastFileEdited = this.state.fileToEdit;

        await NpmPackageDefinition.ensureOnFile(this.state.fileToEdit, this._handleNpmPackageJsonLoaded);
      }
    }

    if (
      this.state.fileToEdit &&
      this.state.fileToEdit.manager !== undefined &&
      this.state.fileToEdit.manager instanceof NpmPackageDefinition &&
      (this.state.fileToEdit.manager as NpmPackageDefinition).isLoaded &&
      !this.state.isLoaded
    ) {
      this._doUpdate(setState);
    }
  }

  _handleNpmPackageJsonLoaded(npmPackageJson: NpmPackageDefinition, typeA: NpmPackageDefinition) {
    this._doUpdate(true);
  }

  async _doUpdate(setState: boolean) {
    await Database.ensureFormLoaded("dev", "package_json");

    let selItem = this.state.selectedItem;

    if (selItem === undefined && this.state && this.state.fileToEdit && this.state.fileToEdit.manager) {
      selItem = this.state.fileToEdit.manager as NpmPackageDefinition;
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

  async persist(): Promise<boolean> {
    if (this.state !== undefined && this.state.fileToEdit != null) {
      const file = this.state.fileToEdit;

      if (file.manager) {
        const et = file.manager as NpmPackageDefinition;

        return await et.persist();
      }
    }

    return false;
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

    const et = this.state.fileToEdit.manager as NpmPackageDefinition;
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

      file.setObjectContentIfSemanticallyDifferent(props.directObject);
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

    const npmJsonFile = this.state.fileToEdit.manager as NpmPackageDefinition;
    const def = npmJsonFile.definition;

    if (def === undefined) {
      return <div className="npme-loading">Loading definition...</div>;
    }

    const form = Database.getForm("dev", "package_json");

    if (!form) {
      return <div className="npme-loading">Form not found</div>;
    }

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
              project={this.props.project}
              lookupProvider={this.props.project}
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
