import React, { Component } from "react";
import "./ImportFiles.css";
import { Button, FormControlLabel, RadioGroup, Radio } from "@mui/material";
import IAppProps from "../appShell/IAppProps";
import { AppMode } from "../appShell/App";
import Project from "../../app/Project";
import HomeFooter from "../home/HomeFooter";
import HomeHeader from "../home/HomeHeader";
import StorageUtilities from "../../storage/StorageUtilities";
import IFolder from "../../storage/IFolder";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFile,
  faFolder,
  faFolderOpen,
  faCheckCircle,
  faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";
import ProjectUtilities from "../../app/ProjectUtilities";
import CreatorToolsHost, { CreatorToolsThemeStyle } from "../../app/CreatorToolsHost";
import ProjectItem from "../../app/ProjectItem";
import Database from "../../minecraft/Database";
import ContentIndex from "../../core/ContentIndex";
import { ProjectItemType } from "../../app/IProjectItemData";
import Log from "../../core/Log";
import { getThemeColors } from "../hooks/theme/useThemeColors";
import IProjectTheme from "../types/IProjectTheme";

export enum ImportFileAction {
  createNewProject = 0,
  updateExistingProject = 1,
  addToNewProject = 2,
}

export interface IImportFileInfo {
  file: File;
  name: string;
  itemType: ProjectItemType;
  action: ImportFileAction;
  selectedProjectIndex?: number;
  matchingProjectItems: { project: Project; items: ProjectItem[] }[];
  vanillaOverridePath?: string;
  vanillaOverridePaths?: string[];
  fileContent?: Uint8Array | string;
  suggestedFolder?: string;
  previewUrl?: string;
}

interface IImportFilesProps extends IAppProps {
  theme: IProjectTheme;
  files?: File[];
  onModeChangeRequested?: (mode: AppMode) => void;
  onNewProjectFromFilesSelected?: (files: IImportFileInfo[], projectName?: string) => void;
  onUpdateExistingProject?: (project: Project, files: IImportFileInfo[]) => void;
  onNewProjectFromGallerySelected?: (galleryId: string, updateContent?: IFolder) => void;
}

interface IImportFilesState {
  isLoading: boolean;
  fileInfos: IImportFileInfo[];
  selectedFileIndex: number;
  projectName: string;
  vanillaContentIndex?: ContentIndex;
  errorMessage?: string;
  loadedProjects: Project[];
}

export default class ImportFiles extends Component<IImportFilesProps, IImportFilesState> {
  constructor(props: IImportFilesProps) {
    super(props);

    this._handleCreate = this._handleCreate.bind(this);
    this._navigateToHome = this._navigateToHome.bind(this);
    this._handleFileSelect = this._handleFileSelect.bind(this);
    this._handleActionChange = this._handleActionChange.bind(this);
    this._handleProjectSelect = this._handleProjectSelect.bind(this);
    this._handleProjectNameChange = this._handleProjectNameChange.bind(this);
    this._handleSelectAll = this._handleSelectAll.bind(this);
    this._handleVanillaPathSelect = this._handleVanillaPathSelect.bind(this);

    this.state = {
      isLoading: true,
      fileInfos: [],
      selectedFileIndex: 0,
      projectName: "",
      loadedProjects: [],
    };
  }

  componentDidMount(): void {
    this._load();
  }

  _navigateToHome() {
    window.location.hash = "#";
    if (this.props.onModeChangeRequested) {
      this.props.onModeChangeRequested(AppMode.home);
    }
  }

