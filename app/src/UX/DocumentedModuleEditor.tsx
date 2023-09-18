import { Component } from "react";
import IFileProps from "./IFileProps";
import IFile from "../storage/IFile";
import "./DocumentedModuleEditor.css";
import DocumentedClass from "../minecraft/docs/DocumentedClass";
import DocumentedModule from "../minecraft/docs/DocumentedModule";
import IPersistable from "./IPersistable";
import DataForm from "../dataform/DataForm";
import Database from "../minecraft/Database";
import Project from "../app/Project";
import { List, ListProps, ThemeInput, Toolbar } from "@fluentui/react-northstar";
import DocumentedClassEditor from "./DocumentedClassEditor";
import { CustomTabLabel, UnassociatedDocumentationLabel } from "./Labels";
import WebUtilities from "./WebUtilities";
import FileExplorer from "./FileExplorer";
import Carto from "../app/Carto";
import ItemAnnotationCollection from "./ItemAnnotationCollection";
import ItemAnnotation from "./ItemAnnotation";
import { ItemAnnotationType } from "./ItemAnnotation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPenToSquare } from "@fortawesome/free-regular-svg-icons";
import { faCode } from "@fortawesome/free-solid-svg-icons";
import DocumentedScriptEnum from "../minecraft/docs/DocumentedScriptEnum";
import DocumentedScriptEnumEditor from "./DocumentedScriptEnumEditor";

interface IDocumentedModuleEditorProps extends IFileProps {
  heightOffset: number;
  theme: ThemeInput<any>;
  typesReadOnly: boolean;
  docsReadOnly: boolean;
  carto: Carto;
  project: Project;
}

interface IDocumentedModuleEditorState {
  fileToEdit: IFile;
  selectedClass?: DocumentedClass;
  selectedEnum?: DocumentedScriptEnum;
  isLoaded: boolean;
  mode: ModuleEditorMode;
  fileAnnotations?: ItemAnnotationCollection;
}

export enum ModuleEditorMode {
  types = 0,
  typesNeedingEdits = 1,
  unassociatedDocs = 2,
}

