import BlockBaseType from "./BlockBaseType";
import { BlockRenderType } from "./BlockRenderType";
import IBlockTypeData from "./IBlockTypeData";
import IJavaBlockTypeData from "./IJavaBlockTypeData";
import MinecraftUtilities from "./MinecraftUtilities";
import Database from "./Database";
import Utilities from "../core/Utilities";
import { EventDispatcher, IEventHandler } from "ste-events";
import IFile from "../storage/IFile";
import Log from "../core/Log";
import IComponent from "./IComponent";
import IBlockTypeBehaviorPack from "./IBlockTypeBehaviorPack";
import IBlockTypeWrapper from "./IBlockTypeWrapper";
import IManagedComponentSetItem from "./IManagedComponentSetItem";
import IManagedComponent from "./IManagedComponent";
import { ManagedComponent } from "./ManagedComponent";
import StorageUtilities from "../storage/StorageUtilities";

const BLOCK_TYPE_MATERIALS = [
  "bone",
  "cobblestone",
  "stone",
  "andesite",
  "bedrock",
  "blackstone",
  "basalt",
  "acacia",
  "oak",
  "gold",
  "jungle",
  "birch",
  "big_oak",
  "spruce",
  "bamboo",
  "chiseled_nether_bricks",
  "chiseled_polished_blackstone_brick",
  "cracked_netherbricks",
  "cracked_polishedblackstone_bricks",
  "end_brick",
  "wood",
  "purpur",
  "brick",
  "blue",
  "black",
  "brown",
  "cyan",
  "gray",
  "light_blue",
  "lime",
  "magenta",
  "orange",
  "pink",
  "purple",
  "red",
  "silver",
  "white",
  "yellow",
  "fern",
  "grass",
  "paeonia",
  "rose",
  "rose_blue",
  "sunflower",
  "syringa",
  "allium",
  "blue_orchid",
  "cornflower",
  "dandelion",
  "houstonia",
  "lily_of_the_valley",
  "oxeye_daisy",
  "orange_tulip",
  "pink_tulip",
  "red_tulip",
  "white_tulip",
  "dark_oak",
  "blue_ice",
  "frosted_ice",
  "ice",
];

export default class BlockType implements IManagedComponentSetItem {
  private _typeId = "";

  public data: IBlockTypeData;
  public javaData: IJavaBlockTypeData | null;

  private _baseType?: BlockBaseType;
  private _baseTypeId = "";

  private _material = "";
  private _isCustom = false;
  private _behaviorPackData: IBlockTypeWrapper | null = null;
  private _behaviorPackFile?: IFile;
  private _id?: string;
  private _isLoaded: boolean = false;

  public behaviorPackBlockTypeDef?: IBlockTypeBehaviorPack;
  private _managed: { [id: string]: IManagedComponent | undefined } = {};
  private _onLoaded = new EventDispatcher<BlockType, BlockType>();

  private _onComponentAdded = new EventDispatcher<BlockType, IManagedComponent>();
  private _onComponentRemoved = new EventDispatcher<BlockType, string>();
  private _onComponentChanged = new EventDispatcher<BlockType, IManagedComponent>();

  public get numericId() {
    return this.data.id;
  }

  public get baseTypeId() {
    return this._baseTypeId;
  }

  public get mapColor() {
    return this.data.mapColor;
  }

  public get isCustom() {
    return this._isCustom;
  }

  public get baseType() {
    if (this._baseType !== undefined) {
      return this._baseType;
    }

    return Database.defaultBlockBaseType;
  }

  public set baseType(baseType: BlockBaseType) {
    this._baseType = baseType;
    this._baseTypeId = baseType.name;
  }

  public get material() {
    return this._material;
  }

  public renderType: BlockRenderType = BlockRenderType.Custom;

  get icon() {
    let val = this.data.icon;

    if (val === undefined && this.baseType !== undefined) {
      val = this.baseType.icon;
    }

    return val;
  }

  get typeId() {
    return this._typeId;
  }

  get shortTypeName() {
    let name = this._typeId;

    const colonIndex = name.indexOf(":");

    if (colonIndex >= 0) {
      name = name.substring(colonIndex + 1, name.length);
    }

    return name;
  }

