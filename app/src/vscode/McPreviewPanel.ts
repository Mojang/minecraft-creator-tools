// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * McPreviewPanel - Live preview webview panel for Minecraft content
 *
 * ARCHITECTURE: This class manages a VS Code webview panel that displays
 * live previews of Minecraft content files (entities, blocks, items).
 *
 * KEY FEATURES:
 * - Auto-updates when the source document changes
 * - Supports entity types, block types, and item types
 * - Theme-aware (matches VS Code light/dark theme)
 * - Navigable links to specific components/events
 *
 * COMMUNICATION:
 * The webview hosts React components (EntityTypeLivePreview, BlockTypeLivePreview)
 * and communicates via postMessage:
 *
 * Extension → Webview:
 *   - { type: 'update', data: {...}, filePath: '...' }
 *   - { type: 'theme', isDark: true/false }
 *
 * Webview → Extension:
 *   - { type: 'navigate', path: 'components/minecraft:health' }
 *   - { type: 'ready' }
 *
 * USAGE:
 * Called via:
 * - Command: "mctools.showPreview"
 * - Keyboard: Ctrl+K V (open side preview)
 * - Context menu on entity/block files
 */

import * as vscode from "vscode";
import ExtensionManager from "./ExtensionManager";
import Log from "../core/Log";

/** Types of content that can be previewed */
export type PreviewContentType = "entity" | "block" | "item" | "unknown";

export default class McPreviewPanel {
  public static currentPanel: McPreviewPanel | undefined;
  public static readonly viewType = "mctools.preview";

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private readonly _extensionManager: ExtensionManager;
  private _disposables: vscode.Disposable[] = [];
  private _currentDocument: vscode.TextDocument | undefined;
  private _updateTimer: NodeJS.Timeout | undefined;

  /**
   * Create or show the preview panel
   */
  public static createOrShow(
    extensionUri: vscode.Uri,
    extensionManager: ExtensionManager,
    document?: vscode.TextDocument
  ): McPreviewPanel {
    const column = vscode.ViewColumn.Beside;

    // If we already have a panel, show it
    if (McPreviewPanel.currentPanel) {
      McPreviewPanel.currentPanel._panel.reveal(column);
      if (document) {
        McPreviewPanel.currentPanel.update(document);
      }
      return McPreviewPanel.currentPanel;
    }

    // Create a new panel
    const panel = vscode.window.createWebviewPanel(McPreviewPanel.viewType, "Minecraft Preview", column, {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [extensionUri],
    });

    McPreviewPanel.currentPanel = new McPreviewPanel(panel, extensionUri, extensionManager);

    if (document) {
      McPreviewPanel.currentPanel.update(document);
    }

    return McPreviewPanel.currentPanel;
  }

