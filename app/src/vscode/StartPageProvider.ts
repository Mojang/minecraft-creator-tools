import * as vscode from "vscode";
import CreatorToolsHost from "../app/CreatorToolsHost";
import ExtensionManager from "./ExtensionManager";

export default class StartPageProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "mctools.startPage";
  private static _showingPanels: vscode.WebviewPanel[] = [];

  private _view?: vscode.WebviewView;
  private _context: vscode.ExtensionContext;
  private _extensionManager: ExtensionManager;

  constructor(context: vscode.ExtensionContext, extensionManager: ExtensionManager) {
    this._context = context;
    this._extensionManager = extensionManager;
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      //      localResourceRoots: [context.extensionUri],
    };

    this._extensionManager.registerWebview(this._extensionManager.activeProjectPath, webviewView.webview);
    webviewView.webview.html = this._extensionManager.getWebviewContent(webviewView.webview, "codestartpage");

    webviewView.webview.onDidReceiveMessage((e: any) => {
      CreatorToolsHost.notifyNewMessage(webviewView.webview, e);
    });
  }

  public static show(extensionUri: vscode.Uri, extensionManager: ExtensionManager) {
    const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;

    const panel = vscode.window.createWebviewPanel(
      StartPageProvider.viewType,
      "New Minecraft Project",
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [extensionUri],
      }
    );

    panel.webview.onDidReceiveMessage((e: any) => {
      CreatorToolsHost.notifyNewMessage(panel.webview, e);
    });

    panel.webview.html = extensionManager.getWebviewContent(panel.webview, "codestartpage");

    StartPageProvider._showingPanels.push(panel);
  }

  public static closeAllStartPages() {
    for (const panel of StartPageProvider._showingPanels) {
      panel.dispose();
    }

    StartPageProvider._showingPanels = [];
  }

  public static register(context: vscode.ExtensionContext, _extensionManager: ExtensionManager): vscode.Disposable {
    return vscode.commands.registerCommand("mctools.newProject", () => {
      StartPageProvider.show(context.extensionUri, _extensionManager);
    });
  }
}
