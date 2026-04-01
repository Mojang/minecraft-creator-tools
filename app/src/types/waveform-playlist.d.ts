declare module "waveform-playlist" {
  export default function WaveformPlaylist(options: IWaveformPlaylistOptions): WaveformPlaylistObj;

  export class WaveformPlaylistObj {
    load(list: any[]): Promise<void>;
    initExporter(): void;
    pause(): void;
    play(): void;
    record(): void;
    rewind(): void;
    stop(): void;
    fastForward(): void;
    getState(): string;
    initRecorder(stream: MediaStream): void;
    setState(state: "cursor" | "select" | "fadein" | "fadeout" | "shift"): void;
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
    emit(eventId: string, eventArgument?: string): void;
    on(eventId: string, eventFn: (...args: any[]) => void): void;
  }

  interface IWaveformPlaylistStates {
    cursor: boolean;
    fadein: boolean;
    fadeout: boolean;
    select: boolean;
    shift: boolean;
  }
}
