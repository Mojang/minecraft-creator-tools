// Main library entry point - exports core types and functionality
// This file serves as the public API for the minecraft-creator-tools library

// Core exports
export { default as Utilities } from "./core/Utilities";
export { constants as Constants } from "./core/Constants";

// App/Project exports
export { default as CreatorToolsHost } from "./app/CreatorToolsHost";
export { default as CreatorTools } from "./app/CreatorToolsHost";
export { default as Project } from "./app/Project";
export { default as ProjectItem } from "./app/ProjectItem";
export * from "./app/IProjectData";
export * from "./app/IProjectItemData";
export * from "./app/IProjectItemSeed";

// Minecraft Utilities and Core
export { default as MinecraftUtilities } from "./minecraft/MinecraftUtilities";
export { default as MinecraftDefinitions } from "./minecraft/MinecraftDefinitions";

// Minecraft Definition Types
export { default as AnimationBehaviorDefinition } from "./minecraft/AnimationBehaviorDefinition";
export { default as AnimationControllerBehaviorDefinition } from "./minecraft/AnimationControllerBehaviorDefinition";
export { default as AnimationControllerResourceDefinition } from "./minecraft/AnimationControllerResourceDefinition";
export { default as AnimationResourceDefinition } from "./minecraft/AnimationResourceDefinition";
export { default as AttachableResourceDefinition } from "./minecraft/AttachableResourceDefinition";
export { default as AudioDefinition } from "./minecraft/AudioDefinition";
export { default as BehaviorManifestDefinition } from "./minecraft/BehaviorManifestDefinition";
export { default as BiomeBehaviorDefinition } from "./minecraft/BiomeBehaviorDefinition";
export { default as BiomeResourceDefinition } from "./minecraft/BiomeResourceDefinition";
export { default as BlockTypeDefinition } from "./minecraft/BlockTypeDefinition";
export { default as BlocksCatalogDefinition } from "./minecraft/BlocksCatalogDefinition";
export { default as DesignManifestDefinition } from "./minecraft/DesignManifestDefinition";
export { default as Dialogue } from "./minecraft/Dialogue";
export { default as EntityTypeDefinition } from "./minecraft/EntityTypeDefinition";
export { default as EntityTypeResourceDefinition } from "./minecraft/EntityTypeResourceDefinition";
export { default as FeatureDefinition } from "./minecraft/FeatureDefinition";
export { default as FeatureRuleDefinition } from "./minecraft/FeatureRuleDefinition";
export { default as FlipbookTextureCatalogDefinition } from "./minecraft/FlipbookTextureCatalogDefinition";
export { default as FogResourceDefinition } from "./minecraft/FogResourceDefinition";
export { default as ItemTextureCatalogDefinition } from "./minecraft/ItemTextureCatalogDefinition";
export { default as ItemTypeDefinition } from "./minecraft/ItemTypeDefinition";
export { default as ItemTypeResourceDefinition } from "./minecraft/ItemTypeResourceDefinition";
export { default as JigsawProcessorListDefinition } from "./minecraft/JigsawProcessorListDefinition";
export { default as JigsawStructureDefinition } from "./minecraft/JigsawStructureDefinition";
export { default as JigsawStructureSetDefinition } from "./minecraft/JigsawStructureSetDefinition";
export { default as JigsawTemplatePoolDefinition } from "./minecraft/JigsawTemplatePoolDefinition";
export { default as JsonUIResourceDefinition } from "./minecraft/JsonUIResourceDefinition";
export { default as Lang } from "./minecraft/Lang";
export { default as LootTableBehaviorDefinition } from "./minecraft/LootTableBehaviorDefinition";
export { default as ModelGeometryDefinition } from "./minecraft/ModelGeometryDefinition";
export { default as MusicDefinitionCatalogDefinition } from "./minecraft/MusicDefinitionCatalogDefinition";
export { default as ParticleEffectResourceDefinition } from "./minecraft/ParticleEffectResourceDefinition";
export { default as PersonaManifestDefinition } from "./minecraft/PersonaManifestDefinition";
export { default as RecipeBehaviorDefinition } from "./minecraft/RecipeBehaviorDefinition";
export { default as RenderControllerSetDefinition } from "./minecraft/RenderControllerSetDefinition";
export { default as ResourceManifestDefinition } from "./minecraft/ResourceManifestDefinition";
export { default as SkinCatalogDefinition } from "./minecraft/SkinCatalogDefinition";
export { default as SkinManifestDefinition } from "./minecraft/SkinManifestDefinition";
export { default as SoundCatalogDefinition } from "./minecraft/SoundCatalogDefinition";
export { default as SoundDefinitionCatalogDefinition } from "./minecraft/SoundDefinitionCatalogDefinition";
export { default as SpawnRulesBehaviorDefinition } from "./minecraft/SpawnRulesBehaviorDefinition";
export { default as Structure } from "./minecraft/Structure";
export { default as TerrainTextureCatalogDefinition } from "./minecraft/TerrainTextureCatalogDefinition";
export { default as TextureDefinition } from "./minecraft/TextureDefinition";
export { default as TextureSetDefinition } from "./minecraft/TextureSetDefinition";
export { default as TypeScriptDefinition } from "./minecraft/TypeScriptDefinition";
export { default as WorldTemplateManifestDefinition } from "./minecraft/WorldTemplateManifestDefinition";