  /**
   * Revive a webview panel from serialized state
   */
  public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, extensionManager: ExtensionManager): void {
    McPreviewPanel.currentPanel = new McPreviewPanel(panel, extensionUri, extensionManager);
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, extensionManager: ExtensionManager) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._extensionManager = extensionManager;

    // Set up the webview content
    this._panel.webview.html = this._getWebviewContent();

    // Handle panel disposal
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Handle messages from webview
    this._panel.webview.onDidReceiveMessage((message) => this._handleMessage(message), null, this._disposables);

    // Handle theme changes
    vscode.window.onDidChangeActiveColorTheme(() => this._sendTheme(), null, this._disposables);

    // Handle document changes
    vscode.workspace.onDidChangeTextDocument(
      (e) => {
        if (this._currentDocument && e.document === this._currentDocument) {
          this._scheduleUpdate();
        }
      },
      null,
      this._disposables
    );

    // Send initial theme
    this._sendTheme();
  }

  /**
   * Update the preview with content from a document
   */
  public update(document: vscode.TextDocument): void {
    this._currentDocument = document;

    // Determine content type from file path
    const contentType = this._getContentType(document);

    // Update panel title
    const fileName = document.fileName.split(/[\\/]/).pop() || "Preview";
    this._panel.title = `Preview: ${fileName}`;

    // Parse and send the content
    try {
      const text = document.getText();
      const data = JSON.parse(text);

      this._panel.webview.postMessage({
        type: "update",
        contentType,
        data,
        filePath: document.fileName,
      });
    } catch (error) {
      Log.debug(`Preview parse error: ${error}`);
      this._panel.webview.postMessage({
        type: "error",
        message: "Failed to parse JSON content",
      });
    }
  }

  /**
   * Schedule an update with debouncing
   */
  private _scheduleUpdate(): void {
    if (this._updateTimer) {
      clearTimeout(this._updateTimer);
    }

    this._updateTimer = setTimeout(() => {
      if (this._currentDocument) {
        this.update(this._currentDocument);
      }
    }, 300);
  }

  /**
   * Determine content type from document
   */
  private _getContentType(document: vscode.TextDocument): PreviewContentType {
    const path = document.fileName.toLowerCase();

    if (path.includes("/entities/") || path.includes("\\entities\\") || path.includes("/entity/") || path.includes("\\entity\\")) {
      return "entity";
    }

    if (path.includes("/blocks/") || path.includes("\\blocks\\")) {
      return "block";
    }

    if (path.includes("/items/") || path.includes("\\items\\")) {
      return "item";
    }

    // Try to detect from content
    try {
      const text = document.getText();
      if (text.includes('"minecraft:entity"')) {
        return "entity";
      }
      if (text.includes('"minecraft:block"')) {
        return "block";
      }
      if (text.includes('"minecraft:item"')) {
        return "item";
      }
    } catch {
      // Ignore parse errors
    }

    return "unknown";
  }

  /**
   * Send theme information to webview
   */
  private _sendTheme(): void {
    const kind = vscode.window.activeColorTheme.kind;
    const isDark =
      kind === vscode.ColorThemeKind.Dark ||
      kind === vscode.ColorThemeKind.HighContrast;
    // HighContrastLight (enum value 4) was added in VS Code 1.74
    const isHighContrast =
      kind === vscode.ColorThemeKind.HighContrast ||
      kind === 4; // ColorThemeKind.HighContrastLight

    this._panel.webview.postMessage({
      type: "theme",
      isDark,
      isHighContrast,
    });
  }

  /**
   * Handle messages from the webview
   */
  private _handleMessage(message: any): void {
    switch (message.type) {
      case "ready":
        // Webview is ready, send current content
        this._sendTheme();
        if (this._currentDocument) {
          this.update(this._currentDocument);
        }
        break;

      case "navigate":
        // Navigate to a specific path in the document
        this._navigateToPath(message.path);
        break;

      case "openFile":
        // Open a related file
        this._openRelatedFile(message.filePath);
        break;
    }
  }

  /**
   * Navigate to a specific path in the current document
   */
  private async _navigateToPath(path: string): Promise<void> {
    if (!this._currentDocument) {
      return;
    }

    // Try to find and select the path in the document
    const text = this._currentDocument.getText();
    const parts = path.split("/");

    // Build a regex to find the target
    let searchText: string | undefined;

    if (parts[0] === "components" && parts[1]) {
      searchText = `"${parts[1]}"`;
    } else if (parts[0] === "events" && parts[1]) {
      searchText = `"${parts[1]}"`;
    } else if (parts[0] === "component_groups" && parts[1]) {
      searchText = `"${parts[1]}"`;
    } else if (parts[0] === "states" && parts[1]) {
      searchText = `"${parts[1]}"`;
    }

    if (searchText) {
      const index = text.indexOf(searchText);
      if (index >= 0) {
        const position = this._currentDocument.positionAt(index);
        const range = new vscode.Range(position, position);

        // Show the document and reveal the range
        const editor = await vscode.window.showTextDocument(this._currentDocument, {
          viewColumn: vscode.ViewColumn.One,
          selection: range,
        });

        // Highlight the found text
        const endPosition = this._currentDocument.positionAt(index + searchText.length);
        editor.selection = new vscode.Selection(position, endPosition);
        editor.revealRange(new vscode.Range(position, endPosition), vscode.TextEditorRevealType.InCenter);
      }
    }
  }

  /**
   * Open a related file (like a referenced texture or geometry)
   */
  private async _openRelatedFile(filePath: string): Promise<void> {
    try {
      const files = await vscode.workspace.findFiles(`**/${filePath}*`);
      if (files.length > 0) {
        const doc = await vscode.workspace.openTextDocument(files[0]);
        await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
      }
    } catch (error) {
      Log.debug(`Failed to open related file: ${error}`);
    }
  }

  /**
   * Get the webview HTML content
   */
  private _getWebviewContent(): string {
    const webview = this._panel.webview;
    const nonce = this._getNonce();

    // Generate URIs for scripts and styles
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "build", "preview.js"));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "build", "preview.css"));

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>Minecraft Preview</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
    }
    
    .preview-container {
      padding: 8px;
      min-height: 100vh;
    }
    
    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 200px;
      opacity: 0.6;
    }
    
    .error {
      padding: 16px;
      color: var(--vscode-errorForeground);
      background: var(--vscode-inputValidation-errorBackground);
      border: 1px solid var(--vscode-inputValidation-errorBorder);
      border-radius: 4px;
      margin: 8px;
    }
    
    .unknown-type {
      padding: 16px;
      text-align: center;
      opacity: 0.6;
    }
    
    /* Entity type preview styles (inline fallback) */
    .entity-preview, .block-preview, .item-preview {
      padding: 8px;
    }
    
    .preview-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding-bottom: 8px;
      margin-bottom: 8px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    
    .preview-icon {
      font-size: 24px;
    }
    
    .preview-title {
      font-weight: 600;
      font-size: 16px;
    }
    
    .preview-id {
      font-size: 11px;
      opacity: 0.6;
      font-family: monospace;
    }
    
    .preview-section {
      margin: 8px 0;
    }
    
    .preview-section-header {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 0;
      cursor: pointer;
      font-weight: 500;
    }
    
    .preview-badge {
      margin-left: auto;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      padding: 1px 6px;
      border-radius: 10px;
      font-size: 10px;
    }
    
    .preview-tag {
      display: inline-block;
      padding: 2px 6px;
      margin: 2px;
      border-radius: 4px;
      font-size: 10px;
      cursor: pointer;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
    }
    
    .preview-tag:hover {
      opacity: 0.8;
    }
    
    .stats-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding: 8px 0;
    }
    
    .stat-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 8px 12px;
      background: var(--vscode-textBlockQuote-background);
      border-radius: 6px;
      border-left: 3px solid var(--vscode-progressBar-background);
      min-width: 60px;
    }
    
    .stat-icon {
      font-size: 16px;
    }
    
    .stat-value {
      font-weight: 700;
      font-size: 16px;
    }
    
    .stat-label {
      font-size: 9px;
      opacity: 0.7;
      text-transform: uppercase;
    }
  </style>
