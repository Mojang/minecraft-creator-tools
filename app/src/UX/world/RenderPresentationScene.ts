// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * CLI-only presentation stage, shared by model/structure and block viewers.
 *
 * Call after content meshes are built, passing placed roots, never the cached templates
 * VolumeEditor parks at X=10000. World-space vertex bounds include rotations and offsets.
 * Named cameras use one orthographic scale enclosing every preset, not four independent
 * auto-fits. ModelMeshFactory reflects model Z; model front (-Z) is therefore scene +Z.
 * Structure placement reflects X instead: its front remains -Z and east is scene -X.
 *
 * The capture bridge renders synchronously before reading WebGL (no preserveDrawingBuffer
 * dependency). Playwright composes sheet labels outside the scene and checks bridge errors.
 * CLI engines also release their native WebGL context on disposal rather than
 * waiting for page teardown.
 * No URL opt-in means no changes to interactive viewers, MCP previews, or sprite atlases.
 */
import * as B from "babylonjs";
import {
  RenderView,
  renderViews,
  RenderCapture,
  RenderPresentationOptions,
  SkeletonJoint,
  ProjectedJoint,
} from "../../app/RenderPresentation";
import Log from "../../core/Log";

export function boneColor(name: string): B.Color3 {
  let hash = 2166136261;
  for (let i = 0; i < name.length; i++) hash = Math.imul(hash ^ name.charCodeAt(i), 16777619);
  return B.Color3.FromHSV((hash >>> 0) % 360, 0.38, 0.83);
}

export function setPresentationCameraPose(camera: B.TargetCamera, target: B.Vector3, position: B.Vector3): void {
  if (camera instanceof B.ArcRotateCamera) {
    camera.setTarget(target);
    camera.setPosition(position);
  } else {
    camera.position.copyFrom(position);
    camera.setTarget(target);
  }
}

export default class RenderPresentationScene implements RenderCapture {
  private min = new B.Vector3(Infinity, Infinity, Infinity);
  private max = new B.Vector3(-Infinity, -Infinity, -Infinity);
  private center: B.Vector3;
  private span: number;
  private owned: B.IDisposable[] = [];
  private ground!: B.Mesh;
  private grid!: B.DynamicTexture;
  private groundColor = "#454545";
  private gridColor = "#505050";
  private skeletons: { root: B.AbstractMesh; joints: SkeletonJoint[] }[] = [];
  private projectedJoints: ProjectedJoint[][] = [];

  constructor(
    private scene: B.Scene,
    private camera: B.TargetCamera,
    roots: B.AbstractMesh[],
    private options: RenderPresentationOptions,
    private frontZ: number,
    private sideX: number
  ) {
    const meshes = Array.from(new Set(roots.flatMap((root) => [root, ...root.getChildMeshes()]))).filter(
      (mesh) => mesh.getTotalVertices() > 0 && mesh.isEnabled() && mesh.isVisible
    );
    if (meshes.length === 0) throw new Error("No renderable geometry was loaded.");
    if (options.skeleton) {
      for (const root of roots) {
        const joints: SkeletonJoint[] | undefined = root.metadata?.modelSkeleton;
        if (joints?.length) this.skeletons.push({ root, joints });
      }
      if (!this.skeletons.length) throw new Error("--skeleton requires named model bones.");
    }
    for (const mesh of meshes) {
      mesh.computeWorldMatrix(true);
      const bounds = mesh.getBoundingInfo().boundingBox;
      this.min = B.Vector3.Minimize(this.min, bounds.minimumWorld);
      this.max = B.Vector3.Maximize(this.max, bounds.maximumWorld);
    }
    this.center = this.min.add(this.max).scale(0.5);
    this.span = Math.max(0.1, this.max.subtract(this.min).length());
    Log.verbose(
      `Render presentation bounds: ${this.min.toString()} to ${this.max.toString()} (${meshes.length} meshes)`
    );
    this.scene.blockMaterialDirtyMechanism = false;
    this.scene.fogMode = B.Scene.FOGMODE_NONE;
    this.scene.ambientColor = B.Color3.Black();
    this.scene.clearColor = new B.Color4(0.21, 0.21, 0.21, 1);
    for (const light of [...scene.lights]) light.dispose();
    this.applyAppearance(meshes);
    this.createStage(meshes);
  }

