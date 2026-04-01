import * as vscode from "vscode";
import Log from "../core/Log";
import Disposable from "./Disposable";
import ExtensionManager from "./ExtensionManager";

interface JsonDocumentDelegate {
  getFileData(): Promise<string>;
  requestSave(): void;
}

/**
 * Define the document (the data model) used for generic Minecraft files - typically JSON files.
 */
export default class JsonDocument extends Disposable implements vscode.CustomDocument {
  _edits: string[] = [];

  static async create(
    uri: vscode.Uri,
    backupId: string | undefined,
    extensionManager: ExtensionManager,
    delegate: JsonDocumentDelegate
  ): Promise<JsonDocument | PromiseLike<JsonDocument>> {
    // If we have a backup, read that. Otherwise read the resource from the workspace
    const dataFile = typeof backupId === "string" ? vscode.Uri.parse(backupId) : uri;
    const fileData = await JsonDocument.readFile(dataFile);

    // if we have a set of backup content, load that and tell extension manager to hand that to HTML clients when they ask
    if (typeof backupId === "string") {
      Log.debug("Restoring backup content for " + uri.toString());
      extensionManager.registerAlternateContents(uri.toString(), fileData.toString());
    }

    return new JsonDocument(uri, fileData, extensionManager, delegate);
  }

  private static async readFile(uri: vscode.Uri): Promise<string> {
    if (uri.scheme === "untitled") {
      return "";
    }

    const byteData = new Uint8Array(await vscode.workspace.fs.readFile(uri));

    return byteData.toString();
  }

  private readonly _uri: vscode.Uri;

  private _documentData: string;

  private readonly _delegate: JsonDocumentDelegate;
  private _extensionManager: ExtensionManager;

  private constructor(
    uri: vscode.Uri,
    initialContent: string,
    extensionManager: ExtensionManager,
    delegate: JsonDocumentDelegate
  ) {
    super();
    this._uri = uri;
    this._extensionManager = extensionManager;
    this._documentData = initialContent;
    this._delegate = delegate;
  }

  public get uri() {
    return this._uri;
  }

  public get documentData(): string {
    return this._documentData;
  }

  private readonly _onDidDispose = this._register(new vscode.EventEmitter<void>());
  /**
   * Fired when the document is disposed of.
   */
  public readonly onDidDispose = this._onDidDispose.event;

  private readonly _onDidChangeDocument = this._register(
    new vscode.EventEmitter<{
      readonly content?: string;
    }>()
  );

  /**
   * Fired to notify webviews that the document has changed.
   */
  public readonly onDidChangeContent = this._onDidChangeDocument.event;

  private readonly _onDidChange = this._register(
    new vscode.EventEmitter<{
      readonly label: string;
      undo(): void;
      redo(): void;
    }>()
  );

  /**
   * Fired to tell VS Code that an edit has occurred in the document.
   *
   * This updates the document's dirty indicator.
   */
  public readonly onDidChange = this._onDidChange.event;

  /**
   * Called by VS Code when there are no more references to the document.
   *
   * This happens when all editors for it have been closed.
   */
  dispose(): void {
    this._onDidDispose.fire();
    super.dispose();
  }

  /**
   * Called when the user edits the document in a webview.
   *
   * This fires an event to notify VS Code that the document has been edited.
   */
  notifyEditMade(content: string) {
    this._edits.push(content);

    this._onDidChange.fire({
      label: "Edit",
      undo: async () => {
        const lastContent = this._edits.pop();
        this._onDidChangeDocument.fire({
          content: lastContent,
        });
      },
      redo: async () => {
        this._edits.push(content);
        this._onDidChangeDocument.fire({
          content: content,
        });
      },
    });
  }

  /**
   * Called by VS Code when the user saves the document.
   */
  async save(cancellation: vscode.CancellationToken): Promise<void> {
    Log.debug(`Save requested.`);
    await this.saveAs(this.uri, cancellation);
  }

  /**
   * Called by VS Code when the user saves the document to a new location.
   */
  async saveAs(targetResource: vscode.Uri, cancellation: vscode.CancellationToken): Promise<void> {
    Log.debug(`SaveAs requested ${targetResource.toString()}.`);

    this._delegate.requestSave();
    this._extensionManager.clearAlternateContents(this.uri.toString());
  }

  /**
   * Called by VS Code when the user calls `revert` on a document.
   */
  async revert(_cancellation: vscode.CancellationToken): Promise<void> {
    const diskContent = await JsonDocument.readFile(this.uri);
    this._documentData = diskContent;
    this._extensionManager.clearAlternateContents(this.uri.toString());

    //this._edits = this._savedEdits;
    this._onDidChangeDocument.fire({
      content: diskContent,
      //edits: this._edits,
    });
  }

  async backup(destination: vscode.Uri, cancellation: vscode.CancellationToken): Promise<vscode.CustomDocumentBackup> {
    if (this._edits.length > 0) {
      const byteContent = new TextEncoder().encode(this._edits[this._edits.length - 1]);

      await vscode.workspace.fs.writeFile(destination, byteContent);

      this._extensionManager.registerAlternateContents(this.uri.toString(), this._edits[this._edits.length - 1]);
    }

    return {
      id: destination.toString(),
      delete: async () => {
        try {
          await vscode.workspace.fs.delete(destination);
          this._extensionManager.clearAlternateContents(destination.toString());
        } catch {
          // noop
        }
      },
    };
  }
}
