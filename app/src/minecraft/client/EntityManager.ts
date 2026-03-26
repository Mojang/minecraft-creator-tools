/**
 * ARCHITECTURE: EntityManager
 *
 * Tracks all entities (mobs, players, items) in the currently loaded world view.
 * Receives entity updates from the active world data source and maintains entity state.
 *
 * ENTITY LIFECYCLE:
 *   add_actor/add_player → create entity state
 *   move_actor_absolute/move_actor_delta → update position
 *   set_actor_data → update metadata
 *   remove_actor → delete entity state
 *
 * INTERPOLATION:
 *   Server sends at ~20 TPS, client renders at 60 FPS.
 *   We store previous + current positions and interpolate between them.
 */

// ---------------------------------------------------------------------------
// Bedrock protocol packet interfaces (partial).
// These describe the subset of fields we actually read from decoded packets.
// The proxy may use different casing or field names depending on protocol
// version, so many fields have alternates (e.g., runtime_id | runtime_entity_id).
// ---------------------------------------------------------------------------

/** Shared 3D coordinate shape used in most Bedrock packets. */
export interface IBedrockVec3 {
  x?: number;
  y?: number;
  z?: number;
  X?: number;
  Y?: number;
  Z?: number;
  pitch?: number;
  yaw?: number;
  head_yaw?: number;
}

export interface IAddActorPacket {
  runtime_id?: number;
  runtime_entity_id?: number;
  unique_id?: number;
  unique_entity_id?: number;
  entity_type?: string;
  identifier?: string;
  position?: IBedrockVec3;
  rotation?: IBedrockVec3;
  velocity?: IBedrockVec3;
  metadata?: Record<string, unknown>;
}

export interface IAddPlayerPacket {
  runtime_id?: number;
  runtime_entity_id?: number;
  unique_id?: number;
  unique_entity_id?: number;
  username?: string;
  user_name?: string;
  position?: IBedrockVec3;
  rotation?: IBedrockVec3;
  metadata?: Record<string, unknown>;
}

export interface IRemoveActorPacket {
  runtime_entity_id?: number;
  entity_id_self?: number;
}

export interface IMoveActorAbsolutePacket {
  runtime_entity_id?: number;
  runtime_id?: number;
  position?: IBedrockVec3;
  rotation?: IBedrockVec3;
  rotation_x?: number;
  rotation_y?: number;
  rotation_y_head?: number;
}

export interface IMovePlayerPacket {
  runtime_id?: number;
  runtime_entity_id?: number;
  position?: IBedrockVec3;
  rotation?: IBedrockVec3;
  pitch?: number;
  yaw?: number;
  head_yaw?: number;
}

export interface ISetActorMotionPacket {
  runtime_entity_id?: number;
  runtime_id?: number;
  velocity?: IBedrockVec3;
}

export interface ISetActorDataPacket {
  runtime_entity_id?: number;
  runtime_id?: number;
  metadata?: Record<string, unknown>;
}

export interface IMoveEntityDeltaPacket {
  runtime_entity_id?: number;
  runtime_id?: number;
  x?: number;
  y?: number;
  z?: number;
  rot_x?: number;
  rot_y?: number;
  rot_y_head?: number;
}

export interface IEntityState {
  runtimeId: number;
  uniqueId?: number;
  typeId: string;
  displayName?: string;
  position: { x: number; y: number; z: number };
  prevPosition: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  prevRotation: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  isPlayer: boolean;
  username?: string;
  health?: number;
  metadata?: Record<string, any>;
  lastUpdateTime: number;
  interpolationAlpha: number;
}

export default class EntityManager {
  private _entities: Map<number, IEntityState> = new Map();
  private _playerEntities: Map<string, number> = new Map(); // username → runtimeId
  private _localPlayerRuntimeId: number | undefined;

  get entities(): Map<number, IEntityState> {
    return this._entities;
  }
  get entityCount(): number {
    return this._entities.size;
  }

