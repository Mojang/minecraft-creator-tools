import JsonDocument from "./JsonDocument";
import * as vscode from "vscode";
import { disposeAll } from "./Disposable";
import WebviewCollection from "./WebviewCollection";
import CreatorToolsHost from "../app/CreatorToolsHost";
import ExtensionManager from "./ExtensionManager";
import Log from "../core/Log";

export default class JsonEditorProvider implements vscode.CustomEditorProvider<JsonDocument> {
  private _context: vscode.ExtensionContext;
  private _extensionManager: ExtensionManager;

  public static register(context: vscode.ExtensionContext, _extensionManager: ExtensionManager): vscode.Disposable {
    return vscode.window.registerCustomEditorProvider(
      JsonEditorProvider.viewType,
      new JsonEditorProvider(context, _extensionManager),
      {
        webviewOptions: {
          retainContextWhenHidden: false,
        },
        supportsMultipleEditorsPerDocument: false,
      }
    );
  }

  private static readonly viewType = "mctools.json";

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
  ): Promise<JsonDocument> {
    const document: JsonDocument = await JsonDocument.create(uri, openContext.backupId, this._extensionManager, {
      getFileData: async () => {
        const webviewsForDocument = Array.from(this.webviews.get(document.uri));
        if (!webviewsForDocument.length) {
          throw new Error("Could not find webview to save for");
        }
        const panel = webviewsForDocument[0];
        const response = await this.postMessageWithResponse<string>(panel, "getFileData", {});
        return response;
      },
      requestSave: async () => {
        const webviewsForDocument = Array.from(this.webviews.get(document.uri));
        if (!webviewsForDocument.length) {
          throw new Error("Could not find webview to save for");
        }
        const panel = webviewsForDocument[0];
        const response = await this.postMessageWithResponse<string>(panel, "saveAll", {});
        return response;
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

    // a new change happened on disk, and we should const the web panel editor know
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
    document: JsonDocument,
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
      if (e.type && e.type === "notifyFileUpdated" && e.content) {
        Log.debug(`Processing notify file updated.`);
        document.notifyEditMade(e.content);
      }

      CreatorToolsHost.notifyNewMessage(webviewPanel.webview, e);
    });
  }

  private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<vscode.CustomDocumentEditEvent<JsonDocument>>();

  public readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;

  public saveCustomDocument(document: JsonDocument, cancellation: vscode.CancellationToken): Thenable<void> {
    return document.save(cancellation);
  }

  public saveCustomDocumentAs(
    document: JsonDocument,
    destination: vscode.Uri,
    cancellation: vscode.CancellationToken
  ): Thenable<void> {
    return document.saveAs(destination, cancellation);
  }

  public revertCustomDocument(document: JsonDocument, cancellation: vscode.CancellationToken): Thenable<void> {
    return document.revert(cancellation);
  }

  public backupCustomDocument(
    document: JsonDocument,
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
