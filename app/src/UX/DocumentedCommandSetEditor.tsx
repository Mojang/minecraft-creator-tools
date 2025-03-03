import { Component } from "react";
import IFileProps from "./IFileProps";
import IFile from "../storage/IFile";
import "./DocumentedCommandSetEditor.css";
import DocumentedCommand from "../minecraft/docs/DocumentedCommand";
import DocumentedCommandSet from "../minecraft/docs/DocumentedCommandSet";
import DataForm from "../dataform/DataForm";
import Database from "../minecraft/Database";
import CartoApp from "../app/CartoApp";
import Project from "../app/Project";
import { List, ListProps, ThemeInput, selectableListBehavior } from "@fluentui/react-northstar";
import DocumentedCommandEditor from "./DocumentedCommandEditor";

interface IDocumentedCommandSetEditorProps extends IFileProps {
  heightOffset: number;
  theme: ThemeInput<any>;
  typesReadOnly: boolean;
  docsReadOnly: boolean;
  carto: CartoApp;
  project: Project;
}

interface IDocumentedCommandSetEditorState {
  fileToEdit: IFile;
  selectedCommand?: DocumentedCommand;
  isLoaded: boolean;
}

export default class DocumentedCommandSetEditor extends Component<
  IDocumentedCommandSetEditorProps,
  IDocumentedCommandSetEditorState
> {
  constructor(props: IDocumentedCommandSetEditorProps) {
    super(props);

    this._handleDocumentedCommandSetLoaded = this._handleDocumentedCommandSetLoaded.bind(this);
    this._handleCommandSelected = this._handleCommandSelected.bind(this);
  }

  static getDerivedStateFromProps(props: IDocumentedCommandSetEditorProps, state: IDocumentedCommandSetEditorState) {
    if (state === undefined || state === null) {
      state = {
        fileToEdit: props.file,
        isLoaded: false,
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

  componentDidUpdate(prevProps: IDocumentedCommandSetEditorProps, prevState: IDocumentedCommandSetEditorState) {
    this._updateManager();
  }

  async _updateManager() {
    if (this.state !== undefined && this.state.fileToEdit !== undefined) {
      if (!this.state.isLoaded) {
        await this.props.project.inferProjectItemsFromFiles();

        const docsFolder = await this.props.project.ensureDocsFolder();

        await DocumentedCommandSet.ensureOnFile(
          this.state.fileToEdit,
          docsFolder,
          this._handleDocumentedCommandSetLoaded
        );

        await Database.ensureFormLoaded("documentation", "command_set");

        this._handleDocumentedCommandSetLoaded();
      }
    }
  }

  _handleDocumentedCommandSetLoaded() {
    this.setState({
      fileToEdit: this.state.fileToEdit,
      isLoaded: true,
    });
  }

  async persist() {
    if (this.state !== undefined && this.state.fileToEdit != null) {
      const file = this.state.fileToEdit;

      if (file.manager) {
        const et = file.manager as DocumentedCommandSet;

        et.persist();
      }
    }
  }

  _handleCommandSelected(elt: any, event: ListProps | undefined) {
    if (
      event === undefined ||
      event.selectedIndex === undefined ||
      this.state == null ||
      this.state.fileToEdit === undefined ||
      this.state.fileToEdit.manager === undefined
    ) {
      return;
    }

    const dm = this.state.fileToEdit.manager as DocumentedCommandSet;
    const classListing = this.getCommandListing();

    const key = classListing[event.selectedIndex].key;

    if (key) {
      const selectedCommand = dm.commands[key];

      this.setState({
        fileToEdit: this.state.fileToEdit,
        isLoaded: this.state.isLoaded,
        selectedCommand: selectedCommand,
      });
    }
  }

  getCommandListing() {
    const commandListing = [];

    const dcs = this.state.fileToEdit.manager as DocumentedCommandSet;

    const commands = dcs.commands;

    for (const commandName in commands) {
      const docCommand = commands[commandName];

      commandListing.push({
        key: docCommand.id,
        content: <div title={docCommand.id}>{docCommand.id}</div>,
      });
    }

    return commandListing;
  }

  render() {
    const height = "calc(100vh - " + String(this.props.heightOffset) + "px)";
    const classHeight = "calc(100vh - " + String(this.props.heightOffset + 136) + "px)";

    if (
      this.state === null ||
      this.state.fileToEdit === null ||
      this.state.fileToEdit.manager === undefined ||
      Database.uxCatalog === null
    ) {
      if (this.state.fileToEdit !== null) {
        if (this.state.fileToEdit.manager === undefined) {
          this._updateManager();
        }
      }

      return <div>Loading...</div>;
    }

    if (this.props.setActivePersistable !== undefined) {
      this.props.setActivePersistable(this);
    }

    const dcs = this.state.fileToEdit.manager as DocumentedCommandSet;
    const form = Database.getForm("documentation", "command_set");

    const commandListing = this.getCommandListing();

    let docClassEditor = <div>&#160;</div>;

    if (this.state.selectedCommand) {
      docClassEditor = (
        <DocumentedCommandEditor
          heightOffset={this.props.heightOffset + 160}
          carto={this.props.carto}
          theme={this.props.theme}
          typesReadOnly={this.props.typesReadOnly}
          docsReadOnly={this.props.docsReadOnly}
          project={this.props.project}
          file={this.props.file}
          docCommand={this.state.selectedCommand}
        />
      );
    }

    return (
      <div
        className="dcse-area"
        style={{
          minHeight: height,
          maxHeight: height,
          backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background2,
          color: this.props.theme.siteVariables?.colorScheme.brand.foreground2,
        }}
      >
        <div className="dcse-header">{dcs.name}</div>

        <div className="dcse-moduleProps">
          <DataForm
            definition={form}
            directObject={dcs}
            theme={this.props.theme}
            objectKey={dcs.id}
            readOnly={this.props.typesReadOnly}
          ></DataForm>
        </div>

        <div
          className="dcse-classEditorOuter"
          style={{
            backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
            color: this.props.theme.siteVariables?.colorScheme.brand.foreground1,
          }}
        >
          <div
            className="dcse-classList"
            style={{
              minHeight: classHeight,
              maxHeight: classHeight,
            }}
          >
            <List
              selectable
              aria-label="List of document command sets"
              accessibility={selectableListBehavior}
              defaultSelectedIndex={-1}
              items={commandListing}
              onSelectedIndexChange={this._handleCommandSelected}
            />
          </div>
          <div
            className="dcse-classEditor"
            style={{
              minHeight: classHeight,
              maxHeight: classHeight,
            }}
          >
            {docClassEditor}
          </div>
        </div>
      </div>
    );
  }
}