  getEntityByRuntimeId(runtimeId: number): IEntityState | undefined {
    return this._entities.get(runtimeId);
  }

  get localPlayerRuntimeId(): number | undefined {
    return this._localPlayerRuntimeId;
  }

  setLocalPlayerRuntimeId(id: number): void {
    this._localPlayerRuntimeId = id;
  }

  /**
   * Find the closest entity within the player's look direction (for attacking).
   * Uses a simple sphere check + dot product test rather than full AABB raycast.
   * Returns the entity's runtime ID or undefined if none found.
   */
  findEntityInLookDirection(
    eyePos: { x: number; y: number; z: number },
    lookDir: { x: number; y: number; z: number },
    maxDist: number = 6
  ): number | undefined {
    let bestId: number | undefined;
    let bestDist = maxDist;

    for (const [rid, entity] of this._entities) {
      if (rid === this._localPlayerRuntimeId) continue;

      // Vector from eye to entity center (entity position + half height)
      const dx = entity.position.x - eyePos.x;
      const dy = entity.position.y + 0.9 - eyePos.y; // approximate center
      const dz = entity.position.z - eyePos.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist > maxDist || dist < 0.5) continue;

      // Check if entity is roughly in look direction (dot product > cos(15°))
      const dot = (dx * lookDir.x + dy * lookDir.y + dz * lookDir.z) / dist;
      // Wider cone for closer entities (easier to hit up close)
      const minDot = dist < 2 ? 0.7 : 0.9;
      if (dot < minDot) continue;

      if (dist < bestDist) {
        bestDist = dist;
        bestId = rid;
      }
    }

