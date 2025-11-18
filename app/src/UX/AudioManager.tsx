import { Component } from "react";
import IFile from "../storage/IFile";
import "./AudioManager.css";
import React from "react";
import IPersistable from "./IPersistable";
import CreatorTools from "../app/CreatorTools";
import { ThemeInput, Toolbar } from "@fluentui/react-northstar";
import WaveformPlaylist, { IWaveformEventEmitter, WaveformPlaylistObj } from "waveform-playlist";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBackward,
  faCircle,
  faForward,
  faICursor,
  faMagnifyingGlassMinus,
  faMagnifyingGlassPlus,
  faMousePointer,
  faPause,
  faPlay,
  faStop,
} from "@fortawesome/free-solid-svg-icons";
import StorageUtilities from "../storage/StorageUtilities";
import { faEdit } from "@fortawesome/free-regular-svg-icons";
import CreatorToolsHost, { CreatorToolsThemeStyle } from "../app/CreatorToolsHost";
import Project from "../app/Project";
import AudioItemProperties from "./AudioItemProperties";

export enum AudioManagerMode {
  view = 0,
  edit = 1,
  record = 2,
}

interface IAudioManagerProps {
  file?: IFile;
  theme: ThemeInput<any>;
  initialContent?: Uint8Array;
  placeholder?: string;
  visualSeed?: number;
  setActivePersistable?: (persistObject: IPersistable) => void;
  heightOffset?: number;
  readOnly: boolean;
  creatorTools: CreatorTools;
  project: Project;
  onUpdateContent?: (newContent: Uint8Array) => void;
  onCommit?: (newContent: Uint8Array) => void;
}

interface IAudioManagerState {
  fileToEdit?: IFile;
  content?: Uint8Array;
  mode: AudioManagerMode;
}

interface IViewState {
  startTime?: number;
  endTime?: number;
}

export default class AudioManager extends Component<IAudioManagerProps, IAudioManagerState> {
  private rootElt: React.RefObject<HTMLDivElement>;
  private statusElt: React.RefObject<HTMLDivElement>;
  private viewAudioElement: HTMLDivElement | null = null;
  private viewPlaylist: WaveformPlaylistObj | null = null;
  private recordPlaylist: WaveformPlaylistObj | null = null;
  private editAudioElement: HTMLDivElement | null = null;
  private recordAudioElement: HTMLDivElement | null = null;
  private editPlaylist: WaveformPlaylistObj | null = null;
  private coreEditFilePath: string | undefined = undefined;
  private coreViewFilePath: string | undefined = undefined;
  private _isPersisting: boolean = false;
  private _pendingPersistRequests: ((value: unknown) => void)[] = [];
  private _activeEditorPersistable?: IPersistable;
  private _setToViewAfterPersist = false;

  private viewState: IViewState = {};
  private editState: IViewState = {};

  private canRecord = false;
  private _editorThumbPrint: string = "";
  private _viewThumbPrint: string = "";
  private activeEventEmitter: IWaveformEventEmitter | undefined = undefined;
  private editEventEmitter: IWaveformEventEmitter | undefined = undefined;
  private recordEventEmitter: IWaveformEventEmitter | undefined = undefined;

  constructor(props: IAudioManagerProps) {
    super(props);
    this.rootElt = React.createRef();
    this.statusElt = React.createRef();

    this._toggleEdit = this._toggleEdit.bind(this);
    this.pause = this.pause.bind(this);
    this.play = this.play.bind(this);
    this.recordAdd = this.recordAdd.bind(this);
    this.rewind = this.rewind.bind(this);
    this.zoomIn = this.zoomIn.bind(this);
    this.zoomOut = this.zoomOut.bind(this);
    this.stop = this.stop.bind(this);
    this.stopRecording = this.stopRecording.bind(this);
    this.persist = this.persist.bind(this);
    this.persistRecord = this.persistRecord.bind(this);
    this.fastForward = this.fastForward.bind(this);
    this.setCursorStyle = this.setCursorStyle.bind(this);
    this.setSelectionStyle = this.setSelectionStyle.bind(this);
    this.updateViewSelect = this.updateViewSelect.bind(this);
    this.updateEditSelect = this.updateEditSelect.bind(this);
    this._audioRenderingComplete = this._audioRenderingComplete.bind(this);
    this._recordAudioRenderingComplete = this._recordAudioRenderingComplete.bind(this);
    this._handleNewChildPersistable = this._handleNewChildPersistable.bind(this);
    this.state = {
      fileToEdit: props.file,
      content: this.props.initialContent,
      mode: AudioManagerMode.view,
    };
  }

