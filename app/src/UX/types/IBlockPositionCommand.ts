import ICommand from "./ICommand";


export default interface IBlockPositionCommand extends ICommand
{
    x : number;
    y : number;
    z : number;
}