    return bestId;
  }

  /**
   * Handle add_actor packet — a non-player entity spawns.
   */
  handleAddActor(packet: IAddActorPacket): void {
    const runtimeId = packet.runtime_id ?? packet.runtime_entity_id;
    if (runtimeId === undefined) return;

    const entity: IEntityState = {
      runtimeId,
      uniqueId: packet.unique_id ?? packet.unique_entity_id,
      typeId: packet.entity_type ?? packet.identifier ?? "unknown",
      position: this._extractPosition(packet.position),
      prevPosition: this._extractPosition(packet.position),
      rotation: this._extractRotation(packet.rotation),
      prevRotation: this._extractRotation(packet.rotation),
      velocity: this._extractPosition(packet.velocity ?? { x: 0, y: 0, z: 0 }),
      isPlayer: false,
      metadata: packet.metadata,
      lastUpdateTime: performance.now(),
      interpolationAlpha: 1,
    };

    this._entities.set(runtimeId, entity);
  }

  /**
   * Handle add_player packet — another player spawns.
   */
  handleAddPlayer(packet: IAddPlayerPacket): void {
    const runtimeId = packet.runtime_id ?? packet.runtime_entity_id;
    if (runtimeId === undefined) return;

    const username = packet.username ?? packet.user_name ?? "Player";

    const entity: IEntityState = {
      runtimeId,
      uniqueId: packet.unique_id ?? packet.unique_entity_id,
      typeId: "minecraft:player",
      displayName: username,
      position: this._extractPosition(packet.position),
      prevPosition: this._extractPosition(packet.position),
      rotation: this._extractRotation(packet.rotation),
      prevRotation: this._extractRotation(packet.rotation),
      velocity: { x: 0, y: 0, z: 0 },
      isPlayer: true,
      username: username,
      metadata: packet.metadata,
      lastUpdateTime: performance.now(),
      interpolationAlpha: 1,
    };

    this._entities.set(runtimeId, entity);
    this._playerEntities.set(username, runtimeId);
  }

  /**
   * Handle remove_entity packet.
   * Note: remove_entity uses entity_id_self which is the UNIQUE entity ID (zigzag64),
   * not the runtime ID. We need to search by uniqueId since our Map is keyed by runtimeId.
   */
  handleRemoveActor(packet: IRemoveActorPacket): void {
    // Try runtime_entity_id first (some packets use this)
    let runtimeId = packet.runtime_entity_id;

    // remove_entity packet uses entity_id_self which is the unique ID, not runtime ID
    if (runtimeId === undefined && packet.entity_id_self !== undefined) {
      // Search for entity by uniqueId
      for (const [rid, entity] of this._entities) {
        if (entity.uniqueId === packet.entity_id_self) {
          runtimeId = rid;
          break;
        }
      }
    }

    if (runtimeId === undefined) return;

    const entity = this._entities.get(runtimeId);
    if (entity?.username) {
      this._playerEntities.delete(entity.username);
    }
    this._entities.delete(runtimeId);
  }

  /**
   * Handle move_actor_absolute packet.
   */
  handleMoveActorAbsolute(packet: IMoveActorAbsolutePacket): void {
    const runtimeId = packet.runtime_entity_id ?? packet.runtime_id;
    if (runtimeId === undefined) return;
    const entity = this._entities.get(runtimeId);
    if (!entity) return;

    // Store previous for interpolation
    entity.prevPosition = { ...entity.position };
    entity.prevRotation = { ...entity.rotation };

    const pos = packet.position;
    if (pos) {
      entity.position = this._extractPosition(pos);
    }

    if (packet.rotation) {
      entity.rotation = this._extractRotation(packet.rotation);
    } else {
      // Some packets encode rotation as x/y/yaw values directly
      if (packet.rotation_x !== undefined) entity.rotation.x = packet.rotation_x;
      if (packet.rotation_y !== undefined) entity.rotation.y = packet.rotation_y;
      if (packet.rotation_y_head !== undefined) entity.rotation.z = packet.rotation_y_head;
    }

    entity.lastUpdateTime = performance.now();
    entity.interpolationAlpha = 0;
  }

  /**
   * Handle move_player packet.
   */
  handleMovePlayer(packet: IMovePlayerPacket): void {
    const runtimeId = packet.runtime_id ?? packet.runtime_entity_id;
    if (runtimeId === undefined) return;
    if (runtimeId === this._localPlayerRuntimeId) return; // Don't apply to local player

    const entity = this._entities.get(runtimeId);
    if (!entity) return;

    entity.prevPosition = { ...entity.position };
    entity.prevRotation = { ...entity.rotation };

    const pos = packet.position;
    if (pos) {
      entity.position = this._extractPosition(pos);
    }

    if (packet.rotation) {
      entity.rotation = this._extractRotation(packet.rotation);
    } else {
      if (packet.pitch !== undefined) entity.rotation.x = packet.pitch;
      if (packet.yaw !== undefined) entity.rotation.y = packet.yaw;
      if (packet.head_yaw !== undefined) entity.rotation.z = packet.head_yaw;
    }

    entity.lastUpdateTime = performance.now();
    entity.interpolationAlpha = 0;
  }

  /**
   * Handle set_actor_motion packet.
   */
  handleSetActorMotion(packet: ISetActorMotionPacket): void {
    const runtimeId = packet.runtime_entity_id ?? packet.runtime_id;
    if (runtimeId === undefined) return;
    const entity = this._entities.get(runtimeId);
    if (!entity) return;

    const vel = packet.velocity;
    if (vel) {
      entity.velocity = this._extractPosition(vel);
    }
  }

  /**
   * Handle set_actor_data packet (entity metadata flags).
   */
  handleSetActorData(packet: ISetActorDataPacket): void {
    const runtimeId = packet.runtime_entity_id ?? packet.runtime_id;
    if (runtimeId === undefined) return;
    const entity = this._entities.get(runtimeId);
    if (!entity) return;

    if (packet.metadata) {
      entity.metadata = { ...entity.metadata, ...packet.metadata };
    }
  }

  /**
   * Handle move_entity_delta packet (incremental entity movement).
   * This is the most frequent entity movement packet — applies deltas to current position/rotation.
   */
  handleMoveEntityDelta(packet: IMoveEntityDeltaPacket): void {
    const runtimeId = packet.runtime_entity_id ?? packet.runtime_id;
    if (runtimeId === undefined) return;
    const entity = this._entities.get(runtimeId);
    if (!entity) return;
    if (runtimeId === this._localPlayerRuntimeId) return;

    entity.prevPosition = { ...entity.position };
    entity.prevRotation = { ...entity.rotation };

    // move_entity_delta can contain absolute or delta values depending on flags
    if (packet.x !== undefined) entity.position.x = packet.x;
    if (packet.y !== undefined) entity.position.y = packet.y;
    if (packet.z !== undefined) entity.position.z = packet.z;
    if (packet.rot_x !== undefined) entity.rotation.x = packet.rot_x;
    if (packet.rot_y !== undefined) entity.rotation.y = packet.rot_y;
    if (packet.rot_y_head !== undefined) entity.rotation.z = packet.rot_y_head;

    entity.lastUpdateTime = performance.now();
    entity.interpolationAlpha = 0;
  }

  /**
   * Update interpolation for all entities. Call every render frame.
   * @param deltaMs Milliseconds since last frame
   */
  updateInterpolation(deltaMs: number): void {
    const interpSpeed = deltaMs / 50; // 50ms = 1 server tick
    for (const entity of this._entities.values()) {
      if (entity.interpolationAlpha < 1) {
        entity.interpolationAlpha = Math.min(1, entity.interpolationAlpha + interpSpeed);
      }
    }
  }

  /**
   * Get interpolated position for an entity.
   */
  getInterpolatedPosition(runtimeId: number): { x: number; y: number; z: number } | undefined {
    const entity = this._entities.get(runtimeId);
    if (!entity) return undefined;

    const t = entity.interpolationAlpha;
    return {
      x: entity.prevPosition.x + (entity.position.x - entity.prevPosition.x) * t,
      y: entity.prevPosition.y + (entity.position.y - entity.prevPosition.y) * t,
      z: entity.prevPosition.z + (entity.position.z - entity.prevPosition.z) * t,
    };
  }

  /**
   * Get interpolated rotation for an entity.
   */
  getInterpolatedRotation(runtimeId: number): { x: number; y: number; z: number } | undefined {
    const entity = this._entities.get(runtimeId);
    if (!entity) return undefined;

    const t = entity.interpolationAlpha;
    return {
      x: this._lerpAngle(entity.prevRotation.x, entity.rotation.x, t),
      y: this._lerpAngle(entity.prevRotation.y, entity.rotation.y, t),
      z: this._lerpAngle(entity.prevRotation.z, entity.rotation.z, t),
    };
  }

  /**
   * Get all entities as an array.
   */
  getAllEntities(): IEntityState[] {
    return Array.from(this._entities.values());
  }

  /**
   * Clear all entities (dimension change).
   */
  clear(): void {
    this._entities.clear();
    this._playerEntities.clear();
  }

  private _extractPosition(obj: IBedrockVec3 | undefined): { x: number; y: number; z: number } {
    return {
      x: obj?.x ?? obj?.X ?? 0,
      y: obj?.y ?? obj?.Y ?? 0,
      z: obj?.z ?? obj?.Z ?? 0,
    };
  }

  private _extractRotation(obj: IBedrockVec3 | undefined): { x: number; y: number; z: number } {
    return {
      x: obj?.x ?? obj?.pitch ?? 0,
      y: obj?.y ?? obj?.yaw ?? 0,
      z: obj?.z ?? obj?.head_yaw ?? 0,
    };
  }

  private _lerpAngle(a: number, b: number, t: number): number {
    let diff = b - a;
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;
    return a + diff * t;
  }
}
