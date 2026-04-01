import IBlockPositionCommand from "./IBlockPositionCommand";

export default interface IBlockSetPropertyCommand extends IBlockPositionCommand {
  propertyName: string;
  propertyValue: string | number | number[] | bigint | bigint[] | boolean | undefined;
}
