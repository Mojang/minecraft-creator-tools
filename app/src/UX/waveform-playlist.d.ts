declare module "waveform-playlist" {
  export default function WaveformPlaylist(options: IWaveformPlaylistOptions): WaveformPlaylistObj;

  export class WaveformPlaylistObj {
    load(list: any[]): Promise<void>;
    initExporter();
    pause();
    play();
    record();
    rewind();
    stop();
    fastForward();
    getState();
    initRecorder(stream: any);
    setState(state: "cursor" | "select" | "fadein" | "fadeout" | "shift");
    getEventEmitter(): IWaveformEventEmitter;
  }

  interface IWaveformPlaylistOptions {
    ac: any;
    samplesPerPixel: number;
    mono: boolean;
    waveHeight: number;
    container: any;
    state: string;
    seekStyle: string;
    isAutomaticScroll: boolean;
    timescale: boolean;
    states?: IWaveformPlaylistStates;
    colors: {};
    controls?: {};
    zoomLevels: number[];
  }

  interface IWaveformEventEmitter {
    emit(eventId: string, eventArgument?: string);
    on(eventId: string, eventFn: (...args: any[]) => void);
  }

  interface IWaveformPlaylistStates {
    cursor: boolean;
    fadein: boolean;
    fadeout: boolean;
    select: boolean;
    shift: boolean;
  }
}
