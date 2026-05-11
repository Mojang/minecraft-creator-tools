import { Component } from "react";
import IFileProps from "../../project/fileExplorer/IFileProps";
import IFile from "../../../storage/IFile";
import "./DocumentedModuleEditor.css";
import DocumentedClass from "../../../minecraft/docs/DocumentedClass";
import DocumentedModule from "../../../minecraft/docs/DocumentedModule";
import DataForm from "../../../dataformux/DataForm";
import Database from "../../../minecraft/Database";
import Project from "../../../app/Project";
import { List, ListItemButton, ListItemText, Stack, Button } from "@mui/material";
import { McSelectableListItem } from "../../shared/components/inputs/mcSelectableList/McSelectableList";
import DocumentedClassEditor from "./DocumentedClassEditor";
import { CustomTabLabel, UnassociatedDocumentationLabel } from "../../shared/components/feedback/labels/Labels";
import WebUtilities from "../../utils/WebUtilities";
import FileExplorer, { FileExplorerMode } from "../../project/fileExplorer/FileExplorer";
import CreatorTools from "../../../app/CreatorTools";
import ItemAnnotationCollection from "../../types/ItemAnnotationCollection";
import ItemAnnotation from "../../types/ItemAnnotation";
import { ItemAnnotationType } from "../../types/ItemAnnotation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPenToSquare } from "@fortawesome/free-regular-svg-icons";
import { faCode } from "@fortawesome/free-solid-svg-icons";
import DocumentedScriptEnum from "../../../minecraft/docs/DocumentedScriptEnum";
import DocumentedScriptEnumEditor from "./DocumentedScriptEnumEditor";
import { getThemeColors } from "../../hooks/theme/useThemeColors";
import IProjectTheme from "../../types/IProjectTheme";
import { WithLocalizationProps, withLocalization } from "../../withLocalization";

