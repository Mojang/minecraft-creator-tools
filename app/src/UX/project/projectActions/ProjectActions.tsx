import { Component } from "react";
import IAppProps from "../../appShell/IAppProps";
import Project from "../../../app/Project";
import "./ProjectActions.css";
import LocTokenBox from "../../shared/components/inputs/locTokenBox/LocTokenBox";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMagnifyingGlass,
  faCube,
  faCubes,
  faCode,
  faImage,
  faWandMagicSparkles,
  faGlobe,
  faFileCode,
  faLayerGroup,
} from "@fortawesome/free-solid-svg-icons";
import { faEdit } from "@fortawesome/free-regular-svg-icons";
import ProjectEditorUtilities, {
  ProjectEditorAction,
  ProjectEditorMode,
  ProjectItemEditorView,
} from "../ProjectEditorUtilities";
import telemetry from "../../../analytics/Telemetry";
import { TelemetryEvents, TelemetryProperties } from "../../../analytics/TelemetryConstants";
import CreatorToolsHost, { CreatorToolsThemeStyle } from "../../../app/CreatorToolsHost";
import { faFolder, faFileZipper } from "@fortawesome/free-regular-svg-icons";
import MinecraftButton from "../../shared/components/inputs/minecraftButton/MinecraftButton";
import { getThemeColors } from "../../hooks/theme/useThemeColors";
import { ProjectItemType } from "../../../app/IProjectItemData";
import { CreatorToolsEditPreference } from "../../../app/ICreatorToolsData";
import IProjectTheme from "../../types/IProjectTheme";
import { mcColors } from "../../hooks/theme/mcColors";
import { Dialog, DialogTitle, DialogContent, DialogActions } from "@mui/material";
import McButton from "../../shared/components/inputs/mcButton/McButton";
import NewEntityType from "../../editors/entityType/NewEntityType";
import NewBlockType from "../../editors/blockType/NewBlockType";
import NewItemType from "../../editors/itemType/NewItemType";
import { NewEntityTypeAddMode, NewItemTypeAddMode } from "../../../app/ProjectUtilities";
import IGalleryItem from "../../../app/IGalleryItem";
import ProjectCreateManager from "../../../app/ProjectCreateManager";
import ProjectItem from "../../../app/ProjectItem";
import { ContentGenerator } from "../../../minecraft/ContentGenerator";
import Log from "../../../core/Log";

interface IProjectActionsProps extends IAppProps {
  project: Project;
  theme: IProjectTheme;
  heightOffset: number;
  onActionRequested?: (action: ProjectEditorAction) => void;
  onModeChangeRequested?: (mode: ProjectEditorMode) => void;
  onEditPreferenceChanged?: () => void;
  onActiveProjectItemChangeRequested?: (projectItem: ProjectItem, itemView: ProjectItemEditorView) => void;
}

interface IProjectActionsState {
  entityCount: number;
  blockCount: number;
  itemCount: number;
  scriptCount: number;
  textureCount: number;
  functionCount: number;
  showFirstRun: boolean;
  quickAddDialog: "none" | "entity" | "block" | "item";
}

