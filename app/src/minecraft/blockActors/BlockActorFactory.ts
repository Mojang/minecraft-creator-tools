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
import CommandBlockActor from "./CommandBlockActor";
import MobSpawnerBlockActor from "./MobSpawnerBlockActor";
import HopperBlockActor from "./HopperBlockActor";
import ComparatorBlockActor from "./ComparatorBlockActor";

export default class BlockActorFactory {
  public static create(id: string, rootTagIn: NbtBinaryTag) {
    switch (id) {
      case "minecraft:wall_sign":
      case "minecraft:standing_sign":
      case "Sign":
      case "HangingSign":
        return new SignBlockActor(rootTagIn);

      case "minecraft:structure_block":
      case "StructureBlock":
        return new StructureBlockActor(rootTagIn);

      case "minecraft:ender_chest":
      case "minecraft:chest":
      case "minecraft:barrel":
      case "Barrel":
      case "Chest":
      case "EnderChest":
        return new ChestBlockActor(rootTagIn);

      case "Cauldron":
        return new CauldronBlockActor(rootTagIn);

      case "minecraft:noteblock":
      case "Music":
        return new NoteBlockActor(rootTagIn);

      case "minecraft:frame":
      case "ItemFrame":
      case "GlowItemFrame":
        return new FrameBlockActor(rootTagIn);

      case "minecraft:spore_blossom":
      case "SporeBlossom":
      case "FlowerPot":
      case "EndPortal":
      case "Banner": // start of just blanket inclusion.
      case "EnchantTable":
      case "Lectern":
      case "BlastFurnace":
      case "Furnace":
      case "DaylightDetector":
      case "ShulkerBox":
      case "BrewingStand":
      case "Skull":
      case "Dropper":
      case "Dispenser":
      case "Bell":
      case "BrushableBlock":
      case "ChiseledBookshelf":
      case "SculkSensor":
      case "PistonArm":
      case "SculkShrieker":
      case "NetherReactor":
      case "SculkCatalyst":
      case "Lodestone":
      case "Beacon":
      case "Conduit":
      case "Jukebox":
      case "JigsawBlock":
      case "Smoker":
      case "ChalkboardBlock":
      case "ChemistryTable":
      case "CalibratedSculkSensor":
      case "DecoratedPot":
      case "SuspiciousSand":
      case "EndGateway":
      case "SuspiciousGravel":
        return new GenericBlockActor(rootTagIn);

      case "Bed":
        return new BedBlockActor(rootTagIn);

      case "Campfire":
      case "SoulCampfire":
        return new CampfireBlockActor(rootTagIn);

      case "Beehive":
        return new BeehiveBlockActor(rootTagIn);

      case "CommandBlock":
        return new CommandBlockActor(rootTagIn);

      case "MobSpawner":
      case "mob_spawner":
      case "minecraft:mob_spawner":
        return new MobSpawnerBlockActor(rootTagIn);

      case "Hopper":
        return new HopperBlockActor(rootTagIn);

      case "Comparator":
        return new ComparatorBlockActor(rootTagIn);

      default:
        Log.debugAlert("Unexpected block actor type found '" + id + "'");
        return undefined;
    }
  }
}
