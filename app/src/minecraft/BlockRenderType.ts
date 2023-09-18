
export enum BlockRenderType
{
    Custom = 0, // custom rendering
    BlockOneTexture = 1, // cobblestone is cobblestone
    BlockLogSideTop = 2, 
    FrontBaseSideTop = 3,
    DoorMaterialDoorUpperLower = 4, // e.g., door_acacia_lower, door_acacia_upper
    SignMaterial = 5,
    AnvilBaseTopDamaged = 6, // eg anvil has anvil_base, anvil_top_damaged_0, anvil_top_damaged_1, anvil_top_damaged_2
    BlockSideTop = 7,  // eg ancient_debris has ancient_debris_side and ancient_debris_top 
    StairsMaterial = 8, // stairs with a material
    PressurePlateMaterial = 9, // pressure plate with a material
    FenceGateMaterial = 10, // acacia_fence_gate => acacia_fence_gate
    ButtonMaterial = 11, // acacia_button
    WallSignMaterial = 12, // acacia wall sign
    Stem = 13, // eg bamboo => bamboo_stem
    BottomSideTopOpen = 14, // barrel => barrel_bottom, barrel_side, barrel_top, barrel_top_open
    BedFeetHeadEndSideTop = 15, // bed => bed_feet_end, bed_feet_side, bed_feet_top
    Honeyable = 16, // bee_nest => bee_nest_front, bee_nest_front_honey, bee_nest_side, bee_nest_end, bee_nest_top
    PluralStages0to4 = 17, // beetroot => beetroots_stage_0, beetroots_stage_1, -> 4
    BottomSideTop = 18, // bell => bell_bottom, bell_side, bell_top
    Trapdoor = 19, // acacia_trapdoor
    BaseTop = 20, // blackstone => blackstone, blackstone_top
    DoubleSlabMaterial = 21, // blackstone_double_slab
    SlabMaterial = 22, // blackstone_slab
    WallMaterial = 23, // blackstone_wall
    BlockSideTopFrontOffOn = 24, // blast_furnace => blast_furnace_front_off, blast_furnace_front_on, blast_furnace_side, blast_furnace_top
    RemoveBlock = 25, // border_block => border
    BaseBase = 26, // brewing_stand => brewing_stand, brewing_stand_base
    TgaBottomSideTop = 27, // cactus => cactus_bottom.tga, cactus_side.tga, cactus_top.tga
    ColumnDownInnerOuterUp = 28, // bubble_column
    MaterialOneTexture = 29, // brown_mushroom => mushroom_brown
    RemoveBlockMaterialOneTexture = 30, // brown_mushroom => mushroom_brown
    BottomInnerSideTop = 31, // cake => cake_bottom, cake_inner, cake_side, cake_top
    BackFrontSideTop = 32, // camera => camera_back, camera_front, camera_side, camera_top
    BottomInnerSideTopWater = 33, // cauldron
    NumberedSide = 34, // cartography_table => cartography_table_side1, cartography_table_side2, cartography_table_side3,cartography_table_top 
    FrontSideTop = 35,
    BaseDead = 36, // chorus_flower
    Stages0to2 = 37, // cocoa
    CustomBase = 38, // command_block
    Water = 39 // water





}