export default class ProjectActions extends Component<IProjectActionsProps, IProjectActionsState> {
  constructor(props: IProjectActionsProps) {
    super(props);

    this._downloadFlatWorld = this._downloadFlatWorld.bind(this);
    this._downloadProjectWorld = this._downloadProjectWorld.bind(this);
    this._exportLocal = this._exportLocal.bind(this);
    this._exportZip = this._exportZip.bind(this);
    this._inspectProject = this._inspectProject.bind(this);
    this._editProjectDetails = this._editProjectDetails.bind(this);
    this._dismissFirstRun = this._dismissFirstRun.bind(this);
    this._handleQuickAddEntity = this._handleQuickAddEntity.bind(this);
    this._handleQuickAddBlock = this._handleQuickAddBlock.bind(this);
    this._handleQuickAddItem = this._handleQuickAddItem.bind(this);
    this._handleQuickAddCancel = this._handleQuickAddCancel.bind(this);
    this._handleEntityTypeUpdated = this._handleEntityTypeUpdated.bind(this);
    this._handleBlockTypeUpdated = this._handleBlockTypeUpdated.bind(this);
    this._handleItemTypeUpdated = this._handleItemTypeUpdated.bind(this);
    this._handleCreateEntity = this._handleCreateEntity.bind(this);
    this._handleCreateBlock = this._handleCreateBlock.bind(this);
    this._handleCreateItem = this._handleCreateItem.bind(this);

    const hasExplicitEditPreference =
      props.creatorTools.editPreference !== undefined && props.creatorTools.editPreference !== null;

    if (!hasExplicitEditPreference) {
      props.creatorTools.editPreference = CreatorToolsEditPreference.editors;
      props.creatorTools.save();
    }

    // Show first run panel unless user explicitly disabled it; skip for first-run defaulting path
    const shouldShowFirstRun = !props.creatorTools.disableFirstRun && hasExplicitEditPreference;

    this.state = {
      entityCount: 0,
      blockCount: 0,
      itemCount: 0,
      scriptCount: 0,
      textureCount: 0,
      functionCount: 0,
      showFirstRun: shouldShowFirstRun,
      quickAddDialog: "none",
    };
  }

  componentDidMount() {
    this._updateStats();

    // Handle post-creation action from goal picker (e.g., auto-open Add Mob dialog)
    const project = this.props.project;
    if (project.pendingPostCreateAction) {
      const action = project.pendingPostCreateAction;
      project.pendingPostCreateAction = undefined;

      if (action === "addMob") {
        this._requestQuickAdd("entity");
      } else if (action === "addBlock") {
        this._requestQuickAdd("block");
      } else if (action === "addItem") {
        this._requestQuickAdd("item");
      }
    }

    if (project.pendingContentDefinition) {
      const definition = project.pendingContentDefinition;
      project.pendingContentDefinition = undefined;
      this._generateContentFromDefinition(definition);
    }
  }

  private async _generateContentFromDefinition(definition: any) {
    const project = this.props.project;
    const itemsBefore = new Set(project.items.map((i) => i.projectPath));

    try {
      const generator = new ContentGenerator(definition);
      const content = await generator.generate();

      const bpFolder = await project.ensureDefaultBehaviorPackFolder();
      const rpFolder = await project.ensureDefaultResourcePackFolder();

      const getFilename = (filePath: string) => {
        const parts = filePath.split("/");
        return parts[parts.length - 1];
      };

      if (bpFolder) {
        for (const f of content.entityBehaviors) {
          bpFolder
            .ensureFolder("entities")
            .ensureFile(getFilename(f.path))
            .setContent(JSON.stringify(f.content, null, 2));
        }
        for (const f of content.blockBehaviors) {
          bpFolder
            .ensureFolder("blocks")
            .ensureFile(getFilename(f.path))
            .setContent(JSON.stringify(f.content, null, 2));
        }
        for (const f of content.itemBehaviors) {
          bpFolder
            .ensureFolder("items")
            .ensureFile(getFilename(f.path))
            .setContent(JSON.stringify(f.content, null, 2));
        }
        for (const f of content.lootTables) {
          bpFolder
            .ensureFolder("loot_tables")
            .ensureFile(getFilename(f.path))
            .setContent(JSON.stringify(f.content, null, 2));
        }
        for (const f of content.recipes) {
          bpFolder
            .ensureFolder("recipes")
            .ensureFile(getFilename(f.path))
            .setContent(JSON.stringify(f.content, null, 2));
        }
        for (const f of content.spawnRules) {
          bpFolder
            .ensureFolder("spawn_rules")
            .ensureFile(getFilename(f.path))
            .setContent(JSON.stringify(f.content, null, 2));
        }
      }

      if (rpFolder) {
        for (const f of content.entityResources) {
          rpFolder
            .ensureFolder("entity")
            .ensureFile(getFilename(f.path))
            .setContent(JSON.stringify(f.content, null, 2));
        }
        for (const f of content.geometries) {
          rpFolder
            .ensureFolder("models")
            .ensureFolder("entity")
            .ensureFile(getFilename(f.path))
            .setContent(JSON.stringify(f.content, null, 2));
        }
        for (const f of content.textures) {
          const pathParts = f.path.split("/");
          const subfolderName = pathParts.length >= 2 ? pathParts[pathParts.length - 2] : "entity";
          const subFolder = rpFolder.ensureFolder("textures").ensureFolder(subfolderName);
          const file = subFolder.ensureFile(getFilename(f.path));
          if (f.content instanceof Uint8Array) {
            file.setContent(f.content);
          } else if (Array.isArray(f.content)) {
            file.setContent(new Uint8Array(f.content as number[]));
          } else if (typeof f.content === "string") {
            file.setContent(f.content);
          } else {
            file.setContent(JSON.stringify(f.content, null, 2));
          }
        }
        for (const f of content.renderControllers) {
          rpFolder
            .ensureFolder("render_controllers")
            .ensureFile(getFilename(f.path))
            .setContent(JSON.stringify(f.content, null, 2));
        }
        if (content.terrainTextures) {
          rpFolder
            .ensureFolder("textures")
            .ensureFile("terrain_texture.json")
            .setContent(JSON.stringify(content.terrainTextures.content, null, 2));
        }
        if (content.itemTextures) {
          rpFolder
            .ensureFolder("textures")
            .ensureFile("item_texture.json")
            .setContent(JSON.stringify(content.itemTextures.content, null, 2));
        }
      }

      await project.save();
      await project.inferProjectItemsFromFiles(true);
      await project.processRelations(true);

      const newItems = project.items.filter((i) => !itemsBefore.has(i.projectPath));
      const createdItem =
        newItems.find((i) => i.itemType === ProjectItemType.entityTypeBehavior) ||
        newItems.find((i) => i.itemType === ProjectItemType.blockTypeBehavior) ||
        newItems.find((i) => i.itemType === ProjectItemType.itemTypeBehavior) ||
        (newItems.length > 0 ? newItems[0] : undefined);

      if (createdItem && this.props.onActiveProjectItemChangeRequested) {
        this.props.onActiveProjectItemChangeRequested(createdItem, ProjectItemEditorView.singleFileEditor);
      }

      this._updateStats();
    } catch (e) {
      Log.error("Failed to generate content from wizard definition: " + e);
    }
  }