  get title() {
    const id = this.shortTypeName;

    return Utilities.humanifyMinecraftName(id);
  }

  constructor(name: string) {
    this._typeId = name;
    this.javaData = null;

    this.data = {
      name: name,
    };

    if (name.indexOf(":") >= 0 && !name.startsWith("minecraft:")) {
      this._isCustom = true;
    }

    const baseTypeShort = MinecraftUtilities.canonicalizeName(name);

    for (const material of BLOCK_TYPE_MATERIALS) {
      if (baseTypeShort.indexOf(material) >= 0) {
        this._material = material;
        break;
      }
    }
  }

  getIcon(): string {
    const icon = this.icon;

    if (icon === undefined) {
      return this.shortTypeName;
    }

    const typeName = MinecraftUtilities.canonicalizeName(this.shortTypeName);

    const lastUnder = typeName.lastIndexOf("_");

    let allButLast = typeName;

    if (lastUnder >= 0) {
      allButLast = allButLast.substring(0, lastUnder);
    }

    switch (icon) {
      case "st_":
        return "stone_" + allButLast;

      case "le_":
        return "leaves_acacia_carried";

      case "pl_":
        return "planks_" + allButLast;

      case "_car":
        return allButLast + "_carried";

      case "plant_":
        return typeName + "_fern_carried";
      case "_":
        return typeName;
      case "_t":
        return allButLast + "_top";

      case "_br":
        return allButLast + "_bricks";

      case "_carr":
        return typeName + "_carried";

      case "_bl":
        return allButLast + "_block";

      case "_n":
        return allButLast + "_normal";

      case "_blt":
        return allButLast + "_block_top";

      case "mshblk":
        const lastmb = allButLast.split("_");

        return "mushroom_block_skin_" + lastmb[0];

      case "ml_sm":
        const lastml = allButLast.split("_");

        return lastml[lastml.length - 2] + "_" + lastml[lastml.length - 1] + "_smooth";

      case "l_blt":
        const lastbt = allButLast.split("_");

        return lastbt[lastbt.length - 1] + "_block_top";

      case "|":
        return allButLast;

      case "|s":
        return allButLast + "s";

      case "l":
        const last = allButLast.split("_");

        return last[last.length - 1];

      case "sb_":
        const fu = allButLast.split("_");

        return "stonebricks_" + fu[0];

      case "st_l_sm":
        const lasta = allButLast.split("_");

        return "stone_" + lasta[lasta.length - 1] + "_smooth";

      case "|rv":
        // dark_prismarine_stairs => prismarine_dark_stairs
        let result = "";

        const rv = allButLast.split("_");

        for (let i = rv.length - 1; i > 0; i--) {
          if (result.length > 0) {
            result += "_";
          }

          result += rv[i];
        }

        return result;

      case "2rv":
        // yellow_glazed_terracotta => glazed_terracotta_yellow
        // dark_blue_glazed_terracotta => glazed_terracotta_dark_blue
        let resultF = "";

        const rvF = typeName.split("_");

        if (rvF.length >= 2) {
          resultF = rvF[rvF.length - 2] + "_" + rvF[rvF.length - 1];

          for (let i = 0; i < rvF.length - 2; i++) {
            resultF += "_" + rvF[i];
          }
        } else {
          resultF = typeName;
        }

        return resultF;

      case "rv":
        // dark_prismarine => prismarine_dark
        let resultA = "";

        const rvA = typeName.split("_");

        for (let i = rvA.length - 1; i >= 0; i--) {
          if (resultA.length > 0) {
            resultA += "_";
          }

          resultA += rvA[i];
        }

        return resultA;
    }

    if (this.icon !== undefined) {
      return this.icon;
    }

    return this.shortTypeName;
  }

  public set id(newId: string | undefined) {
    this._id = newId;
  }

  public get onComponentAdded() {
    return this._onComponentAdded.asEvent();
  }

  public get onComponentRemoved() {
    return this._onComponentRemoved.asEvent();
  }

  public get onComponentChanged() {
    return this._onComponentChanged.asEvent();
  }

  public get isLoaded() {
    return this._isLoaded;
  }

  public get behaviorPackFile() {
    return this._behaviorPackFile;
  }

  public get onLoaded() {
    return this._onLoaded.asEvent();
  }

