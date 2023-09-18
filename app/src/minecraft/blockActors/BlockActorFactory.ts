import Log from "../../core/Log";
import NbtBinaryTag from "../NbtBinaryTag";
import ChestBlockActor from "./ChestBlockActor";
import BedBlockActor from "./BedBlockActor";
import FrameBlockActor from "./FrameBlockActor";
import GenericBlockActor from "./GenericBlockActor";
import NoteBlockActor from "./NoteBlockActor";
import SignBlockActor from "./SignBlockActor";
import StructureBlockActor from "./StructureBlockActor";
import CauldronBlockActor from "./CauldronBlockActor";
import CampfireBlockActor from "./CampfireBlockActor";
import BeehiveBlockActor from "./BeehiveBlockActor";

export default class BlockActorFactory {
  public static create(id: string, rootTagIn: NbtBinaryTag) {
    switch (id) {
      case "minecraft:wall_sign":
      case "minecraft:standing_sign":
      case "Sign":
        return new SignBlockActor(rootTagIn);

      case "minecraft:structure_block":
      case "StructureBlock":
        return new StructureBlockActor(rootTagIn);

      case "minecraft:ender_chest":
      case "minecraft:chest":
      case "minecraft:barrel":
      case "Barrel":
      case "Chest":
        return new ChestBlockActor(rootTagIn);

      case "Cauldron":
        return new CauldronBlockActor(rootTagIn);

      case "minecraft:noteblock":
      case "Music":
        return new NoteBlockActor(rootTagIn);

      case "minecraft:frame":
      case "ItemFrame":
        return new FrameBlockActor(rootTagIn);

      case "minecraft:spore_blossom":
      case "SporeBlossom":
        return new GenericBlockActor(rootTagIn);

      case "Bed":
        return new BedBlockActor(rootTagIn);

      case "Campfire":
        return new CampfireBlockActor(rootTagIn);

      case "Beehive":
        return new BeehiveBlockActor(rootTagIn);

      default:
        Log.debugAlert("Unexpected block actor type found '" + id + "'");
        return undefined;
    }
  }
}
