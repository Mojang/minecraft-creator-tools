import IBlockNbtJson from "./IBlockNbtJson";


export default interface ISnbtBlock
{
    pos: number[];
    state: string;
    nbt: IBlockNbtJson;
}