  public set behaviorPackFile(newFile: IFile | undefined) {
    this._behaviorPackFile = newFile;
  }

  public get shortId() {
    if (this._id !== undefined) {
      if (this._id.startsWith("minecraft:")) {
        return this._id.substring(10, this._id.length);
      }

      return this._id;
    }

    return undefined;
  }

  getComponent(id: string) {
    if (this.behaviorPackBlockTypeDef === undefined) {
      return undefined;
    }

    if (!this._managed[id]) {
      const comp = this.behaviorPackBlockTypeDef.components[id];
      if (comp) {
        this._managed[id] = new ManagedComponent(id, comp);
      }
    }

    return this._managed[id];
  }

  notifyComponentUpdated(id: string) {
    const component = this.getComponent(id);

    if (component === undefined) {
      Log.unexpectedUndefined("BTNCU");
    } else {
      this._onComponentChanged.dispatch(this, component);
    }
  }

  getComponents(): IManagedComponent[] {
    const componentSet: IManagedComponent[] = [];

    if (this.behaviorPackBlockTypeDef !== undefined) {
      for (const componentName in this.behaviorPackBlockTypeDef.components) {
        const component = this.getComponent(componentName);

        if (component !== undefined) {
          componentSet.push(component);
        }
      }
    }

    return componentSet;
  }

  addComponent(id: string, component: IManagedComponent) {
    this._ensureBehaviorPackDataInitialized();

    const bpData = this.behaviorPackBlockTypeDef as IBlockTypeBehaviorPack;

    bpData.components[id] = component.getData();
    this._managed[id] = component;

    this._onComponentAdded.dispatch(this, component);
  }

  removeComponent(id: string) {
    if (this.behaviorPackBlockTypeDef === undefined) {
      return;
    }

    const newBehaviorPacks: { [name: string]: IComponent | string | number | undefined } = {};
    const newComponents: { [name: string]: IManagedComponent | undefined } = {};

    for (const name in this.behaviorPackBlockTypeDef.components) {
      if (name !== id) {
        const component = this.behaviorPackBlockTypeDef.components[name];

        newBehaviorPacks[name] = component;
      }
    }

    for (const name in this._managed) {
      if (name !== id) {
        newComponents[name] = this._managed[name];
      }
    }

    this.behaviorPackBlockTypeDef.components = newBehaviorPacks;
    this._managed = newComponents;
  }

  _ensureBehaviorPackDataInitialized() {
    if (this.behaviorPackBlockTypeDef === undefined) {
      this.behaviorPackBlockTypeDef = {
        description: {
          identifier: "unknown",
        },
        components: {},
        events: {},
      };
    }
  }

  static async ensureBlockTypeOnFile(file: IFile, loadHandler?: IEventHandler<BlockType, BlockType>) {
    let bt: BlockType | undefined = undefined;

    if (file.manager === undefined) {
      bt = new BlockType("custom:" + file.name);

      bt.behaviorPackFile = file;

      file.manager = bt;
    }

    if (file.manager !== undefined && file.manager instanceof BlockType) {
      bt = file.manager as BlockType;

      if (!bt.isLoaded && loadHandler) {
        bt.onLoaded.subscribe(loadHandler);
      }

      await bt.load();
    }

    return bt;
  }

  persist() {
    if (this._behaviorPackFile === undefined) {
      return;
    }

    const bpString = JSON.stringify(this._behaviorPackData, null, 2);

    this._behaviorPackFile.setContent(bpString);
  }

  async load() {
    if (this._behaviorPackFile === undefined || this._isLoaded) {
      return;
    }

    await this._behaviorPackFile.loadContent();

    if (!this._behaviorPackFile.content || this._behaviorPackFile.content instanceof Uint8Array) {
      return;
    }

    let data: any = {};

    let result = StorageUtilities.getJsonObject(this._behaviorPackFile);

    if (result) {
      data = result;
    }

    this._behaviorPackData = data;

    const entity = data["minecraft:entity"];

    if (entity.description) {
      this.id = entity.description.identifier;
    }

    this.behaviorPackBlockTypeDef = entity;

    this._onLoaded.dispatch(this, this);

    this._isLoaded = true;
  }
}
