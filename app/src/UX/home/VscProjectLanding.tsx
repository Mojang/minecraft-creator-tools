// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * VscProjectLanding - VS Code Extension Landing Page Component
 *
 * ARCHITECTURE:
 * This component provides a rich landing page for projects opened in the VS Code extension.
 * It's adapted from ProjectActions but uses VS Code-specific messaging (AppServiceProxy)
 * for actions like file saving, instead of browser APIs.
 *
 * KEY FEATURES:
 * - Project stats display (entities, blocks, items, scripts, textures, functions)
 * - Quick actions: Inspect Project, View Items
 * - Export actions: Export to Folder (via VS Code save dialog), Export as Zip
 * - Run in Minecraft: Download as Flat World or Project World
 *
 * MESSAGE PROTOCOL:
 * Actions that need VS Code API access use AppServiceProxy.sendAsync() with these commands:
 * - "showSaveDialog" - Opens VS Code save dialog, returns selected path
 * - "saveBinaryFile" - Saves binary data to a file path
 *
 * RELATED FILES:
 * - ProjectActions.tsx - Web version with browser APIs
 * - ExtensionManager.ts - Handles messages on VS Code side
 * - CodeToolboxNoProjectLanding.tsx - Minimal version shown when no project is loaded
 */

import { Component } from "react";
import IAppProps from "../appShell/IAppProps";
import Project from "../../app/Project";
import "./VscProjectLanding.css";
import LocTokenBox from "../shared/components/inputs/locTokenBox/LocTokenBox";
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
  faList,
  faArrowLeft,
} from "@fortawesome/free-solid-svg-icons";
import { faEdit, faFileZipper, faFolder } from "@fortawesome/free-regular-svg-icons";
import { ProjectEditorMode } from "../project/ProjectEditorUtilities";
import CreatorToolsHost, { CreatorToolsThemeStyle, HostType } from "../../app/CreatorToolsHost";
import MinecraftButton from "../shared/components/inputs/minecraftButton/MinecraftButton";
import { ProjectItemType } from "../../app/IProjectItemData";
import { CreatorToolsEditPreference } from "../../app/ICreatorToolsData";
import AppServiceProxy from "../../core/AppServiceProxy";
import ProjectExporter from "../../app/ProjectExporter";
import Utilities from "../../core/Utilities";
import ZipStorage from "../../storage/ZipStorage";
import StorageUtilities from "../../storage/StorageUtilities";
import { getThemeColors } from "../hooks/theme/useThemeColors";
import IProjectTheme from "../types/IProjectTheme";
import Log from "../../core/Log";


interface IVscProjectLandingProps extends IAppProps {
  project: Project;
  theme: IProjectTheme;
  heightOffset: number;
  onModeChangeRequested?: (mode: ProjectEditorMode) => void;
  onBackRequested?: () => void;
}

interface IVscProjectLandingState {
  entityCount: number;
  blockCount: number;
  itemCount: number;
  scriptCount: number;
  textureCount: number;
  functionCount: number;
  isExporting: boolean;
  statusMessage: string;
}

class VscProjectLanding extends Component<IVscProjectLandingProps, IVscProjectLandingState> {
  constructor(props: IVscProjectLandingProps) {
    super(props);

    this._downloadFlatWorld = this._downloadFlatWorld.bind(this);
    this._downloadProjectWorld = this._downloadProjectWorld.bind(this);
    this._exportZip = this._exportZip.bind(this);
    this._inspectProject = this._inspectProject.bind(this);
    this._editProjectDetails = this._editProjectDetails.bind(this);
    this._viewItems = this._viewItems.bind(this);

    this.state = {
      entityCount: 0,
      blockCount: 0,
      itemCount: 0,
      scriptCount: 0,
      textureCount: 0,
      functionCount: 0,
      isExporting: false,
      statusMessage: "",
    };
  }

  componentDidMount() {
    this._updateStats();
  }

  componentDidUpdate(prevProps: IVscProjectLandingProps) {
    if (prevProps.project !== this.props.project) {
      this._updateStats();
    }
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
    if (this.props.onModeChangeRequested) {
      this.props.onModeChangeRequested(ProjectEditorMode.inspector);
    }
  }

  private _editProjectDetails() {
    if (this.props.onModeChangeRequested) {
      this.props.onModeChangeRequested(ProjectEditorMode.properties);
    }
  }

  private _viewItems() {
    if (this.props.onModeChangeRequested) {
      this.props.onModeChangeRequested(ProjectEditorMode.activeItem);
    }
  }

