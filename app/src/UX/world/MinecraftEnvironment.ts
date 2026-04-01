/**
 * ARCHITECTURE: MinecraftEnvironment
 *
 * Shared environment rendering for all Minecraft 3D views (WorldRenderer,
 * VolumeEditor, BlockViewer, etc.). Provides a single codepath for creating
 * the visual environment elements that surround block/entity content:
 *
 *   - Sky dome (gradient sphere)
 *   - Lighting (hemispheric ambient + directional sun + optional fill)
 *   - Ground planes (world-scale, structure checkerboard, model platform)
 *   - Clouds (animated blocky cloud layer)
 *   - Sun visual (billboard plane)
 *   - Fog configuration
 *   - Scene-level configuration (clear color, performance flags)
 *
 * USAGE:
 *   WorldRenderer calls configureScene(), configureLighting(), createSkyDome(),
 *   createWorldGroundPlane() at construction time.
 *
 *   VolumeEditor calls createFullEnvironment() in _addEnvironment() which
 *   selects the right combination based on view mode.
 *
 * RELATED FILES:
 *   - WorldRenderer.ts — live world rendering (uses this for environment)
 *   - VolumeEditor.tsx — structure editor (uses this for environment)
 *   - BlockRenderDatabase.ts — block metadata; provides base configureScene/configureLighting
 *   - BlockViewer.tsx — single block preview (may use this in future)
 */

import * as BABYLON from "babylonjs";
import BlockRenderDatabase from "./BlockRenderDatabase";
import CreatorToolsHost, { CreatorToolsThemeStyle } from "../../app/CreatorToolsHost";

/** Options for sky dome creation. */
export interface ISkyDomeOptions {
  /** Sphere diameter. Default: 2000 */
  diameter?: number;
  /** Sphere tessellation segments. Default: 128 */
  segments?: number;
}

/** Options for lighting setup. */
export interface ILightingOptions {
  /** Add an upward fill light for ceiling illumination. Default: false */
  addFillLight?: boolean;
  /** Fill light intensity (if addFillLight). Default: 0.5 */
  fillLightIntensity?: number;
  /** Scene ambient color override. */
  ambientColor?: BABYLON.Color3;
}

/** Result of lighting configuration. */
export interface ILightingResult {
  ambient: BABYLON.HemisphericLight;
  sun: BABYLON.DirectionalLight;
  fillLight?: BABYLON.DirectionalLight;
}

/** Options for scene configuration. */
export interface ISceneOptions {
  /** Fog start distance. Default: 48 */
  fogStart?: number;
  /** Fog end distance. Default: 128 */
  fogEnd?: number;
  /** Apply performance optimizations for world rendering. Default: false */
  worldPerformanceMode?: boolean;
  /** Use theme-aware clear color (dark/light mode). Default: false */
  themeAwareClearColor?: boolean;
}

/** Options for world-scale ground plane (used by WorldRenderer). */
export interface IWorldGroundPlaneOptions {
  /** Ground plane width/height. Default: 800 */
  size?: number;
  /** Y position. Default: 62 */
  yPosition?: number;
  /** Material z-offset to prevent z-fighting. Default: 10 */
  zOffset?: number;
}

/** Options for checkerboard platform (used by VolumeEditor). */
export interface ICheckerboardPlatformOptions {
  /** Minimum X block coordinate. */
  minX: number;
  /** Maximum X block coordinate. */
  maxX: number;
  /** Minimum Z block coordinate. */
  minZ: number;
  /** Maximum Z block coordinate. */
  maxZ: number;
  /** Y position of platform. Default: -0.5 */
  yPosition?: number;
  /** Name prefix for mesh names. Default: "platform" */
  namePrefix?: string;
}

/** Options for sun billboard visual. */
export interface ISunVisualOptions {
  /** Sun angle from vertical (radians). Default: π/4 */
  sunAngle?: number;
  /** Sun billboard size. Default: 60 */
  sunSize?: number;
  /** Distance from origin. Default: 300 */
  sunDistance?: number;
  /** Also create a directional light from the sun position. Default: true */
  createDirectionalLight?: boolean;
}

