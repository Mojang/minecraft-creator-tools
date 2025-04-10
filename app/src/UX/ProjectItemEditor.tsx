import { Component, SyntheticEvent } from "react";
import IAppProps from "./IAppProps";
import Project from "./../app/Project";
import ProjectItem from "./../app/ProjectItem";
import JavaScriptEditor, { ScriptEditorRole } from "./JavaScriptEditor";
import JsonEditor from "./JsonEditor";
import FunctionEditor from "./FunctionEditor";
import Log from "./../core/Log";

import IPersistable from "./IPersistable";
import { ProjectItemCreationType, ProjectItemStorageType, ProjectItemType } from "../app/IProjectItemData";
import IGitHubInfo from "../app/IGitHubInfo";
import GitHubReferenceEditor from "./GitHubReferenceEditor";

import "./ProjectItemEditor.css";
import { Dropdown, DropdownProps, ThemeInput, Toolbar } from "@fluentui/react-northstar";
import { ProjectEditPreference, ProjectScriptLanguage } from "../app/IProjectData";
import DocumentedModuleEditor from "./DocumentedModuleEditor";
import DocumentedCommandSetEditor from "./DocumentedCommandSetEditor";
import Utilities from "../core/Utilities";
import CartoApp, { HostType } from "../app/CartoApp";
import TextEditor from "./TextEditor";
import NpmPackageEditor from "./NpmPackageEditor";
import BehaviorPackManifestJsonEditor from "./BehaviorPackManifestJsonEditor";
import DataFormEditor from "./DataFormEditor";
import ProjectItemUtilities, { FormMappings } from "../app/ProjectItemUtilities";
import ProjectInfoDisplay from "./ProjectInfoDisplay";
import EntityTypeEditor from "./EntityTypeEditor";
import SpawnRulesEditor from "./SpawnRulesEditor";
import LootTableEditor from "./LootTableEditor";
import EntityTypeResourceEditor from "./EntityTypeResourceEditor";
import BlockTypeEditor from "./BlockTypeEditor";
import AudioManager from "./AudioManager";
import ItemTypeEditor from "./ItemTypeEditor";
import GeneralFormEditor from "./GeneralFormEditor";
import ProjectItemVariant from "../app/ProjectItemVariant";
import { CustomTabLabel } from "./Labels";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import IFile from "../storage/IFile";
import { faFile } from "@fortawesome/free-regular-svg-icons";
import ImageEditor from "./ImageEditor";

enum ProjectItemEditorDirtyState {
  clean = 0,
  editorDirty = 1,
  itemDirty = 2,
}

enum ProjectItemEditorView {
  singleFile = 0,
  diff = 1,
}

interface IProjectItemEditorProps extends IAppProps {
  project: Project;
  theme: ThemeInput<any>;
  heightOffset: number;
  forceRawView: boolean;
  activeVariant?: string;
  visualSeed?: number;
  activeProjectItem: ProjectItem | null;
  activeReference: IGitHubInfo | null;
  readOnly: boolean;
  onVariantChangeRequested?: (newVariant: string | undefined) => void;
  setActivePersistable?: (persistObject: IPersistable) => void;
}

interface IProjectItemEditorState {
  dirtyState: ProjectItemEditorDirtyState;
  loadedItem: ProjectItem | null;
  activeView?: ProjectItemEditorView;
  activeViewTarget?: string;
}

export default class ProjectItemEditor extends Component<IProjectItemEditorProps, IProjectItemEditorState> {
  private _activeEditorPersistable?: IPersistable;
  private _isMountedInternal = false;

  constructor(props: IProjectItemEditorProps) {
    super(props);

    this._handleItemLoaded = this._handleItemLoaded.bind(this);
    this.persist = this.persist.bind(this);
    this._handleNewChildPersistable = this._handleNewChildPersistable.bind(this);
    this._onUpdatePreferredTextSize = this._onUpdatePreferredTextSize.bind(this);
    this._updateFromProps = this._updateFromProps.bind(this);
    this._handleVariantButton = this._handleVariantButton.bind(this);
    this._handleDefaultVariant = this._handleDefaultVariant.bind(this);
    this._handleDrodownValChange = this._handleDrodownValChange.bind(this);

    if (this.props.activeProjectItem && this.props.activeProjectItem.isLoaded) {
      this.state = {
        dirtyState: ProjectItemEditorDirtyState.clean,
        loadedItem: this.props.activeProjectItem,
      };
    } else {
      this.state = {
        dirtyState: ProjectItemEditorDirtyState.clean,
        loadedItem: null,
      };

      this._updateFromProps();
    }
  }

