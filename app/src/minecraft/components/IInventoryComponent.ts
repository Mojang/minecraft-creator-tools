
export default interface IInventoryComponent
{
    containerType : string;
    inventorySize: number;
    canBeSiphonedFrom: boolean;
    private: boolean;
    restrictToOwner: boolean;
    additionalSlotsPerStrength: number;
}