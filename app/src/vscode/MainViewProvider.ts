import * as vscode from "vscode";
import CreatorToolsHost from "../app/CreatorToolsHost";
import ExtensionManager from "./ExtensionManager";

export default class MainViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "mctools.mainView";
  public static readonly explorerViewType = "mctools.mainViewExplorer";

  private _view?: vscode.WebviewView;
  private _context: vscode.ExtensionContext;
  private _extensionUri: vscode.Uri;
  private _extensionManager: ExtensionManager;

  constructor(
    context: vscode.ExtensionContext,
    private readonly extensionUri: vscode.Uri,
    extensionManager: ExtensionManager
  ) {
    this._context = context;
    this._extensionUri = extensionUri;
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
      localResourceRoots: [this._extensionUri],
    };

    let page = "codetoolbox";
    let projectPath = this._extensionManager.activeProjectPath;

    // If there are workspace folders but activeProjectPath hasn't been set yet
    // (because doInitAsync hasn't completed), derive the path from the first workspace folder.
    // This ensures the webview gets a valid project path to load the project items list.
    if (!projectPath && vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
      projectPath = vscode.workspace.workspaceFolders[0].uri.toString();
    }

    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length < 1) {
      page = "codelandingforcenewproject";
    }

    this._extensionManager.registerWebview(projectPath, webviewView.webview);

    webviewView.webview.html = this._extensionManager.getWebviewContent(
      webviewView.webview,
      page,
      undefined,
      projectPath
    );

    webviewView.webview.onDidReceiveMessage((e: any) => {
      CreatorToolsHost.notifyNewMessage(webviewView.webview, e);
    });
  }
}
