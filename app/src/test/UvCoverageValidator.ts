/**
 * UV Coverage Validator
 *
 * Validates that every cube face's UV coordinates in a geometry file
 * point to non-transparent pixels in the corresponding texture.
 */

import * as fs from "fs";
import { PNG } from "pngjs";

export interface IUvCoverageResult {
  isValid: boolean;
  totalFaces: number;
  coveredFaces: number;
  uncoveredFaces: IUncoveredFace[];
  warnings: string[];
}

export interface IUncoveredFace {
  boneName: string;
  cubeIndex: number;
  faceName: string;
  uv: [number, number];
  uvSize: [number, number];
  emptyPixelPercentage: number;
}

export class UvCoverageValidator {
  /**
   * Validate that all UV coordinates in a geometry file point to
   * non-transparent pixels in the texture.
   *
   * @param geometryPath Path to the .geo.json file
   * @param texturePath Path to the texture .png file
   * @param emptyThreshold Percentage of empty pixels allowed per face (0-100)
   */
  static validate(geometryPath: string, texturePath: string, emptyThreshold: number = 10): IUvCoverageResult {
    const result: IUvCoverageResult = {
      isValid: true,
      totalFaces: 0,
      coveredFaces: 0,
      uncoveredFaces: [],
      warnings: [],
    };

    // Load geometry
    if (!fs.existsSync(geometryPath)) {
      result.warnings.push(`Geometry file not found: ${geometryPath}`);
      result.isValid = false;
      return result;
    }

    const geoContent = fs.readFileSync(geometryPath, "utf-8");
    const geometry = JSON.parse(geoContent);

    // Load texture
    if (!fs.existsSync(texturePath)) {
      result.warnings.push(`Texture file not found: ${texturePath}`);
      result.isValid = false;
      return result;
    }

    const textureData = fs.readFileSync(texturePath);
    const png = PNG.sync.read(textureData);

    // Get geometry description
    const geoArray = geometry["minecraft:geometry"];
    if (!geoArray || geoArray.length === 0) {
      result.warnings.push("No minecraft:geometry array found");
      result.isValid = false;
      return result;
    }

    const geo = geoArray[0];
    const textureWidth = geo.description?.texture_width || png.width;
    const textureHeight = geo.description?.texture_height || png.height;

    // Check each bone's cubes
    const bones = geo.bones || [];
    for (const bone of bones) {
      const boneName = bone.name || "unnamed";
      const cubes = bone.cubes || [];

      for (let cubeIndex = 0; cubeIndex < cubes.length; cubeIndex++) {
        const cube = cubes[cubeIndex];
        const uvFaces = cube.uv;

        if (!uvFaces || typeof uvFaces !== "object") {
          result.warnings.push(`Bone ${boneName} cube ${cubeIndex}: No UV data found`);
          continue;
        }

        // Check each face
        for (const faceName of ["north", "south", "east", "west", "up", "down"]) {
          const faceUv = uvFaces[faceName];
          if (!faceUv) {
            result.warnings.push(`Bone ${boneName} cube ${cubeIndex}: No ${faceName} face UV`);
            continue;
          }

          result.totalFaces++;

          const uv = faceUv.uv as [number, number];
          const uvSize = faceUv.uv_size as [number, number];

          // Check pixel coverage
          const coverage = this.checkRegionCoverage(png, uv, uvSize, textureWidth, textureHeight);

          if (coverage.emptyPercentage > emptyThreshold) {
            result.uncoveredFaces.push({
              boneName,
              cubeIndex,
              faceName,
              uv,
              uvSize,
              emptyPixelPercentage: coverage.emptyPercentage,
            });
            result.isValid = false;
          } else {
            result.coveredFaces++;
          }
        }
      }
    }

    return result;
  }

  /**
   * Check what percentage of pixels in a UV region are empty (transparent or black)
   */
  private static checkRegionCoverage(
    png: PNG,
    uv: [number, number],
    uvSize: [number, number],
    textureWidth: number,
    textureHeight: number
  ): { emptyPercentage: number; totalPixels: number; emptyPixels: number } {
    // UV coordinates in Minecraft geometry are in texture pixels
    const startX = Math.floor(uv[0]);
    const startY = Math.floor(uv[1]);
    const width = Math.floor(Math.abs(uvSize[0]));
    const height = Math.floor(Math.abs(uvSize[1]));

    let totalPixels = 0;
    let emptyPixels = 0;

    for (let y = startY; y < startY + height && y < png.height; y++) {
      for (let x = startX; x < startX + width && x < png.width; x++) {
        if (x < 0 || y < 0) continue;

        totalPixels++;
        const idx = (png.width * y + x) * 4;
        const r = png.data[idx];
        const g = png.data[idx + 1];
        const b = png.data[idx + 2];
        const a = png.data[idx + 3];

        // Consider pixel empty if fully transparent or very dark with low alpha
        if (a < 10 || (r < 5 && g < 5 && b < 5 && a < 128)) {
          emptyPixels++;
        }
      }
    }

    const emptyPercentage = totalPixels > 0 ? (emptyPixels / totalPixels) * 100 : 100;

    return {
      emptyPercentage,
      totalPixels,
      emptyPixels,
    };
  }

  /**
   * Print a detailed report of UV coverage issues
   */
  static printReport(result: IUvCoverageResult): void {
    console.log("\n=== UV Coverage Report ===");
    console.log(`Total faces: ${result.totalFaces}`);
    console.log(`Covered faces: ${result.coveredFaces}`);
    console.log(`Uncovered faces: ${result.uncoveredFaces.length}`);
    console.log(`Valid: ${result.isValid}`);

    if (result.warnings.length > 0) {
      console.log("\nWarnings:");
      for (const warning of result.warnings) {
        console.log(`  - ${warning}`);
      }
    }

    if (result.uncoveredFaces.length > 0) {
      console.log("\nUncovered faces:");
      for (const face of result.uncoveredFaces) {
        console.log(
          `  - ${face.boneName}[${face.cubeIndex}].${face.faceName}: ` +
            `UV(${face.uv[0]}, ${face.uv[1]}) size(${face.uvSize[0]}, ${face.uvSize[1]}) ` +
            `- ${face.emptyPixelPercentage.toFixed(1)}% empty`
        );
      }
    }
  }
}