  /**
   * Saves binary data using VS Code's save dialog when in VS Code context,
   * or falls back to browser download when not in VS Code.
   */
  private async _saveBinaryFile(data: Uint8Array, defaultFileName: string, fileTypeLabel: string): Promise<boolean> {
    const isVsCode =
      CreatorToolsHost.hostType === HostType.vsCodeMainWeb || CreatorToolsHost.hostType === HostType.vsCodeWebWeb;

    if (isVsCode) {
      // Use VS Code save dialog via message proxy
      try {
        const result = await AppServiceProxy.sendAsync(
          "showSaveDialog",
          JSON.stringify({
            defaultFileName: defaultFileName,
            filters: {
              [fileTypeLabel]: [defaultFileName.split(".").pop() || "bin"],
            },
          })
        );

        if (result) {
          const parsed = JSON.parse(result);
          if (parsed.path) {
            // Convert Uint8Array to base64 for transmission
            const base64 = btoa(String.fromCharCode(...data));
            await AppServiceProxy.sendAsync(
              "saveBinaryFile",
              JSON.stringify({
                path: parsed.path,
                base64Data: base64,
              })
            );
            return true;
          }
        }
        return false; // User cancelled
      } catch (e) {
        Log.debug("Failed to save file via VS Code: " + e);
        return false;
      }
    } else {
      // Fallback: Use browser download (for testing outside VS Code)
      try {
        const { saveAs } = await import("file-saver");
        saveAs(new Blob([data], { type: "application/octet-stream" }), defaultFileName);
        return true;
      } catch (e) {
        Log.debug("Failed to save file via browser: " + e);
        return false;
      }
    }
  }

  private async _downloadFlatWorld() {
    const { project, creatorTools } = this.props;

    this.setState({ isExporting: true, statusMessage: "Creating flat world with packs..." });

    try {
      const projName = await project.loc.getTokenValue(project.name);
      const nameCore = Utilities.getFileFriendlySummarySeconds(new Date()) + "-" + projName;
      const name = nameCore + " Flat";
      const fileName = nameCore + "-flatpack.mcworld";

      const newBytes = await ProjectExporter.generateFlatBetaApisWorldWithPacksZipBytes(creatorTools, project, name);

      if (newBytes) {
        this.setState({ statusMessage: `Saving ${fileName}...` });
        const saved = await this._saveBinaryFile(new Uint8Array(newBytes), fileName, "Minecraft World");
        if (saved) {
          this.setState({ statusMessage: `Saved ${fileName}` });
        } else {
          this.setState({ statusMessage: "" });
        }
      } else {
        this.setState({ statusMessage: "Failed to create world package" });
      }
    } catch (e) {
      this.setState({ statusMessage: `Error creating world: ${String(e)}` });
    } finally {
      this.setState({ isExporting: false });
    }
  }

  private async _downloadProjectWorld() {
    const { project, creatorTools } = this.props;

    this.setState({ isExporting: true, statusMessage: "Creating project world with packs..." });

    try {
      const projName = await project.loc.getTokenValue(project.name);
      const name = Utilities.getFileFriendlySummarySeconds(new Date()) + "-" + projName;
      const fileName = name + ".mcworld";

      const mcworld = await ProjectExporter.generateWorldWithPacks(
        creatorTools,
        project,
        project.ensureWorldSettings()
      );

      if (mcworld) {
        const newBytes = await mcworld.getBytes();

        if (newBytes) {
          this.setState({ statusMessage: `Saving ${fileName}...` });
          const saved = await this._saveBinaryFile(new Uint8Array(newBytes), fileName, "Minecraft World");
          if (saved) {
            this.setState({ statusMessage: `Saved ${fileName}` });
          } else {
            this.setState({ statusMessage: "" });
          }
        } else {
          this.setState({ statusMessage: "Failed to create world package" });
        }
      } else {
        this.setState({ statusMessage: "Failed to create world" });
      }
    } catch (e) {
      this.setState({ statusMessage: `Error creating world: ${String(e)}` });
    } finally {
      this.setState({ isExporting: false });
    }
  }

