import * as BABYLON from "babylonjs";

export interface IMaterialAndUv {
  material: BABYLON.StandardMaterial;
  uv: BABYLON.Vector4;
}

export enum BoxSide {
  left = 0,
  right = 1,
  forward = 2,
  backward = 3,
  up = 4,
  down = 5,
}

export enum BoxMaterialStrategy {
  uniform = 0,
  uniformSidesAndUniformTopBottom = 1,
  sideTopBottom = 2,
}

export default class BoxMaterialAndUv {
  private _sides: IMaterialAndUv[] = [];
  private _strategy: BoxMaterialStrategy = BoxMaterialStrategy.uniform;

  constructor(material?: BABYLON.StandardMaterial) {
    if (material) {
      this.setUniform(material);
    }
  }

  setUniform(material: BABYLON.StandardMaterial, uv?: BABYLON.Vector4) {
    this._sides[0] = {
      material: material,
      uv: uv ?? new BABYLON.Vector4(0, 0, 1, 1),
    };

    this._strategy = BoxMaterialStrategy.uniform;
  }

  setUniformSidesAndTops(
    sidesMaterial: BABYLON.StandardMaterial,
    topsMaterial: BABYLON.StandardMaterial,
    sidesUv?: BABYLON.Vector4,
    topsUv?: BABYLON.Vector4
  ) {
    this._sides[0] = {
      material: sidesMaterial,
      uv: sidesUv ?? new BABYLON.Vector4(0, 0, 1, 1),
    };
    this._sides[BoxSide.up] = {
      material: topsMaterial,
      uv: topsUv ?? new BABYLON.Vector4(0, 0, 1, 1),
    };

    this._strategy = BoxMaterialStrategy.uniformSidesAndUniformTopBottom;
  }

  setSideTopBottom(
    sidesMaterial: BABYLON.StandardMaterial,
    topMaterial: BABYLON.StandardMaterial,
    bottomMaterial: BABYLON.StandardMaterial,
    sidesUv?: BABYLON.Vector4,
    topUv?: BABYLON.Vector4,
    bottomUv?: BABYLON.Vector4
  ) {
    const defaultUv = new BABYLON.Vector4(0, 0, 1, 1);
    this._sides[0] = {
      material: sidesMaterial,
      uv: sidesUv ?? defaultUv,
    };
    this._sides[BoxSide.up] = {
      material: topMaterial,
      uv: topUv ?? defaultUv,
    };
    this._sides[BoxSide.down] = {
      material: bottomMaterial,
      uv: bottomUv ?? defaultUv,
    };

    this._strategy = BoxMaterialStrategy.sideTopBottom;
  }

  get strategy(): BoxMaterialStrategy {
    return this._strategy;
  }

  getDefaultMaterialAndUv() {
    return this._sides[0];
  }

  getMaterialAndUv(side: BoxSide): IMaterialAndUv {
    if (this._strategy === BoxMaterialStrategy.uniformSidesAndUniformTopBottom) {
      if (side === BoxSide.up || side === BoxSide.down) {
        return this._sides[BoxSide.up];
      }
    } else if (this._strategy === BoxMaterialStrategy.sideTopBottom) {
      if (side === BoxSide.up) {
        return this._sides[BoxSide.up];
      } else if (side === BoxSide.down) {
        return this._sides[BoxSide.down];
      }
    }

    return this._sides[0];
  }
}
