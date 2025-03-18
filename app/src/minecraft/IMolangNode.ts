export enum MolangNodeType {
  unknown = 0,
  number = 1,
  variable = 2,
  operator = 3,
  function = 4,
  condition = 5,
  clauseSet = 6,
}

export default interface IMolangNode {
  type: MolangNodeType;
  value?: string;
  left?: IMolangNode;
  right?: IMolangNode;
}