/** Options for cloud layer. */
export interface ICloudOptions {
  /** Cloud altitude. Default: 100 */
  height?: number;
  /** Cloud block size. Default: 4 */
  blockSize?: number;
  /** Cloud spread distance. Default: 300 */
  spread?: number;
  /** Cloud density threshold (0-1, lower = less clouds). Default: 0.35 */
  density?: number;
}

/** Options for infinite ground plane with fog (used by VolumeEditor ModelPreview). */
export interface IInfiniteGroundPlaneOptions {
  /** Ground plane size. Default: 2000 */
  size?: number;
  /** Y position. Default: -0.5 */
  yPosition?: number;
  /** Center X. Default: 0 */
  centerX?: number;
  /** Center Z. Default: 0 */
  centerZ?: number;
  /** Add linear fog. Default: true */
  addFog?: boolean;
  /** Fog start. Default: 20 */
  fogStart?: number;
  /** Fog end. Default: 200 */
  fogEnd?: number;
}

/**
 * Shared Minecraft environment rendering utilities.
 * Provides consistent sky, lighting, ground, and atmosphere across all 3D views.
 */
export default class MinecraftEnvironment {
  /**
   * Configure scene-level settings (clear color, fog, performance flags).
   * Builds on BlockRenderDatabase.configureScene() with additional options.
   */
  static configureScene(scene: BABYLON.Scene, options?: ISceneOptions): void {
    const fogStart = options?.fogStart ?? 48;
    const fogEnd = options?.fogEnd ?? 128;

    BlockRenderDatabase.configureScene(scene, { fogStart, fogEnd });

    if (options?.themeAwareClearColor) {
      const isDark = CreatorToolsHost.theme === CreatorToolsThemeStyle.dark;
      scene.clearColor = isDark ? new BABYLON.Color4(0.18, 0.17, 0.16, 1) : new BABYLON.Color4(0.47, 0.65, 0.85, 1);
    }

    if (options?.worldPerformanceMode) {
      scene.skipPointerMovePicking = true;
      scene.autoClear = true;
      scene.autoClearDepthAndStencil = true;
      scene.blockMaterialDirtyMechanism = false;
      scene.skipFrustumClipping = false;
      scene.renderTargetsEnabled = false;
      scene.particlesEnabled = false;
      scene.spritesEnabled = false;
      scene.probesEnabled = false;
      scene.lensFlaresEnabled = false;
      scene.proceduralTexturesEnabled = false;
      scene.collisionsEnabled = false;
      scene.physicsEnabled = false;
      scene.animationsEnabled = false;
      scene.audioEnabled = false;
      scene.constantlyUpdateMeshUnderPointer = false;
    }
  }

  /**
   * Configure lighting using the shared BlockRenderDatabase pipeline.
   * Optionally adds an upward fill light for ceiling illumination (WorldRenderer).
   */
  static configureLighting(scene: BABYLON.Scene, options?: ILightingOptions): ILightingResult {
    const lights = BlockRenderDatabase.configureLighting(scene);

    if (options?.ambientColor) {
      scene.ambientColor = options.ambientColor;
    }

    let fillLight: BABYLON.DirectionalLight | undefined;
    if (options?.addFillLight) {
      fillLight = new BABYLON.DirectionalLight("fillLight", new BABYLON.Vector3(0.1, 0.8, -0.1), scene);
      fillLight.intensity = options.fillLightIntensity ?? 0.5;
      fillLight.diffuse = new BABYLON.Color3(0.95, 0.95, 1.0);
    }

    return { ambient: lights.ambient, sun: lights.sun, fillLight };
  }

