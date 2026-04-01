import IFolder from "../storage/IFolder";
import ModuleConfig from "./ModuleConfig";

export const CartoServerToolsScriptModuleId = "ead57a90-41fc-4f3b-8e1a-ddd64c99da05";

export default class ServerConfigManager {
  private _serverConfigFolder?: IFolder;

  private _configsByModule: { [name: string]: ModuleConfig } = {};

  public get serverConfigFolder() {
    return this._serverConfigFolder;
  }
  public set serverConfigFolder(newConfigFolder: IFolder | undefined) {
    this._serverConfigFolder = newConfigFolder;
  }

  ensureDefaultConfig() {
    const mc = new ModuleConfig();

    mc.permissionsAllowedModules = ["@minecraft/server-gametest", "@minecraft/server", "@minecraft/server-ui"];

    this._configsByModule["default"] = mc;
  }

  addCartoConfig() {
    const mc = new ModuleConfig();

    mc.permissionsAllowedModules = [
      "@minecraft/server-gametest",
      "@minecraft/server",
      "@minecraft/server-ui",
      "@minecraft/server-net",
      "@minecraft/server-admin",
    ];

    this._configsByModule[CartoServerToolsScriptModuleId] = mc;
  }

  public async writeFiles() {
    if (this._serverConfigFolder === undefined) {
      return;
    }

    for (const moduleName in this._configsByModule) {
      const config = this._configsByModule[moduleName];

      const moduleFolder = this._serverConfigFolder.ensureFolder(moduleName.toLowerCase());

      await moduleFolder.ensureExists();

      const permissionsFile = moduleFolder.ensureFile("permissions.json");

      const permissionsData = {
        allowed_modules: config.permissionsAllowedModules,
      };

      const permissionsFIleExists = await permissionsFile.exists();

      let text: string | undefined;
      if (permissionsFIleExists) {
        await permissionsFile.loadContent(true);

        text = permissionsFile.content as string;
      }

      let newText: string | undefined = JSON.stringify(permissionsData);

      // backup the server properties file if it's not generated
      if (text && text.length > 0 && text !== newText) {
        const now = new Date();

        const fileCopy = moduleFolder.ensureFile(
          "permissions.json." +
            now.getFullYear() +
            "." +
            (now.getMonth() + 1) +
            "." +
            now.getDate() +
            "." +
            now.getHours() +
            "." +
            now.getMinutes() +
            ".cartobackup"
        );
        fileCopy.setContent(text);

        await fileCopy.saveContent();
      }

      permissionsFile.setContent(newText);

      await permissionsFile.saveContent();

      const varFile = moduleFolder.ensureFile("variables.json");

      const varFileExists = await varFile.exists();

      if (varFileExists) {
        if (!varFile.isContentLoaded) {
          await varFile.loadContent(true);
        }

        text = varFile.content as string;
      }

      if (config.variables) {
        newText = JSON.stringify(config.variables);
      } else {
        newText = undefined;
      }

      // backup the server properties file if it's not generated
      if (text && text.length > 0 && text !== newText) {
        const now = new Date();

        const fileCopy = moduleFolder.ensureFile(
          "variables.json." +
            now.getFullYear() +
            "." +
            (now.getMonth() + 1) +
            "." +
            now.getDate() +
            "." +
            now.getHours() +
            "." +
            now.getMinutes() +
            ".cartobackup"
        );
        fileCopy.setContent(text);

        await fileCopy.saveContent();
      }

      if (!newText && varFileExists) {
        await varFile.deleteThisFile();
      } else if (newText) {
        varFile.content = newText;
        await varFile.saveContent();
      }

      const secretsFile = moduleFolder.ensureFile("secrets.json");

      const secretsFileExists = await secretsFile.exists();

      if (secretsFileExists) {
        if (!secretsFile.isContentLoaded) {
          await secretsFile.loadContent(true);
        }

        text = secretsFile.content as string;
      }

      if (config.secrets) {
        newText = JSON.stringify(config.secrets);
      } else {
        newText = undefined;
      }

      // backup the server properties file if it's not generated
      if (text && text.length > 0 && text !== newText) {
        const now = new Date();

        const fileCopy = moduleFolder.ensureFile(
          "secrets.json." +
            now.getFullYear() +
            "." +
            (now.getMonth() + 1) +
            "." +
            now.getDate() +
            "." +
            now.getHours() +
            "." +
            now.getMinutes() +
            ".cartobackup"
        );
        fileCopy.setContent(text);

        await fileCopy.saveContent();
      }

      if (!newText && secretsFileExists) {
        await secretsFile.deleteThisFile();
      } else if (newText) {
        secretsFile.content = newText;
        await secretsFile.saveContent();
      }
    }
  }
}