  private applyAppearance(meshes: B.AbstractMesh[]): void {
    const materials = new Map<string, B.StandardMaterial>();
    for (const mesh of meshes) {
      if (this.options.appearance === "textured") {
        const material = mesh.material;
        if (material instanceof B.StandardMaterial) {
          material.unfreeze();
          if (
            material.diffuseTexture instanceof B.Texture &&
            !material.diffuseTexture.url &&
            !material.diffuseTexture.getInternalTexture()
          ) {
            material.diffuseTexture = null;
          }
          material.specularColor = B.Color3.Black();
          material.emissiveColor = B.Color3.Black();
          material.ambientColor = B.Color3.Black();
        }
        continue;
      }
      const bone = mesh.metadata?.modelBone;
      if (this.options.appearance === "bones" && typeof bone !== "string") {
        throw new Error(
          "Bones appearance requires named model bones; use textured, clay, or wireframe for this content."
        );
      }
      const key = this.options.appearance === "bones" ? bone : this.options.appearance;
      let material = materials.get(key);
      if (!material) {
        material = new B.StandardMaterial(`presentation-${key}`, this.scene);
        material.diffuseColor = this.options.appearance === "bones" ? boneColor(bone) : new B.Color3(0.67, 0.67, 0.67);
        material.specularColor = B.Color3.Black();
        material.backFaceCulling = false;
        if (this.options.appearance === "wireframe") {
          material.disableColorWrite = true;
          material.disableDepthWrite = true;
        }
        materials.set(key, material);
        this.owned.push(material);
      }
      mesh.material = material;
      mesh.useVertexColors = false;
      if (this.options.appearance === "wireframe") {
        mesh.enableEdgesRendering(0.999, true);
        mesh.edgesWidth = 4;
        mesh.edgesColor = new B.Color4(0.8, 0.8, 0.8, 1);
      }
    }
  }

