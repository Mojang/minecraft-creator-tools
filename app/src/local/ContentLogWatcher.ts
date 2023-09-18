import * as fs from "fs";
import MinecraftLogItem from "./MinecraftLogItem";
import { EventDispatcher } from "ste-events";
import LocalEnvironment from "./LocalEnvironment";

export default class ContentLogWatcher {
  private _onLogItem = new EventDispatcher<ContentLogWatcher, MinecraftLogItem>();

  private _env: LocalEnvironment;

  logItems: MinecraftLogItem[] = [];

  constructor(env: LocalEnvironment) {
    this._env = env;
  }

  public get onLogItem() {
    return this._onLogItem.asEvent();
  }

  public watchServerFolder() {
    const mcLogPath = this._env.utilities.localServerLogPath;

    if (!mcLogPath || !fs.existsSync(mcLogPath)) {
      return;
    }

    this.watchLogFolder(mcLogPath);
  }

  public watchMinecraftUwpFolder() {
    let mcLogPath = this._env.utilities.localAppDataPath;

    if (!mcLogPath) {
      return;
    }

    mcLogPath = mcLogPath + "\\Packages\\Microsoft.MinecraftUWP_8wekyb3d8bbwe\\LocalState\\logs\\";
    mcLogPath = mcLogPath.toLowerCase();

    this.watchLogFolder(mcLogPath);
  }

  public watchLogFolder(mcLogPath: string) {
    const exists = fs.existsSync(mcLogPath);

    if (exists) {
      // Log.message("Starting logging of Minecraft logs at '" + mcLogPath + ".'");

      const now = new Date();

      this.processFolder(mcLogPath, new Date(now.getTime() - 30 * 60 * 1000));

      fs.watch(mcLogPath, async (eventType: string, fileName: string) => {
        this.processFile(mcLogPath, fileName);
      });
    }
  }

  public processFolder(mcLogPath: string, sinceDate: Date) {
    const sinceDateMs = sinceDate.getTime();
    const exists = fs.existsSync(mcLogPath);

    if (exists) {
      const files = fs.readdirSync(mcLogPath);

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const stat = fs.statSync(mcLogPath + file);

        if (stat.isFile() && stat.mtimeMs > sinceDateMs) {
          this.processFile(mcLogPath, file);
        }
      }
    }
  }

  private processFile(logPath: string, fileName: string) {
    if (fileName !== null) {
      fileName = fileName.toLowerCase();

      if (fileName.startsWith("contentlog__")) {
        const content = fs.readFileSync(logPath + fileName, { encoding: "utf8", flag: "r" });

        const logItem = new MinecraftLogItem();

        logItem.fileName = fileName;
        logItem.message = content;

        this.logItems.push(logItem);

        this._onLogItem.dispatch(this, logItem);
      }
    }
  }
}
