import { useCallback, useEffect, useState } from "react";
import { MouseEvent, SyntheticEvent } from "react";
import CreatorTools from "../../../app/CreatorTools";
import { ProjectEditorMode } from "../../ProjectEditorUtilities";
import IStorage from "../../../storage/IStorage";
import StorageUtilities from "../../../storage/StorageUtilities";
import { AppMode, NewProjectTemplateType } from "../../App";
import Log from "../../../core/Log";
import Utilities from "../../../core/Utilities";
import AppServiceProxy, { AppServiceProxyCommands } from "../../../core/AppServiceProxy";
import Project from "../../../app/Project";
import { ShorthandValue, ListItemProps, List, selectableListBehavior, ThemeInput } from "@fluentui/react-northstar";
import { faNewspaper } from "@fortawesome/free-regular-svg-icons";
import { faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import CreatorToolsHost, { HostType } from "../../../app/CreatorToolsHost";
import { MinecraftFlavor } from "../../../app/ICreatorToolsData";
import FileSystemFolder from "../../../storage/FileSystemFolder";
import FileSystemStorage from "../../../storage/FileSystemStorage";
import MinecraftBox from "../../MinecraftBox";
import MinecraftButton from "../../MinecraftButton";
import WebUtilities from "../../WebUtilities";
import IAppProps from "../../IAppProps";
import { GalleryProjectCommand } from "../../ProjectGallery";
import { LocalFolderType, LocalGalleryCommand } from "../../LocalGalleryCommand";
import IProjectSeed from "../../../app/IProjectSeed";
import IFolder from "../../../storage/IFolder";
import IGallery from "../../../app/IGallery";

export enum HomeEffect {
  none = 0,
  dragOver = 1,
}

enum HomeDialogMode {
  none = 0,
  newProject = 1,
  errorMessage = 2,
  confirmProjectDelete = 3,
  infoMessage = 4,
  webLocalDeploy = 5,
}

type HomeMonolithValues = {
  introArea?: JSX.Element[];
  accessoryToolArea?: JSX.Element;
  recentsArea?: JSX.Element[];
  messageArea?: JSX.Element[];
  actionsToolbar?: {
    icon: JSX.Element;
    key: string;
    onClick: () => Promise<void>;
    title: string;
  }[];
  errorMessageContainer?: JSX.Element;
  localGallery?: JSX.Element;
  recentProjects?: Project[];
  handleExportAll: () => Promise<void>;
  handleInspectFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleOpenLocalFolderClick: () => void;
  handleProjectClicked: (event: SyntheticEvent, project: Project) => void;
  onNewProjectFromFolderInstanceSelected?: (folder: IFolder, name?: string, isDocumentationProject?: boolean) => void;
};

interface IHomeProps extends IAppProps {
  theme: ThemeInput<any>;
  errorMessage: string | undefined;
  heightOffset: number;
  visualSeed?: number;
  isPersisted?: boolean;
  onModeChangeRequested?: (mode: AppMode) => void;
  onProjectSelected?: (project: Project) => void;
  onLog: (message: string) => Promise<void>;
  onSetProject: (project: Project) => void;
  onGalleryItemCommand: (command: GalleryProjectCommand, newProjectSeed: IProjectSeed) => void;
  onLocalGalleryItemCommand: (command: LocalGalleryCommand, folderType: LocalFolderType, folder: IFolder) => void;
  onNewProjectSelected?: (
    newProjectSeed: IProjectSeed,
    newProjectType: NewProjectTemplateType,
    additionalFilePath?: string,
    additionalFile?: File,
    editorStartMode?: ProjectEditorMode,
    isReadOnly?: boolean
  ) => void;
  onNewProjectFromFolderSelected?: (folder: string) => void;
  onProgressLog?: (message: string) => void;
  onNewProjectFromFolderInstanceSelected?: (folder: IFolder, name?: string, isDocumentationProject?: boolean) => void;
}

interface IHomeState {
  gallery: IGallery | undefined;
  dialogMode?: HomeDialogMode;
  effect?: HomeEffect;
  isDeployingToComMojang: boolean;
  selectedProject?: string;
  search?: string;
  errorMessage?: string;
  inlineUpdateMessage?: string;
  inlineLoadingMessage?: string;
  newProjectSeed?: IProjectSeed;
  contextFocusedProject?: number;
}

/* 
  legacy functionality wrapped in a hook. 
  Some things had to be updated away from class component specific logic, otherwise mostly left as-is
  Eventually, logic should be moved into more focused components/hooks
*/
export default function useHomeMonolith(creatorTools: CreatorTools, props: IHomeProps): HomeMonolithValues {
  const [state, setState] = useState<IHomeState>({
    gallery: undefined,
    effect: HomeEffect.none,
    isDeployingToComMojang: creatorTools.isDeployingToComMojang,
    dialogMode: HomeDialogMode.errorMessage,
    errorMessage: props.errorMessage,
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.setTimeout(_startDelayLoadItems, 10);
    }
    //didMount
    if (typeof window !== "undefined") {
      window.document.addEventListener("dragleave", _handleFileDragOut);
      window.document.body.addEventListener("dragover", _handleFileDragOver);
      window.document.body.addEventListener("drop", _handleFileDrop);
    }

    _updateCreatorTools();

    //unmount
    return () => {
      if (typeof window !== "undefined") {
        window.document.removeEventListener("dragleave", _handleFileDragOut);
        window.document.body.removeEventListener("dragover", _handleFileDragOver);
        window.document.body.removeEventListener("drop", _handleFileDrop);
      }
    };
    // eslint-disable-next-line
  }, [creatorTools]);

  const _onDeploymentStorageChanged = useCallback((source: CreatorTools, deploymentStorage: IStorage | null) => {
    setState({
      gallery: state.gallery,
      dialogMode: state.dialogMode,
      isDeployingToComMojang: creatorTools.isDeployingToComMojang,
      effect: state.effect,
      search: state.search,
      errorMessage: state.errorMessage,
      newProjectSeed: state.newProjectSeed,
      contextFocusedProject: state.contextFocusedProject,
    });
    // eslint-disable-next-line
  }, []);

  async function _updateCreatorTools() {
    if (!creatorTools) {
      return;
    }

    if (!creatorTools.onLoaded.has(_onCartoLoaded)) {
      creatorTools.onLoaded.subscribe(_onCartoLoaded);
    }

    if (!creatorTools.onDeploymentStorageChanged.has(_onDeploymentStorageChanged)) {
      creatorTools.onDeploymentStorageChanged.subscribe(_onDeploymentStorageChanged);
    }

    await creatorTools.load();

    if (creatorTools.galleryLoaded) {
      setState({
        gallery: creatorTools.gallery,
        dialogMode: state.dialogMode,
        isDeployingToComMojang: creatorTools.isDeployingToComMojang,
      });
    } else {
      creatorTools.onGalleryLoaded.subscribe(_onGalleryLoaded);
      creatorTools.loadGallery();
    }
  }

  function _handleFileDragOut(event: any) {
    if (state && state.dialogMode !== HomeDialogMode.none) {
      return;
    }

    const top = event.pageY;
    const left = event.pageX;
    const right = document.body.clientWidth - left;
    const bottom = document.body.clientHeight - top;

    if (top < 10 || right < 10 || bottom < 10 || left < 10) {
      _stopDragEffect();
    }
  }

  function _stopDragEffect() {
    if (state !== undefined) {
      if (state.effect === HomeEffect.dragOver) {
        setState({
          gallery: state.gallery,
          dialogMode: state.dialogMode,
          isDeployingToComMojang: creatorTools.isDeployingToComMojang,
          search: state.search,
          effect: HomeEffect.none,
          newProjectSeed: state.newProjectSeed,
        });
      }
    }
  }

  function _handleFileDragOver(event: any) {
    if (state !== undefined) {
      if (state.dialogMode !== HomeDialogMode.none) {
        return;
      }

      if (state.effect !== HomeEffect.dragOver) {
        const top = event.pageY;
        const left = event.pageX;
        const right = document.body.clientWidth - left;
        const bottom = document.body.clientHeight - top;

        if (top > 10 && right > 10 && bottom > 10 && left > 10) {
          setState({
            gallery: state.gallery,
            dialogMode: state.dialogMode,
            isDeployingToComMojang: creatorTools.isDeployingToComMojang,
            effect: HomeEffect.dragOver,
            newProjectSeed: state.newProjectSeed,
          });
        }
      }
    }

    if (event == null) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
  }

  async function _handleDirectoryHandle(dirHandle: FileSystemDirectoryHandle, isDocumentationProject?: boolean) {
    const name = dirHandle.name.toLowerCase();

    if (name === "mc_lnk" || name === "mcpvw_lnk" || name.indexOf("bds") >= 0 || name.indexOf("server") >= 0) {
      let fss = new FileSystemStorage(dirHandle as FileSystemDirectoryHandle, dirHandle.name);

      const safeMessage = await (fss.rootFolder as FileSystemFolder).getFirstUnsafeError();

      if (safeMessage !== undefined) {
        Log.debugAlert(safeMessage);
        return false;
      }

      CreatorToolsHost.deploymentStorage = fss;

      creatorTools.isDeployingToComMojang = true;
      creatorTools.updateDeploymentStorage(fss);
      creatorTools.ensureMinecraft(MinecraftFlavor.deploymentStorage);

      setState({
        gallery: state.gallery,
        search: state.search,
        isDeployingToComMojang: creatorTools.isDeployingToComMojang,
        newProjectSeed: state.newProjectSeed,
        effect: HomeEffect.none,
        dialogMode: HomeDialogMode.none,
        inlineLoadingMessage: state.inlineLoadingMessage,
        inlineUpdateMessage: "Set deployment folder as '" + name + "'.",
      });

      return true;
    } else {
      if (props.onProgressLog) {
        props.onProgressLog("Scanning folder '" + dirHandle.name + "'...");
      }

      let fss = new FileSystemStorage(dirHandle as FileSystemDirectoryHandle, dirHandle.name);

      const safeMessage = await (fss.rootFolder as FileSystemFolder).getFirstUnsafeError();

      if (safeMessage !== undefined) {
        setState({
          errorMessage:
            "Folder has unsupported files within it. Please choose a folder on your device that only has Minecraft asset files in it (.json, .png, .mcfunction, etc.)\n\nDetails: " +
            safeMessage,
          dialogMode: HomeDialogMode.errorMessage,
          ...state,
        });
        return false;
      }

      if (props.onNewProjectFromFolderInstanceSelected) {
        props.onNewProjectFromFolderInstanceSelected(fss.rootFolder, dirHandle.name, isDocumentationProject);
        return true;
      }
    }

    return false;
  }

  async function _handleFileDrop(ev: DragEvent): Promise<any> {
    if (state && state.dialogMode !== HomeDialogMode.none) {
      return;
    }

    ev.preventDefault();
    ev.stopPropagation();

    if (ev == null || ev.dataTransfer == null) {
      return;
    }

    if (ev.dataTransfer.items) {
      for (var i = 0; i < ev.dataTransfer.items.length; i++) {
        const dtitem = ev.dataTransfer.items[i];

        let entry: any | undefined;

        if (dtitem.webkitGetAsEntry) {
          entry = dtitem.webkitGetAsEntry();
        } else if ((dtitem as any).getAsEntry) {
          entry = (dtitem as any).getAsEntry();
        }

        if (entry && entry.isDirectory) {
          const dirHandle = await dtitem.getAsFileSystemHandle();

          if (dirHandle) {
            const perm = await dirHandle.requestPermission({
              mode: "readwrite",
            });

            if (perm) {
              await _handleDirectoryHandle(dirHandle as FileSystemDirectoryHandle);
            }
          } else {
            const directoryReader = (entry as any).createReader();
            //const me = this;

            directoryReader.readEntries(function (entries: any) {
              entries.forEach((childEntry: any) => {
                _processInputtedEntry((entry as any).fullPath, childEntry);
              });
            });
          }
        } else if (dtitem.kind === "file") {
          const file = dtitem.getAsFile();
          if (file) {
            _processIncomingFile("/", file);
          }
        }
      }
    }

    _stopDragEffect();
  }

  const _processIncomingFile = useCallback(
    (path: string, file: File, editorStartMode?: ProjectEditorMode, isReadOnly?: boolean) => {
      if (file != null && props.onNewProjectSelected) {
        let fileName = "File";

        if (file.name) {
          fileName = file.name;

          fileName = StorageUtilities.getBaseFromName(fileName);
        }

        props.onNewProjectSelected(
          {
            name: fileName,
          },
          NewProjectTemplateType.empty,
          path,
          file,
          editorStartMode,
          isReadOnly
        );
      }
    },
    [props]
  );

  const _processInputtedEntry = useCallback(
    (path: string, entry: any) => {
      if (entry.file) {
        entry.file((file: File) => {
          _processIncomingFile(path, file);
        });
      }
    },
    [_processIncomingFile]
  );

  function _startDelayLoadItems() {
    //this was already commented out in the original code...
    // load things in the background while we're on the home screen.
    // Database.loadContent();
    // Database.loadDefaultBehaviorPack();
  }

  function _onGalleryLoaded() {
    if (creatorTools) {
      creatorTools.onGalleryLoaded.unsubscribe(_onGalleryLoaded);
    }

    setState({
      gallery: creatorTools.gallery,
      dialogMode: state.dialogMode,
      effect: state.effect,
      isDeployingToComMojang: creatorTools.isDeployingToComMojang,
      newProjectSeed: state.newProjectSeed,
    });
  }

  async function _handleExportAll() {
    const name = "mctbackup." + Utilities.getDateSummary(new Date()) + ".zip";

    setState({
      gallery: state.gallery,
      search: state.search,
      newProjectSeed: state.newProjectSeed,
      isDeployingToComMojang: creatorTools.isDeployingToComMojang,
      effect: HomeEffect.none,
      dialogMode: HomeDialogMode.none,
      inlineLoadingMessage: "Creating backup zip as '" + name + "'...",
      inlineUpdateMessage: state.inlineUpdateMessage,
    });

    const operId = await creatorTools.notifyOperationStarted("Exporting all projects as zip.");

    const zipStorage = await creatorTools.getExportZip();

    const zipBinary = await zipStorage.generateBlobAsync();

    await creatorTools.notifyOperationEnded(operId, "Export of projects created; downloading");

    saveAs(zipBinary, name);

    setState({
      gallery: state.gallery,
      search: state.search,
      newProjectSeed: state.newProjectSeed,
      isDeployingToComMojang: creatorTools.isDeployingToComMojang,
      effect: HomeEffect.none,
      dialogMode: HomeDialogMode.none,
      inlineLoadingMessage: undefined,
      inlineUpdateMessage: state.inlineUpdateMessage,
    });
  }

  function _onCartoLoaded(source: CreatorTools, target: CreatorTools) {
    forceUpdate();
    _loadAsync();
  }

  async function _loadAsync() {
    // add any async loading code here.
    forceUpdate();
  }

  function forceUpdate() {
    setState(state);
  }

  function _handleContextMenu(e: MouseEvent<HTMLUListElement, Event>, data?: any | undefined) {
    if (e.currentTarget && e.currentTarget.children.length > 0 && e.button < 0) {
      let curIndex = 0;
      const eltChildren = e.currentTarget.children;

      for (let i = 0; i < eltChildren.length; i++) {
        const elt = eltChildren[i];
        if ((elt as HTMLElement).tabIndex === 0) {
          setState({
            gallery: state.gallery,
            dialogMode: state.dialogMode,
            isDeployingToComMojang: creatorTools.isDeployingToComMojang,
            effect: state.effect,
            search: state.search,
            errorMessage: state.errorMessage,
            newProjectSeed: state.newProjectSeed,
            contextFocusedProject: curIndex,
          });
          e.preventDefault();
          return;
        }
        curIndex++;
      }
    }
  }

  async function _handleOpenFolderViaAppServiceClick() {
    const result = await AppServiceProxy.sendAsync(AppServiceProxyCommands.openFolder, "");

    if (result && result.length > 0) {
      if (props.onNewProjectFromFolderSelected !== undefined) {
        props.onNewProjectFromFolderSelected(result);
      }
    }
  }

  async function _handleOpenLocalFolderClick() {
    if (CreatorToolsHost.hostType === HostType.electronWeb) {
      const result = await AppServiceProxy.sendAsync(AppServiceProxyCommands.openFolder, "");

      if (result && result.length > 0) {
        if (props.onNewProjectFromFolderSelected !== undefined) {
          props.onNewProjectFromFolderSelected(result);
        }
      }

      return;
    }

    await openLocalFolder(false);
  }

  async function _handleOpenLocalFolderForDocumentationClick() {
    await openLocalFolder(true);
  }

  async function openLocalFolder(isDocumentationProject?: boolean) {
    try {
      const result = (await window.showDirectoryPicker({
        mode: "readwrite",
      })) as FileSystemDirectoryHandle | undefined;

      if (result) {
        await _handleDirectoryHandle(result as FileSystemDirectoryHandle, isDocumentationProject);
      }
    } catch (e) {
      // likely an AbortError, which is the user canceling the dialog.
    }
  }

  async function _handleProjectClicked(_event: SyntheticEvent, project: Project) {
    if (props.onProjectSelected) {
      props.onProjectSelected(project);
    }
  }

  function _compareProjects(projectA: Project, projectB: Project) {
    if (projectA.modified === null || projectB.modified === null) {
      return 0;
    }

    return projectB.modified.getTime() - projectA.modified.getTime();
  }

  const _handleFileUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!event.target || !event.target.files || event.target.files.length <= 0 || !creatorTools.packStorage) {
        return;
      }

      const file = event.target.files[0];

      if (!file) {
        return;
      }

      _processIncomingFile("/", file);
    },
    [creatorTools, _processIncomingFile]
  );

  // function _recentItemContextMenuClick(e: SyntheticEvent<HTMLElement, Event>, data?: any | undefined) {
  //   if (data !== undefined && data.tag !== undefined && carto !== null) {
  //     const project = carto.getProjectByName(data.tag);

  //     if (project !== null) {
  //       if (data.content === "Delete") {
  //         setState({
  //           gallery: state.gallery,
  //           dialogMode: HomeDialogMode.confirmProjectDelete,
  //           isDeployingToComMojang: carto.isDeployingToComMojang,
  //           search: state.search,
  //           effect: state.effect,
  //           selectedProject: data.tag,
  //           contextFocusedProject: undefined,
  //         });
  //       }
  //     }
  //   }

  //   e.preventDefault();
  //   e.stopPropagation();
  // }

  function _handleInspectFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    if (!event.target || !event.target.files || event.target.files.length <= 0 || !creatorTools.packStorage) {
      return;
    }

    const file = event.target.files[0];

    if (!file) {
      return;
    }

    _processIncomingFile("/", file, ProjectEditorMode.inspector, true);
  }

  const projectListItems: ShorthandValue<ListItemProps>[] = [];

  const browserWidth = WebUtilities.getWidth();

  const events = {
    handleExportAll: _handleExportAll,
    handleInspectFileUpload: _handleInspectFileUpload,
    handleFileUpload: _handleFileUpload,
    handleOpenLocalFolderClick: _handleOpenLocalFolderClick,
    handleProjectClicked: _handleProjectClicked,
    onNewProjectFromFolderInstanceSelected: props.onNewProjectFromFolderInstanceSelected,
  };

  if (props === null || creatorTools === null) {
    return events;
  }

  const sortedProjects = creatorTools.projects.sort(_compareProjects);

  let messageArea = [];
  let toolBin: any[] = [];

  messageArea.push(
    <div className="home-areaLoading" key="loadingLabel">
      Loading...
    </div>
  );

  if (state !== null && state.gallery !== undefined) {
    messageArea = [];

    if (state !== null && state.inlineUpdateMessage) {
      messageArea.push(
        <div
          className="home-inlineMessage"
          key="loadingLabel"
          style={{
            backgroundColor: props.theme.siteVariables?.colorScheme.brand.background3,
            color: props.theme.siteVariables?.colorScheme.brand.foreground3,
          }}
        >
          {state.inlineUpdateMessage}
        </div>
      );
    }
    if (state !== null && state.inlineLoadingMessage) {
      messageArea.push(
        <div
          className="home-inlineMessage"
          key="loadingLabel"
          style={{
            backgroundColor: props.theme.siteVariables?.colorScheme.brand.background3,
            color: props.theme.siteVariables?.colorScheme.brand.foreground3,
          }}
        >
          <img className="home-loadingIcon" src="loading.gif" alt="Waiting spinner" />
          {state.inlineLoadingMessage}
        </div>
      );
    }

    toolBin.push(
      <MinecraftBox theme={props.theme} key="home-validateTool" className="home-toolTile">
        <div className="home-toolTileInner">
          <h3
            className="home-toolTile-label"
            style={{
              color: props.theme.siteVariables?.colorScheme.brand.foreground3,
            }}
          >
            <span className="home-iconAdjust">
              <FontAwesomeIcon icon={faMagnifyingGlass} className="fa-lg home-iconAdjust" />
            </span>
            <span>&#160;Validate/Inspect Content</span>
          </h3>
          <div className="home-toolTile-instruction">
            Upload a zip/MCAddon/MCPack/MCWorld of Minecraft files to get an Inspector report.
          </div>
          <input
            type="file"
            accept=".mcaddon, .mcpack, .mcworld, .mcproject, .mctemplate, .zip"
            title="Upload a .mcpack, .mcaddon, or ZIP file to validate"
            className="home-inspectFileUpload"
            style={{
              color: props.theme.siteVariables?.colorScheme.brand.foreground3,
              backgroundColor: props.theme.siteVariables?.colorScheme.brand.background5,
            }}
            onChange={_handleInspectFileUpload}
          />
        </div>
      </MinecraftBox>
    );

    if (Utilities.isPreview) {
      toolBin.push(
        <MinecraftButton
          onClick={_handleOpenLocalFolderForDocumentationClick}
          theme={props.theme}
          key="home-documentationEditor"
          className="home-toolTile"
        >
          <div className="home-toolTileInner">
            <h3 className="home-toolTile-label">
              <span className="home-iconAdjust">
                <FontAwesomeIcon icon={faNewspaper} className="fa-lg home-iconAdjust" />
              </span>
              <span>&#160;Documentation Editor</span>
            </h3>
            <div className="home-toolTile-instruction">
              Open on the GitHub minecraft-creator/content folder on your PC.
            </div>
            <div
              style={{
                color: props.theme.siteVariables?.colorScheme.brand.foreground1,
                backgroundColor: props.theme.siteVariables?.colorScheme.brand.background5,
              }}
              className="home-toolTile-button"
            >
              Open minecraft-creator/content
            </div>
          </div>
        </MinecraftButton>
      );
    }
  }

  const introArea = [];
  const recentsArea = [];

  if (projectListItems.length > 0) {
    if (AppServiceProxy.hasAppServiceOrSim) {
      introArea.push(
        <div key="recentlyOpenedLabel" className="home-projects">
          Projects
        </div>
      );
    } else {
      introArea.push(
        <h2 key="recentlyOpenedLabelA" className="home-projects">
          Projects
        </h2>
      );
      if (props.isPersisted) {
        introArea.push(
          <div key="recentlyNoteA" className="home-projects-note">
            (stored in this device browser's storage.)
          </div>
        );
      } else {
        introArea.push(
          <div key="recentlyNoteA" className="home-projects-note">
            (stored in this device browser's temporary storage.)
          </div>
        );
      }
    }
    recentsArea.push(
      <div
        key="homeProjectsList"
        className="home-projects-list"
        style={{
          height: browserWidth >= 800 ? "calc(100vh - " + (332 + props.heightOffset) + "px)" : "",
        }}
      >
        <List
          selectable
          accessibility={selectableListBehavior}
          defaultSelectedIndex={-1}
          onContextMenu={_handleContextMenu}
          items={projectListItems}
          aria-label="List of edited projects"
        />
      </div>
    );
  }

  let errorMessageContainer = <></>;

  if (props.errorMessage) {
    errorMessageContainer = <div className="home-error">{props.errorMessage}</div>;
  }

  return {
    introArea,
    recentsArea,
    messageArea,
    errorMessageContainer,
    recentProjects: sortedProjects,
    ...events,
  };
}