  private createStage(meshes: B.AbstractMesh[]): void {
    const hemi = new B.HemisphericLight("presentation-fill", B.Vector3.Up(), this.scene);
    hemi.diffuse = B.Color3.White();
    hemi.groundColor = new B.Color3(0.65, 0.65, 0.65);
    hemi.specular = B.Color3.Black();
    hemi.intensity = 0.65;
    const key = new B.DirectionalLight("presentation-key", new B.Vector3(0.25, -1, -0.2), this.scene);
    key.diffuse = B.Color3.White();
    key.specular = B.Color3.Black();
    key.intensity = 0.35;
    key.position = this.center.subtract(key.direction.normalizeToNew().scale(this.span * 2));
    key.shadowMinZ = 0.01;
    key.shadowMaxZ = this.span * 6;
    let groundColor = "#454545";
    let gridColor = "#505050";
    if (this.options.environment !== "neutral") {
      const palette = {
        plains: { sky: "#94b6ca", ground: "#707d59", grid: "#839069" },
        desert: { sky: "#bfc7c9", ground: "#b4a17b", grid: "#c7b48c" },
        snowy: { sky: "#adbfcf", ground: "#aeb9bf", grid: "#c4cdd2" },
      }[this.options.environment];
      this.scene.clearColor = B.Color4.FromHexString(palette.sky + "ff");
      groundColor = palette.ground;
      gridColor = palette.grid;
      if (this.options.timeOfDay === "sunset") {
        key.direction = new B.Vector3(1, -0.35, -0.6);
        key.diffuse = new B.Color3(1, 0.69, 0.43);
        hemi.diffuse = new B.Color3(0.7, 0.75, 0.95);
        this.scene.clearColor = new B.Color4(0.48, 0.36, 0.39, 1);
      } else if (this.options.timeOfDay === "night") {
        key.diffuse = new B.Color3(0.65, 0.73, 1);
        key.intensity = 0.3;
        hemi.intensity = 0.45;
        hemi.diffuse = new B.Color3(0.55, 0.65, 0.9);
        this.scene.clearColor = new B.Color4(0.075, 0.09, 0.14, 1);
      }
      key.position = this.center.subtract(key.direction.normalizeToNew().scale(this.span * 2));
    }
    const shadows = new B.ShadowGenerator(2048, key);
    // A near-overhead area light keeps the footprint compact. PCSS softens the
    // penumbra with height rather than blurring the model's pixel-art texture.
    shadows.useContactHardeningShadow = true;
    shadows.contactHardeningLightSizeUVRatio = 0.15;
    shadows.filteringQuality = B.ShadowGenerator.QUALITY_MEDIUM;
    shadows.setDarkness(0.45);
    shadows.bias = 0.0001;
    shadows.normalBias = 0.01;
    shadows.transparencyShadow = true;
    for (const mesh of meshes) shadows.addShadowCaster(mesh, false);
    const size = this.span * 12;
    const ground = B.MeshBuilder.CreateGround("presentation-ground", { width: size, height: size }, this.scene);
    ground.position.set(this.center.x, this.min.y - this.span * 0.002, this.center.z);
    ground.receiveShadows = true;
    ground.isPickable = false;
    const material = new B.StandardMaterial("presentation-ground-material", this.scene);
    material.specularColor = B.Color3.Black();
    const texture = new B.DynamicTexture("presentation-grid", 128, this.scene, true);
    const ctx = texture.getContext();
    ctx.fillStyle = groundColor;
    ctx.fillRect(0, 0, 128, 128);
    if (this.options.grid) {
      ctx.fillStyle = gridColor;
      ctx.fillRect(0, 0, 2, 128);
      ctx.fillRect(0, 0, 128, 2);
    }
    texture.update();
    texture.uScale = size;
    texture.vScale = size;
    texture.wrapU = B.Texture.WRAP_ADDRESSMODE;
    texture.wrapV = B.Texture.WRAP_ADDRESSMODE;
    texture.anisotropicFilteringLevel = 16;
    material.diffuseTexture = texture;
    ground.material = material;
    this.ground = ground;
    this.grid = texture;
    this.groundColor = groundColor;
    this.gridColor = gridColor;
    this.owned.push(hemi, key, shadows, ground, material, texture);
  }

  private direction(view: RenderView): B.Vector3 {
    const elevation = Math.tan((5 * Math.PI) / 180);
    switch (view) {
      case "front":
        return new B.Vector3(0, elevation, this.frontZ).normalize();
      case "side":
        return new B.Vector3(this.sideX, elevation, 0).normalize();
      case "back":
        return new B.Vector3(0, elevation, -this.frontZ).normalize();
      default:
        return new B.Vector3(this.sideX, 0.7, this.frontZ).normalize();
    }
  }

  private frame(view: RenderView, aspect: number): void {
    const corners: B.Vector3[] = [];
    for (const x of [this.min.x, this.max.x])
      for (const y of [this.min.y, this.max.y]) {
        for (const z of [this.min.z, this.max.z]) corners.push(new B.Vector3(x, y, z).subtract(this.center));
      }
    let halfHeight = 0.05;
    for (const preset of renderViews) {
      const direction = this.direction(preset);
      const right = B.Vector3.Cross(B.Vector3.Up(), direction).normalize();
      const up = B.Vector3.Cross(direction, right).normalize();
      for (const corner of corners) {
        halfHeight = Math.max(
          halfHeight,
          Math.abs(B.Vector3.Dot(corner, up)),
          Math.abs(B.Vector3.Dot(corner, right)) / aspect
        );
      }
    }
    halfHeight *= 1.3;
    this.camera.mode = B.Camera.ORTHOGRAPHIC_CAMERA;
    this.camera.minZ = this.span * 0.001;
    this.camera.maxZ = this.span * 20;
    setPresentationCameraPose(this.camera, this.center, this.center.add(this.direction(view).scale(this.span * 3)));
    this.camera.orthoTop = halfHeight;
    this.camera.orthoBottom = -halfHeight;
    this.camera.orthoLeft = -halfHeight * aspect;
    this.camera.orthoRight = halfHeight * aspect;
  }

