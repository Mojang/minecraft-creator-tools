export default class Rotation {
  private _yaw: number;
  private _pitch: number;

  public get yaw() {
    return this._yaw;
  }

  public set yaw(newYaw: number) {
    this._yaw = newYaw;
  }

  public get pitch() {
    return this._pitch;
  }

  public set pitch(newPitch: number) {
    this._pitch = newPitch;
  }

  constructor(yaw: number | null | undefined, pitch: number | null | undefined) {
    this._yaw = yaw == null ? 0 : yaw;
    this._pitch = pitch == null ? 0 : pitch;
  }
}