  componentDidUpdate(prevProps: IProjectItemEditorProps, prevState: IProjectItemEditorState) {
    this._updateFromProps();
  }

  private async _updateFromProps() {
    if (this.props.activeProjectItem !== null && this.props.activeProjectItem !== undefined) {
      if (!this.props.activeProjectItem.isLoaded) {
        this.props.activeProjectItem.onLoaded.subscribe(this._handleItemLoaded);

        await this.props.activeProjectItem.load();
        this._handleItemLoaded(this.props.activeProjectItem);
      } else {
        if (!this.state.loadedItem) {
          this._handleItemLoaded(this.props.activeProjectItem);
        }
      }
    }
  }

  _handleItemLoaded(source: ProjectItem) {
    if (
      this.props != null &&
      source === this.props.activeProjectItem &&
      this._isMountedInternal &&
      source !== this.state?.loadedItem
    ) {
      this.setState({
        dirtyState: this.state.dirtyState,
        loadedItem: source,
      });
    }
  }

  _handleNewChildPersistable(newPersistable: IPersistable) {
    this._activeEditorPersistable = newPersistable;
  }

  async persist() {
    if (this._activeEditorPersistable !== undefined) {
      await this._activeEditorPersistable.persist();
    }
  }

  componentDidMount() {
    this._isMountedInternal = true;
  }

  componentWillUnmount(): void {
    this._isMountedInternal = false;
  }

  getActiveProjectItemName() {
    if (this.props.activeProjectItem === null || this.props.activeProjectItem === undefined) {
      return "(no project item selected)";
    } else {
      return this.props.activeProjectItem.projectPath;
    }
  }

  _onUpdatePreferredTextSize(newTextSize: number) {
    this.props.carto.preferredTextSize = newTextSize;
  }

  _handleDefaultVariant(ev: SyntheticEvent<HTMLElement, Event>, data: any) {
    if (this.props.onVariantChangeRequested) {
      this.props.onVariantChangeRequested(undefined);
    }
  }

  _handleVariantButton(ev: SyntheticEvent<HTMLElement, Event>, data: any) {
    if (this.props.onVariantChangeRequested) {
      if (data.title !== undefined) {
        this.props.onVariantChangeRequested(data.title);
      }
    }
  }

  _handleDrodownValChange(event: React.MouseEvent<Element> | React.KeyboardEvent<Element> | null, data: DropdownProps) {
    if (data.value && typeof data.value === "string") {
      let fromIndex = data.value.indexOf("from ");

      if (data.value === "Single view") {
        this.setState({
          dirtyState: this.state.dirtyState,
          loadedItem: this.state.loadedItem,
          activeView: ProjectItemEditorView.singleFile,
          activeViewTarget: undefined,
        });
      } else if (fromIndex > 0) {
        const variant = data.value.substring(fromIndex + 5);

        if (variant !== undefined && data.value.startsWith("Diff from")) {
          this.setState({
            dirtyState: this.state.dirtyState,
            loadedItem: this.state.loadedItem,
            activeView: ProjectItemEditorView.diff,
            activeViewTarget: variant,
          });
        }
      }
    }
  }

