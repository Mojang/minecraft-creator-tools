// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * VS Code Adapters for Langcore
 *
 * This module provides adapters that convert langcore platform-agnostic types
 * to VS Code API types (vscode.Hover, vscode.CompletionItem, etc.)
 */

import * as vscode from "vscode";
import { IHoverContent } from "../../langcore/json/JsonHoverContent";
import { ICompletionItem, CompletionItemKind } from "../../langcore/json/JsonCompletionItems";
import { IDiagnostic, DiagnosticSeverity, IDiagnosticFix } from "../../langcore/json/JsonDiagnostics";

/**
 * Convert langcore hover content to VS Code Hover
 */
export function toVscodeHover(content: IHoverContent, range?: vscode.Range): vscode.Hover {
  const markdownStrings: vscode.MarkdownString[] = content.sections.map((section) => {
    const md = new vscode.MarkdownString(section.markdown);
    md.isTrusted = true;
    md.supportHtml = true;
    return md;
  });

  return range ? new vscode.Hover(markdownStrings, range) : new vscode.Hover(markdownStrings);
}

/**
 * Convert langcore completion item kind to VS Code CompletionItemKind
 */
function toVscodeCompletionKind(kind: CompletionItemKind): vscode.CompletionItemKind {
  switch (kind) {
    case CompletionItemKind.Property:
      return vscode.CompletionItemKind.Property;
    case CompletionItemKind.Value:
      return vscode.CompletionItemKind.Value;
    case CompletionItemKind.Enum:
      return vscode.CompletionItemKind.EnumMember;
    case CompletionItemKind.Keyword:
      return vscode.CompletionItemKind.Keyword;
    case CompletionItemKind.File:
      return vscode.CompletionItemKind.File;
    case CompletionItemKind.Folder:
      return vscode.CompletionItemKind.Folder;
    case CompletionItemKind.Reference:
      return vscode.CompletionItemKind.Reference;
    case CompletionItemKind.Module:
      return vscode.CompletionItemKind.Module;
    case CompletionItemKind.Class:
      return vscode.CompletionItemKind.Class;
    case CompletionItemKind.Interface:
      return vscode.CompletionItemKind.Interface;
    case CompletionItemKind.Function:
      return vscode.CompletionItemKind.Function;
    case CompletionItemKind.Variable:
      return vscode.CompletionItemKind.Variable;
    case CompletionItemKind.Constant:
      return vscode.CompletionItemKind.Constant;
    case CompletionItemKind.Snippet:
      return vscode.CompletionItemKind.Snippet;
    case CompletionItemKind.Event:
      return vscode.CompletionItemKind.Event;
    case CompletionItemKind.EnumMember:
      return vscode.CompletionItemKind.EnumMember;
    case CompletionItemKind.Entity:
    case CompletionItemKind.Block:
    case CompletionItemKind.Item:
    case CompletionItemKind.Component:
      return vscode.CompletionItemKind.Reference;
    default:
      return vscode.CompletionItemKind.Text;
  }
}

/**
 * Convert langcore completion item to VS Code CompletionItem
 */
export function toVscodeCompletionItem(item: ICompletionItem): vscode.CompletionItem {
  const vscItem = new vscode.CompletionItem(item.label, toVscodeCompletionKind(item.kind));

  if (item.detail) {
    vscItem.detail = item.detail;
  }

  if (item.documentation) {
    const md = new vscode.MarkdownString(item.documentation);
    md.isTrusted = true;
    vscItem.documentation = md;
  }

  if (item.insertText) {
    if (item.isSnippet) {
      vscItem.insertText = new vscode.SnippetString(item.insertText);
    } else {
      vscItem.insertText = item.insertText;
    }
  }

  if (item.filterText) {
    vscItem.filterText = item.filterText;
  }

  if (item.sortText) {
    vscItem.sortText = item.sortText;
  }

  if (item.deprecated) {
    vscItem.tags = [vscode.CompletionItemTag.Deprecated];
  }

  return vscItem;
}

/**
 * Convert langcore completion items to VS Code CompletionItems
 */
export function toVscodeCompletionItems(items: ICompletionItem[]): vscode.CompletionItem[] {
  return items.map(toVscodeCompletionItem);
}

/**
 * Convert langcore diagnostic severity to VS Code DiagnosticSeverity
 */
function toVscodeDiagnosticSeverity(severity: DiagnosticSeverity): vscode.DiagnosticSeverity {
  switch (severity) {
    case DiagnosticSeverity.Error:
      return vscode.DiagnosticSeverity.Error;
    case DiagnosticSeverity.Warning:
      return vscode.DiagnosticSeverity.Warning;
    case DiagnosticSeverity.Information:
      return vscode.DiagnosticSeverity.Information;
    case DiagnosticSeverity.Hint:
      return vscode.DiagnosticSeverity.Hint;
    default:
      return vscode.DiagnosticSeverity.Information;
  }
}

/**
 * Convert langcore diagnostic to VS Code Diagnostic
 */
export function toVscodeDiagnostic(diagnostic: IDiagnostic): vscode.Diagnostic {
  const range = new vscode.Range(
    diagnostic.startLine - 1, // Convert to 0-indexed
    diagnostic.startColumn - 1,
    diagnostic.endLine - 1,
    diagnostic.endColumn - 1
  );

  const vscDiag = new vscode.Diagnostic(range, diagnostic.message, toVscodeDiagnosticSeverity(diagnostic.severity));

  if (diagnostic.source) {
    vscDiag.source = diagnostic.source;
  }

  if (diagnostic.code) {
    vscDiag.code = diagnostic.code;
  }

  return vscDiag;
}

/**
 * Convert langcore diagnostics to VS Code Diagnostics
 */
export function toVscodeDiagnostics(diagnostics: IDiagnostic[]): vscode.Diagnostic[] {
  return diagnostics.map(toVscodeDiagnostic);
}

/**
 * Convert langcore diagnostic fix to VS Code CodeAction
 */
export function toVscodeCodeAction(fix: IDiagnosticFix, document: vscode.TextDocument): vscode.CodeAction {
  const action = new vscode.CodeAction(fix.title, vscode.CodeActionKind.QuickFix);

  if (fix.edits && fix.edits.length > 0) {
    const edit = new vscode.WorkspaceEdit();

    for (const e of fix.edits) {
      const range = new vscode.Range(e.startLine - 1, e.startColumn - 1, e.endLine - 1, e.endColumn - 1);
      edit.replace(document.uri, range, e.newText);
    }

    action.edit = edit;
  }

  action.isPreferred = fix.isPreferred || false;

  return action;
}

/**
 * Convert langcore diagnostic fixes to VS Code CodeActions
 */
export function toVscodeCodeActions(fixes: IDiagnosticFix[], document: vscode.TextDocument): vscode.CodeAction[] {
  return fixes.map((fix) => toVscodeCodeAction(fix, document));
}
