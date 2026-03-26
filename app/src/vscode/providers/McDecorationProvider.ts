// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * McDecorationProvider - VS Code Inline Component Summaries
 *
 * ARCHITECTURE
 * ============
 * This provider displays inline summaries for Minecraft components in VS Code.
 * It uses VS Code's TextEditorDecorationType API to show subtle annotations
 * after component keys in JSON files.
 *
 * VISUAL APPEARANCE:
 * - Summaries appear after the component/group key line in comment-style color
 * - Example: "minecraft:health": {   // has 20 health points
 *
 * RELATIONSHIP TO WEB VERSION:
 * - Uses shared logic from langcore/json/JsonComponentSummaries
 * - VS Code uses TextEditorDecorationType, Monaco uses deltaDecorations
 * - Both produce the same user-visible result
 *
 * PERFORMANCE:
 * - Debounces updates on text changes
 * - Only processes visible editors
 * - Caches decoration types for efficiency
 */

import * as vscode from "vscode";
import {
  findComponents,
  generateComponentSummaries,
  findComponentLineNumber,
} from "../../langcore/json/JsonComponentSummaries";
import Log from "../../core/Log";

/**
 * Provides inline component summary decorations for VS Code editors
 */
export default class McDecorationProvider implements vscode.Disposable {
  private readonly _disposables: vscode.Disposable[] = [];
  private readonly _decorationType: vscode.TextEditorDecorationType;
  private readonly _groupDecorationType: vscode.TextEditorDecorationType;
  private readonly _eventDecorationType: vscode.TextEditorDecorationType;
  private _debounceTimer: NodeJS.Timeout | undefined;
  private readonly DEBOUNCE_MS = 300;

  constructor() {
    // Create decoration type for individual components
    this._decorationType = vscode.window.createTextEditorDecorationType({
      after: {
        margin: "0 0 0 1em",
        color: new vscode.ThemeColor("editorCodeLens.foreground"),
        fontStyle: "italic",
      },
    });

    // Create decoration type for component groups (slightly different styling)
    this._groupDecorationType = vscode.window.createTextEditorDecorationType({
      after: {
        margin: "0 0 0 1em",
        color: new vscode.ThemeColor("editorLineNumber.foreground"),
        fontStyle: "italic",
      },
    });

    // Create decoration type for events
    this._eventDecorationType = vscode.window.createTextEditorDecorationType({
      after: {
        margin: "0 0 0 1em",
        color: new vscode.ThemeColor("editorCodeLens.foreground"),
        fontStyle: "italic",
      },
    });

    // Listen for editor changes
    this._disposables.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor) {
          this.scheduleUpdate(editor);
        }
      })
    );

    // Listen for text document changes
    this._disposables.push(
      vscode.workspace.onDidChangeTextDocument((event) => {
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document === event.document) {
          this.scheduleUpdate(editor);
        }
      })
    );

    // Initial update for active editor
    if (vscode.window.activeTextEditor) {
      this.scheduleUpdate(vscode.window.activeTextEditor);
    }
  }

  /**
   * Schedule a debounced update for the given editor
   */
  private scheduleUpdate(editor: vscode.TextEditor): void {
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
    }

    this._debounceTimer = setTimeout(() => {
      this.updateDecorations(editor).catch((err) => {
        Log.verbose(`McDecorationProvider update failed: ${err}`);
      });
    }, this.DEBOUNCE_MS);
  }

  /**
   * Update decorations for the given editor
   */
  private async updateDecorations(editor: vscode.TextEditor): Promise<void> {
    const document = editor.document;

    // Only process JSON files
    if (document.languageId !== "json") {
      this.clearDecorations(editor);
      return;
    }

    const content = document.getText();
    if (!content.trim()) {
      this.clearDecorations(editor);
      return;
    }

    // Parse JSON
    let json: unknown;
    try {
      json = JSON.parse(content);
    } catch {
      // Invalid JSON, clear decorations
      this.clearDecorations(editor);
      return;
    }

    // Find all components
    const components = findComponents(json);
    if (components.length === 0) {
      this.clearDecorations(editor);
      return;
    }

    // Generate summaries
    const summaries = await generateComponentSummaries(components);

    // Convert to VS Code decorations
    const componentDecorations: vscode.DecorationOptions[] = [];
    const groupDecorations: vscode.DecorationOptions[] = [];
    const eventDecorations: vscode.DecorationOptions[] = [];

    for (const summary of summaries) {
      const lineNumber = findComponentLineNumber(content, summary.id);
      if (!lineNumber) {
        continue;
      }

      const line = lineNumber - 1; // VS Code uses 0-based line numbers
      const lineLength = document.lineAt(line).text.length;

      const decoration: vscode.DecorationOptions = {
        range: new vscode.Range(line, 0, line, lineLength),
        renderOptions: {
          after: {
            contentText: `  /* ${summary.summaryText} */`,
          },
        },
      };

      if (summary.type === "component_group") {
        groupDecorations.push(decoration);
      } else if (summary.type === "event") {
        eventDecorations.push(decoration);
      } else {
        componentDecorations.push(decoration);
      }
    }

    // Apply decorations
    editor.setDecorations(this._decorationType, componentDecorations);
    editor.setDecorations(this._groupDecorationType, groupDecorations);
    editor.setDecorations(this._eventDecorationType, eventDecorations);
  }

  /**
   * Clear all decorations from the editor
   */
  private clearDecorations(editor: vscode.TextEditor): void {
    editor.setDecorations(this._decorationType, []);
    editor.setDecorations(this._groupDecorationType, []);
    editor.setDecorations(this._eventDecorationType, []);
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
    }

    this._decorationType.dispose();
    this._groupDecorationType.dispose();
    this._eventDecorationType.dispose();

    for (const disposable of this._disposables) {
      disposable.dispose();
    }
  }
}