  render() {
    let descrip = "No project item selected";
    let file: IFile | null = null;

    if (this.props.activeProjectItem) {
      descrip =
        ProjectItemUtilities.getDescriptionForType(this.props.activeProjectItem.itemType) +
        " - " +
        (this.props.activeProjectItem.projectPath ? this.props.activeProjectItem.projectPath + " " : "");

      if (this.props.activeProjectItem.storageType === ProjectItemStorageType.singleFile) {
        file = this.props.activeProjectItem.getFile(this.props.activeVariant);
        if (!file) {
          if (this.props.activeVariant === undefined || this.props.activeVariant === "") {
            descrip += " - No default file. Please select a variant if one exists.";
          } else {
            descrip += " - No file for variant `" + this.props.activeVariant + "`.";
          }
        } else if (file.isContentLoaded) {
          if (file.content === null) {
            descrip += " - no default content.";
          } else {
            descrip += " - loaded.";
          }
        }
      }
    }

    let interior = <div className="pie-loadingLabel">{descrip}</div>;

    let readOnly = this.props.readOnly;
    let heightOffset = this.props.heightOffset;
    let variantList: ProjectItemVariant[] = [];

    if (this.props.activeReference !== null) {
      interior = (
        <GitHubReferenceEditor
          preferredTextSize={this.props.carto.preferredTextSize}
          project={this.props.project}
          readOnly={readOnly}
          carto={this.props.carto}
          reference={this.props.activeReference}
          heightOffset={heightOffset}
        />
      );
    } else if (this.props.activeProjectItem != null) {
      const ep = this.props.activeProjectItem.effectiveEditPreference;

      if (this.props.activeProjectItem.hasNonDefaultVariant()) {
        heightOffset += 40;
      }

      if (
        this.props.activeProjectItem.creationType !== ProjectItemCreationType.normal &&
        this.props.activeProjectItem.creationType !== undefined
      ) {
        readOnly = true;
      }

      if (file !== null && file.isContentLoaded && file.content !== null) {
        if (this.props.setActivePersistable !== undefined) {
          this.props.setActivePersistable(this);
        }

        const projItem = this.props.activeProjectItem;
        const showRaw =
          this.props.forceRawView ||
          ep === ProjectEditPreference.raw ||
          file.isInErrorState ||
          this.state.activeView === ProjectItemEditorView.diff;

        const formCategoryData = FormMappings["" + projItem.itemType];

        if (file.type === "js" || file.type === "ts" || file.type === "mjs") {
          let pref = this.props.project.preferredScriptLanguage;

          if (file.type === "ts") {
            pref = ProjectScriptLanguage.typeScript;
          }

          // Log.verbose("Showing JavaScript editor for '" + file.fullPath + "' size: " + file.content?.length);

          let role = ScriptEditorRole.script;

          if (projItem.itemType === ProjectItemType.testJs) {
            role = ScriptEditorRole.gameTest;
          }

          // because electron doesn't work in debug electron due to odd pathing reasons, use a text editor instead
          if (Utilities.isDebug && CartoApp.hostType === HostType.electronWeb) {
            interior = (
              <TextEditor
                theme={this.props.theme}
                onUpdatePreferredTextSize={this._onUpdatePreferredTextSize}
                preferredTextSize={this.props.carto.preferredTextSize}
                readOnly={readOnly}
                carto={this.props.carto}
                heightOffset={heightOffset}
                file={file}
                setActivePersistable={this._handleNewChildPersistable}
              />
            );
          } else {
            interior = (
              <JavaScriptEditor
                role={role}
                carto={this.props.carto}
                theme={this.props.theme}
                onUpdatePreferredTextSize={this._onUpdatePreferredTextSize}
                preferredTextSize={this.props.carto.preferredTextSize}
                readOnly={readOnly}
                project={this.props.project}
                scriptLanguage={pref}
                heightOffset={heightOffset}
                file={file}
                setActivePersistable={this._handleNewChildPersistable}
              />
            );
          }
        } else if (file.type === "mcfunction") {
          Log.verbose("Showing MCFunction editor for '" + file.storageRelativePath + "'");
          // because electron doesn't work in debug electron due to odd pathing reasons, use a text editor instead
          if (Utilities.isDebug && CartoApp.hostType === HostType.electronWeb) {
            interior = (
              <TextEditor
                theme={this.props.theme}
                onUpdatePreferredTextSize={this._onUpdatePreferredTextSize}
                preferredTextSize={this.props.carto.preferredTextSize}
                readOnly={readOnly}
                carto={this.props.carto}
                heightOffset={heightOffset}
                file={file}
                setActivePersistable={this._handleNewChildPersistable}
              />
            );
          } else {
            interior = (
              <FunctionEditor
                theme={this.props.theme}
                carto={this.props.carto}
                project={this.props.project}
                roleId={"itemEditor"}
                isCommandEditor={false}
                onUpdatePreferredTextSize={this._onUpdatePreferredTextSize}
                preferredTextSize={this.props.carto.preferredTextSize}
                readOnly={this.props.readOnly}
                heightOffset={heightOffset}
                file={file}
                setActivePersistable={this._handleNewChildPersistable}
              />
            );
          }
        } else if (file.type === "png" || file.type === "jpg" || file.type === "jpeg" || file.type === "tga") {
          interior = (
            <ImageEditor
              readOnly={this.props.readOnly}
              heightOffset={heightOffset}
              visualSeed={this.props.visualSeed}
              carto={this.props.carto}
              theme={this.props.theme}
              file={file}
              setActivePersistable={this._handleNewChildPersistable}
            />
          );
        } else if (file.type === "mp3" || file.type === "ogg" || file.type === "wav") {
          interior = (
            <AudioManager
              readOnly={this.props.readOnly}
              heightOffset={heightOffset}
              visualSeed={this.props.visualSeed}
              carto={this.props.carto}
              project={this.props.project}
              theme={this.props.theme}
              file={file}
              setActivePersistable={this._handleNewChildPersistable}
            />
          );
        } else if (file.type === "json" && projItem.itemType === ProjectItemType.entityTypeBehavior && !showRaw) {
          interior = (
            <EntityTypeEditor
              project={this.props.project}
              carto={this.props.carto}
              readOnly={this.props.readOnly}
              heightOffset={heightOffset}
              theme={this.props.theme}
              file={file}
              item={this.props.activeProjectItem}
              setActivePersistable={this._handleNewChildPersistable}
            />
          );
        } else if (file.type === "json" && projItem.itemType === ProjectItemType.blockTypeBehavior && !showRaw) {
          interior = (
            <BlockTypeEditor
              project={this.props.project}
              carto={this.props.carto}
              readOnly={this.props.readOnly}
              heightOffset={heightOffset}
              theme={this.props.theme}
              file={file}
              item={this.props.activeProjectItem}
              setActivePersistable={this._handleNewChildPersistable}
            />
          );
        } else if (file.type === "json" && projItem.itemType === ProjectItemType.itemTypeBehavior && !showRaw) {
          interior = (
            <ItemTypeEditor
              project={this.props.project}
              carto={this.props.carto}
              readOnly={this.props.readOnly}
              heightOffset={heightOffset}
              theme={this.props.theme}
              file={file}
              item={this.props.activeProjectItem}
              setActivePersistable={this._handleNewChildPersistable}
            />
          );
        } else if (file.type === "json" && projItem.itemType === ProjectItemType.scriptTypesJson && !showRaw) {
          interior = (
            <DocumentedModuleEditor
              carto={this.props.carto}
              theme={this.props.theme}
              typesReadOnly={true}
              docsReadOnly={this.props.readOnly}
              heightOffset={heightOffset}
              file={file}
              project={this.props.project}
              setActivePersistable={this._handleNewChildPersistable}
            />
          );
        } else if (file.type === "json" && projItem.itemType === ProjectItemType.packageJson && !showRaw) {
          interior = (
            <NpmPackageEditor
              theme={this.props.theme}
              heightOffset={heightOffset}
              project={this.props.project}
              file={file}
              readOnly={this.props.readOnly}
              setActivePersistable={this._handleNewChildPersistable}
            />
          );
        } else if (file.type === "json" && projItem.itemType === ProjectItemType.behaviorPackManifestJson && !showRaw) {
          interior = (
            <BehaviorPackManifestJsonEditor
              theme={this.props.theme}
              heightOffset={heightOffset}
              project={this.props.project}
              file={file}
              readOnly={this.props.readOnly}
              setActivePersistable={this._handleNewChildPersistable}
            />
          );
        } else if (file.type === "json" && projItem.itemType === ProjectItemType.spawnRuleBehavior && !showRaw) {
          interior = (
            <SpawnRulesEditor
              theme={this.props.theme}
              heightOffset={heightOffset}
              project={this.props.project}
              file={file}
              readOnly={this.props.readOnly}
              setActivePersistable={this._handleNewChildPersistable}
            />
          );
        } else if (file.type === "json" && projItem.itemType === ProjectItemType.lootTableBehavior && !showRaw) {
          interior = (
            <LootTableEditor
              theme={this.props.theme}
              heightOffset={heightOffset}
              project={this.props.project}
              file={file}
              readOnly={this.props.readOnly}
              setActivePersistable={this._handleNewChildPersistable}
            />
          );
        } else if (file.type === "json" && projItem.itemType === ProjectItemType.entityTypeResource && !showRaw) {
          interior = (
            <EntityTypeResourceEditor
              theme={this.props.theme}
              projectItem={this.props.activeProjectItem}
              heightOffset={heightOffset}
              project={this.props.project}
              file={file}
              readOnly={this.props.readOnly}
              setActivePersistable={this._handleNewChildPersistable}
            />
          );
        } else if (file.type === "json" && projItem.itemType === ProjectItemType.commandSetDefinitionJson && !showRaw) {
          interior = (
            <DocumentedCommandSetEditor
              carto={this.props.carto}
              theme={this.props.theme}
              typesReadOnly={true}
              docsReadOnly={this.props.readOnly}
              heightOffset={heightOffset}
              file={file}
              project={this.props.project}
              setActivePersistable={this._handleNewChildPersistable}
            />
          );
        } else if (
          file.type === "json" &&
          (projItem.itemType === ProjectItemType.contentIndexJson ||
            projItem.itemType === ProjectItemType.contentReportJson) &&
          !showRaw
        ) {
          interior = (
            <ProjectInfoDisplay
              carto={this.props.carto}
              theme={this.props.theme}
              heightOffset={heightOffset}
              file={file}
              project={this.props.project}
              allInfoSet={this.props.project.infoSet}
              allInfoSetGenerated={this.props.project.infoSet.completedGeneration}
            />
          );
        } else if (file.type === "json" && projItem.itemType === ProjectItemType.dataForm && !showRaw) {
          interior = (
            <DataFormEditor
              carto={this.props.carto}
              theme={this.props.theme}
              heightOffset={heightOffset}
              file={file}
              project={this.props.project}
              setActivePersistable={this._handleNewChildPersistable}
            />
          );
        } else if (file.type === "json" && formCategoryData && !showRaw) {
          interior = (
            <GeneralFormEditor
              project={this.props.project}
              readOnly={this.props.readOnly}
              heightOffset={heightOffset}
              theme={this.props.theme}
              file={file}
              formCategory={formCategoryData.formCategory}
              formName={formCategoryData.formName}
              select={formCategoryData.select}
              setActivePersistable={this._handleNewChildPersistable}
            />
          );
        } else if (
          file.type === "geometry" ||
          file.type === "vertex" ||
          file.type === "fragment" ||
          file.type === ".env"
        ) {
          interior = (
            <TextEditor
              theme={this.props.theme}
              onUpdatePreferredTextSize={this._onUpdatePreferredTextSize}
              preferredTextSize={this.props.carto.preferredTextSize}
              readOnly={readOnly}
              carto={this.props.carto}
              heightOffset={heightOffset}
              file={file}
              setActivePersistable={this._handleNewChildPersistable}
            />
          );
        } else if (file.type === "json" || file.type === "material") {
          // Log.verbose("Showing Json editor for '" + file.storageRelativePath + "'");

          // because electron doesn't work in debug electron due to odd pathing reasons, use a text editor instead
          if (Utilities.isDebug && CartoApp.hostType === HostType.electronWeb) {
            interior = (
              <TextEditor
                theme={this.props.theme}
                onUpdatePreferredTextSize={this._onUpdatePreferredTextSize}
                preferredTextSize={this.props.carto.preferredTextSize}
                readOnly={readOnly}
                carto={this.props.carto}
                heightOffset={heightOffset}
                file={file}
                setActivePersistable={this._handleNewChildPersistable}
              />
            );
          } else {
            if (
              this.state.activeView === ProjectItemEditorView.diff &&
              this.state.activeViewTarget &&
              this.props.activeProjectItem.getFile(this.state.activeViewTarget) !== null &&
              this.props.activeProjectItem.getFile(this.state.activeViewTarget)?.content
            ) {
              const diffFile = this.props.activeProjectItem.getFile(this.state.activeViewTarget);
              if (diffFile) {
                interior = (
                  <JsonEditor
                    theme={this.props.theme}
                    project={this.props.project}
                    onUpdatePreferredTextSize={this._onUpdatePreferredTextSize}
                    preferredTextSize={this.props.carto.preferredTextSize}
                    readOnly={readOnly}
                    item={this.props.activeProjectItem}
                    heightOffset={heightOffset}
                    file={diffFile}
                    isDiffEditor={true}
                    diffFile={file}
                    setActivePersistable={this._handleNewChildPersistable}
                  />
                );
              }
            } else {
              interior = (
                <JsonEditor
                  theme={this.props.theme}
                  project={this.props.project}
                  onUpdatePreferredTextSize={this._onUpdatePreferredTextSize}
                  preferredTextSize={this.props.carto.preferredTextSize}
                  readOnly={readOnly}
                  item={this.props.activeProjectItem}
                  heightOffset={heightOffset}
                  file={file}
                  setActivePersistable={this._handleNewChildPersistable}
                />
              );
            }
          }
        }
      }
    }

    if (this.props.activeProjectItem?.hasNonDefaultVariant) {
      variantList = this.props.activeProjectItem.getVariantList();
      const toolbarItems = [];
      const items: string[] = [];
      let dropdownVal = undefined;
      items.push("Single view");

      if (this.state.activeView === ProjectItemEditorView.singleFile || this.state.activeView === undefined) {
        dropdownVal = "Single view";
      }

      if (this.props.activeProjectItem.defaultFile) {
        toolbarItems.push({
          icon: (
            <CustomTabLabel
              theme={this.props.theme}
              isSelected={this.props.activeVariant === undefined || this.props.activeVariant === ""}
              icon={<FontAwesomeIcon icon={faFile} className="fa-lg" />}
              text={"Default"}
              isCompact={false}
            />
          ),
          key: "v.",
          onClick: this._handleDefaultVariant,
          active: true,
          title: "Default item",
        });

        if (this.state.activeView === ProjectItemEditorView.diff && !this.state.activeViewTarget) {
          dropdownVal = "Diff from default item";
        }

        items.push("Diff from default item");
      }

      for (const variant of variantList) {
        if (variant.label !== undefined && variant.label !== "") {
          toolbarItems.push({
            icon: (
              <CustomTabLabel
                theme={this.props.theme}
                isSelected={variant.label === this.props.activeVariant}
                icon={<FontAwesomeIcon icon={faFile} className="fa-lg" />}
                text={variant.label}
                isCompact={false}
              />
            ),
            key: "v." + variant.label,
            onClick: this._handleVariantButton,
            active: true,
            title: variant.label,
          });

          const label = "Diff from " + variant.label;

          if (this.state.activeView === ProjectItemEditorView.diff && this.state.activeViewTarget === variant.label) {
            dropdownVal = label;
          }

          items.push(label);
        }
      }

      return (
        <div className="pie-outer pie-grid">
          <div
            className="pie-variantView"
            style={{
              backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
            }}
          >
            <Dropdown
              id={"inptDrop"}
              key={"inptDrop"}
              items={items}
              defaultValue={dropdownVal}
              fluid={true}
              onChange={this._handleDrodownValChange}
            />
          </div>
          <div
            className="pie-viewTabs"
            style={{
              backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
            }}
          >
            <Toolbar aria-label="Actions toolbar overflow menu" items={toolbarItems} />
          </div>
          <div className="pie-interior">{interior}</div>
        </div>
      );
    } else {
      return <div className="pie-outer">{interior}</div>;
    }
  }
}
