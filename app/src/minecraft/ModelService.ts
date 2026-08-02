import { UnitCubeGeometry } from "./ModelData";

export default class ModelService {
  public getUnitCubeGeometry(identifier: string) {
    return {
      ...UnitCubeGeometry,
      "minecraft:geometry": [
        {
          ...UnitCubeGeometry["minecraft:geometry"][0],
          description: {
            ...UnitCubeGeometry["minecraft:geometry"][0].description,
            identifier: identifier,
          },
        },
      ],
    };
  }
}
