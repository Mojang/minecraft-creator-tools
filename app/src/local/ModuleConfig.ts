export default class ModuleConfig {
  permissionsAllowedModules: string[] = [];
  variables: { [name: string]: string | number | boolean } | undefined = undefined;
  secrets: { [name: string]: string | number | boolean } | undefined = undefined;
}
