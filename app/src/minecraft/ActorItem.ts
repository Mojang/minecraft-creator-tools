// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import Utilities from "../core/Utilities";
import { InventoryItem, Item } from "./Items";
import NbtBinary from "./NbtBinary";
import NbtBinaryTag, { NbtTagType } from "./NbtBinaryTag";

export interface ActorAttribute {
  base: number;
  current: number;
  defaultMax: number;
  defaultMin: number;
  max: number;
  min: number;
  name: string;
}

export default class ActorItem {
  #identifier: string;
  #nbtRoot?: NbtBinaryTag;
  #dynamicProperties: { [behaviorPackUid: string]: { [propertyName: string]: string | number | boolean } } = {};

  public armorItems: Item[] = [];
  public chestItems: InventoryItem[] = [];
  public attributes: ActorAttribute[] = [];
  public air?: number;
  public attackTime?: number;
  public bodyRot?: number;
  public chested?: boolean;
  public color?: number;
  public color2?: number;
  public dead?: boolean;
  public deathTime?: number;
  public fallDistance?: number;
  public hasExecuted?: boolean;
  public hurtTime?: number;
  public invulnerable?: boolean;
  public isAngry?: boolean;
  public isAutonomous?: boolean;
  public isBaby?: boolean;
  public isEating?: boolean;
  public isGliding?: boolean;
  public isGlobal?: boolean;
  public isIllagerCaptain?: boolean;
  public isOrphaned?: boolean;
  public isOutOfControl?: boolean;
  public isPregnant?: boolean;
  public isRoaring?: boolean;
  public isScared?: boolean;
  public isStunned?: boolean;
  public isSwimming?: boolean;
  public isTamed?: boolean;
  public isTrusting?: boolean;
  public lastDimensionId?: number;
  public leasherId?: number;
  public lootDropped?: boolean;
  public mainhand?: string;
  public markVariant?: number;
  public naturalSpawn?: boolean;
  public offhand?: string;
  public onGround?: boolean;
  public ownerNew?: bigint;
  public persistent?: boolean;
  public portalCooldown?: boolean;
  public pos?: number[];
  public rotation?: number[];
  public saddled?: boolean;
  public sheared?: boolean;
  public showBottom?: boolean;
  public sitting?: boolean;
  public skinId?: number;
  public strength?: number;
  public strengthMax?: number;
  public surface?: boolean;
  public targetId?: bigint;
  public tradeExperience?: number;
  public tradeTier?: number;
  public uniqueId?: bigint;
  public variant?: number;
  public boundX?: number;
  public boundY?: number;
  public boundZ?: number;
  public canPickupItems?: boolean;
  public definitions?: string[];
  public hasBoundOrigin?: boolean;
  public hasSetCanPickupItems?: boolean;
  public identifier?: string;
  public internalComponents?: { [keyName: string]: string };

  constructor(identifier: string, keyData: Uint8Array) {
    this.#identifier = identifier;

    const actorStorage = new NbtBinary();

    actorStorage.context = identifier;

    actorStorage.fromBinary(keyData, true, false, 0, true);

    if (actorStorage.singleRoot) {
      this.#nbtRoot = actorStorage.singleRoot;
      this.loadFromNbt();
    }
  }

