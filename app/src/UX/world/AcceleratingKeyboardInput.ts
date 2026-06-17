/**
 * Custom Babylon.js camera keyboard input with acceleration.
 *
 * When a movement key (W/S/A/D/Q/E) is held, the camera starts at a base
 * speed and smoothly ramps up to a maximum speed over a configurable duration.
 * Releasing the key resets the speed immediately.
 *
 * Uses the same ICameraInput<FreeCamera> interface as Babylon's built-in
 * FreeCameraKeyboardMoveInput so it can be added via camera.inputs.add().
 */
import * as BABYLON from "babylonjs";

export default class AcceleratingKeyboardInput implements BABYLON.ICameraInput<BABYLON.FreeCamera> {
  camera: BABYLON.FreeCamera | null = null;

  /** Key codes for each direction */
  keysUp: number[] = [87]; // W
  keysDown: number[] = [83]; // S
  keysLeft: number[] = [65]; // A
  keysRight: number[] = [68]; // D
  keysUpward: number[] = [69]; // E
  keysDownward: number[] = [81]; // Q

  /** Base movement speed (blocks per frame-tick) */
  baseSpeed: number = 0.3;

  /** Maximum movement speed after full acceleration */
  maxSpeed: number = 3.0;

  /** Time in milliseconds to ramp from baseSpeed to maxSpeed */
  rampDurationMs: number = 2000;

  /** Currently pressed key codes */
  private _pressedKeys: Set<number> = new Set();

  /** Timestamp (ms) when each key was first pressed */
  private _keyPressStart: Map<number, number> = new Map();

  private _onKeyDown: ((evt: KeyboardEvent) => void) | null = null;
  private _onKeyUp: ((evt: KeyboardEvent) => void) | null = null;

  getClassName(): string {
    return "AcceleratingKeyboardInput";
  }

  getSimpleName(): string {
    return "keyboardAccel";
  }

  attachControl(noPreventDefault?: boolean): void {
    const engine = this.camera?.getEngine();
    if (!engine) return;

    const element = engine.getInputElement();
    if (!element) return;

    this._onKeyDown = (evt: KeyboardEvent) => {
      const code = evt.keyCode;
      if (this._isMovementKey(code) && !this._pressedKeys.has(code)) {
        this._pressedKeys.add(code);
        this._keyPressStart.set(code, performance.now());
      }
      if (!noPreventDefault && this._isMovementKey(code)) {
        evt.preventDefault();
      }
    };

    this._onKeyUp = (evt: KeyboardEvent) => {
      const code = evt.keyCode;
      this._pressedKeys.delete(code);
      this._keyPressStart.delete(code);
      if (!noPreventDefault && this._isMovementKey(code)) {
        evt.preventDefault();
      }
    };

    element.addEventListener("keydown", this._onKeyDown);
    element.addEventListener("keyup", this._onKeyUp);
  }

  detachControl(): void {
    const engine = this.camera?.getEngine();
    if (!engine) return;

    const element = engine.getInputElement();
    if (!element) return;

    if (this._onKeyDown) {
      element.removeEventListener("keydown", this._onKeyDown);
      this._onKeyDown = null;
    }
    if (this._onKeyUp) {
      element.removeEventListener("keyup", this._onKeyUp);
      this._onKeyUp = null;
    }

    this._pressedKeys.clear();
    this._keyPressStart.clear();
  }

  checkInputs(): void {
    const camera = this.camera;
    if (!camera) return;

    const now = performance.now();

    // Compute the effective speed for a given key based on hold duration.
    const speedForKey = (code: number): number => {
      const start = this._keyPressStart.get(code);
      if (start === undefined) return this.baseSpeed;

      const held = now - start;
      const t = Math.min(held / this.rampDurationMs, 1);
      // Ease-in curve for smooth acceleration feel
      const eased = t * t;
      return this.baseSpeed + (this.maxSpeed - this.baseSpeed) * eased;
    };

    // Helper: get the maximum speed among pressed keys in a group
    const maxPressedSpeed = (keys: number[]): number => {
      let speed = 0;
      for (const k of keys) {
        if (this._pressedKeys.has(k)) speed = Math.max(speed, speedForKey(k));
      }
      return speed;
    };

    // Helper vectors for direction calculation.
    // The scene is RIGHT-handed (see WorldRenderer handedness/mirror fix), so the
    // camera looks down its local -Z. Vector3.Forward() returns the left-handed
    // forward (0,0,1) which points backward here, inverting W/S — use the
    // right-handed forward (0,0,-1) via Forward(true). Right() (1,0,0) is
    // handedness-independent, so strafing is unaffected.
    const forward = camera.getDirection(BABYLON.Vector3.Forward(true));
    const right = camera.getDirection(BABYLON.Vector3.Right());

    // Forward / backward
    const fwdSpeed = maxPressedSpeed(this.keysUp);
    const backSpeed = maxPressedSpeed(this.keysDown);
    if (fwdSpeed > 0) {
      camera.cameraDirection.addInPlace(forward.scale(fwdSpeed));
    }
    if (backSpeed > 0) {
      camera.cameraDirection.addInPlace(forward.scale(-backSpeed));
    }

    // Left / right
    const leftSpeed = maxPressedSpeed(this.keysLeft);
    const rightSpeed = maxPressedSpeed(this.keysRight);
    if (leftSpeed > 0) {
      camera.cameraDirection.addInPlace(right.scale(-leftSpeed));
    }
    if (rightSpeed > 0) {
      camera.cameraDirection.addInPlace(right.scale(rightSpeed));
    }

    // Up / down (world-space Y axis)
    const upSpeed = maxPressedSpeed(this.keysUpward);
    const downSpeed = maxPressedSpeed(this.keysDownward);
    if (upSpeed > 0) {
      camera.cameraDirection.addInPlace(new BABYLON.Vector3(0, upSpeed, 0));
    }
    if (downSpeed > 0) {
      camera.cameraDirection.addInPlace(new BABYLON.Vector3(0, -downSpeed, 0));
    }
  }

  private _isMovementKey(code: number): boolean {
    return (
      this.keysUp.includes(code) ||
      this.keysDown.includes(code) ||
      this.keysLeft.includes(code) ||
      this.keysRight.includes(code) ||
      this.keysUpward.includes(code) ||
      this.keysDownward.includes(code)
    );
  }
}