  componentDidUpdate(prevProps: IProjectActionsProps) {
    if (prevProps.project !== this.props.project) {
      this._updateStats();
    }
  }

  private _getFirstEntityName(): string {
    const entities = this.props.project.getItemsByType(ProjectItemType.entityTypeBehavior);
    if (entities.length > 0) {
      const name = entities[0].name || "entity";
      // Strip file extension to match sidebar display (e.g., "biceson.behavior.json" → "biceson")
      const dotIndex = name.indexOf(".");
      return dotIndex > 0 ? name.substring(0, dotIndex) : name;
    }
    return "entity";
  }

  private _updateStats() {
    const project = this.props.project;

    const entityCount = project.getItemsByType(ProjectItemType.entityTypeBehavior).length;
    const blockCount = project.getItemsByType(ProjectItemType.blockTypeBehavior).length;
    const itemCount = project.getItemsByType(ProjectItemType.itemTypeBehavior).length;
    const scriptCount =
      project.getItemsByType(ProjectItemType.ts).length + project.getItemsByType(ProjectItemType.js).length;
    const textureCount = project.getItemsByType(ProjectItemType.texture).length;
    const functionCount = project.getItemsByType(ProjectItemType.MCFunction).length;

    this.setState({
      entityCount,
      blockCount,
      itemCount,
      scriptCount,
      textureCount,
      functionCount,
    });
  }

  private _inspectProject() {
    telemetry.trackEvent({
      name: TelemetryEvents.INSPECTOR_OPENED,
      properties: {
        [TelemetryProperties.ACTION_SOURCE]: "projectActions",
      },
    });

    if (this.props.onModeChangeRequested) {
      this.props.onModeChangeRequested(ProjectEditorMode.inspector);
    }
  }

  private _editProjectDetails() {
    if (this.props.onModeChangeRequested) {
      this.props.onModeChangeRequested(ProjectEditorMode.properties);
    }
  }

  private _requestQuickAdd(action: "entity" | "block" | "item") {
    this.setState({ quickAddDialog: action });
  }