</head>
<body>
  <div id="root" class="preview-container">
    <div class="loading">Loading preview...</div>
  </div>
  
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    
    let currentData = null;
    let currentType = 'unknown';
    let isDarkTheme = true;
    
    // Handle messages from extension
    window.addEventListener('message', event => {
      const message = event.data;
      
      switch (message.type) {
        case 'update':
          currentData = message.data;
          currentType = message.contentType;
          render();
          break;
          
        case 'theme':
          isDarkTheme = message.isDark;
          render();
          break;
          
        case 'error':
          renderError(message.message);
          break;
      }
    });
    
    // Notify extension that webview is ready
    vscode.postMessage({ type: 'ready' });
    
    function navigate(path) {
      vscode.postMessage({ type: 'navigate', path: path });
    }
    
    function openFile(filePath) {
      vscode.postMessage({ type: 'openFile', filePath: filePath });
    }
    
    function render() {
      const root = document.getElementById('root');
      
      if (!currentData) {
        root.innerHTML = '<div class="loading">Waiting for content...</div>';
        return;
      }
      
      switch (currentType) {
        case 'entity':
          renderEntity(root, currentData);
          break;
        case 'block':
          renderBlock(root, currentData);
          break;
        case 'item':
          renderItem(root, currentData);
          break;
        default:
          root.innerHTML = '<div class="unknown-type">Unknown content type. Open an entity, block, or item JSON file.</div>';
      }
    }
    
    function renderError(message) {
      const root = document.getElementById('root');
      root.innerHTML = '<div class="error">' + escapeHtml(message) + '</div>';
    }
    
    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
    
    function toTitleCase(str) {
      return str.replace(/_/g, ' ').replace(/\\b\\w/g, c => c.toUpperCase());
    }
    
    function shortenName(name) {
      return name.replace(/^minecraft:/, '').replace(/_/g, ' ');
    }
    
    function renderEntity(root, data) {
      const entity = data['minecraft:entity'];
      if (!entity || !entity.description) {
        root.innerHTML = '<div class="error">Invalid entity format</div>';
        return;
      }
      
      const id = entity.description.identifier || 'Unknown';
      const shortId = id.includes(':') ? id.split(':')[1] : id;
      
      let html = '<div class="entity-preview">';
      html += '<div class="preview-header">';
      html += '<span class="preview-icon">🥚</span>';
      html += '<div>';
      html += '<div class="preview-title">' + escapeHtml(toTitleCase(shortId)) + '</div>';
      html += '<div class="preview-id">' + escapeHtml(id) + '</div>';
      html += '</div></div>';
      
      // Components count
      const components = entity.components ? Object.keys(entity.components) : [];
      if (components.length > 0) {
        html += renderSection('📦 Components', components.length, 
          components.slice(0, 20).map(c => renderTag(shortenName(c), () => navigate('components/' + c))).join('')
        );
      }
      
      // Events
      const events = entity.events ? Object.keys(entity.events) : [];
      if (events.length > 0) {
        html += renderSection('⚡ Events', events.length,
          events.slice(0, 15).map(e => renderTag(e, () => navigate('events/' + e))).join('')
        );
      }
      
      // Component groups
      const groups = entity.component_groups ? Object.keys(entity.component_groups) : [];
      if (groups.length > 0) {
        html += renderSection('📁 Component Groups', groups.length,
          groups.slice(0, 15).map(g => renderTag(g, () => navigate('component_groups/' + g))).join('')
        );
      }
      
      html += '</div>';
      root.innerHTML = html;
    }
    
    function renderBlock(root, data) {
      const block = data['minecraft:block'];
      if (!block || !block.description) {
        root.innerHTML = '<div class="error">Invalid block format</div>';
        return;
      }
      
      const id = block.description.identifier || 'Unknown';
      const shortId = id.includes(':') ? id.split(':')[1] : id;
      
      let html = '<div class="block-preview">';
      html += '<div class="preview-header">';
      html += '<span class="preview-icon">🧱</span>';
      html += '<div>';
      html += '<div class="preview-title">' + escapeHtml(toTitleCase(shortId)) + '</div>';
      html += '<div class="preview-id">' + escapeHtml(id) + '</div>';
      html += '</div></div>';
      
      // States
      const states = block.description.states ? Object.keys(block.description.states) : [];
      if (states.length > 0) {
        html += renderSection('🔄 Block States', states.length,
          states.map(s => renderTag(shortenName(s), () => navigate('states/' + s))).join('')
        );
      }
      
      // Permutations
      const perms = block.permutations || [];
      if (perms.length > 0) {
        html += renderSection('⚙️ Permutations', perms.length,
          '<div style="font-size: 11px; opacity: 0.8;">' + perms.length + ' conditional variants</div>'
        );
      }
      
      // Components
      const components = block.components ? Object.keys(block.components) : [];
      if (components.length > 0) {
        html += renderSection('📦 Components', components.length,
          components.slice(0, 15).map(c => renderTag(shortenName(c), () => navigate('components/' + c))).join('')
        );
      }
      
      html += '</div>';
      root.innerHTML = html;
    }
    
    function renderItem(root, data) {
      const item = data['minecraft:item'];
      if (!item || !item.description) {
        root.innerHTML = '<div class="error">Invalid item format</div>';
        return;
      }
      
      const id = item.description.identifier || 'Unknown';
      const shortId = id.includes(':') ? id.split(':')[1] : id;
      
      let html = '<div class="item-preview">';
      html += '<div class="preview-header">';
      html += '<span class="preview-icon">🎒</span>';
      html += '<div>';
      html += '<div class="preview-title">' + escapeHtml(toTitleCase(shortId)) + '</div>';
      html += '<div class="preview-id">' + escapeHtml(id) + '</div>';
      html += '</div></div>';
      
      // Components
      const components = item.components ? Object.keys(item.components) : [];
      if (components.length > 0) {
        html += renderSection('📦 Components', components.length,
          components.slice(0, 15).map(c => renderTag(shortenName(c), () => navigate('components/' + c))).join('')
        );
      }
      
      html += '</div>';
      root.innerHTML = html;
    }
    
    function renderSection(title, count, content) {
      return '<div class="preview-section">' +
        '<div class="preview-section-header">' +
        '<span>' + title + '</span>' +
        '<span class="preview-badge">' + count + '</span>' +
        '</div>' +
        '<div class="preview-section-content">' + content + '</div>' +
        '</div>';
    }
    
    function renderTag(text, onClick) {
      const id = 'tag_' + Math.random().toString(36).substr(2, 9);
      setTimeout(() => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', onClick);
      }, 0);
      return '<span id="' + id + '" class="preview-tag">' + escapeHtml(text) + '</span>';
    }
  </script>
</body>
</html>`;
  }

  /**
   * Generate a nonce for script security
   */
  private _getNonce(): string {
    let text = "";
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  /**
   * Dispose of the panel and its resources
   */
  public dispose(): void {
    McPreviewPanel.currentPanel = undefined;

    if (this._updateTimer) {
      clearTimeout(this._updateTimer);
    }

    this._panel.dispose();

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}