  _handleNewChildPersistable(newPersistable: IPersistable) {
    this._activeEditorPersistable = newPersistable;
  }

  pause() {
    if (this.state.mode === AudioManagerMode.view && this.viewPlaylist) {
      this.viewPlaylist.pause();
    } else if (this.state.mode === AudioManagerMode.edit && this.editPlaylist) {
      this.editPlaylist.pause();
    }
  }

  play() {
    if (this.state.mode === AudioManagerMode.view && this.viewPlaylist) {
      this.viewPlaylist.play();
    } else if (this.state.mode === AudioManagerMode.edit && this.editPlaylist) {
      this.editPlaylist.play();
    }
  }

  zoomIn() {
    if (this.activeEventEmitter) {
      this.activeEventEmitter.emit("zoomin");
    }
  }

  zoomOut() {
    if (this.activeEventEmitter) {
      this.activeEventEmitter.emit("zoomout");
    }
  }

  setCursorStyle() {
    if (this.activeEventEmitter) {
      this.activeEventEmitter.emit("statechange", "cursor");
    }
  }

  setSelectionStyle() {
    if (this.activeEventEmitter) {
      this.activeEventEmitter.emit("statechange", "select");
    }
  }

  async recordAdd() {
    this.setState({
      fileToEdit: this.state.fileToEdit,
      content: this.state.content,
      mode: AudioManagerMode.record,
    });

    await this._addAudioInterior(AudioManagerMode.record);

    if (this.recordPlaylist) {
      if (this.canRecord) {
        this.recordPlaylist.record();
      } else {
        const getUserMedia =
          (navigator as any).getUserMedia ||
          (navigator as any).webkitGetUserMedia ||
          (navigator as any).mozGetUserMedia ||
          (navigator as any).msGetUserMedia;

        const playlist = this.recordPlaylist;

        const me = this;
        if (navigator.mediaDevices) {
          navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
            playlist.initRecorder(stream);
            me.canRecord = true;
            playlist.record();
          });
        } else if (getUserMedia && "MediaRecorder" in window) {
          getUserMedia({ audio: true }, (stream: any) => {
            playlist.initRecorder(stream);
            me.canRecord = true;
            playlist.record();
          });
        }
      }
    }
  }

  rewind() {
    if (this.state.mode === AudioManagerMode.view && this.viewPlaylist) {
      this.viewPlaylist.rewind();
    } else if (this.state.mode === AudioManagerMode.edit && this.editPlaylist) {
      this.editPlaylist.rewind();
    }
  }

  stop() {
    if (this.state.mode === AudioManagerMode.view && this.viewPlaylist) {
      this.viewPlaylist.stop();
    } else if (this.state.mode === AudioManagerMode.edit && this.editPlaylist) {
      this.editPlaylist.stop();
    }
  }

  stopRecording() {
    if (this.state.mode === AudioManagerMode.record && this.recordPlaylist) {
      this.recordPlaylist.stop();
    }

    this.persistRecord();
  }

  fastForward() {
    if (this.state.mode === AudioManagerMode.view && this.viewPlaylist) {
      this.viewPlaylist.fastForward();
    } else if (this.state.mode === AudioManagerMode.edit && this.editPlaylist) {
      this.editPlaylist.fastForward();
    }
  }

  componentDidMount() {
    this._addAudioInterior();

    if (this.props.setActivePersistable) {
      this.props.setActivePersistable(this);
    }
  }

  async getAudioWorkingFolder() {
    if (this.props.file) {
      const audioWorkingFolder = await this.props.project.ensureWorkingFolderForFile(this.props.file);

      if (audioWorkingFolder) {
        if (!audioWorkingFolder.isLoaded) {
          await audioWorkingFolder.load();
        }

        if (
          audioWorkingFolder.fileCount === 0 &&
          this.props.file.content &&
          this.props.file.content instanceof Uint8Array
        ) {
          const coreFile = audioWorkingFolder.ensureFile(this.props.file.name);
          coreFile.setContentIfSemanticallyDifferent(this.props.file.content);
        }
      }

      return audioWorkingFolder;
    }

    return undefined;
  }

  async _addAudioInterior(newMode?: AudioManagerMode) {
    if (newMode === undefined) {
      newMode = this.state.mode;
    }

    if (this.rootElt !== null && this.rootElt.current !== null) {
      if (this.props.file) {
        if (!this.props.file.isContentLoaded) {
          await this.props.file.loadContent();
        }
        if (this.props.file.content && this.props.file.content instanceof Uint8Array) {
          const blob = new Blob([this.props.file.content as BlobPart], {
            type: StorageUtilities.getMimeType(this.props.file),
          });

          while (this.rootElt.current && this.rootElt.current.childNodes.length > 0) {
            this.rootElt.current.removeChild(this.rootElt.current.childNodes[0]);
          }

          if (newMode === AudioManagerMode.view) {
            let thumbPrint = this.props.file.content.length + String(this.props.file.latestModified);

            if (
              this.viewAudioElement &&
              thumbPrint === this._viewThumbPrint &&
              this.viewPlaylist &&
              this.coreViewFilePath === this.props.file.extendedPath
            ) {
              this.rootElt.current.appendChild(this.viewAudioElement);
              this.activeEventEmitter = this.viewPlaylist.getEventEmitter();
            } else {
              this.viewAudioElement = document.createElement("DIV") as HTMLDivElement;
              this.rootElt.current.appendChild(this.viewAudioElement);
              this.coreViewFilePath = this.props.file.extendedPath;
              this._viewThumbPrint = thumbPrint;

              this.viewPlaylist = WaveformPlaylist({
                ac: new (window.AudioContext || (window as any).webkitAudioContext)(),
                samplesPerPixel: 512,
                mono: true,
                timescale: true,
                waveHeight: 240,
                container: this.viewAudioElement,
                isAutomaticScroll: true,
                state: "cursor",
                seekStyle: "line",
                colors: {
                  waveOutlineColor: "#E0EFF1",
                  timeColor: "grey",
                  fadeColor: "black",
                },
                controls: {
                  show: true,
                  width: 180,
                  widgets: {
                    muteOrSolo: false,
                    volume: true,
                    stereoPan: true,
                    collapse: false,
                    remove: false,
                  },
                },
                zoomLevels: [128, 256, 512, 1024, 2048, 4096],
              });
              this.activeEventEmitter = this.viewPlaylist.getEventEmitter();
              this.activeEventEmitter.on("select", this.updateViewSelect);

              await this.viewPlaylist.load([
                {
                  src: blob,
                  name: StorageUtilities.getBaseFromName(this.props.file.name),
                },
              ]);

              if (this.viewPlaylist) {
                this.viewPlaylist.initExporter();
              }
            }
          } else if (newMode === AudioManagerMode.edit) {
            const audioWorkingFolder = await this.getAudioWorkingFolder();
            const files = [];
            let thumbPrint = "";

            if (audioWorkingFolder) {
              for (const workingFileName in audioWorkingFolder.files) {
                const workingFile = audioWorkingFolder.files[workingFileName];

                if (workingFile) {
                  if (!workingFile.isContentLoaded) {
                    await workingFile.loadContent();
                  }
                  if (workingFile.content && workingFile.content instanceof Uint8Array) {
                    const workingBlob = new Blob([workingFile.content as BlobPart], {
                      type: StorageUtilities.getMimeType(this.props.file),
                    });

                    files.push({
                      src: workingBlob,
                      name: StorageUtilities.getBaseFromName(workingFile.name),
                    });

                    thumbPrint += workingFile.fullPath + "|";
                  }
                }
              }
            } else {
              files.push({
                src: blob,
                name: StorageUtilities.getBaseFromName(this.props.file.name),
              });
            }

            if (
              this.editAudioElement &&
              thumbPrint === this._editorThumbPrint &&
              this.editPlaylist &&
              this.coreEditFilePath === this.props.file.extendedPath
            ) {
              this.rootElt.current.appendChild(this.editAudioElement);
              this.activeEventEmitter = this.editPlaylist.getEventEmitter();
              this.editEventEmitter = this.activeEventEmitter;
            } else {
              this.editAudioElement = document.createElement("DIV") as HTMLDivElement;
              this.rootElt.current.appendChild(this.editAudioElement);
              this.coreEditFilePath = this.props.file.extendedPath;
              this._editorThumbPrint = thumbPrint;

              this.editPlaylist = WaveformPlaylist({
                ac: new (window.AudioContext || (window as any).webkitAudioContext)(),
                samplesPerPixel: 512,
                mono: true,
                timescale: true,
                waveHeight: 240,
                container: this.editAudioElement,
                isAutomaticScroll: true,
                seekStyle: "line",
                state: "cursor",
                colors: {
                  waveOutlineColor: "#E0EFF1",
                  timeColor: "grey",
                  fadeColor: "black",
                },
                states: {
                  cursor: true,
                  fadein: true,
                  fadeout: true,
                  select: true,
                  shift: true,
                },
                controls: {
                  show: true,
                  width: 180,
                  widgets: {
                    muteOrSolo: true,
                    volume: true,
                    stereoPan: true,
                    collapse: true,
                    remove: true,
                  },
                },
                zoomLevels: [128, 256, 512, 1024, 2048, 4096],
              });

              this.activeEventEmitter = this.editPlaylist.getEventEmitter();
              this.editEventEmitter = this.activeEventEmitter;
              this.editEventEmitter.on("select", this.updateEditSelect);
              this.editEventEmitter.on("audiorenderingfinished", this._audioRenderingComplete);

              await this.editPlaylist.load(files);

              if (this.editPlaylist) {
                this.editPlaylist.initExporter();
              }
            }
          } else if (newMode === AudioManagerMode.record) {
            if (
              this.recordAudioElement &&
              this.recordPlaylist &&
              this.coreEditFilePath === this.props.file.extendedPath
            ) {
              this.rootElt.current.appendChild(this.recordAudioElement);
              this.activeEventEmitter = this.recordPlaylist.getEventEmitter();
              this.editEventEmitter = this.activeEventEmitter;
            } else {
              this.recordAudioElement = document.createElement("DIV") as HTMLDivElement;
              this.rootElt.current.appendChild(this.recordAudioElement);
              this.coreEditFilePath = this.props.file.extendedPath;

              this.recordPlaylist = WaveformPlaylist({
                ac: new (window.AudioContext || (window as any).webkitAudioContext)(),
                samplesPerPixel: 512,
                mono: true,
                timescale: true,
                waveHeight: 240,
                container: this.recordAudioElement,
                isAutomaticScroll: true,
                seekStyle: "line",
                state: "cursor",
                colors: {
                  waveOutlineColor: "#E0EFF1",
                  timeColor: "grey",
                  fadeColor: "black",
                },
                states: {
                  cursor: true,
                  fadein: true,
                  fadeout: true,
                  select: true,
                  shift: true,
                },
                controls: {
                  show: true,
                  width: 180,
                  widgets: {
                    muteOrSolo: false,
                    volume: false,
                    stereoPan: false,
                    collapse: false,
                    remove: false,
                  },
                },
                zoomLevels: [128, 256, 512, 1024, 2048, 4096],
              });

              this.activeEventEmitter = this.recordPlaylist.getEventEmitter();
              this.recordEventEmitter = this.activeEventEmitter;
              this.recordEventEmitter.on("select", this.updateEditSelect);
              this.recordEventEmitter.on("audiorenderingfinished", this._recordAudioRenderingComplete);

              await this.recordPlaylist.load([]);

              if (this.recordPlaylist) {
                this.recordPlaylist.initExporter();
              }
            }
          }

          this.updateView();
        }
      }
    }
  }

  updateViewSelect(start: number, end: number) {
    this.viewState.startTime = start;
    this.viewState.endTime = end;

    this.updateView();
  }

  async _audioRenderingComplete(type: string, data: any) {
    if (type === "buffer") {
      /*
      const file = this.props.file;
      
      audioEncoder(data, 128, null, async (mp3Blob: Blob) => {
        if (file) {
          const arrayBuffer = await mp3Blob.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);

          file.setContent(uint8Array);
      */
      if (this._setToViewAfterPersist) {
        this._setToViewAfterPersist = false;

        this.setState({
          fileToEdit: this.props.file,
          content: this.state.content,
          mode: AudioManagerMode.view,
        });
      }

      this._isPersisting = false;

      const pendingLoad = this._pendingPersistRequests;
      this._pendingPersistRequests = [];

      for (const prom of pendingLoad) {
        prom(undefined);
      }
    }
  }

  async _recordAudioRenderingComplete(type: string, data: any) {
    if (type === "buffer") {
      const workfolder = await this.getAudioWorkingFolder();

      if (!workfolder) {
        return;
      }

      /*const fileName = await StorageUtilities.getUniqueFileName("audio", "mp3", workfolder);

      const file = workfolder.ensureFile(fileName);

      audioEncoder(data, 128, null, async (mp3Blob: Blob) => {
        if (file) {
          const arrayBuffer = await mp3Blob.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);

          file.setContent(uint8Array);

          await file.saveContent();
*/
      this.setState({
        fileToEdit: this.props.file,
        content: this.state.content,
        mode: AudioManagerMode.edit,
      });
    }
    //    });
    //}
  }

  updateEditSelect(start: number, end: number) {
    this.editState.startTime = start;
    this.editState.endTime = end;

    this.updateView();
  }

  updateView() {
    if (!this.state || !this.statusElt.current) {
      return;
    }

    while (this.statusElt.current.childNodes.length > 0) {
      this.statusElt.current.removeChild(this.statusElt.current.childNodes[0]);
    }

    const viewState = this.state.mode ? this.viewState : this.editState;

    const displayElt = document.createElement("SPAN") as HTMLSpanElement;

    let str = "";

    if (viewState.startTime !== undefined && viewState.endTime !== undefined) {
      str += "Selected: ";

      if (viewState.startTime === viewState.endTime) {
        str += viewState.startTime.toFixed(3);
      } else {
        str += viewState.startTime.toFixed(3) + " to " + viewState.endTime.toFixed(3);
      }
    }

    displayElt.innerText = str;

    this.statusElt.current.appendChild(displayElt);
  }

  componentDidUpdate(prevProps: IAudioManagerProps, prevState: IAudioManagerState) {
    if (this.props.file !== prevProps.file || this.props.visualSeed !== prevProps.visualSeed) {
      this.setState({
        fileToEdit: this.props.file,
        content: this.props.initialContent,
        mode: AudioManagerMode.view,
      });
      this._addAudioInterior();
    } else if (this.state.mode !== prevState.mode) {
      this._addAudioInterior();
    }
  }

  async _toggleEdit() {
    if (this.state.mode === AudioManagerMode.edit) {
      await this.persist();

      this._setToViewAfterPersist = true;
    } else {
      this.setState({
        mode: AudioManagerMode.edit,
        fileToEdit: this.state.fileToEdit,
        content: this.state.content,
      });
    }
  }

  static getDerivedStateFromProps(props: IAudioManagerProps, state: IAudioManagerState) {
    if (state === undefined || state === null) {
      state = {
        fileToEdit: props.file,
        mode: AudioManagerMode.view,
      };

      return state;
    }
    if (props.file !== state.fileToEdit) {
      state.fileToEdit = props.file;
      return state;
    }

    return null; // No change to state
  }

  async persist(): Promise<boolean> {
    if (this._activeEditorPersistable) {
      await this._activeEditorPersistable.persist();
    }

    if (this.editEventEmitter) {
      const pendingPersists = this._pendingPersistRequests;

      const prom = (resolve: (value: unknown) => void, reject: (reason?: any) => void) => {
        pendingPersists.push(resolve);
      };

      if (!this._isPersisting) {
        this._isPersisting = true;
        this.editEventEmitter.emit("startaudiorendering", "buffer");
      }

      if (this._isPersisting) {
        await new Promise(prom);
      }

      return true;
    }

    return false;
  }

  async persistRecord() {
    if (this.recordEventEmitter) {
      this.recordEventEmitter.emit("startaudiorendering", "buffer");
    }
  }

  render() {
    const height = "calc(100vh - " + ((this.props.heightOffset ? this.props.heightOffset : 500) + 34) + "px)";

    let toolbarItems = [];

    if (this.state.mode === AudioManagerMode.record) {
      toolbarItems = [
        {
          icon: <FontAwesomeIcon icon={faEdit} className="fa-lg" />,
          key: "toggleEdit",
          onClick: this._toggleEdit,
          title: "Toggles Edit mode",
        },
        {
          key: "dividerEdit",
          kind: "divider",
        },
        {
          icon: <FontAwesomeIcon icon={faStop} className="fa-lg" />,
          key: "stop",
          onClick: this.stopRecording,
          title: "Stops playback",
        },
      ];
    } else {
      toolbarItems = [
        /*{
          icon: <FontAwesomeIcon icon={faEdit} className="fa-lg" />,
          key: "toggleEdit",
          onClick: this._toggleEdit,
          title: "Toggles Edit mode",
        },
        {
          key: "dividerEdit",
          kind: "divider",
        },*/
        {
          icon: <FontAwesomeIcon icon={faPause} className="fa-lg" />,
          key: "pause",
          onClick: this.pause,
          title: "Pauses playback of the recording",
        },
        {
          icon: <FontAwesomeIcon icon={faPlay} className="fa-lg" />,
          key: "play",
          onClick: this.play,
          title: "Plays the selected track",
        },
        {
          icon: <FontAwesomeIcon icon={faStop} className="fa-lg" />,
          key: "stop",
          onClick: this.stop,
          title: "Stops playback",
        },
        {
          icon: <FontAwesomeIcon icon={faBackward} className="fa-lg" />,
          key: "rewind",
          onClick: this.rewind,
          title: "Rewinds the current playback",
        },
        {
          icon: <FontAwesomeIcon icon={faForward} className="fa-lg" />,
          key: "forward",
          onClick: this.rewind,
          title: "Forwards the current playback",
        },
        {
          key: "dividerZoom",
          kind: "divider",
        },
        {
          icon: <FontAwesomeIcon icon={faMagnifyingGlassMinus} className="fa-lg" />,
          key: "zoomOut",
          onClick: this.zoomOut,
          title: "Zooms out",
        },
        {
          icon: <FontAwesomeIcon icon={faMagnifyingGlassPlus} className="fa-lg" />,
          key: "zoomIn",
          onClick: this.zoomIn,
          title: "Zooms in on the current wave",
        },
      ];
    }

    if (this.state.mode === AudioManagerMode.edit) {
      toolbarItems.push({
        key: "dividerMouse",
        kind: "divider",
      });

      toolbarItems.push({
        icon: <FontAwesomeIcon icon={faMousePointer} className="fa-lg" />,
        key: "selectCursor",
        onClick: this.setCursorStyle,
        title: "Select an item",
      });

      toolbarItems.push({
        icon: <FontAwesomeIcon icon={faICursor} className="fa-lg" />,
        key: "selectSelection",
        onClick: this.setSelectionStyle,
        title: "Select an range",
      });

      toolbarItems.push({
        key: "dividerRec",
        kind: "divider",
      });

      toolbarItems.push({
        icon: <FontAwesomeIcon icon={faCircle} className="fa-lg aum-recordbutton" />,
        key: "recordAdd",
        onClick: this.recordAdd,
        title: "Records a new track",
      });
    }

    let audioItemProps = <></>;

    if (this.state.mode !== AudioManagerMode.record) {
      audioItemProps = (
        <div>
          <div className="aum-propTitle">Audio properties</div>
          <AudioItemProperties
            setActivePersistable={this._handleNewChildPersistable}
            readOnly={this.props.readOnly || this.state.mode === AudioManagerMode.view}
            theme={this.props.theme}
            creatorTools={this.props.creatorTools}
            file={this.props.file}
            project={this.props.project}
          />
        </div>
      );
    }

    return (
      <div className="aum-outer">
        <div className="jse-toolBarArea">
          <Toolbar aria-label="Javascript editor" items={toolbarItems} />
        </div>
        <div
          className="aum-bin"
          style={{
            maxHeight: height,
            height: height,
          }}
        >
          <div
            className={
              "aum-contents " +
              (CreatorToolsHost.theme === CreatorToolsThemeStyle.dark ? "playlist-dark" : "playlist-light")
            }
            ref={this.rootElt}
          ></div>
          <div
            className={
              "aum-status " +
              (CreatorToolsHost.theme === CreatorToolsThemeStyle.dark ? "playlist-dark" : "playlist-light")
            }
            ref={this.statusElt}
          ></div>
          {audioItemProps}
        </div>
      </div>
    );
  }
}