  private _handleQuickAddEntity() {
    this._requestQuickAdd("entity");
  }

  private _handleQuickAddBlock() {
    this._requestQuickAdd("block");
  }

  private _handleQuickAddItem() {
    this._requestQuickAdd("item");
  }

  private _handleQuickAddCancel() {
    this.setState({ quickAddDialog: "none" });
  }

  // Tentative values set by dialog child components
  private _tentativeNewEntityTypeItem?: IGalleryItem;
  private _tentativeNewEntityTypeAddMode?: NewEntityTypeAddMode;
  private _tentativeNewBlockTypeItem?: IGalleryItem;
  private _tentativeNewItemTypeItem?: IGalleryItem;
  private _tentativeNewName?: string;

  private _handleEntityTypeUpdated(newAddMode: NewEntityTypeAddMode, entityTypeItem: IGalleryItem, name: string) {
    this._tentativeNewEntityTypeItem = entityTypeItem;
    this._tentativeNewEntityTypeAddMode = newAddMode;
    this._tentativeNewName = name;
  }

  private _handleBlockTypeUpdated(blockTypeItem: IGalleryItem | undefined, name: string | undefined) {
    this._tentativeNewBlockTypeItem = blockTypeItem;
    this._tentativeNewName = name;
  }

  private _handleItemTypeUpdated(propertyType: NewItemTypeAddMode, itemTypeItem: IGalleryItem, name: string) {
    this._tentativeNewItemTypeItem = itemTypeItem;
    this._tentativeNewName = name;
  }

  private async _handleCreateEntity() {
    const project = this.props.project;
    const itemsBefore = new Set(project.getItemsByType(ProjectItemType.entityTypeBehavior).map((i) => i.projectPath));

    if (this._tentativeNewEntityTypeItem) {
      await ProjectCreateManager.addEntityTypeFromGallery(
        project,
        this._tentativeNewEntityTypeItem,
        this._tentativeNewName,
        this._tentativeNewEntityTypeAddMode
      );
    }

    await project.save();

    const itemsAfter = project.getItemsByType(ProjectItemType.entityTypeBehavior);
    const newItems = itemsAfter.filter((i) => !itemsBefore.has(i.projectPath));
    const createdItem = newItems.length > 0 ? newItems[0] : undefined;

    this.setState({ quickAddDialog: "none" });
    this._updateStats();

    if (createdItem && this.props.onActiveProjectItemChangeRequested) {
      this.props.onActiveProjectItemChangeRequested(createdItem, ProjectItemEditorView.singleFileEditor);
    }
  }

  private async _handleCreateBlock() {
    const project = this.props.project;
    const itemsBefore = new Set(project.getItemsByType(ProjectItemType.blockTypeBehavior).map((i) => i.projectPath));

    if (this._tentativeNewBlockTypeItem) {
      await ProjectCreateManager.addBlockTypeFromGallery(
        project,
        this._tentativeNewBlockTypeItem,
        this._tentativeNewName
      );
    }

    await project.save();

    const itemsAfter = project.getItemsByType(ProjectItemType.blockTypeBehavior);
    const newItems = itemsAfter.filter((i) => !itemsBefore.has(i.projectPath));
    const createdItem = newItems.length > 0 ? newItems[0] : undefined;

    this.setState({ quickAddDialog: "none" });
    this._updateStats();

    if (createdItem && this.props.onActiveProjectItemChangeRequested) {
      this.props.onActiveProjectItemChangeRequested(createdItem, ProjectItemEditorView.singleFileEditor);
    }
  }

  private async _handleCreateItem() {
    const project = this.props.project;
    const itemsBefore = new Set(project.getItemsByType(ProjectItemType.itemTypeBehavior).map((i) => i.projectPath));

    if (this._tentativeNewItemTypeItem) {
      await ProjectCreateManager.addItemTypeFromGallery(
        project,
        this._tentativeNewItemTypeItem,
        this._tentativeNewName
      );
    }

    await project.save();

    const itemsAfter = project.getItemsByType(ProjectItemType.itemTypeBehavior);
    const newItems = itemsAfter.filter((i) => !itemsBefore.has(i.projectPath));
    const createdItem = newItems.length > 0 ? newItems[0] : undefined;

    this.setState({ quickAddDialog: "none" });
    this._updateStats();

    if (createdItem && this.props.onActiveProjectItemChangeRequested) {
      this.props.onActiveProjectItemChangeRequested(createdItem, ProjectItemEditorView.singleFileEditor);
    }
  }

