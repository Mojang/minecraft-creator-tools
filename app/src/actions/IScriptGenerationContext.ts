export enum ScriptGenerationPlacement {
  initInSequence = 5,
  beforeBlockStart = 9,
  blockStart = 10,
  afterBlockStart = 11,
  inSequence = 20,
  beforeBlockEnd = 29,
  blockEnd = 30,
  afterBlockEnd = 31,
}

export default interface IScriptGenerationContext {
  topLevelFunction?: boolean;
  indent: number;
}