  async _load() {
    if (!this.props.files || this.props.files.length === 0) {
      this.setState({ isLoading: false, errorMessage: "No files provided" });
      return;
    }

    try {
      // Load vanilla content index for override detection
      await Database.loadPreviewVanillaInfoData();

      // Get loaded projects from CreatorTools and ensure their items are loaded
      const loadedProjects = this.props.creatorTools.projects || [];
      for (const project of loadedProjects) {
        if (!project.isLoaded) {
          await project.loadPreferencesAndFolder();
        }

        if (!project.isInflated) {
          await project.ensureInflated();
        }

        if (project.items.length === 0) {
          await project.inferProjectItemsFromFiles();
          if (project.items.length > 0) {
            await project.save();
          }
        }
      }

      // Process each file
      const fileInfos: IImportFileInfo[] = [];
      let suggestedProjectName = "";

      for (const file of this.props.files) {
        const fileInfo = await this._processFile(file, loadedProjects);
        fileInfos.push(fileInfo);

        // Use first file's base name as suggested project name
        if (!suggestedProjectName) {
          suggestedProjectName = StorageUtilities.getBaseFromName(file.name);
        }
      }

      this.setState({
        isLoading: false,
        fileInfos,
        projectName: suggestedProjectName,
        vanillaContentIndex: Database.previewVanillaContentIndex || undefined,
        loadedProjects,
        selectedFileIndex: fileInfos.length === 1 ? 0 : -1, // Auto-select if single file
      });
    } catch (e) {
      Log.debug("Error analyzing import files: " + e);
      this.setState({ isLoading: false, errorMessage: "Could not analyze the imported files. Please try again." });
    }
  }