  /**
   * Create a sky dome — large inverted sphere with gradient sky material.
   * Uses 128 segments for seamless pole coverage. The gradient is tuned to
   * blend with linear fog (horizon band matches fog color).
   *
   * For WorldRenderer: caller should also set scene.clearColor to match zenith
   * color so pole gaps are invisible.
   */
  static createSkyDome(scene: BABYLON.Scene, options?: ISkyDomeOptions): BABYLON.Mesh {
    const diameter = options?.diameter ?? 2000;
    const segments = options?.segments ?? 128;

    const skyDome = BABYLON.MeshBuilder.CreateSphere(
      "skyDome",
      {
        diameter,
        segments,
        sideOrientation: BABYLON.Mesh.BACKSIDE,
      },
      scene
    );

    // Babylon.js sphere UV: V=0 at bottom pole, V=1 at top pole.
    // Canvas Y=0 → V=1 (zenith), Y=texSize → V=0 (nadir).
    const texSize = 256;
    const skyTex = new BABYLON.DynamicTexture("skyGradient", { width: 64, height: texSize }, scene, false);
    const ctx = skyTex.getContext();
    const gradient = ctx.createLinearGradient(0, 0, 0, texSize);

    // Horizon stops match fog color (#87CEEB / rgb(0.53, 0.81, 0.92)) for seamless blending.
    // Zenith color (#4A90C8) matches a typical clearColor so pole gaps are invisible.
    gradient.addColorStop(0.0, "#4A90C8"); // Zenith: medium-deep blue
    gradient.addColorStop(0.15, "#4A90C8"); // Extended zenith (covers pole area)
    gradient.addColorStop(0.25, "#5599D0"); // Upper sky
    gradient.addColorStop(0.35, "#6BAED6"); // Mid sky
    gradient.addColorStop(0.42, "#7CC0E2"); // Lower mid sky
    gradient.addColorStop(0.48, "#87CEEB"); // Approaching horizon → fog color
    gradient.addColorStop(0.55, "#87CEEB"); // Horizon band = fog color (wide)
    gradient.addColorStop(0.65, "#87CEEB"); // Below horizon = fog color
    gradient.addColorStop(0.8, "#6090A8"); // Below horizon: muted blue-grey
    gradient.addColorStop(1.0, "#506878"); // Nadir: dark blue-grey

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, texSize);
    skyTex.update();

    const skyMat = new BABYLON.StandardMaterial("skyDomeMat", scene);
    // Use diffuseTexture (not emissiveTexture) because Babylon.js 8.x does not render
    // emissiveTexture when disableLighting is true — the texture is silently ignored,
    // causing the sky dome to appear as solid white (the emissiveColor fallback).
    // With disableLighting=false, we use diffuseTexture for the gradient and set
    // emissiveColor to white to ensure the sky dome appears fully bright regardless
    // of scene lighting. The diffuse contribution from lights adds on top but since
    // specular=0 and diffuseColor is black, only emissive matters.
    skyMat.diffuseTexture = skyTex;
    skyMat.diffuseColor = new BABYLON.Color3(0, 0, 0);
    skyMat.emissiveColor = new BABYLON.Color3(1, 1, 1);
    skyMat.specularColor = new BABYLON.Color3(0, 0, 0);
    skyMat.backFaceCulling = false;
    skyMat.disableLighting = false;
    skyMat.fogEnabled = false;

    skyDome.material = skyMat;
    skyDome.isPickable = false;
    skyDome.infiniteDistance = true;
    skyDome.renderingGroupId = 0;

