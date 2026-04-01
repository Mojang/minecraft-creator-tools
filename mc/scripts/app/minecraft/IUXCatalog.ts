import IFormDefinition from "./../dataform/IFormDefinition";
import ISnippet from "./../app/ISnippet";

export default interface IUXCatalog {
  gameTestSnippets: ISnippet[];
  scriptSnippets: ISnippet[];

  mcworldProperties: IFormDefinition;
  documentedModule: IFormDefinition;
  documentedClass: IFormDefinition;
  documentedScriptEnum: IFormDefinition;
  documentedCommandSet: IFormDefinition;
  documentedCommand: IFormDefinition;
  simpleInfoJson: IFormDefinition;
  commandOverload: IFormDefinition;
  commandArgument: IFormDefinition;
  packageJson: IFormDefinition;
  behaviorPackHeaderJson: IFormDefinition;
  behaviorPackRestOfFile: IFormDefinition;

  componentForms: { [id: string]: IFormDefinition };
}
