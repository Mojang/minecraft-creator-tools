import StructureDocument from "./StructureDocument";
import * as vscode from "vscode";
import { disposeAll } from "./Disposable";
import WebviewCollection from "./WebviewCollection";
import CreatorToolsHost from "../app/CreatorToolsHost";
import ExtensionManager from "./ExtensionManager";

export default class StructureEditorProvider implements vscode.CustomEditorProvider<StructureDocument> {
  private static newStructureFileId = 1;
  private _context: vscode.ExtensionContext;
  private _extensionManager: ExtensionManager;

  public static register(context: vscode.ExtensionContext, _extensionManager: ExtensionManager): vscode.Disposable {
    vscode.commands.registerCommand("mctools.mcstructure.new", () => {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        vscode.window.showErrorMessage("Creating new mcstructure files currently requires opening a workspace");
        return;
      }

      const uri = vscode.Uri.joinPath(
        workspaceFolders[0].uri,
        `new-${StructureEditorProvider.newStructureFileId++}.mcstructure`
      ).with({ scheme: "untitled" });

      vscode.commands.executeCommand("vscode.openWith", uri, StructureEditorProvider.viewType);
    });

    return vscode.window.registerCustomEditorProvider(
      StructureEditorProvider.viewType,
      new StructureEditorProvider(context, _extensionManager),
      {
        // For this demo extension, we enable `retainContextWhenHidden` which keeps the
        // webview alive even when it is not visible. You should avoid using this setting
        // unless is absolutely required as it does have memory overhead.
        webviewOptions: {
          retainContextWhenHidden: true,
        },
        supportsMultipleEditorsPerDocument: false,
      }
    );
  }

  private static readonly viewType = "mctools.mcstructure";

  private readonly webviews = new WebviewCollection();

  constructor(
    private readonly context: vscode.ExtensionContext,
    extensionManager: ExtensionManager
  ) {
    this._context = context;
    this._extensionManager = extensionManager;
  }

  //#region CustomEditorProvider

  async openCustomDocument(
    uri: vscode.Uri,
    openContext: { backupId?: string },
    _token: vscode.CancellationToken
  ): Promise<StructureDocument> {
    const document: StructureDocument = await StructureDocument.create(uri, openContext.backupId, {
      getFileData: async () => {
        const webviewsForDocument = Array.from(this.webviews.get(document.uri));
        if (!webviewsForDocument.length) {
          throw new Error("Could not find webview to save for");
        }
        const panel = webviewsForDocument[0];
        const response = await this.postMessageWithResponse<number[]>(panel, "getFileData", {});
        return new Uint8Array(response);
      },
    });

    const listeners: vscode.Disposable[] = [];

    listeners.push(
      document.onDidChange((e: any) => {
        this._onDidChangeCustomDocument.fire({
          document,
          ...e,
        });
      })
    );

    listeners.push(
      document.onDidChangeContent((e: any) => {
        for (const webviewPanel of this.webviews.get(document.uri)) {
          this.postMessage(webviewPanel, "update", {
            //    edits: e.edits,
            content: e.content,
          });
        }
      })
    );

    document.onDidDispose(() => disposeAll(listeners));

    return document;
  }

  async resolveCustomEditor(
    document: StructureDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    this.webviews.add(document.uri, webviewPanel);

    webviewPanel.webview.options = {
      enableScripts: true,
    };

    // Get the workspace folder containing this document
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    let projectPath = this._extensionManager.activeProjectPath;

    // If we found a workspace folder, ensure storage/project is set up for it
    if (workspaceFolder) {
      const result = await this._extensionManager.ensureStorageAndProjectForFolder(this._context, workspaceFolder);
      projectPath = workspaceFolder.uri.toString();
    }

    this._extensionManager.registerWebview(projectPath, webviewPanel.webview);

    webviewPanel.webview.html = this._extensionManager.getWebviewContent(
      webviewPanel.webview,
      "projectitem",
      document.uri.toString(),
      projectPath
    );

    webviewPanel.webview.onDidReceiveMessage((e: any) => {
      CreatorToolsHost.notifyNewMessage(webviewPanel.webview, e);
    });
  }

  private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<
    vscode.CustomDocumentEditEvent<StructureDocument>
  >();

  public readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;

  public saveCustomDocument(document: StructureDocument, cancellation: vscode.CancellationToken): Thenable<void> {
    return document.save(cancellation);
  }

  public saveCustomDocumentAs(
    document: StructureDocument,
    destination: vscode.Uri,
    cancellation: vscode.CancellationToken
  ): Thenable<void> {
    return document.saveAs(destination, cancellation);
  }

  public revertCustomDocument(document: StructureDocument, cancellation: vscode.CancellationToken): Thenable<void> {
    return document.revert(cancellation);
  }

  public backupCustomDocument(
    document: StructureDocument,
    context: vscode.CustomDocumentBackupContext,
    cancellation: vscode.CancellationToken
  ): Thenable<vscode.CustomDocumentBackup> {
    return document.backup(context.destination, cancellation);
  }

  private _requestId = 1;
  private readonly _callbacks = new Map<number, (response: any) => void>();

  private postMessageWithResponse<R = unknown>(panel: vscode.WebviewPanel, type: string, body: any): Promise<R> {
    const requestId = this._requestId++;
    const p = new Promise<R>((resolve) => this._callbacks.set(requestId, resolve));
    panel.webview.postMessage({ type, requestId, body });
    return p;
  }

  private postMessage(panel: vscode.WebviewPanel, type: string, body: any): void {
    panel.webview.postMessage({ type, body });
  }
}