  loadFromNbt() {
    if (!this.#nbtRoot) {
      return;
    }

    const root = this.#nbtRoot;

    let tag = root.find("Armor");
    if (tag !== null) {
      const children = tag.getTagChildren();
      this.armorItems = [];

      for (let i = 0; i < children.length; i++) {
        const childTag = children[i];

        const countTag = childTag.find("Count");
        const damageTag = childTag.find("Damage");
        const nameTag = childTag.find("Name");
        const wasPickedUpTag = childTag.find("WasPickedUp");

        if (countTag && damageTag && nameTag && wasPickedUpTag) {
          this.armorItems.push({
            count: countTag.valueAsInt,
            damage: damageTag.valueAsInt,
            name: nameTag.valueAsString,
            wasPickedUp: wasPickedUpTag.valueAsBoolean,
          });
        }
      }
    }

    tag = root.find("ChestItems");
    if (tag !== null) {
      const children = tag.getTagChildren();
      this.armorItems = [];

      for (let i = 0; i < children.length; i++) {
        const childTag = children[i];

        const countTag = childTag.find("Count");
        const damageTag = childTag.find("Damage");
        const nameTag = childTag.find("Name");
        const slotTag = childTag.find("Slot");
        const wasPickedUpTag = childTag.find("WasPickedUp");

        if (countTag && damageTag && nameTag && slotTag && wasPickedUpTag) {
          this.chestItems.push({
            count: countTag.valueAsInt,
            damage: damageTag.valueAsInt,
            name: nameTag.valueAsString,
            slot: slotTag.valueAsInt,
            wasPickedUp: wasPickedUpTag.valueAsBoolean,
          });
        }
      }
    }

    tag = root.find("Attributes");
    if (tag !== null) {
      const children = tag.getTagChildren();
      this.attributes = [];

      for (let i = 0; i < children.length; i++) {
        const childTag = children[i];

        const baseTag = childTag.find("Base");
        const currentTag = childTag.find("Current");
        const defaultMaxTag = childTag.find("DefaultMax");
        const defaultMinTag = childTag.find("DefaultMin");
        const maxTag = childTag.find("Max");
        const minTag = childTag.find("Min");
        const nameTag = childTag.find("Name");

        if (baseTag && currentTag && nameTag && defaultMaxTag && defaultMinTag && maxTag && minTag) {
          this.attributes.push({
            base: baseTag.valueAsInt,
            current: currentTag.valueAsInt,
            defaultMax: defaultMaxTag.valueAsInt,
            defaultMin: defaultMinTag.valueAsInt,
            max: maxTag.valueAsInt,
            min: minTag.valueAsInt,
            name: nameTag.valueAsString,
          });
        }
      }
    }

    tag = root.find("DynamicProperties");
    if (tag !== null) {
      const children = tag.getTagChildren();
      this.#dynamicProperties = {};

      for (const child of children) {
        if (child.name && Utilities.isValidUuid(child.name)) {
          this.#dynamicProperties[child.name] = {};

          const bpChildren = child.getTagChildren();

          for (const propChild of bpChildren) {
            if (propChild.name && propChild.type === NbtTagType.string) {
              this.#dynamicProperties[child.name][propChild.name] = propChild.valueAsString;
            }
          }
        }
      }
    }

    tag = root.find("AttackTime");
    if (tag !== null) {
      this.attackTime = tag.valueAsInt;
    }

    tag = root.find("Air");
    if (tag !== null) {
      this.air = tag.valueAsInt;
    }

    tag = root.find("BodyRot");
    if (tag !== null) {
      this.bodyRot = tag.valueAsFloat;
    }

    tag = root.find("Chested");
    if (tag !== null) {
      this.chested = tag.valueAsBoolean;
    }

    tag = root.find("Color");
    if (tag !== null) {
      this.color = tag.valueAsInt;
    }

    tag = root.find("Color2");
    if (tag !== null) {
      this.color2 = tag.valueAsInt;
    }

    tag = root.find("Dead");
    if (tag !== null) {
      this.dead = tag.valueAsBoolean;
    }

    tag = root.find("DeathTime");
    if (tag !== null) {
      this.deathTime = tag.valueAsInt;
    }

    tag = root.find("FallDistance");
    if (tag !== null) {
      this.fallDistance = tag.valueAsFloat;
    }

    tag = root.find("HasExecuted");
    if (tag !== null) {
      this.hasExecuted = tag.valueAsBoolean;
    }

    tag = root.find("HurtTime");
    if (tag !== null) {
      this.hurtTime = tag.valueAsInt;
    }

    tag = root.find("Invulnerable");
    if (tag !== null) {
      this.invulnerable = tag.valueAsBoolean;
    }

    tag = root.find("IsAngry");
    if (tag !== null) {
      this.isAngry = tag.valueAsBoolean;
    }

    tag = root.find("IsAutonomous");
    if (tag !== null) {
      this.isAutonomous = tag.valueAsBoolean;
    }

    tag = root.find("IsBaby");
    if (tag !== null) {
      this.isBaby = tag.valueAsBoolean;
    }

    tag = root.find("IsEating");
    if (tag !== null) {
      this.isEating = tag.valueAsBoolean;
    }

    tag = root.find("IsGliding");
    if (tag !== null) {
      this.isGliding = tag.valueAsBoolean;
    }

    tag = root.find("IsGlobal");
    if (tag !== null) {
      this.isGliding = tag.valueAsBoolean;
    }

    tag = root.find("IsIllagerCaptain");
    if (tag !== null) {
      this.isIllagerCaptain = tag.valueAsBoolean;
    }

    tag = root.find("IsOrphaned");
    if (tag !== null) {
      this.isOrphaned = tag.valueAsBoolean;
    }

    tag = root.find("IsOutOfControl");
    if (tag !== null) {
      this.isOutOfControl = tag.valueAsBoolean;
    }

    tag = root.find("IsPregnant");
    if (tag !== null) {
      this.isPregnant = tag.valueAsBoolean;
    }

    tag = root.find("IsRoaring");
    if (tag !== null) {
      this.isRoaring = tag.valueAsBoolean;
    }

    tag = root.find("IsScared");
    if (tag !== null) {
      this.isScared = tag.valueAsBoolean;
    }

    tag = root.find("IsStunned");
    if (tag !== null) {
      this.isStunned = tag.valueAsBoolean;
    }

    tag = root.find("IsSwimming");
    if (tag !== null) {
      this.isSwimming = tag.valueAsBoolean;
    }

    tag = root.find("IsTamed");
    if (tag !== null) {
      this.isTamed = tag.valueAsBoolean;
    }

    tag = root.find("IsTrusting");
    if (tag !== null) {
      this.isTrusting = tag.valueAsBoolean;
    }

    tag = root.find("LastDimensionId");
    if (tag !== null) {
      this.lastDimensionId = tag.valueAsInt;
    }

    tag = root.find("LeasherID");
    if (tag !== null) {
      this.leasherId = tag.valueAsInt;
    }

    tag = root.find("LootDropped");
    if (tag !== null) {
      this.lootDropped = tag.valueAsBoolean;
    }

    tag = root.find("Mainhand");
    if (tag !== null) {
      this.mainhand = tag.valueAsString;
    }

    tag = root.find("MarkVariant");
    if (tag !== null) {
      this.markVariant = tag.valueAsInt;
    }

    tag = root.find("NaturalSpawn");
    if (tag !== null) {
      this.naturalSpawn = tag.valueAsBoolean;
    }

    tag = root.find("Offhand");
    if (tag !== null) {
      this.offhand = tag.valueAsString;
    }

    tag = root.find("OnGround");
    if (tag !== null) {
      this.onGround = tag.valueAsBoolean;
    }

    tag = root.find("OwnerNew");
    if (tag !== null) {
      this.ownerNew = tag.valueAsBigInt;
    }

    tag = root.find("Persistent");
    if (tag !== null) {
      this.persistent = tag.valueAsBoolean;
    }

    tag = root.find("PortalCooldown");
    if (tag !== null) {
      this.portalCooldown = tag.valueAsBoolean;
    }

    tag = root.find("Pos");
    if (tag !== null) {
      this.pos = tag.valueAsNumericArray;
    }

    tag = root.find("Rotation");
    if (tag !== null) {
      this.rotation = tag.valueAsNumericArray;
    }

    tag = root.find("Saddled");
    if (tag !== null) {
      this.saddled = tag.valueAsBoolean;
    }

    tag = root.find("Sheared");
    if (tag !== null) {
      this.sheared = tag.valueAsBoolean;
    }

    tag = root.find("ShowBottom");
    if (tag !== null) {
      this.showBottom = tag.valueAsBoolean;
    }

    tag = root.find("Sitting");
    if (tag !== null) {
      this.sitting = tag.valueAsBoolean;
    }

    tag = root.find("SkinID");
    if (tag !== null) {
      this.skinId = tag.valueAsInt;
    }

    tag = root.find("Strength");
    if (tag !== null) {
      this.strength = tag.valueAsInt;
    }

    tag = root.find("StrengthMax");
    if (tag !== null) {
      this.strengthMax = tag.valueAsFloat;
    }

    tag = root.find("Surface");
    if (tag !== null) {
      this.surface = tag.valueAsBoolean;
    }

    tag = root.find("TargetID");
    if (tag !== null) {
      this.targetId = tag.valueAsBigInt;
    }

    tag = root.find("TradeExperience");
    if (tag !== null) {
      this.tradeExperience = tag.valueAsInt;
    }

    tag = root.find("TradeTier");
    if (tag !== null) {
      this.tradeTier = tag.valueAsInt;
    }

    tag = root.find("UniqueID");
    if (tag !== null) {
      this.uniqueId = tag.valueAsBigInt;
    }

    tag = root.find("Variant");
    if (tag !== null) {
      this.variant = tag.valueAsInt;
    }

    tag = root.find("boundX");
    if (tag !== null) {
      this.boundX = tag.valueAsInt;
    }

    tag = root.find("boundY");
    if (tag !== null) {
      this.boundY = tag.valueAsInt;
    }

    tag = root.find("boundZ");
    if (tag !== null) {
      this.boundZ = tag.valueAsInt;
    }

    tag = root.find("canPickupItems");
    if (tag !== null) {
      this.canPickupItems = tag.valueAsBoolean;
    }

    tag = root.find("definitions");
    if (tag !== null) {
      this.definitions = tag.valueAsStringArray;
    }

    tag = root.find("hasBoundOrigin");
    if (tag !== null) {
      this.hasBoundOrigin = tag.valueAsBoolean;
    }

    tag = root.find("hasSetCanPickupItems");
    if (tag !== null) {
      this.hasSetCanPickupItems = tag.valueAsBoolean;
    }

    tag = root.find("identifier");
    if (tag !== null) {
      this.identifier = tag.valueAsString;
    }
  }
}
