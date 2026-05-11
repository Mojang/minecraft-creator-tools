import { Component } from "react";
import Log from "../../core/Log";
import IFile from "../../storage/IFile";
import "./AudioManager.css";
import React from "react";
import IPersistable from "../types/IPersistable";
import CreatorTools from "../../app/CreatorTools";
import { Divider, IconButton, Stack } from "@mui/material";
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
import StorageUtilities from "../../storage/StorageUtilities";
import { faEdit } from "@fortawesome/free-regular-svg-icons";
import CreatorToolsHost, { CreatorToolsThemeStyle } from "../../app/CreatorToolsHost";
import Project from "../../app/Project";
import AudioItemProperties from "./AudioItemProperties";
import IProjectTheme from "../types/IProjectTheme";
import { WithLocalizationProps, withLocalization } from "../withLocalization";

export enum AudioManagerMode {
  view = 0,
  edit = 1,
  record = 2,
}

interface IAudioManagerProps extends WithLocalizationProps {
  file?: IFile;
  theme: IProjectTheme;
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

class AudioManager extends Component<IAudioManagerProps, IAudioManagerState> {
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
          navigator.mediaDevices
            .getUserMedia({ audio: true })
            .then((stream) => {
              playlist.initRecorder(stream);
              me.canRecord = true;
              playlist.record();
            })
            .catch((err) => {
              Log.error(`Mic permission denied or unavailable: ${err}`);
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
      str += this.props.intl.formatMessage({ id: "project_editor.audio.selected" });

      if (viewState.startTime === viewState.endTime) {
        str += viewState.startTime.toFixed(3);
      } else {
        str += this.props.intl.formatMessage(
          { id: "project_editor.audio.selected_range" },
          { start: viewState.startTime.toFixed(3), end: viewState.endTime.toFixed(3) }
        );
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

    let recordModeButtons = <></>;
    let mainModeButtons = <></>;
    let editModeButtons = <></>;

    if (this.state.mode === AudioManagerMode.record) {
      recordModeButtons = (
        <>
          <IconButton
            onClick={this._toggleEdit}
            title={this.props.intl.formatMessage({ id: "project_editor.audio.toggle_edit" })}
            aria-label={this.props.intl.formatMessage({ id: "project_editor.audio.toggle_edit" })}
            size="small"
          >
            <FontAwesomeIcon icon={faEdit} className="fa-lg" />
          </IconButton>
          <Divider orientation="vertical" flexItem />
          <IconButton
            onClick={this.stopRecording}
            title={this.props.intl.formatMessage({ id: "project_editor.audio.stop_title" })}
            aria-label={this.props.intl.formatMessage({ id: "project_editor.audio.stop_playback" })}
            size="small"
          >
            <FontAwesomeIcon icon={faStop} className="fa-lg" />
          </IconButton>
        </>
      );
    } else {
      mainModeButtons = (
        <>
          <IconButton
            onClick={this.pause}
            title={this.props.intl.formatMessage({ id: "project_editor.audio.pause_title" })}
            aria-label={this.props.intl.formatMessage({ id: "project_editor.audio.pause" })}
            size="small"
          >
            <FontAwesomeIcon icon={faPause} className="fa-lg" />
          </IconButton>
          <IconButton
            onClick={this.play}
            title={this.props.intl.formatMessage({ id: "project_editor.audio.play_title" })}
            aria-label={this.props.intl.formatMessage({ id: "project_editor.audio.play" })}
            size="small"
          >
            <FontAwesomeIcon icon={faPlay} className="fa-lg" />
          </IconButton>
          <IconButton
            onClick={this.stop}
            title={this.props.intl.formatMessage({ id: "project_editor.audio.stop_title" })}
            aria-label={this.props.intl.formatMessage({ id: "project_editor.audio.stop" })}
            size="small"
          >
            <FontAwesomeIcon icon={faStop} className="fa-lg" />
          </IconButton>
          <IconButton
            onClick={this.rewind}
            title={this.props.intl.formatMessage({ id: "project_editor.audio.rewind_title" })}
            aria-label={this.props.intl.formatMessage({ id: "project_editor.audio.rewind" })}
            size="small"
          >
            <FontAwesomeIcon icon={faBackward} className="fa-lg" />
          </IconButton>
          <IconButton
            onClick={this.rewind}
            title={this.props.intl.formatMessage({ id: "project_editor.audio.forward_title" })}
            aria-label={this.props.intl.formatMessage({ id: "project_editor.audio.forward" })}
            size="small"
          >
            <FontAwesomeIcon icon={faForward} className="fa-lg" />
          </IconButton>
          <Divider orientation="vertical" flexItem />
          <IconButton
            onClick={this.zoomOut}
            title={this.props.intl.formatMessage({ id: "project_editor.audio.zoom_out_title" })}
            aria-label={this.props.intl.formatMessage({ id: "project_editor.audio.zoom_out" })}
            size="small"
          >
            <FontAwesomeIcon icon={faMagnifyingGlassMinus} className="fa-lg" />
          </IconButton>
          <IconButton
            onClick={this.zoomIn}
            title={this.props.intl.formatMessage({ id: "project_editor.audio.zoom_in_title" })}
            aria-label={this.props.intl.formatMessage({ id: "project_editor.audio.zoom_in" })}
            size="small"
          >
            <FontAwesomeIcon icon={faMagnifyingGlassPlus} className="fa-lg" />
          </IconButton>
        </>
      );
    }

    if (this.state.mode === AudioManagerMode.edit) {
      editModeButtons = (
        <>
          <Divider orientation="vertical" flexItem />
          <IconButton
            onClick={this.setCursorStyle}
            title={this.props.intl.formatMessage({ id: "project_editor.audio.select_item_title" })}
            aria-label={this.props.intl.formatMessage({ id: "project_editor.audio.select_item" })}
            size="small"
          >
            <FontAwesomeIcon icon={faMousePointer} className="fa-lg" />
          </IconButton>
          <IconButton
            onClick={this.setSelectionStyle}
            title={this.props.intl.formatMessage({ id: "project_editor.audio.select_range_title" })}
            aria-label={this.props.intl.formatMessage({ id: "project_editor.audio.select_range" })}
            size="small"
          >
            <FontAwesomeIcon icon={faICursor} className="fa-lg" />
          </IconButton>
          <Divider orientation="vertical" flexItem />
          <IconButton
            onClick={this.recordAdd}
            title={this.props.intl.formatMessage({ id: "project_editor.audio.record_title" })}
            aria-label={this.props.intl.formatMessage({ id: "project_editor.audio.record" })}
            size="small"
          >
            <FontAwesomeIcon icon={faCircle} className="fa-lg aum-recordbutton" />
          </IconButton>
        </>
      );
    }

    let audioItemProps = <></>;

    if (this.state.mode !== AudioManagerMode.record) {
      audioItemProps = (
        <div>
          <div className="aum-propTitle">
            {this.props.intl.formatMessage({ id: "project_editor.audio.properties_title" })}
          </div>
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
          <Stack
            direction="row"
            spacing={0.5}
            alignItems="center"
            aria-label={this.props.intl.formatMessage({ id: "project_editor.audio.toolbar_aria" })}
          >
            {recordModeButtons}
            {mainModeButtons}
            {editModeButtons}
          </Stack>
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

export default withLocalization(AudioManager);