interface IDocumentedModuleEditorProps extends IFileProps, WithLocalizationProps {
  heightOffset: number;
  theme: IProjectTheme;
  typesReadOnly: boolean;
  docsReadOnly: boolean;
  creatorTools: CreatorTools;
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

class DocumentedModuleEditor extends Component<
  IDocumentedModuleEditorProps,
  IDocumentedModuleEditorState
> {
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
        await this.props.project.inferProjectItemsFromFiles();

        await Database.ensureFormLoaded("documentation", "module");

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

  async persist(): Promise<boolean> {
    if (this.state !== undefined && this.state.fileToEdit != null) {
      const file = this.state.fileToEdit;

      if (file.manager) {
        const dm = file.manager as DocumentedModule;

        return await dm.persist();
      }
    }

    return false;
  }

  _handleClassSelected(index: number, item: McSelectableListItem) {
    if (
      index === undefined ||
      this.state == null ||
      this.state.fileToEdit === undefined ||
      this.state.fileToEdit.manager === undefined
    ) {
      return;
    }

    const dm = this.state.fileToEdit.manager as DocumentedModule;
    const classListing = this.getClassListing(this.state.mode === ModuleEditorMode.typesNeedingEdits);

    const key = classListing[index].key;

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

      let nodeTitle = docClass.id;
      let media = <div>&#160;</div>;

      if (docClass.undocumentedCount > 0) {
        nodeTitle += " (" + docClass.undocumentedCount + ")";
        media = (
          <div className="dme-incompleteItem">
            <FontAwesomeIcon icon={faPenToSquare} className="fa-lg" />
          </div>
        );
      }

      const contentNode = <div title={docClass.id}>{nodeTitle}</div>;

      if (!filterOnTypesNeedingEdits || docClass.undocumentedCount > 0) {
        classListing.push({
          key: docClass.id ?? className,
          icon: media,
          content: contentNode,
        });
      }
    }

    const enums = dm.enums;

    for (const enumName in enums) {
      const docEnum = enums[enumName];

      let nodeTitle = docEnum.id;
      let media = <div>&#160;</div>;

      if (docEnum.undocumentedCount > 0) {
        nodeTitle += " (" + docEnum.undocumentedCount + ")";
        media = (
          <div className="dme-incompleteItem">
            <FontAwesomeIcon icon={faPenToSquare} className="fa-lg" />
          </div>
        );
      }

      const contentNode = <div title={docEnum.id}>{nodeTitle}</div>;

      if (!filterOnTypesNeedingEdits || docEnum.undocumentedCount > 0) {
        classListing.push({
          key: docEnum.id ?? enumName,
          icon: media,
          content: contentNode,
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
          message: filePath + this.props.intl.formatMessage({ id: "project_editor.doc_module.not_associated" }),
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
    const classHeight = "calc(100vh - " + String(this.props.heightOffset + 186) + "px)";
    let isButtonCompact = false;
    const width = WebUtilities.getWidth();
    let interior = <></>;
    const colors = getThemeColors();

    if (width < 1016) {
      isButtonCompact = true;
    }

    if (this.state === null || this.state.fileToEdit === null || this.state.fileToEdit.manager === undefined) {
      if (this.state.fileToEdit !== null) {
        if (this.state.fileToEdit.manager === undefined) {
          this._updateManager();
        }
      }

      return <div>{this.props.intl.formatMessage({ id: "project_editor.doc_module.loading" })}</div>;
    }

    const filteredClassListing = this.getClassListing(true);
    const allClassListing = this.getClassListing(false);

    let classListing = filteredClassListing;

    if (this.state.mode !== ModuleEditorMode.typesNeedingEdits) {
      classListing = allClassListing;
    }

    if (this.props.setActivePersistable !== undefined) {
      this.props.setActivePersistable(this);
    }

    const dm = this.state.fileToEdit.manager as DocumentedModule;
    const form = Database.getForm("documentation", "module");

    let docItemEditor = <div>&#160;</div>;

    if (this.state.mode === ModuleEditorMode.unassociatedDocs) {
      interior = (
        <FileExplorer
          rootFolder={dm.docFolder}
          theme={this.props.theme}
          creatorTools={this.props.creatorTools}
          selectedItem={undefined}
          mode={FileExplorerMode.explorer}
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
            creatorTools={this.props.creatorTools}
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
            creatorTools={this.props.creatorTools}
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
            backgroundColor: colors.sectionHeaderBackground,
            color: colors.sectionHeaderForeground,
          }}
        >
          <div
            className="dme-classList"
            style={{
              minHeight: classHeight,
              maxHeight: classHeight,
            }}
          >
            <List aria-label={this.props.intl.formatMessage({ id: "project_editor.doc_module.class_list_aria" })}>
              {classListing.map((item, index) => (
                <ListItemButton key={item.key} onClick={() => this._handleClassSelected(index, item)}>
                  {item.icon}
                  <ListItemText primary={item.content} />
                </ListItemButton>
              ))}
            </List>
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

    if (!form) {
      return <div>{this.props.intl.formatMessage({ id: "project_editor.doc_module.error_loading" })}</div>;
    }

    return (
      <div
        className="dme-area"
        style={{
          minHeight: height,
          maxHeight: height,
          backgroundColor: colors.contentBackground,
          color: colors.contentForeground,
        }}
      >
        <div className="dme-header">
          {dm.name}{this.props.intl.formatMessage({ id: "project_editor.doc_module.version_separator" })}{dm.version}
        </div>

        <div className="dme-moduleProps">
          <DataForm
            definition={form}
            directObject={dm}
            objectKey={dm.id}
            theme={this.props.theme}
            readOnly={this.props.typesReadOnly}
          ></DataForm>
            <Stack direction="row" spacing={0.5} aria-label={this.props.intl.formatMessage({ id: "project_editor.doc_module.actions_aria" })}>
            <Button onClick={this._setTypesMode} title={this.props.intl.formatMessage({ id: "project_editor.doc_module.edit_by_types_title" })}>
              <CustomTabLabel
                icon={<FontAwesomeIcon icon={faCode} className="fa-lg" />}
                text={this.props.intl.formatMessage({ id: "project_editor.doc_module.all_types_tab" }) + allClassListing.length + ")"}
                isCompact={isButtonCompact}
                isSelected={this.state.mode === ModuleEditorMode.types}
                theme={this.props.theme}
              />
            </Button>
            <Button onClick={this._setTypesNeedingEditsMode} title={this.props.intl.formatMessage({ id: "project_editor.doc_module.edit_by_need_edits_title" })}>
              <CustomTabLabel
                icon={<FontAwesomeIcon icon={faPenToSquare} className="fa-lg" />}
                text={this.props.intl.formatMessage({ id: "project_editor.doc_module.needs_edits_tab" }) + filteredClassListing.length + ")"}
                isCompact={isButtonCompact}
                isSelected={this.state.mode === ModuleEditorMode.typesNeedingEdits}
                theme={this.props.theme}
              />
            </Button>
            <Button
              onClick={this._setUnassociatedDocsMode}
              title={this.props.intl.formatMessage({ id: "project_editor.doc_module.unassociated_docs_title" })}
            >
              <UnassociatedDocumentationLabel
                isCompact={isButtonCompact}
                isSelected={this.state.mode === ModuleEditorMode.unassociatedDocs}
                theme={this.props.theme}
              />
            </Button>
          </Stack>
        </div>
        {interior}
      </div>
    );
  }
}

export default withLocalization(DocumentedModuleEditor);
