/// <reference types="node" />
import "../app/CreatorToolsHost";
import { expect } from "chai";
import * as os from "os";
import * as path from "path";
import LocalUtilities from "../local/LocalUtilities";
import LocalEnvironment from "../local/LocalEnvironment";
import ContentLogWatcher from "../local/ContentLogWatcher";
import { Platform } from "../core/ILocalUtilities";

describe("Minecraft GDK folders", () => {
  // A GDK install keeps com.mojang under %APPDATA%\Minecraft Bedrock[ Preview], next to its logs folder.
  it("puts retail and preview com.mojang under the Minecraft Bedrock app data folders", () => {
    const utils = new LocalUtilities();
    const roaming = path.join(os.homedir(), "AppData", "Roaming");
    const comMojang = ["Users", "Shared", "games", "com.mojang"];

    expect(path.normalize(utils.minecraftPath)).to.equal(
      path.join(roaming, "Minecraft Bedrock", ...comMojang) + path.sep
    );
    expect(path.normalize(utils.minecraftPreviewPath)).to.equal(
      path.join(roaming, "Minecraft Bedrock Preview", ...comMojang) + path.sep
    );
  });

  it("watches the client log folder for the chosen track, once, and none off Windows", () => {
    const listed: string[] = [];
    const timers = new Set<number>();
    let nextTimer = 0;
    const watcherFor = (utilities: Partial<LocalUtilities>) =>
      new ContentLogWatcher(
        { utilities } as unknown as LocalEnvironment,
        { list: (folder) => (listed.push(folder), []), stat: () => undefined, read: () => Buffer.alloc(0) },
        {
          setInterval: () => timers.add(++nextTimer) && nextTimer,
          clearInterval: (timer) => timers.delete(timer as number),
        }
      );

    const gdk = watcherFor({ localReleaseServerLogPath: "retail", localPreviewServerLogPath: "preview" });
    gdk.watchMinecraftFolder(true);
    gdk.watchMinecraftFolder(true);
    expect([listed, timers.size]).to.deep.equal([["preview"], 1]);
    gdk.watchMinecraftFolder(false);
    expect([listed, timers.size]).to.deep.equal([["preview", "retail"], 1]);
    gdk.stop();

    const linux = new LocalUtilities();
    Object.defineProperty(linux, "platform", { value: Platform.linux });
    expect([linux.localReleaseServerLogPath, linux.localPreviewServerLogPath]).to.deep.equal(["", ""]);
    watcherFor(linux).watchMinecraftFolder(false);
    watcherFor(linux).watchMinecraftFolder(true);
    expect([listed.length, timers.size]).to.deep.equal([2, 0]);
  });
});
