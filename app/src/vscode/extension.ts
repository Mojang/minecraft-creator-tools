import ExtensionManager from "./ExtensionManager";
import * as vscode from "vscode";
import VscDedicatedServerManager from "./VscDedicatedServerManager";
import VscWebSocketServerManager from "./VscWebSocketServerManager";
import LocalEnvironment from "../local/LocalEnvironment";
import NodeStorage from "../local/NodeStorage";
import CreatorToolsHost from "../app/CreatorToolsHost";

// note that this line of code gets transformed in a post build process to ExtensionManager(true) to support the web extension variant
const _em = new ExtensionManager(false);

const _env = new LocalEnvironment(true);

export function activate(context: vscode.ExtensionContext) {
  _em.activate(context);

  const _carto = CreatorToolsHost.getCreatorTools();

  if (_carto) {
    const _dedicatedServerManager = new VscDedicatedServerManager(_em, _env, _carto);
    _carto.processHostedMinecraft = _dedicatedServerManager;
    _em.processHostedMinecraft = _dedicatedServerManager;

    const _webSocketServerManager = new VscWebSocketServerManager(_em, _env);
    _carto.gameMinecraft = _webSocketServerManager;
    _em.gameMinecraft = _webSocketServerManager;

    _webSocketServerManager.onFolderInitRequested.subscribe((fn: any, path: string) => {
      if (!_em.hasStoragePath(path)) {
        // console.log("Initializing storage at path " + path);
        const es = new NodeStorage(path, "");

        _em.registerStorage(es, path);
      }
    });
  }
}

export function deactivate() {
  _em.deactivate();
}
