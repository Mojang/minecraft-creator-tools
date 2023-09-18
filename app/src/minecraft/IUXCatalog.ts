import IFormDefinition from "./../dataform/IFormDefinition";

export default interface IUXCatalog {
  mcworldProperties: IFormDefinition;
  documentedModule: IFormDefinition;
  documentedClass: IFormDefinition;
  documentedScriptEnum: IFormDefinition;
  documentedCommandSet: IFormDefinition;
  documentedCommand: IFormDefinition;
  simpleInfoJson: IFormDefinition;
  commandOverload: IFormDefinition;
  commandArgument: IFormDefinition;
  commandValue: IFormDefinition;
  packageJson: IFormDefinition;
  behaviorPackHeaderJson: IFormDefinition;
  behaviorPackRestOfFile: IFormDefinition;

  componentForms: { [id: string]: IFormDefinition };
}
