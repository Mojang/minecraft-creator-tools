export enum ToolScope {
  global = 0,
  project = 1,
}

export enum ToolType {
  executeGameTest = 0,
  runCommand = 1,
  pushStructure = 2,
  reload = 3,
  say = 4,
  playSound = 5,
  customTool = 6,
}

export default interface ITool {
  title: string;
  type: ToolType;
  scope: ToolScope;
  parameter1?: string;
  parameter2?: string;
}