export default class DocumentedModuleEditor
  extends Component<IDocumentedModuleEditorProps, IDocumentedModuleEditorState>
  implements IPersistable
{
  constructor(props: IDocumentedModuleEditorProps) {
    super(props);

    this._handleDocumentedModuleLoaded = this._handleDocumentedModuleLoaded.bind(this);
    this._handleClassSelected = this._handleClassSelected.bind(this);
    this._handleDocumentedClassUpdate = this._handleDocumentedClassUpdate.bind(this);
    this._handleDocumentedScriptEnumUpdate = this._handleDocumentedScriptEnumUpdate.bind(this);

    this._setUnassociatedDocsMode = this._setUnassociatedDocsMode.bind(this);
    this._setTypesNeedingEditsMode = this._setTypesNeedingEditsMode.bind(this);
    this._setTypesMode = this._setTypesMode.bind(this);
  }

  static getDerivedStateFromProps(props: IDocumentedModuleEditorProps, state: IDocumentedModuleEditorState) {
    if (state === undefined || state === null) {
      state = {
        fileToEdit: props.file,
        isLoaded: false,
        mode: ModuleEditorMode.types,
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

  componentDidUpdate(prevProps: IDocumentedModuleEditorProps, prevState: IDocumentedModuleEditorState) {
    this._updateManager();
  }

  async _updateManager() {
    if (this.state !== undefined && this.state.fileToEdit !== undefined) {
      if (!this.state.isLoaded) {
        if (Database.uxCatalog === null) {
          await Database.loadUx();
        }

        await this.props.project.inferProjectItemsFromFiles();

        const docsFolder = await this.props.project.ensureDocsFolder();

        await DocumentedModule.ensureOnFile(this.state.fileToEdit, docsFolder, this._handleDocumentedModuleLoaded);

        this._handleDocumentedModuleLoaded();
      }
    }
  }

  _handleDocumentedModuleLoaded() {
    this.setState({
      fileToEdit: this.state.fileToEdit,
      isLoaded: true,
      selectedClass: undefined,
      selectedEnum: undefined,
      mode: this.state.mode,
    });

    this.startAsyncLoad();
  }

  async startAsyncLoad() {
    const dm = this.state.fileToEdit.manager as DocumentedModule;

    if (dm) {
      dm.associateParentClasses();

      for (const docClassName in dm.classes) {
        const docClass = dm.classes[docClassName];

        await docClass.load();

        if (docClass.undocumentedCount > 0) {
          this.forceUpdate();
        }
      }

      for (const docEnumName in dm.enums) {
        const docEnum = dm.enums[docEnumName];

        await docEnum.load();

        if (docEnum.undocumentedCount > 0) {
          this.forceUpdate();
        }
      }

      await dm.loadUnassociatedDocumentation();
    }
  }

  async _doUpdate() {
    if (Database.uxCatalog === null) {
      await Database.loadUx();

      this.forceUpdate();
    }
  }

  async persist() {
    if (this.state !== undefined && this.state.fileToEdit != null) {
      const file = this.state.fileToEdit;

      if (file.manager) {
        const dm = file.manager as DocumentedModule;

        await dm.persist();
      }
    }
  }

  _handleClassSelected(elt: any, event: ListProps | undefined) {
    if (
      event === undefined ||
      event.selectedIndex === undefined ||
      this.state == null ||
      this.state.fileToEdit === undefined ||
      this.state.fileToEdit.manager === undefined
    ) {
      return;
    }

    const dm = this.state.fileToEdit.manager as DocumentedModule;
    const classListing = this.getClassListing(this.state.mode === ModuleEditorMode.typesNeedingEdits);

    const key = classListing[event.selectedIndex].key;

    if (key) {
      const selectedClass = dm.classes[key];
      const selectedEnum = dm.enums[key];
      if (selectedClass) {
        this.setState({
          fileToEdit: this.state.fileToEdit,
          isLoaded: this.state.isLoaded,
          selectedEnum: undefined,
          selectedClass: selectedClass,
          mode: this.state.mode,
        });
      } else if (selectedEnum) {
        this.setState({
          fileToEdit: this.state.fileToEdit,
          isLoaded: this.state.isLoaded,
          selectedEnum: selectedEnum,
          selectedClass: undefined,
          mode: this.state.mode,
        });
      }
    }
  }

  getClassListing(filterOnTypesNeedingEdits: boolean) {
    const classListing = [];

    const dm = this.state.fileToEdit.manager as DocumentedModule;

    const classes = dm.classes;

    for (const className in classes) {
      const docClass = classes[className];

      let header = docClass.id;
      let media = <div>&#160;</div>;

      if (docClass.undocumentedCount > 0) {
        header += " (" + docClass.undocumentedCount + ")";
        media = (
          <div className="dme-incompleteItem">
            <FontAwesomeIcon icon={faPenToSquare} className="fa-lg" />
          </div>
        );
      }

      if (!filterOnTypesNeedingEdits || docClass.undocumentedCount > 0) {
        classListing.push({
          key: docClass.id,
          media: media,
          header: header,
        });
      }
    }

    const enums = dm.enums;

    for (const enumName in enums) {
      const docEnum = enums[enumName];

      let header = docEnum.id;
      let media = <div>&#160;</div>;

      if (docEnum.undocumentedCount > 0) {
        header += " (" + docEnum.undocumentedCount + ")";
        media = (
          <div className="dme-incompleteItem">
            <FontAwesomeIcon icon={faPenToSquare} className="fa-lg" />
          </div>
        );
      }

      if (!filterOnTypesNeedingEdits || docEnum.undocumentedCount > 0) {
        classListing.push({
          key: docEnum.id,
          media: media,
          header: header,
        });
      }
    }

    return classListing;
  }

  _handleDocumentedClassUpdate(docClass: DocumentedClass) {
    this.forceUpdate();
  }

  _handleDocumentedScriptEnumUpdate(docEnum: DocumentedScriptEnum) {
    this.forceUpdate();
  }

  _setTypesMode() {
    this.setState({
      fileToEdit: this.state.fileToEdit,
      selectedClass: this.state.selectedClass,
      selectedEnum: this.state.selectedEnum,
      isLoaded: this.state.isLoaded,
      mode: ModuleEditorMode.types,
    });
  }

  _setTypesNeedingEditsMode() {
    this.setState({
      fileToEdit: this.state.fileToEdit,
      selectedClass: this.state.selectedClass,
      selectedEnum: this.state.selectedEnum,
      isLoaded: this.state.isLoaded,
      mode: ModuleEditorMode.typesNeedingEdits,
    });
  }

  _setUnassociatedDocsMode() {
    this.setState({
      fileToEdit: this.state.fileToEdit,
      selectedClass: this.state.selectedClass,
      selectedEnum: this.state.selectedEnum,
      isLoaded: this.state.isLoaded,
      mode: ModuleEditorMode.unassociatedDocs,
    });

    this.loadAssociatedDocs();
  }

  async loadAssociatedDocs() {
    const dm = this.state.fileToEdit.manager as DocumentedModule;
    dm.associateParentClasses();
    await dm.loadUnassociatedDocumentation(false);

    const unassociatedFiles = dm.unassociatedInfoJsonFiles;

    const itemAnnotations: ItemAnnotationCollection = {};

    for (const filePath in unassociatedFiles) {
      const file = unassociatedFiles[filePath];

      if (file) {
        const itemAnnotationColl: ItemAnnotation[] = [];

        itemAnnotationColl.push({
          path: filePath,
          type: ItemAnnotationType.error,
          message: filePath + " is not associated with this module.",
        });

        itemAnnotations[file.storageRelativePath] = itemAnnotationColl;
      }
    }

    this.setState({
      fileToEdit: this.state.fileToEdit,
      selectedClass: this.state.selectedClass,
      selectedEnum: this.state.selectedEnum,
      isLoaded: this.state.isLoaded,
      mode: this.state.mode,
      fileAnnotations: itemAnnotations,
    });
  }

  render() {
    const height = "calc(100vh - " + String(this.props.heightOffset) + "px)";
    const classHeight = "calc(100vh - " + String(this.props.heightOffset + 180) + "px)";
    const toolbarItems = [];
    let isButtonCompact = false;
    const width = WebUtilities.getWidth();
    let interior = <></>;

    if (width < 1016) {
      isButtonCompact = true;
    }

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

    const filteredClassListing = this.getClassListing(true);
    const allClassListing = this.getClassListing(false);

    let classListing = filteredClassListing;

    if (this.state.mode !== ModuleEditorMode.typesNeedingEdits) {
      classListing = allClassListing;
    }

    toolbarItems.push({
      icon: (
        <CustomTabLabel
          icon={<FontAwesomeIcon icon={faCode} className="fa-lg" />}
          text={"All Types (" + allClassListing.length + ")"}
          isCompact={isButtonCompact}
          isSelected={this.state.mode === ModuleEditorMode.types}
          theme={this.props.theme}
        />
      ),
      key: "typesMode",
      onClick: this._setTypesMode,
      title: "Edit documentation by types",
    });

    toolbarItems.push({
      icon: (
        <CustomTabLabel
          icon={<FontAwesomeIcon icon={faPenToSquare} className="fa-lg" />}
          text={"Needs Edits (" + filteredClassListing.length + ")"}
          isCompact={isButtonCompact}
          isSelected={this.state.mode === ModuleEditorMode.typesNeedingEdits}
          theme={this.props.theme}
        />
      ),
      key: "typesNeedingEditsMode",
      onClick: this._setTypesNeedingEditsMode,
      title: "Edit documentation by types that need edits",
    });

    toolbarItems.push({
      icon: (
        <UnassociatedDocumentationLabel
          isCompact={isButtonCompact}
          isSelected={this.state.mode === ModuleEditorMode.unassociatedDocs}
          theme={this.props.theme}
        />
      ),
      key: "unassociatedDocsMode",
      onClick: this._setUnassociatedDocsMode,
      title: "Remove or associate documentation that might be abandoned",
    });

    if (this.props.setActivePersistable !== undefined) {
      this.props.setActivePersistable(this);
    }

    const dm = this.state.fileToEdit.manager as DocumentedModule;
    const form = Database.uxCatalog.documentedModule;

    let docItemEditor = <div>&#160;</div>;

    if (this.state.mode === ModuleEditorMode.unassociatedDocs) {
      interior = (
        <FileExplorer
          rootFolder={dm.docFolder}
          theme={this.props.theme}
          carto={this.props.carto}
          itemAnnotations={this.state.fileAnnotations}
          heightOffset={this.props.heightOffset + 225}
          readOnly={false}
        />
      );
    } else {
      if (this.state.selectedClass) {
        docItemEditor = (
          <DocumentedClassEditor
            heightOffset={this.props.heightOffset + 190}
            carto={this.props.carto}
            theme={this.props.theme}
            onDocumentedClassUpdate={this._handleDocumentedClassUpdate}
            typesReadOnly={this.props.typesReadOnly}
            docsReadOnly={this.props.docsReadOnly}
            project={this.props.project}
            file={this.props.file}
            docClass={this.state.selectedClass}
          />
        );
      } else if (this.state.selectedEnum) {
        docItemEditor = (
          <DocumentedScriptEnumEditor
            heightOffset={this.props.heightOffset + 190}
            carto={this.props.carto}
            theme={this.props.theme}
            onDocumentedScriptEnumUpdate={this._handleDocumentedScriptEnumUpdate}
            typesReadOnly={this.props.typesReadOnly}
            docsReadOnly={this.props.docsReadOnly}
            project={this.props.project}
            file={this.props.file}
            docScriptEnum={this.state.selectedEnum}
          />
        );
      }

      interior = (
        <div
          className="dme-classEditorOuter"
          style={{
            backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background2,
            color: this.props.theme.siteVariables?.colorScheme.brand.foreground2,
          }}
        >
          <div
            className="dme-classList"
            style={{
              minHeight: classHeight,
              maxHeight: classHeight,
            }}
          >
            <List
              selectable
              defaultSelectedIndex={-1}
              items={classListing}
              onSelectedIndexChange={this._handleClassSelected}
            />
          </div>
          <div
            className="dme-classEditor"
            style={{
              minHeight: classHeight,
              maxHeight: classHeight,
            }}
          >
            {docItemEditor}
          </div>
        </div>
      );
    }

    return (
      <div
        className="dme-area"
        style={{
          minHeight: height,
          maxHeight: height,
          backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
          color: this.props.theme.siteVariables?.colorScheme.brand.foreground1,
        }}
      >
        <div className="dme-header">
          {dm.name} version {dm.version}
        </div>

        <div className="dme-moduleProps">
          <DataForm
            definition={form}
            directObject={dm}
            objectKey={dm.id}
            readOnly={this.props.typesReadOnly}
          ></DataForm>
          <Toolbar aria-label="Actions toolbar overflow menu" items={toolbarItems} />
        </div>
        {interior}
      </div>
    );
  }
}
