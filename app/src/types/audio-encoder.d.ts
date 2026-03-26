declare module "audio-encoder" {
  export default function audioEncoder(
    audioBuffer: AudioBuffer,
    encoding: number,
    onProgress: ((progress: number) => void) | null,
    onComplete: (blob: Blob) => void
  ): void;
}