// Minecraft Core Types
export { default as Block } from "./minecraft/Block";
export { default as BlockType } from "./minecraft/BlockType";
export { default as BlockLocation } from "./minecraft/BlockLocation";
export { default as BlockPermutation } from "./minecraft/BlockPermutation";
export { default as BlockVolume } from "./minecraft/BlockVolume";
export { default as Command } from "./minecraft/Command";
export { default as Database } from "./minecraft/Database";
export { default as Entity } from "./minecraft/Entity";
export { default as ItemStack } from "./minecraft/ItemStack";
export { default as LevelDb } from "./minecraft/LevelDb";
export { default as LocManager } from "./minecraft/LocManager";
export type { default as LocToken } from "./minecraft/LocToken";
export { default as Location } from "./minecraft/Location";
export { default as MCWorld } from "./minecraft/MCWorld";
export { default as Material } from "./minecraft/Material";
export { default as Molang } from "./minecraft/Molang";
export { default as MolangNode } from "./minecraft/MolangNode";
export { default as NbtBinary } from "./minecraft/NbtBinary";
export { default as Pack } from "./minecraft/Pack";
export { default as Player } from "./minecraft/Player";
export { default as ServerPropertiesManager } from "./minecraft/ServerPropertiesManager";
export { default as VanillaProjectManager } from "./minecraft/VanillaProjectManager";
export { default as WorldChunk } from "./minecraft/WorldChunk";
export { default as WorldLevelDat } from "./minecraft/WorldLevelDat";

// Minecraft Interfaces
export * from "./minecraft/IAddonManifest";
export * from "./minecraft/IAnimationBehavior";
export * from "./minecraft/IAnimationControllerBehavior";
export * from "./minecraft/IAnimationControllerResource";
export * from "./minecraft/IAnimationResource";
export * from "./minecraft/IBlockData";
export * from "./minecraft/IBlockTypeBehaviorPack";
export * from "./minecraft/IBlockTypeData";
export * from "./minecraft/IBlockTypeWrapper";
export * from "./minecraft/IBlocksCatalog";
export * from "./minecraft/IComponent";
export * from "./minecraft/IDefinition";
export * from "./minecraft/IDialogue";
export * from "./minecraft/IEntityComponent";
export * from "./minecraft/IEntityComponents";
export * from "./minecraft/IEntityTypeBehaviorPack";
export * from "./minecraft/IEntityTypeDescription";
export * from "./minecraft/IEntityTypeResource";
export * from "./minecraft/IEntityTypeWrapper";
export * from "./minecraft/IFlipbookTexture";
export * from "./minecraft/IFogResource";
export * from "./minecraft/IItemTexture";
export * from "./minecraft/IItemTypeBehaviorPack";
export * from "./minecraft/IItemTypeResourcePack";
export * from "./minecraft/IItemTypeWrapper";
export * from "./minecraft/IJsonUIScreen";
export * from "./minecraft/ILootTableBehavior";
export * from "./minecraft/IMaterial";
export * from "./minecraft/IModelGeometry";
export * from "./minecraft/IMusicDefinitionCatalog";
export * from "./minecraft/IParticleEffect";
export * from "./minecraft/IRecipeBehavior";
export * from "./minecraft/IRenderControllerSet";
export * from "./minecraft/ISkinCatalog";
export * from "./minecraft/ISoundCatalog";
export * from "./minecraft/ISoundDefinitionCatalog";
export * from "./minecraft/ISpawnRulesBehavior";
export * from "./minecraft/ITerrainTextureCatalog";
export * from "./minecraft/IVector3";
export * from "./minecraft/IWorld";
export * from "./minecraft/IWorldManifest";
export * from "./minecraft/IWorldSettings";

// Minecraft Block Actors
export { default as BlockActor } from "./minecraft/blockActors/BlockActor";
export { default as BlockActorFactory } from "./minecraft/blockActors/BlockActorFactory";
export { default as BedBlockActor } from "./minecraft/blockActors/BedBlockActor";
export { default as BeehiveBlockActor } from "./minecraft/blockActors/BeehiveBlockActor";
export { default as CampfireBlockActor } from "./minecraft/blockActors/CampfireBlockActor";
export { default as CauldronBlockActor } from "./minecraft/blockActors/CauldronBlockActor";
export { default as ChestBlockActor } from "./minecraft/blockActors/ChestBlockActor";
export { default as CommandBlockActor } from "./minecraft/blockActors/CommandBlockActor";
export { default as ComparatorBlockActor } from "./minecraft/blockActors/ComparatorBlockActor";
export { default as FrameBlockActor } from "./minecraft/blockActors/FrameBlockActor";
export { default as GenericBlockActor } from "./minecraft/blockActors/GenericBlockActor";
export { default as HopperBlockActor } from "./minecraft/blockActors/HopperBlockActor";
export { default as MobSpawnerBlockActor } from "./minecraft/blockActors/MobSpawnerBlockActor";
export { default as NoteBlockActor } from "./minecraft/blockActors/NoteBlockActor";
export { default as SignBlockActor } from "./minecraft/blockActors/SignBlockActor";
export { default as StructureBlockActor } from "./minecraft/blockActors/StructureBlockActor";

// Minecraft Components
export * from "./minecraft/components/IInventoryComponent";
export * from "./minecraft/components/IRideableComponent";
export * from "./minecraft/components/ISeat";

// Minecraft Manifests
export type { default as Manifest } from "./minecraft/manifests/Manifest";
export type { JsonManifest } from "./minecraft/manifests/JsonManifest";

// Storage
export * from "./storage/StorageUtilities";

// Updates
export * from "./updates/IProjectUpdater";
export * from "./updates/ProjectUpdateRunner";

// Data forms
export * from "./dataform/IFormDefinition";
export * from "./dataform/DataFormUtilities";