  private async _exportZip() {
    const { project, creatorTools } = this.props;

    this.setState({ isExporting: true, statusMessage: "Creating zip export..." });

    try {
      const projName = await project.loc.getTokenValue(project.name);
      const fileName = projName + ".zip";

      const zipStorage = new ZipStorage();
      const projectFolder = await project.ensureLoadedProjectFolder();

      await StorageUtilities.syncFolderTo(projectFolder, zipStorage.rootFolder, true, true, false);
      await zipStorage.rootFolder.saveAll();

      const zipBlob = await zipStorage.generateBlobAsync();

      // Convert Blob to Uint8Array
      const arrayBuffer = await zipBlob.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);

      this.setState({ statusMessage: `Saving ${fileName}...` });
      const saved = await this._saveBinaryFile(data, fileName, "Zip Archive");
      if (saved) {
        this.setState({ statusMessage: `Saved ${fileName}` });
      } else {
        this.setState({ statusMessage: "" });
      }
    } catch (e) {
      this.setState({ statusMessage: `Error creating zip: ${String(e)}` });
    } finally {
      this.setState({ isExporting: false });
    }
  }

  render() {
    const { project, theme, heightOffset } = this.props;
    const height = "calc(100vh - " + heightOffset + "px)";

    // Build stats for display
    const stats = [
      { icon: faCube, label: "Mob Types", count: this.state.entityCount },
      { icon: faCubes, label: "Block Types", count: this.state.blockCount },
      { icon: faLayerGroup, label: "Item Types", count: this.state.itemCount },
      { icon: faCode, label: "Scripts", count: this.state.scriptCount },
      { icon: faImage, label: "Textures", count: this.state.textureCount },
      { icon: faFileCode, label: "Functions", count: this.state.functionCount },
    ].filter((s) => s.count > 0);

    const hasStats = stats.length > 0;

    const fallbackSrc =
      CreatorToolsHost.theme === CreatorToolsThemeStyle.dark
        ? `${CreatorToolsHost.contentWebRoot}res/images/templates/redflower_darkbg.png`
        : `${CreatorToolsHost.contentWebRoot}res/images/templates/redflower_lightbg.png`;

    const handleImgError = (e: React.SyntheticEvent<HTMLImageElement>) => {
      const img = e.currentTarget;
      // currentTarget can be null if the <img> was unmounted before the browser
      // dispatched the error event (e.g. project list re-rendered while the
      // preview was still loading).
      if (!img) {
        return;
      }
      Log.verbose(`VscProjectLanding: preview image failed to load: ${img.src}`);
      // Hide the broken-image placeholder (alt text + icon) if the image can't be
      // fetched (e.g. webview CSP, missing bundle asset, or contentWebRoot not set).
      img.style.display = "none";
    };

    let imgElt = (
      <img
        alt="Project preview"
        style={{
          imageRendering: "pixelated",
        }}
        src={fallbackSrc}
        onError={handleImgError}
      />
    );

    if (project.previewImageBase64) {
      imgElt = (
        <img
          alt="Project preview"
          src={`data:image/png;base64,${project.previewImageBase64}`}
          onError={handleImgError}
        />
      );
    }

    const colors = getThemeColors();

    return (
      <div
        className="vspl-outer"
        style={{
          backgroundColor: colors.background2,
          color: colors.foreground2,
          minHeight: height,
          maxHeight: height,
        }}
      >
        {/* Back button for mobile/narrow views */}
        {this.props.onBackRequested && (
          <div className="vspl-backBar">
            <button className="vspl-backButton" onClick={this.props.onBackRequested} aria-label="Back to items">
              <FontAwesomeIcon icon={faArrowLeft} /> Back
            </button>
          </div>
        )}

        {/* Hero Section */}
        <div className="vspl-hero">
          <div className="vspl-heroContent">
            <div className="vspl-heroImage">{imgElt}</div>
            <div className="vspl-heroText">
              <div className="vspl-titleRow">
                <h1 className="vspl-projectTitle">
                  <LocTokenBox
                    creatorTools={this.props.creatorTools}
                    project={project}
                    value={project.title || "Untitled Project"}
                  />
                </h1>
                <button
                  className="vspl-editButton"
                  onClick={this._editProjectDetails}
                  title="Edit project settings"
                  aria-label="Edit project settings"
                >
                  <FontAwesomeIcon icon={faEdit} />
                </button>
              </div>
              {project.creator && <div className="vspl-projectCreator">{`by ${project.creator}`}</div>}
              {project.description && (
                <p className="vspl-projectDescription">
                  <LocTokenBox creatorTools={this.props.creatorTools} project={project} value={project.description} />
                </p>
              )}
            </div>
          </div>

          {/* Stats Bar */}
          {hasStats && (
            <div className="vspl-statsBar">
              {stats.map((stat) => (
                <div key={stat.label} className="vspl-stat">
                  <FontAwesomeIcon icon={stat.icon} className="vspl-statIcon" />
                  <span className="vspl-statCount">{stat.count}</span>
                  <span className="vspl-statLabel">{stat.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Status message */}
        {this.state.statusMessage && (
          <div className="vspl-status">
            {this.state.isExporting && <span className="vspl-spinner"></span>}
            {this.state.statusMessage}
          </div>
        )}

        {/* Quick Actions Section */}
        <div className="vspl-section">
          <div className="vspl-sectionHeader">
            <FontAwesomeIcon icon={faWandMagicSparkles} className="vspl-sectionIcon" />
            <h2>Quick Actions</h2>
          </div>
          <div className="vspl-cardGrid">
            <MinecraftButton className="vspl-actionCard" key="vspl-viewItems" theme={theme} onClick={this._viewItems}>
              <div className="vspl-cardContent vspl-cardContentCompact">
                <div className="vspl-cardIconLarge">
                  <FontAwesomeIcon icon={faList} fixedWidth />
                </div>
                <div className="vspl-cardText">
                  <div className="vspl-cardTitle">View Items</div>
                  <div className="vspl-cardDesc">Browse and edit project contents</div>
                </div>
              </div>
            </MinecraftButton>

            {this.props.creatorTools.editPreference !== CreatorToolsEditPreference.summarized && (
              <MinecraftButton
                className="vspl-actionCard vspl-cardPrimary"
                key="vspl-inspectProject"
                theme={theme}
                onClick={this._inspectProject}
              >
                <div className="vspl-cardContent vspl-cardContentCompact">
                  <div className="vspl-cardIconLarge">
                    <FontAwesomeIcon icon={faMagnifyingGlass} fixedWidth />
                  </div>
                  <div className="vspl-cardText">
                  <div className="vspl-cardTitle">Inspect Project</div>
                  <div className="vspl-cardDesc">Find errors, unused files, and common issues</div>
                  </div>
                </div>
              </MinecraftButton>
            )}
          </div>
        </div>

        {/* Export Section */}
        <div className="vspl-section">
          <div className="vspl-sectionHeader">
            <FontAwesomeIcon icon={faFolder} className="vspl-sectionIcon" />
            <h2>Export Project</h2>
          </div>
          <div className="vspl-cardGrid">
            <MinecraftButton
              className={"vspl-actionCard" + (this.state.isExporting ? " vspl-disabled" : "")}
              key="vspl-exportZip"
              theme={theme}
              onClick={this.state.isExporting ? undefined : this._exportZip}
            >
              <div className="vspl-cardContent">
                <div className="vspl-cardIcon">
                  <FontAwesomeIcon icon={faFileZipper} fixedWidth />
                </div>
                <div className="vspl-cardText">
                  <div className="vspl-cardTitle">Export as Zip</div>
                  <div className="vspl-cardDesc">Save project as a compressed archive</div>
                </div>
              </div>
            </MinecraftButton>
          </div>
        </div>

        {/* Run in Minecraft Section */}
        <div className="vspl-section">
          <div className="vspl-sectionHeader">
            <FontAwesomeIcon icon={faGlobe} className="vspl-sectionIcon" />
            <h2>Run in Minecraft</h2>
          </div>
          <div className="vspl-cardGrid">
            <MinecraftButton
              className={"vspl-actionCard vspl-cardMinecraft" + (this.state.isExporting ? " vspl-disabled" : "")}
              key="vspl-dlFlatWorld"
              theme={theme}
              onClick={this.state.isExporting ? undefined : this._downloadFlatWorld}
            >
              <div className="vspl-cardContent">
                <div className="vspl-cardIconImage">
                  <img
                    alt="Flat world"
                    src={
                      CreatorToolsHost.contentWebRoot +
                      "res/latest/van/serve/resource_pack/textures/blocks/grass_path_side.png"
                    }
                  />
                </div>
                <div className="vspl-cardText">
                  <div className="vspl-cardTitle">Flat World</div>
                  <div className="vspl-cardDesc">Download as .mcworld with flat terrain</div>
                </div>
              </div>
            </MinecraftButton>

            <MinecraftButton
              className={"vspl-actionCard vspl-cardMinecraft" + (this.state.isExporting ? " vspl-disabled" : "")}
              key="vspl-dlProjectWorld"
              theme={theme}
              onClick={this.state.isExporting ? undefined : this._downloadProjectWorld}
            >
              <div className="vspl-cardContent">
                <div className="vspl-cardIconImage">
                  <img
                    alt="Project world"
                    src={
                      CreatorToolsHost.contentWebRoot +
                      "res/latest/van/serve/resource_pack/textures/blocks/grass_side_carried.png"
                    }
                  />
                </div>
                <div className="vspl-cardText">
                  <div className="vspl-cardTitle">Project World</div>
                  <div className="vspl-cardDesc">Download as .mcworld with default terrain</div>
                </div>
              </div>
            </MinecraftButton>
          </div>
        </div>
      </div>
    );
  }
}

export default VscProjectLanding;