  capture(view: RenderView | undefined, width: number, height: number): string {
    const engine = this.scene.getEngine();
    const canvas = engine.getRenderingCanvas();
    if (!canvas) throw new Error("The render canvas is unavailable.");
    const samplingScale = this.options.appearance === "wireframe" ? 2 : 1;
    engine.setSize(width * samplingScale, height * samplingScale, true);
    if (view) this.frame(view, width / height);
    const cardinal = view !== undefined && view !== "three-quarter";
    const floorScale = cardinal ? 1 / 6 : 1;
    this.ground.scaling.set(floorScale, 1, floorScale);
    this.grid.uScale = this.grid.vScale = this.span * 12 * floorScale;
    const ctx = this.grid.getContext();
    ctx.fillStyle = this.groundColor;
    ctx.fillRect(0, 0, 128, 128);
    // Compensate line weight for the grazing presentation angle, retaining
    // one-block spacing instead of letting one grid direction vanish subpixel.
    if (this.options.grid) {
      ctx.fillStyle = this.gridColor;
      ctx.fillRect(0, 0, cardinal && view === "side" ? 12 : 2, 128);
      ctx.fillRect(0, 0, 128, cardinal && view !== "side" ? 12 : 2);
    }
    this.grid.update();
    this.scene.render();
    if (samplingScale > 1 || this.options.skeleton) {
      const output = document.createElement("canvas");
      output.width = width;
      output.height = height;
      const context = output.getContext("2d");
      if (!context) throw new Error("Could not create the rendered image.");
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(canvas, 0, 0, width, height);
      if (this.options.skeleton) this.drawSkeleton(context, width, height);
      return output.toDataURL("image/png");
    }
    return canvas.toDataURL("image/png");
  }

  private drawSkeleton(context: CanvasRenderingContext2D, width: number, height: number): void {
    const viewport = new B.Viewport(0, 0, width, height);
    const unit = Math.max(1, Math.min(width, height) / 512);
    this.projectedJoints = this.skeletons.map(({ root, joints }) => {
      root.computeWorldMatrix(true);
      return joints.flatMap((joint) => {
        const world = B.Vector3.TransformCoordinates(B.Vector3.FromArray(joint.position), root.getWorldMatrix());
        const point = B.Vector3.Project(world, B.Matrix.Identity(), this.scene.getTransformMatrix(), viewport);
        return point.z >= 0 && point.z <= 1 ? [{ name: joint.name, parent: joint.parent, x: point.x, y: point.y }] : [];
      });
    });
    context.lineCap = "round";
    context.lineJoin = "round";
    for (const joints of this.projectedJoints) {
      const byName = new Map(joints.map((joint) => [joint.name, joint]));
      context.beginPath();
      for (const joint of joints) {
        const parent = joint.parent ? byName.get(joint.parent) : undefined;
        if (parent) {
          context.moveTo(parent.x, parent.y);
          context.lineTo(joint.x, joint.y);
        }
      }
      context.strokeStyle = "rgba(0, 0, 0, 0.85)";
      context.lineWidth = 4 * unit;
      context.stroke();
      context.strokeStyle = "#f2f2f2";
      context.lineWidth = 1.5 * unit;
      context.stroke();
      for (const joint of joints) {
        context.beginPath();
        context.arc(joint.x, joint.y, 3 * unit, 0, Math.PI * 2);
        context.fillStyle = this.options.appearance === "bones" ? boneColor(joint.name).toHexString() : "#ffd279";
        context.fill();
        context.strokeStyle = "rgba(0, 0, 0, 0.85)";
        context.lineWidth = 1.5 * unit;
        context.stroke();
      }
    }
  }

  describe() {
    return {
      min: this.min.asArray(),
      max: this.max.asArray(),
      camera: this.camera.position.asArray(),
      orthoTop: this.camera.orthoTop,
      ...(this.options.skeleton ? { joints: this.projectedJoints } : {}),
    };
  }

  release(): void {
    const engine = this.scene.getEngine();
    engine.stopRenderLoop();
    this.dispose();
    this.scene.dispose();
    engine.dispose();
  }

  dispose(): void {
    for (const resource of this.owned) resource.dispose();
    if (window.mctPresentation === this) delete window.mctPresentation;
  }
}