    return skyDome;
  }

  /**
   * Create a world-scale ground plane at Minecraft surface level.
   * Extends beyond loaded chunks to prevent sky showing below terrain edges.
   * The plane follows the camera's XZ position (caller must update in render loop).
   */
  static createWorldGroundPlane(scene: BABYLON.Scene, options?: IWorldGroundPlaneOptions): BABYLON.Mesh {
    const size = options?.size ?? 800;
    const yPosition = options?.yPosition ?? 62;
    const zOffset = options?.zOffset ?? 10;

    const groundPlane = BABYLON.MeshBuilder.CreateGround("groundPlane", { width: size, height: size }, scene);
    groundPlane.position.y = yPosition;

    const groundMat = new BABYLON.StandardMaterial("groundPlaneMat", scene);
    // Dark muted earth color — deliberately low to avoid oversaturation
    // under bright hemispheric+directional lighting (~2.1x multiplier).
    groundMat.diffuseColor = new BABYLON.Color3(0.12, 0.15, 0.08);
    groundMat.specularColor = new BABYLON.Color3(0.02, 0.02, 0.02);
    groundMat.emissiveColor = new BABYLON.Color3(0.04, 0.06, 0.03);
    groundMat.backFaceCulling = true;
    groundMat.fogEnabled = true;
    groundMat.zOffset = zOffset;

    groundPlane.material = groundMat;
    groundPlane.isPickable = false;
    groundPlane.renderingGroupId = 0;

    return groundPlane;
  }

  /**
   * Create an infinite ground plane with earthy color and fog (for ModelPreview/editor views).
   */
  static createInfiniteGroundPlane(scene: BABYLON.Scene, options?: IInfiniteGroundPlaneOptions): BABYLON.Mesh {
    const size = options?.size ?? 2000;
    const yPosition = options?.yPosition ?? -0.5;
    const centerX = options?.centerX ?? 0;
    const centerZ = options?.centerZ ?? 0;

    const ground = BABYLON.MeshBuilder.CreateGround(
      "infiniteGround",
      { width: size, height: size, subdivisions: 1 },
      scene
    );
    ground.position.y = yPosition;
    ground.position.x = centerX;
    ground.position.z = centerZ;

    const groundMaterial = new BABYLON.StandardMaterial("groundMaterial", scene);
    groundMaterial.diffuseColor = new BABYLON.Color3(0.35, 0.3, 0.25);
    groundMaterial.ambientColor = new BABYLON.Color3(0.25, 0.22, 0.18);
    groundMaterial.specularColor = new BABYLON.Color3(0.02, 0.02, 0.02);
    groundMaterial.emissiveColor = new BABYLON.Color3(0.04, 0.03, 0.02);

    ground.material = groundMaterial;
    ground.isPickable = false;
    ground.receiveShadows = true;
    ground.renderingGroupId = 0;

    if (options?.addFog !== false) {
      scene.fogMode = BABYLON.Scene.FOGMODE_LINEAR;
      scene.fogColor = new BABYLON.Color3(0.68, 0.82, 0.95);
      scene.fogStart = options?.fogStart ?? 20;
      scene.fogEnd = options?.fogEnd ?? 200;
    }

    return ground;
  }

  /**
   * Create a checkerboard grass platform for structure or model rendering.
   * Each block is 1×1×1 with alternating green shades for scale reference.
   */
  static createCheckerboardPlatform(scene: BABYLON.Scene, options: ICheckerboardPlatformOptions): BABYLON.Mesh[] {
    const blockSize = 1.0;
    const yPosition = options.yPosition ?? -0.5;
    const prefix = options.namePrefix ?? "platform";

    const grassLight = new BABYLON.StandardMaterial(prefix + "MatLight", scene);
    grassLight.diffuseColor = new BABYLON.Color3(0.22, 0.33, 0.2);
    grassLight.specularColor = new BABYLON.Color3(0.02, 0.03, 0.02);
    grassLight.emissiveColor = new BABYLON.Color3(0.01, 0.015, 0.01);

    const grassDark = new BABYLON.StandardMaterial(prefix + "MatDark", scene);
    grassDark.diffuseColor = new BABYLON.Color3(0.18, 0.28, 0.16);
    grassDark.specularColor = new BABYLON.Color3(0.02, 0.03, 0.02);
    grassDark.emissiveColor = new BABYLON.Color3(0.01, 0.012, 0.008);

    const meshes: BABYLON.Mesh[] = [];
    for (let x = options.minX; x <= options.maxX; x++) {
      for (let z = options.minZ; z <= options.maxZ; z++) {
        const block = BABYLON.MeshBuilder.CreateBox(
          `${prefix}Block_${x}_${z}`,
          { width: blockSize, height: blockSize, depth: blockSize },
          scene
        );
        block.position = new BABYLON.Vector3(x + 0.5, yPosition, z + 0.5);
        block.material = (x + z) % 2 === 0 ? grassLight : grassDark;
        block.isPickable = false;
        block.receiveShadows = true;
        meshes.push(block);
      }
    }

    return meshes;
  }

  /**
   * Create a billboard sun visual with optional directional light.
   * The sun texture is loaded from the vanilla resource pack.
   */
  static createSunVisual(
    scene: BABYLON.Scene,
    options?: ISunVisualOptions
  ): { sunMesh: BABYLON.Mesh; sunLight?: BABYLON.DirectionalLight } {
    const sunAngle = options?.sunAngle ?? Math.PI / 4;
    const sunSize = options?.sunSize ?? 60;
    const sunDistance = options?.sunDistance ?? 300;

    const sunX = sunDistance * Math.sin(sunAngle) * 0.7;
    const sunY = sunDistance * Math.cos(sunAngle);
    const sunZ = sunDistance * Math.sin(sunAngle) * 0.3;

    const sunPlane = BABYLON.MeshBuilder.CreatePlane("sun", { size: sunSize }, scene);
    sunPlane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
    sunPlane.position = new BABYLON.Vector3(sunX, sunY, sunZ);

    const sunMaterial = new BABYLON.StandardMaterial("sunMaterial", scene);
    sunMaterial.backFaceCulling = false;
    sunMaterial.disableLighting = true;

    const sunTexturePath =
      CreatorToolsHost.getVanillaContentRoot() + "res/latest/van/serve/resource_pack/textures/environment/sun.png";
    const sunTexture = new BABYLON.Texture(sunTexturePath, scene, false, true, BABYLON.Texture.NEAREST_SAMPLINGMODE);
    sunTexture.hasAlpha = true;

    sunMaterial.emissiveTexture = sunTexture;
    sunMaterial.opacityTexture = sunTexture;
    sunMaterial.emissiveColor = new BABYLON.Color3(1, 1, 0.9);

    sunPlane.material = sunMaterial;
    sunPlane.isPickable = false;
    sunPlane.renderingGroupId = 0;

    let sunLight: BABYLON.DirectionalLight | undefined;
    if (options?.createDirectionalLight !== false) {
      sunLight = new BABYLON.DirectionalLight("sunLight", new BABYLON.Vector3(-sunX, -sunY, -sunZ).normalize(), scene);
      sunLight.intensity = 1.2;
      sunLight.diffuse = new BABYLON.Color3(1.0, 0.98, 0.9);
      sunLight.specular = new BABYLON.Color3(0.5, 0.5, 0.4);
    }

    return { sunMesh: sunPlane, sunLight };
  }

  /**
   * Create an animated cloud layer with blocky Minecraft-style clouds.
   */
  static createClouds(scene: BABYLON.Scene, options?: ICloudOptions): BABYLON.Mesh | null {
    const cloudHeight = options?.height ?? 100;
    const cloudThickness = 1.5;
    const cloudBlockSize = options?.blockSize ?? 4;
    const cloudSpread = options?.spread ?? 300;
    const cloudDensity = options?.density ?? 0.35;

    const cloudsParent = new BABYLON.TransformNode("cloudsParent", scene);

    const cloudMaterial = new BABYLON.StandardMaterial("cloudMaterial", scene);
    cloudMaterial.diffuseColor = new BABYLON.Color3(1, 1, 1);
    cloudMaterial.emissiveColor = new BABYLON.Color3(0.95, 0.97, 1.0);
    cloudMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
    cloudMaterial.alpha = 0.92;
    cloudMaterial.backFaceCulling = false;

    const gridSize = Math.floor(cloudSpread / cloudBlockSize);
    const halfGrid = gridSize / 2;

    const cloudPositions: { x: number; z: number }[] = [];
    for (let gx = -halfGrid; gx < halfGrid; gx++) {
      for (let gz = -halfGrid; gz < halfGrid; gz++) {
        const noiseVal =
          Math.sin(gx * 0.3) * Math.cos(gz * 0.3) * 0.5 +
          Math.sin(gx * 0.7 + 1.3) * Math.cos(gz * 0.5 + 2.1) * 0.3 +
          Math.sin(gx * 0.1 + gz * 0.1) * 0.2;

        if (noiseVal > cloudDensity) {
          cloudPositions.push({ x: gx * cloudBlockSize, z: gz * cloudBlockSize });
        }
      }
    }

    const cloudBoxes: BABYLON.Mesh[] = [];
    for (const pos of cloudPositions) {
      const cloudBox = BABYLON.MeshBuilder.CreateBox(
        "cloudBlock",
        { width: cloudBlockSize, height: cloudThickness, depth: cloudBlockSize },
        scene
      );
      cloudBox.position.x = pos.x;
      cloudBox.position.y = cloudHeight;
      cloudBox.position.z = pos.z;
      cloudBox.material = cloudMaterial;
      cloudBox.parent = cloudsParent;
      cloudBox.isPickable = false;
      cloudBox.renderingGroupId = 0;
      cloudBoxes.push(cloudBox);
    }

    if (cloudBoxes.length > 0) {
      const mergedClouds = BABYLON.Mesh.MergeMeshes(cloudBoxes, true, true, undefined, false, true);
      if (mergedClouds) {
        mergedClouds.name = "clouds";
        mergedClouds.material = cloudMaterial;
        mergedClouds.isPickable = false;
        mergedClouds.renderingGroupId = 0;

        let cloudOffset = 0;
        const observer = scene.onBeforeRenderObservable.add(() => {
          cloudOffset += 0.015;
          if (mergedClouds) {
            mergedClouds.position.x = Math.sin(cloudOffset * 0.01) * 2;
            mergedClouds.position.z += 0.02;
            if (mergedClouds.position.z > cloudSpread / 2) {
              mergedClouds.position.z = -cloudSpread / 2;
            }
          }
        });

        // Clean up the render observer when the cloud mesh is disposed
        mergedClouds.onDisposeObservable.addOnce(() => {
          scene.onBeforeRenderObservable.remove(observer);
        });

        return mergedClouds;
      }
    }

    return null;
  }

  /**
   * Create reference blocks for scale context in model previews.
   * Places dirt + log blocks at a corner and loads vanilla textures.
   */
  static createReferenceBlocks(scene: BABYLON.Scene): void {
    const blockSize = 1.0;
    const vanillaRoot = CreatorToolsHost.getVanillaContentRoot();
    const textureBasePath = vanillaRoot + "res/latest/van/serve/resource_pack/textures/blocks/";

    // Dirt material
    const dirtMaterial = new BABYLON.StandardMaterial("refDirtMaterial", scene);
    const dirtTexture = new BABYLON.Texture(
      textureBasePath + "dirt.png",
      scene,
      true,
      false,
      BABYLON.Texture.NEAREST_SAMPLINGMODE
    );
    dirtTexture.hasAlpha = false;
    dirtTexture.uScale = 1;
    dirtTexture.vScale = -1;
    dirtMaterial.diffuseTexture = dirtTexture;
    dirtMaterial.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);

    // Log material
    const logMaterial = new BABYLON.StandardMaterial("refLogMaterial", scene);
    const logTexture = new BABYLON.Texture(
      textureBasePath + "log_oak.png",
      scene,
      true,
      false,
      BABYLON.Texture.NEAREST_SAMPLINGMODE
    );
    logTexture.hasAlpha = false;
    logTexture.uScale = 1;
    logTexture.vScale = -1;
    logMaterial.diffuseTexture = logTexture;
    logMaterial.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);

    // Position at corner of platform
    const refX = -2 + 0.5;
    const refZ = -2 + 0.5;
    const platformY = -0.5;

    const bottomBlock = BABYLON.MeshBuilder.CreateBox(
      "refBlock1",
      { width: blockSize, height: blockSize, depth: blockSize },
      scene
    );
    bottomBlock.position = new BABYLON.Vector3(refX, platformY + blockSize, refZ);
    bottomBlock.material = dirtMaterial;
    bottomBlock.isPickable = false;
    bottomBlock.receiveShadows = true;

    const topBlock = BABYLON.MeshBuilder.CreateBox(
      "refBlock2",
      { width: blockSize, height: blockSize, depth: blockSize },
      scene
    );
    topBlock.position = new BABYLON.Vector3(refX, platformY + blockSize * 2, refZ);
    topBlock.material = logMaterial;
    topBlock.isPickable = false;
    topBlock.receiveShadows = true;
  }

  /**
   * Create a minimal isolated lighting setup for headless rendering.
   * Uses simple ambient + directional without loading vanilla textures.
   */
  static createIsolatedLighting(scene: BABYLON.Scene): {
    ambient: BABYLON.HemisphericLight;
    sun: BABYLON.DirectionalLight;
  } {
    const ambient = new BABYLON.HemisphericLight("isolatedAmbient", new BABYLON.Vector3(0, 1, 0), scene);
    ambient.intensity = 0.9;
    ambient.diffuse = new BABYLON.Color3(1, 1, 1);
    ambient.groundColor = new BABYLON.Color3(0.6, 0.6, 0.6);

    const sun = new BABYLON.DirectionalLight(
      "isolatedSunLight",
      new BABYLON.Vector3(-0.5, -1, -0.3).normalize(),
      scene
    );
    sun.intensity = 0.8;
    sun.diffuse = new BABYLON.Color3(1.0, 0.98, 0.9);

    return { ambient, sun };
  }
}
