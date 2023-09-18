import BlockLocation from "../minecraft/BlockLocation";
import ICommand from "./ICommand";

export default interface IBlocksSetTypeCommand extends ICommand
{
    updatedBlocks : { newTypeId : string, location : BlockLocation }[];
}