  _readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result);
        } else {
          reject(new Error("FileReader did not return a string"));
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  async _processFile(file: File, projects: Project[]): Promise<IImportFileInfo> {
    const itemType = ProjectUtilities.inferJsonProjectItemTypeFromExtension(file.name);
    const matchingProjectItems: { project: Project; items: ProjectItem[] }[] = [];

    // Check for matching files in loaded projects
    for (const project of projects) {
      const matchingItems: ProjectItem[] = [];

      for (const item of project.items) {
        if (item.projectPath && item.projectPath.toLowerCase().endsWith("/" + file.name.toLowerCase())) {
          matchingItems.push(item);
        }
      }

      if (matchingItems.length > 0) {
        matchingProjectItems.push({ project, items: matchingItems });
      }
    }

    // Sort by most recently modified project first
    matchingProjectItems.sort((a, b) => {
      const aTime = a.project.modified?.getTime() ?? 0;
      const bTime = b.project.modified?.getTime() ?? 0;
      return bTime - aTime;
    });

    // Check for vanilla override paths
    let vanillaOverridePaths: string[] | undefined;
    if (Database.previewVanillaContentIndex) {
      const pathMatches = Database.previewVanillaContentIndex.getPathMatches(
        StorageUtilities.ensureStartsWithDelimiter(file.name)
      );
      if (pathMatches && pathMatches.length > 0) {
        vanillaOverridePaths = pathMatches;
      }
    }

    // Read file content for better type inference
    let fileContent: Uint8Array | string | undefined;
    try {
      if (file.size < 1024 * 1024) {
        // Only read files under 1MB
        const arrayBuffer = await file.arrayBuffer();
        fileContent = new Uint8Array(arrayBuffer);

        // Try to decode as text for JSON files
        const ext = StorageUtilities.getTypeFromName(file.name);
        if (ext === "json" || ext === "txt" || ext === "js" || ext === "ts") {
          try {
            fileContent = new TextDecoder().decode(fileContent);
          } catch {
            // Keep as Uint8Array
          }
        }
      }
    } catch (e) {
      Log.debug("Could not read file content: " + e);
    }

    // Determine default action
    let defaultAction = ImportFileAction.addToNewProject;
    let selectedProjectIndex: number | undefined;

    if (matchingProjectItems.length > 0) {
      defaultAction = ImportFileAction.updateExistingProject;
      selectedProjectIndex = 0;
    }

    // Suggest folder based on file type
    const suggestedFolder = this._getSuggestedFolder(file.name, itemType);

    // Generate preview URL for image files using data URL
    let previewUrl: string | undefined;
    const ext = StorageUtilities.getTypeFromName(file.name).toLowerCase();
    if (ext === "png" || ext === "jpg" || ext === "jpeg" || ext === "gif" || ext === "webp") {
      try {
        previewUrl = await this._readFileAsDataUrl(file);
      } catch (e) {
        Log.debug("Could not create preview URL: " + e);
      }
    }

    return {
      file,
      name: file.name,
      itemType,
      action: defaultAction,
      selectedProjectIndex,
      matchingProjectItems,
      vanillaOverridePaths,
      vanillaOverridePath: vanillaOverridePaths?.[0],
      fileContent,
      suggestedFolder,
      previewUrl,
    };
  }

  _getDefaultFolderForItemType(itemType: ProjectItemType): string | undefined {
    switch (itemType) {
      case ProjectItemType.entityTypeBehavior:
        return "entities";
      case ProjectItemType.blockTypeBehavior:
        return "blocks";
      case ProjectItemType.itemTypeBehavior:
        return "items";
      case ProjectItemType.recipeBehavior:
        return "recipes";
      case ProjectItemType.lootTableBehavior:
        return "loot_tables";
      case ProjectItemType.animationBehaviorJson:
        return "animations";
      case ProjectItemType.animationControllerBehaviorJson:
        return "animation_controllers";
      case ProjectItemType.spawnRuleBehavior:
        return "spawn_rules";
      default:
        return undefined;
    }
  }

  _getSuggestedFolder(fileName: string, itemType: ProjectItemType): string | undefined {
    const ext = StorageUtilities.getTypeFromName(fileName).toLowerCase();

    switch (ext) {
      case "png":
      case "jpg":
      case "jpeg":
      case "tga":
        return "textures";
      case "ogg":
      case "wav":
      case "mp3":
        return "sounds";
      case "json":
        return this._getDefaultFolderForItemType(itemType);
      case "lang":
        return "texts";
      case "mcfunction":
        return "functions";
      case "js":
      case "ts":
        return "scripts";
      default:
        return undefined;
    }
  }

  _handleFileSelect(index: number) {
    this.setState({ selectedFileIndex: index });
  }

  _handleActionChange(e: React.ChangeEvent<HTMLInputElement>) {
    const dataValue = e.target.value;
    if (!dataValue) return;

    const { fileInfos, selectedFileIndex } = this.state;
    if (selectedFileIndex < 0 || selectedFileIndex >= fileInfos.length) return;

    const newFileInfos = [...fileInfos];
    const fileInfo = { ...newFileInfos[selectedFileIndex] };

    if (dataValue === "createNew") {
      fileInfo.action = ImportFileAction.addToNewProject;
      fileInfo.vanillaOverridePath = undefined;
      fileInfo.selectedProjectIndex = undefined;
    } else if (typeof dataValue === "string" && dataValue.startsWith("updateExisting.")) {
      fileInfo.action = ImportFileAction.updateExistingProject;
      fileInfo.vanillaOverridePath = undefined;
      const projectName = dataValue.substring(15);
      const projectIndex = fileInfo.matchingProjectItems.findIndex(
        (mp) => (mp.project.name || "Untitled") === projectName
      );
      fileInfo.selectedProjectIndex = projectIndex >= 0 ? projectIndex : 0;
    } else if (typeof dataValue === "string" && dataValue.startsWith("vanilla.")) {
      fileInfo.action = ImportFileAction.addToNewProject;
      fileInfo.vanillaOverridePath = dataValue.substring(8);
      fileInfo.selectedProjectIndex = undefined;
    }

    newFileInfos[selectedFileIndex] = fileInfo;
    this.setState({ fileInfos: newFileInfos });
  }

  _handleProjectSelect(index: number) {
    const { fileInfos, selectedFileIndex } = this.state;
    if (selectedFileIndex < 0 || selectedFileIndex >= fileInfos.length) return;

    const newFileInfos = [...fileInfos];
    const fileInfo = { ...newFileInfos[selectedFileIndex] };

    fileInfo.selectedProjectIndex = index;

    newFileInfos[selectedFileIndex] = fileInfo;
    this.setState({ fileInfos: newFileInfos });
  }

  _handleVanillaPathSelect(path: string) {
    const { fileInfos, selectedFileIndex } = this.state;
    if (selectedFileIndex < 0 || selectedFileIndex >= fileInfos.length) return;

    const newFileInfos = [...fileInfos];
    const fileInfo = { ...newFileInfos[selectedFileIndex] };

    fileInfo.vanillaOverridePath = path;

    newFileInfos[selectedFileIndex] = fileInfo;
    this.setState({ fileInfos: newFileInfos });
  }

  _handleProjectNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    this.setState({ projectName: e.target.value });
  }

  _handleSelectAll(e: React.ChangeEvent<HTMLInputElement>) {
    const newAction = e.target.checked ? ImportFileAction.addToNewProject : ImportFileAction.updateExistingProject;
    const newFileInfos = this.state.fileInfos.map((fi) => ({
      ...fi,
      action: fi.matchingProjectItems.length > 0 ? newAction : fi.action,
    }));

    this.setState({ fileInfos: newFileInfos });
  }

  _handleCreate() {
    const { fileInfos, projectName } = this.state;

    // Separate files by action
    const newProjectFiles = fileInfos.filter((f) => f.action === ImportFileAction.addToNewProject);
    const updateFiles = fileInfos.filter((f) => f.action === ImportFileAction.updateExistingProject);

    // Handle updates to existing projects
    if (updateFiles.length > 0 && this.props.onUpdateExistingProject) {
      // Group by project
      const projectUpdates = new Map<Project, IImportFileInfo[]>();

      for (const fileInfo of updateFiles) {
        if (
          fileInfo.selectedProjectIndex !== undefined &&
          fileInfo.matchingProjectItems[fileInfo.selectedProjectIndex]
        ) {
          const project = fileInfo.matchingProjectItems[fileInfo.selectedProjectIndex].project;
          const existing = projectUpdates.get(project) || [];
          existing.push(fileInfo);
          projectUpdates.set(project, existing);
        }
      }

      for (const [project, files] of projectUpdates) {
        this.props.onUpdateExistingProject(project, files);
      }
    }

    // Handle new project files
    if (newProjectFiles.length > 0 && this.props.onNewProjectFromFilesSelected) {
      this.props.onNewProjectFromFilesSelected(newProjectFiles, projectName);
    }

    // Navigate home if everything processed
    if (newProjectFiles.length === 0 && updateFiles.length > 0) {
      this._navigateToHome();
    }
  }

  _renderFileList() {
    const { fileInfos, selectedFileIndex } = this.state;

    if (fileInfos.length <= 1) {
      return null;
    }

    return (
      <div className="iff-fileList">
        <div className="iff-fileListHeader">Files to Import ({fileInfos.length})</div>
        <div className="iff-fileListItems">
          {fileInfos.map((fi, index) => (
            <div
              key={index}
              className={`iff-fileListItem ${index === selectedFileIndex ? "iff-fileListItemSelected" : ""}`}
              onClick={() => this.setState({ selectedFileIndex: index })}
            >
              {fi.previewUrl ? (
                <img src={fi.previewUrl} alt={fi.name} className="iff-filePreview" />
              ) : (
                <FontAwesomeIcon icon={faFile} className="iff-fileIcon" />
              )}
              <span className="iff-fileName">{fi.name}</span>
              <span className="iff-fileStatus">{this._getFileStatusIcon(fi)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  _getFileStatusText(fi: IImportFileInfo): string {
    if (fi.action === ImportFileAction.updateExistingProject && fi.matchingProjectItems.length > 0) {
      const projIndex = fi.selectedProjectIndex ?? 0;
      return `Update in ${fi.matchingProjectItems[projIndex]?.project.name || "project"}`;
    } else if (fi.vanillaOverridePath) {
      return `Override ${fi.vanillaOverridePath}`;
    }
    return "Add to new project";
  }

  _getFileStatusIcon(fi: IImportFileInfo) {
    if (fi.action === ImportFileAction.updateExistingProject) {
      return <FontAwesomeIcon icon={faCheckCircle} className="iff-statusUpdate" title="Will update existing" />;
    } else if (fi.vanillaOverridePath) {
      return <FontAwesomeIcon icon={faFolderOpen} className="iff-statusOverride" title="Will override vanilla" />;
    }
    return <FontAwesomeIcon icon={faFolder} className="iff-statusNew" title="Will add to new project" />;
  }

  _renderFileOptions() {
    const { fileInfos, selectedFileIndex } = this.state;

    if (selectedFileIndex < 0 || selectedFileIndex >= fileInfos.length) {
      return <div className="iff-selectFile">Select a file from the list to configure import options</div>;
    }

    const fileInfo = fileInfos[selectedFileIndex];
    const radioItems: { name: string; value: string; label: string }[] = [];

    // Option: Add to new project
    let addNewLabel = "Add to new project";
    if (fileInfo.suggestedFolder) {
      addNewLabel += ` (in ${fileInfo.suggestedFolder}/)`;
    }
    radioItems.push({
      name: "createNew",
      value: "createNew",
      label: addNewLabel,
    });

    // Option: Update existing project (if matches found)
    if (fileInfo.matchingProjectItems.length > 0) {
      for (const matchingProject of fileInfo.matchingProjectItems) {
        const projectName = matchingProject.project.name || "Untitled";
        const matchCount = matchingProject.items.length;
        radioItems.push({
          name: `updateExisting.${projectName}`,
          value: `updateExisting.${projectName}`,
          label: `Update in "${projectName}" (${matchCount} matching file${matchCount > 1 ? "s" : ""})`,
        });
      }
    }

    // Option: Override vanilla file paths
    if (fileInfo.vanillaOverridePaths && fileInfo.vanillaOverridePaths.length > 0) {
      for (const path of fileInfo.vanillaOverridePaths) {
        radioItems.push({
          name: `vanilla.${path}`,
          value: `vanilla.${path}`,
          label: `Override vanilla: ${path}`,
        });
      }
    }

    let selectedValue = "createNew";
    if (fileInfo.action === ImportFileAction.updateExistingProject && fileInfo.matchingProjectItems.length > 0) {
      const projectIndex = fileInfo.selectedProjectIndex ?? 0;
      const projectName = fileInfo.matchingProjectItems[projectIndex]?.project.name || "Untitled";
      selectedValue = `updateExisting.${projectName}`;
    } else if (fileInfo.vanillaOverridePath) {
      selectedValue = `vanilla.${fileInfo.vanillaOverridePath}`;
    }

    return (
      <div className="iff-fileOptions">
        <div className="iff-fileOptionsHeader">
          {fileInfo.previewUrl ? (
            <img src={fileInfo.previewUrl} alt={fileInfo.name} className="iff-filePreviewLarge" />
          ) : (
            <FontAwesomeIcon icon={faFile} className="iff-fileIcon" />
          )}
          <span className="iff-fileOptionsName">{fileInfo.name}</span>
        </div>

        <div className="iff-fileOptionsContent">
          <div className="iff-optionSection">
            <div className="iff-optionLabel">Import Action:</div>
            <div className="iff-radioGroupScroll">
              <RadioGroup value={selectedValue} onChange={this._handleActionChange}>
                {radioItems.map((item) => (
                  <FormControlLabel key={item.name} value={item.value} control={<Radio />} label={item.label} />
                ))}
              </RadioGroup>
            </div>
          </div>
        </div>

        {fileInfo.action === ImportFileAction.updateExistingProject &&
          fileInfo.matchingProjectItems.length > 0 &&
          fileInfo.selectedProjectIndex !== undefined && (
            <div className="iff-filesToUpdateSection">
              <div className="iff-optionLabel">Files to update:</div>
              <div className="iff-matchingFiles">
                {fileInfo.matchingProjectItems[fileInfo.selectedProjectIndex]?.items.map((item, idx) => (
                  <div key={idx} className="iff-matchingFile">
                    {item.projectPath}
                  </div>
                ))}
              </div>
            </div>
          )}
      </div>
    );
  }

  render() {
    const colors = getThemeColors();
    const { fileInfos, isLoading, errorMessage, projectName } = this.state;

    if (isLoading) {
      return (
        <div className="iff-outer">
          <header
            className="iff-header"
            style={{
              borderBottomColor: colors.background2,
            }}
          >
            <HomeHeader mode={CreatorToolsHost.theme === CreatorToolsThemeStyle.dark ? "dark" : "light"} />
          </header>
          <main className="iff-main">
            <div className="iff-content">
              <div className="iff-loading">Analyzing files...</div>
            </div>
          </main>
          <footer className="iff-footer">
            <HomeFooter
              theme={this.props.theme}
              creatorTools={this.props.creatorTools}
              displayStorageHandling={false}
            />
          </footer>
        </div>
      );
    }

    if (errorMessage) {
      return (
        <div className="iff-outer">
          <header
            className="iff-header"
            style={{
              borderBottomColor: colors.background2,
            }}
          >
            <HomeHeader mode={CreatorToolsHost.theme === CreatorToolsThemeStyle.dark ? "dark" : "light"} />
          </header>
          <main className="iff-main">
            <div className="iff-content">
              <div className="iff-error">
                <FontAwesomeIcon icon={faTriangleExclamation} className="iff-errorIcon" />
                <div className="iff-errorText">{errorMessage}</div>
              </div>
            </div>
            <div className="iff-buttonBar">
              <Button onClick={this._navigateToHome} variant="text">
                Back to Home
              </Button>
            </div>
          </main>
          <footer className="iff-footer">
            <HomeFooter
              theme={this.props.theme}
              creatorTools={this.props.creatorTools}
              displayStorageHandling={false}
            />
          </footer>
        </div>
      );
    }

    // Check if any files will go to new project
    const newProjectFileCount = fileInfos.filter((f) => f.action === ImportFileAction.addToNewProject).length;
    const updateFileCount = fileInfos.filter((f) => f.action === ImportFileAction.updateExistingProject).length;

    let createButtonText = "Import";
    if (newProjectFileCount > 0 && updateFileCount > 0) {
      createButtonText = `Create Project & Update ${updateFileCount} File${updateFileCount > 1 ? "s" : ""}`;
    } else if (newProjectFileCount > 0) {
      createButtonText = "Create New Project";
    } else if (updateFileCount > 0) {
      createButtonText = `Update ${updateFileCount} File${updateFileCount > 1 ? "s" : ""}`;
    }

    return (
      <div className="iff-outer">
        <header
          className="iff-header"
          style={{
            borderBottomColor: colors.background2,
          }}
        >
          <HomeHeader mode={CreatorToolsHost.theme === CreatorToolsThemeStyle.dark ? "dark" : "light"} />
        </header>
        <main className="iff-main">
          <div className="iff-content">
            <h2 className="iff-title">Import Files</h2>

            <div className={fileInfos.length <= 1 ? "iff-layout-single" : "iff-layout"}>
              {this._renderFileList()}

              <div className="iff-optionsPanel">
                {this._renderFileOptions()}

                {newProjectFileCount > 0 && (
                  <div className="iff-newProjectSection">
                    <div className="iff-sectionHeader">New Project Settings</div>
                    <div className="iff-projectNameRow">
                      <label className="iff-projectNameLabel">Project Name:</label>
                      <input
                        type="text"
                        className="iff-projectNameInput"
                        value={projectName}
                        onChange={(e) => this.setState({ projectName: e.target.value })}
                      />
                    </div>
                    <div className="iff-newProjectInfo">
                      {newProjectFileCount} file{newProjectFileCount > 1 ? "s" : ""} will be added to new project
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="iff-buttonBar">
            <Button onClick={this._navigateToHome} variant="text">
              Cancel
            </Button>
            <Button variant="contained" color="primary" onClick={this._handleCreate} disabled={fileInfos.length === 0}>
              {createButtonText}
            </Button>
          </div>
        </main>
        <footer className="iff-footer">
          <HomeFooter theme={this.props.theme} creatorTools={this.props.creatorTools} displayStorageHandling={false} />
        </footer>
      </div>
    );
  }
}
