import * as BABYLON from "babylonjs";

export default class FreeCameraKeyboardRotateInput implements BABYLON.ICameraInput<BABYLON.FreeCamera> {
  _noPreventDefault?: boolean;
  camera: BABYLON.FreeCamera;
  _keys: string[] = [];
  keyLeft = "q";
  keyRight = "e";
  keyUp = "z";
  keyDown = "c";
  sensibility = 0.002;

  _trappingKeyDown = false;

  constructor(camera: BABYLON.FreeCamera) {
    this.camera = camera;

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
  }

  getClassName() {
    return "FreeCameraKeyboardRotateInput";
  }

  _onLostFocus(e: Event) {
    this._keys = [];
  }

  getSimpleName() {
    return "keyboardRotate";
  }

  _onKeyDown(evt: KeyboardEvent) {
    if (this.keyDown === evt.key || this.keyUp === evt.key || this.keyLeft === evt.key || this.keyRight === evt.key) {
      let hasKey = false;

      for (let i = 0; i < this._keys.length; i++) {
        if (this._keys[i] === evt.key) {
          hasKey = true;
        }
      }

      if (!hasKey) {
        this._keys.push(evt.key);
      }

      if (!this._noPreventDefault) {
        evt.preventDefault();
      }
    }
  }

  _onKeyUp(evt: KeyboardEvent) {
    if (this.keyDown === evt.key || this.keyUp === evt.key || this.keyLeft === evt.key || this.keyRight === evt.key) {
      let index = -1;

      for (let i = 0; i < this._keys.length; i++) {
        if (this._keys[i] === evt.key) {
          index = i;
        }
      }

      if (index >= 0) {
        this._keys.splice(index, 1);
      }

      if (!this._noPreventDefault) {
        evt.preventDefault();
      }
    }
  }

  // Hooking keyboard events
  attachControl(noPreventDefault?: boolean) {
    const engine = this.camera.getEngine();
    const element = engine.getInputElement();

    if (element === undefined || element === null) {
      return;
    }

    if (!this._trappingKeyDown) {
      element.tabIndex = 1;

      element.addEventListener("keydown", this._onKeyDown, false);
      element.addEventListener("keyup", this._onKeyUp, false);

      this._trappingKeyDown = true;
    }

    /*
        BABYLON.Tools.RegisterTopRootEvents(canvas, [
            { name: "blur", handler: this._onLostFocus }
        ]);*/
  }
  // Unhook
  detachControl() {
    if (this._trappingKeyDown) {
      const engine = this.camera.getEngine();
      const element = engine.getInputElement();

      if (element === undefined || element === null) {
        return;
      }

      element.removeEventListener("keydown", this._onKeyDown);
      element.removeEventListener("keyup", this._onKeyUp);

      /*    BABYLON.Tools.UnregisterTopRootEvents(canvas, [
            { name: "blur", handler: this._onLostFocus }
        ]);*/

      this._keys = [];
      this._trappingKeyDown = false;
    }
  }

  // This function is called by the system on every frame
  checkInputs() {
    if (this._trappingKeyDown) {
      const camera = this.camera;

      // Keyboard
      for (var index = 0; index < this._keys.length; index++) {
        const keyCode = this._keys[index];

        if (this.keyLeft === keyCode) {
          camera.cameraRotation.y -= this.sensibility;
        } else if (this.keyRight === keyCode) {
          camera.cameraRotation.y += this.sensibility;
        } else if (this.keyDown === keyCode) {
          camera.cameraRotation.x += this.sensibility;
        } else if (this.keyUp === keyCode) {
          camera.cameraRotation.x -= this.sensibility;
        }
      }
    }
  }
}
