import BlockActor from "./BlockActor";

export default class MobSpawnerBlockActor extends BlockActor {
  delay?: number;
  displayEntityHeight?: number;
  displayEntityScale?: number;
  displayEntityWidth?: number;
  entityIdentifier?: string;
  maxNearbyEntities?: number;
  maxSpawnDelay?: number;
  minSpawnDelay?: number;
  requiredPlayerRange?: number;
  spawnCount?: number;
  spawnRange?: number;

  public override load() {
    if (!this.rootTag) {
      return;
    }

    let tag = this.rootTag.find("Delay");
    if (tag) {
      this.delay = tag.valueAsInt;
    }

    tag = this.rootTag.find("DisplayEntityType");
    if (tag) {
      this.displayEntityHeight = tag.valueAsFloat;
    }

    tag = this.rootTag.find("DisplayEntityScale");
    if (tag) {
      this.displayEntityScale = tag.valueAsFloat;
    }

    tag = this.rootTag.find("DisplayEntityWidth");
    if (tag) {
      this.displayEntityWidth = tag.valueAsFloat;
    }

    tag = this.rootTag.find("EntityIdentifier");
    if (tag) {
      this.entityIdentifier = tag.valueAsString;
    }

    tag = this.rootTag.find("MaxNearbyEntities");
    if (tag) {
      this.maxNearbyEntities = tag.valueAsInt;
    }

    tag = this.rootTag.find("MaxSpawnDelay");
    if (tag) {
      this.maxSpawnDelay = tag.valueAsInt;
    }

    tag = this.rootTag.find("MinSpawnDelay");
    if (tag) {
      this.minSpawnDelay = tag.valueAsInt;
    }

    tag = this.rootTag.find("RequiredPlayerRange");
    if (tag) {
      this.requiredPlayerRange = tag.valueAsInt;
    }

    tag = this.rootTag.find("SpawnCount");
    if (tag) {
      this.spawnCount = tag.valueAsInt;
    }

    tag = this.rootTag.find("SpawnRange");
    if (tag) {
      this.spawnRange = tag.valueAsInt;
    }
  }
}
