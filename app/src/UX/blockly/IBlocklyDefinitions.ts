export default interface IBlocklyDefinition {
  blocks: IBlocklyDefinitionInterior;
}

export interface IBlocklyDefinitionInterior {
  languageVersion: number;
  blocks: IBlocklyBlockLocatableBase[];
}

export interface IBlocklyBlockBase {
  id: string;
  type: string;
  fields?: { [fieldName: string]: boolean | string | number | undefined };
  next?: IBlocklyBlockWrapper;
}

export interface IBlocklyBlockWrapper {
  block?: IBlocklyBlockBase;
}

export interface IBlocklyBlockLocatableBase extends IBlocklyBlockBase {
  id: string;
  x?: number;
  y?: number;
}

export interface IActionGroupBlock extends IBlocklyBlockLocatableBase {
  inputs: IActionGroupBlockInputs;
}

export interface IActionGroupBlockInputs {
  filters?: {
    block: IBlocklyBlockBase;
  };
  actions?: {
    block: IBlocklyBlockBase;
  };
}

export interface IBlocklyBlockDefinition {
  type: string;
  tooltip?: string;
  helpUrl?: string;
  message0: string;
  args0?: IBlocklyBlockDefinitionArgument[];
  colour?: number | string;
  style?: string;
  inputsInline?: boolean;
  output?: string;
  nextStatement?: undefined | null | string[];
  previousStatement?: undefined | null | string[];
}

export interface IBlocklyBlockDefinitionArgument {
  type: string;
  name: string;
  variable?: string;
  text?: string;
  options?: (string | number | boolean)[][];
}
