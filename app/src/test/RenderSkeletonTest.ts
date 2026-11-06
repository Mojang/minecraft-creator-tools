// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { assert } from "chai";
import * as B from "babylonjs";
import { ModelMeshFactory } from "../UX/world/ModelMeshFactory";
import { IGeometry } from "../minecraft/IModelGeometry";
import { SkeletonJoint } from "../app/RenderPresentation";
import { applyGeometryTransforms } from "../minecraft/VanillaGeometryTransforms";
import ModelGeometryDefinition from "../minecraft/ModelGeometryDefinition";
import Entity from "../minecraft/Entity";
import { setPresentationCameraPose } from "../UX/world/RenderPresentationScene";

describe("Render skeleton transforms", () => {
  let engine: B.NullEngine;
  let scene: B.Scene;
  beforeEach(() => {
    engine = new B.NullEngine();
    scene = new B.Scene(engine);
  });
  afterEach(() => {
    scene.dispose();
    engine.dispose();
  });

  function render(model: IGeometry, authored = model) {
    const root = new ModelMeshFactory(scene).createMesh(
      "fixture",
      model,
      "fixture",
      undefined,
      undefined,
      undefined,
      authored,
      true
    );
    assert.exists(root);
    return root!;
  }
  function joint(root: B.Mesh, name: string) {
    const joints: SkeletonJoint[] = root.metadata.modelSkeleton;
    const value = joints.find((candidate) => candidate.name === name);
    assert.exists(value, name);
    return value!;
  }
  function description(identifier = "geometry.fixture") {
    return {
      identifier,
      texture_width: 64,
      texture_height: 64,
      visible_bounds_width: 4,
      visible_bounds_height: 4,
      visible_bounds_offset: [0, 0, 0],
    };
  }
  it("retains named positions when an orbit camera recomputes its view", () => {
    const camera = new B.ArcRotateCamera("orbit", Math.PI / 6, Math.PI / 3, 3, B.Vector3.Zero(), scene);
    for (const position of [new B.Vector3(0, 0.3, -3), new B.Vector3(3, 0.3, 0), new B.Vector3(0, 0.3, 3)]) {
      setPresentationCameraPose(camera, B.Vector3.Zero(), position);
      camera.getViewMatrix(true);
      assert.closeTo(B.Vector3.Distance(camera.position, position), 0, 0.00001);
    }
  });

  for (const legacy of [false, true]) {
    it(`keeps the selected second geometry's authored hierarchy (legacy: ${legacy})`, () => {
      const first = { bones: [{ name: "wrong" }, { name: "tip", parent: "wrong" }] };
      const second = {
        bones: [
          { name: "right" },
          {
            name: "tip",
            parent: "right",
            pivot: [16, 32, -48],
            cubes: [{ origin: [15, 31, -49], size: [2, 2, 2], uv: [0, 0] }],
          },
        ],
      };
      const definition = new ModelGeometryDefinition();
      definition.loadFromData(
        legacy
          ? {
              format_version: "1.8.0",
              "geometry.first": first,
              "geometry.second": second,
            }
          : {
              format_version: "1.12.0",
              "minecraft:geometry": [
                { description: description("geometry.first"), ...first },
                { description: description("geometry.second"), ...second },
              ],
            }
      );
      const selected = definition.getById("geometry.second")!;
      assert.notStrictEqual(selected, definition.defaultGeometry);
      if (legacy) assert.isUndefined(selected.description);
      const entity = new Entity();
      entity.customModel = definition;
      entity.customGeometry = applyGeometryTransforms(selected, "geometry.second");
      entity.customAuthoredGeometry = selected;
      const { geometry, authoredGeometry } = entity.getCustomModelGeometry(true);
      assert.strictEqual(authoredGeometry, selected);
      const root = render(geometry!, authoredGeometry);
      assert.equal(joint(root, "tip").parent, "right");
    });
  }
  it("does not silently use the file default when selected authored data is missing", () => {
    const definition = new ModelGeometryDefinition();
    definition.loadFromData({ "minecraft:geometry": [{ description: description(), bones: [] }] });
    const entity = new Entity();
    entity.customModel = definition;
    entity.customGeometry = { description: description("geometry.selected"), bones: [] };
    assert.throws(
      () => entity.getCustomModelGeometry(true),
      /selected geometry's authored bone hierarchy isn't available/
    );
    assert.strictEqual(
      entity.getCustomModelGeometry().geometry,
      entity.customGeometry,
      "Non-skeleton selection is unchanged"
    );
  });

  it("projects off-origin pivots with the same nearest bind-pose transform as the cubes", () => {
    const model: IGeometry = {
      description: description(),
      bones: [
        { name: "root", pivot: [80, 20, -48], bind_pose_rotation: [0, 90, 0] },
        { name: "child", parent: "root", pivot: [84, 24, -40], bind_pose_rotation: [30, 0, 0] },
        { name: "group", parent: "child", pivot: [88, 28, -40] },
        {
          name: "tip",
          parent: "group",
          pivot: [90, 32, -40],
          cubes: [{ origin: [89, 31, -41], size: [2, 2, 2], uv: [0, 0] }],
        },
      ],
    };
    const pin = JSON.stringify(model);
    const root = render(model);
    const tip = joint(root, "tip");
    assert.equal(joint(root, "group").parent, "child", "Include cube-less grouping bones");
    root.position.set(7, 2, -3);
    root.rotation.y = 0.2;
    root.computeWorldMatrix(true);
    const cube = root.getChildMeshes().find((mesh) => mesh.name.includes("_tip_cube_0"));
    assert.exists(cube);
    cube!.computeWorldMatrix(true);
    const expected = cube!.getAbsolutePosition();
    const actual = B.Vector3.TransformCoordinates(B.Vector3.FromArray(tip.position), root.getWorldMatrix());
    assert.closeTo(B.Vector3.Distance(expected, actual), 0, 0.00001);
    const stacked = scene.getTransformNodeByName("fixture_bone_tip")!;
    stacked.computeWorldMatrix(true);
    assert.isAbove(
      B.Vector3.Distance(stacked.getAbsolutePosition(), actual),
      0.1,
      "Do not use the unrelated stacked hierarchy"
    );
    const camera = new B.FreeCamera("camera", actual.add(new B.Vector3(3, 2, 3)), scene);
    camera.setTarget(actual);
    const transform = camera.getViewMatrix().multiply(camera.getProjectionMatrix());
    const viewport = new B.Viewport(0, 0, 1024, 1024);
    const projected = B.Vector3.Project(actual, B.Matrix.Identity(), transform, viewport);
    const cubePixel = B.Vector3.Project(expected, B.Matrix.Identity(), transform, viewport);
    assert.closeTo(projected.x, cubePixel.x, 0.0001);
    assert.closeTo(projected.y, cubePixel.y, 0.0001);
    assert.equal(JSON.stringify(model), pin, "Do not mutate geometry while adding metadata");
  });

  it("retains authored parent links after vanilla rendering detaches a leg", () => {
    const authored: IGeometry = {
      description: description("geometry.sheep.v1.8"),
      bones: [
        { name: "body", pivot: [0, 10, 0], bind_pose_rotation: [90, 0, 0] },
        {
          name: "leg0",
          parent: "body",
          pivot: [2, 4, -2],
          cubes: [{ origin: [1, 3, -3], size: [2, 2, 2], uv: [0, 0] }],
        },
      ],
    };
    const transformed = applyGeometryTransforms(authored, "geometry.sheep.v1.8");
    assert.isUndefined(transformed.bones![1].parent);
    const root = render(transformed, authored);
    assert.equal(joint(root, "leg0").parent, "body");
    assert.deepEqual(joint(root, "leg0").position, [2 / 16, 4 / 16, 2 / 16]);
  });

  it("keeps missing-parent roots and does not introduce unsupported bone rotation semantics", () => {
    const model: IGeometry = {
      description: description(),
      bones: [
        {
          name: "tip",
          parent: "missing",
          pivot: [16, 32, -48],
          rotation: [90, 90, 90],
          cubes: [{ origin: [15, 31, -49], size: [2, 2, 2], uv: [0, 0] }],
        },
      ],
    };
    const root = render(model);
    assert.deepEqual(joint(root, "tip").position, [1, 2, 3]);
    assert.equal(joint(root, "tip").parent, "missing");
  });
});
