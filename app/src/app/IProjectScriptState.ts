export default interface IProjectScriptState {
  hasScript: boolean;

  hasModule: { [moduleId: string]: boolean };
}