  private _notifyExportError(action: string, error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    this.props.creatorTools.notifyStatusUpdate(`${action} failed: ${message}`);
  }

  private async _downloadFlatWorld() {
    try {
      await ProjectEditorUtilities.launchFlatWorldWithPacksDownload(this.props.creatorTools, this.props.project);
    } catch (error) {
      this._notifyExportError("Download flat world", error);
    }
  }

  private async _downloadProjectWorld() {
    try {
      await ProjectEditorUtilities.launchWorldWithPacksDownload(this.props.creatorTools, this.props.project);
    } catch (error) {
      this._notifyExportError("Download project world", error);
    }
  }

  private async _exportLocal() {
    try {
      await ProjectEditorUtilities.launchLocalExport(this.props.creatorTools, this.props.project);
    } catch (error) {
      this._notifyExportError("Export to folder", error);
    }
  }

  private _dismissFirstRun() {
    this.setState({ showFirstRun: false });
  }
  private async _exportZip() {
    try {
      await ProjectEditorUtilities.launchZipExport(this.props.creatorTools, this.props.project);
    } catch (error) {
      this._notifyExportError("Export zip", error);
    }
  }

  render() {
    const project = this.props.project;
    const height = "calc(100vh - " + this.props.heightOffset + "px)";
    const isDark = CreatorToolsHost.theme === CreatorToolsThemeStyle.dark;
    const gettingStartedTitleColor = isDark ? mcColors.green2 : mcColors.green7;
    const gettingStartedBodyColor = isDark ? mcColors.gray2 : mcColors.gray6;

    // Build stats for display
    const stats = [
      { icon: faCube, label: "Mob Types", count: this.state.entityCount },
      { icon: faCubes, label: "Block Types", count: this.state.blockCount },
      { icon: faLayerGroup, label: "Item Types", count: this.state.itemCount },
      { icon: faCode, label: "Game Logic", count: this.state.scriptCount },
      { icon: faImage, label: "Textures", count: this.state.textureCount },
      { icon: faFileCode, label: "Functions", count: this.state.functionCount },
    ].filter((s) => s.count > 0);

    const hasStats = stats.length > 0;

    let imgElt = (
      <img
        alt="Project preview"
        style={{
          imageRendering: "pixelated",
        }}
        src={
          CreatorToolsHost.theme === CreatorToolsThemeStyle.dark
            ? `${CreatorToolsHost.contentWebRoot}res/images/templates/redflower_darkbg.png`
            : `${CreatorToolsHost.contentWebRoot}res/images/templates/redflower_lightbg.png`
        }
      />
    );

    if (project.previewImageBase64) {
      imgElt = <img alt="Project preview" src={`data:image/png;base64,${project.previewImageBase64}`} />;
    }

    return (
      <div
        className="pact-outer"
        style={{
          backgroundColor: getThemeColors().background2,
          color: getThemeColors().foreground2,
          minHeight: height,
          maxHeight: height,
        }}
      >
        {/* Hero Section */}
        <div className="pact-hero">
          <div className="pact-heroContent">
            <div className="pact-heroImage">{imgElt}</div>
            <div className="pact-heroText">
              <div className="pact-titleRow">
                <h1 className="pact-projectTitle">
                  <LocTokenBox
                    creatorTools={this.props.creatorTools}
                    project={project}
                    value={project.title || "Untitled Project"}
                  />
                </h1>
                <button
                  className="pact-editButton"
                  onClick={this._editProjectDetails}
                  title="Edit project details"
                  aria-label="Edit project details"
                >
                  <FontAwesomeIcon icon={faEdit} />
                </button>
              </div>
              {project.creator && <div className="pact-projectCreator">by {project.creator}</div>}
              {project.description && (
                <p className="pact-projectDescription">
                  <LocTokenBox creatorTools={this.props.creatorTools} project={project} value={project.description} />
                </p>
              )}
            </div>
          </div>

          {/* Stats Bar */}
          {hasStats && (
            <div className="pact-statsBar">
              {stats.map((stat) => (
                <div key={stat.label} className="pact-stat">
                  <FontAwesomeIcon icon={stat.icon} className="pact-statIcon" />
                  <span className="pact-statCount">{stat.count}</span>
                  <span className="pact-statLabel">{stat.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions Section - Inspector is hidden in Focused/summarized mode */}
        {this.props.creatorTools.editPreference !== CreatorToolsEditPreference.summarized && (
          <div className="pact-section">
            <div className="pact-sectionHeader">
              <FontAwesomeIcon icon={faWandMagicSparkles} className="pact-sectionIcon" />
              <h2>Quick Actions</h2>
            </div>
            <div className="pact-cardGrid">
              <MinecraftButton
                className="pact-actionCard pact-cardPrimary"
                key="pact-inspectProject"
                theme={this.props.theme}
                onClick={this._inspectProject}
              >
                <div className="pact-cardContent pact-cardContentCompact">
                  <div className="pact-cardIconLarge">
                    <FontAwesomeIcon icon={faMagnifyingGlass} fixedWidth />
                  </div>
                  <div className="pact-cardText">
                    <div className="pact-cardTitle">Inspect Project</div>
                    <div className="pact-cardDesc">
                      Find errors, spot unused files, and check for common issues in your project
                    </div>
                  </div>
                </div>
              </MinecraftButton>
            </div>
          </div>
        )}

        {/* Export Section */}
        <div className="pact-section">
          <div className="pact-sectionHeader">
            <FontAwesomeIcon icon={faFolder} className="pact-sectionIcon" />
            <h2>Export Project</h2>
          </div>
          <div
            style={{
              padding: "12px 16px",
              marginBottom: "12px",
              fontSize: "13px",
              lineHeight: 1.5,
              color: isDark ? mcColors.gray2 : mcColors.gray5,
              backgroundColor: isDark ? `${mcColors.green7}35` : `${mcColors.green3}22`,
              borderRadius: "2px",
              borderLeft: `3px solid ${mcColors.green4}`,
            }}
          >
            <strong>Most beginners should start with the first card below.</strong> It creates one file you can open in
            Minecraft right away or send to a friend.
          </div>
          <div className="pact-cardGrid">
            <MinecraftButton
              className="pact-actionCard pact-cardPrimary"
              key="pact-exportZip"
              theme={this.props.theme}
              onClick={this._exportZip}
            >
              <div className="pact-cardContent">
                <div className="pact-cardIcon">
                  <FontAwesomeIcon icon={faFileZipper} fixedWidth />
                </div>
                <div className="pact-cardText">
                  <div
                    style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}
                  >
                    <div className="pact-cardTitle" style={{ marginBottom: 0 }}>
                      Download &amp; Install in Minecraft (.mcaddon)
                    </div>
                  </div>
                  <div className="pact-cardDesc">
                    Download one file you can double-click to open in Minecraft, keep as a shareable copy, or send to
                    another device.
                  </div>
                </div>
              </div>
            </MinecraftButton>

            {window.showDirectoryPicker !== undefined && (
              <MinecraftButton
                className="pact-actionCard"
                key="pact-exportLocalFolder"
                theme={this.props.theme}
                onClick={this._exportLocal}
              >
                <div className="pact-cardContent">
                  <div className="pact-cardIcon">
                    <FontAwesomeIcon icon={faFolder} />
                  </div>
                  <div className="pact-cardText">
                    <div className="pact-cardTitle">Save project files to a folder</div>
                    <div className="pact-cardDesc">
                      Use this when you want the raw project files on disk for editing, backups, or another tool.
                    </div>
                  </div>
                </div>
              </MinecraftButton>
            )}
          </div>
        </div>

        {/* Run in Minecraft Section */}
        <div className="pact-section">
          <div className="pact-sectionHeader">
            <FontAwesomeIcon icon={faGlobe} className="pact-sectionIcon" />
            <h2>Test in Minecraft</h2>
          </div>
          <div className="pact-cardGrid">
            <MinecraftButton
              className="pact-actionCard pact-cardMinecraft"
              key="pact-dlFlatWorld"
              theme={this.props.theme}
              onClick={this._downloadFlatWorld}
            >
              <div className="pact-cardContent">
                <div className="pact-cardIconImage">
                  <img
                    alt="Flat world"
                    src={
                      CreatorToolsHost.contentWebRoot +
                      "res/latest/van/serve/resource_pack/textures/blocks/grass_path_side.png"
                    }
                  />
                </div>
                <div className="pact-cardText">
                  <div className="pact-cardTitle">Download a flat test world</div>
                  <div className="pact-cardDesc">
                    Best first test — open a simple flat world with your add-on already installed.
                  </div>
                </div>
              </div>
            </MinecraftButton>

            <MinecraftButton
              className="pact-actionCard pact-cardMinecraft"
              key="pact-dlProjectWorld"
              theme={this.props.theme}
              onClick={this._downloadProjectWorld}
            >
              <div className="pact-cardContent">
                <div className="pact-cardIconImage">
                  <img
                    alt="Project world"
                    src={
                      CreatorToolsHost.contentWebRoot +
                      "res/latest/van/serve/resource_pack/textures/blocks/grass_side_carried.png"
                    }
                  />
                </div>
                <div className="pact-cardText">
                  <div className="pact-cardTitle">Download a regular project world</div>
                  <div className="pact-cardDesc">
                    Use a normal Minecraft world if you want hills, caves, and regular terrain while testing.
                  </div>
                </div>
              </div>
            </MinecraftButton>
          </div>
          <div
            style={{
              padding: "10px 16px",
              marginTop: "8px",
              fontSize: "12px",
              lineHeight: 1.5,
              color: isDark ? mcColors.gray2 : mcColors.gray4,
              fontStyle: "italic",
            }}
          >
            After downloading, double-click the .mcworld file to open it directly in Minecraft. Your add-on will be
            installed automatically.
          </div>
        </div>

        {this.state.quickAddDialog === "entity" && (
          <Dialog open={true} onClose={this._handleQuickAddCancel}>
            <DialogTitle>New Mob Based on Existing</DialogTitle>
            <DialogContent>
              <NewEntityType
                theme={this.props.theme}
                onNewEntityTypeUpdated={this._handleEntityTypeUpdated}
                project={this.props.project}
                creatorTools={this.props.creatorTools}
              />
            </DialogContent>
            <DialogActions>
              <McButton variant="stone" onClick={this._handleQuickAddCancel}>
                Cancel
              </McButton>
              <McButton variant="green" onClick={this._handleCreateEntity}>
                Add
              </McButton>
            </DialogActions>
          </Dialog>
        )}
        {this.state.quickAddDialog === "block" && (
          <Dialog open={true} onClose={this._handleQuickAddCancel}>
            <DialogTitle>New Block Based on Existing</DialogTitle>
            <DialogContent>
              <NewBlockType
                theme={this.props.theme}
                onNewBlockTypeUpdated={this._handleBlockTypeUpdated}
                project={this.props.project}
                creatorTools={this.props.creatorTools}
              />
            </DialogContent>
            <DialogActions>
              <McButton variant="stone" onClick={this._handleQuickAddCancel}>
                Cancel
              </McButton>
              <McButton variant="green" onClick={this._handleCreateBlock}>
                Add
              </McButton>
            </DialogActions>
          </Dialog>
        )}
        {this.state.quickAddDialog === "item" && (
          <Dialog open={true} onClose={this._handleQuickAddCancel}>
            <DialogTitle>New Item Based on Existing</DialogTitle>
            <DialogContent>
              <NewItemType
                theme={this.props.theme}
                onNewItemTypeUpdated={this._handleItemTypeUpdated}
                project={this.props.project}
                creatorTools={this.props.creatorTools}
              />
            </DialogContent>
            <DialogActions>
              <McButton variant="stone" onClick={this._handleQuickAddCancel}>
                Cancel
              </McButton>
              <McButton variant="green" onClick={this._handleCreateItem}>
                Add
              </McButton>
            </DialogActions>
          </Dialog>
        )}
      </div>
    );
  }
}
