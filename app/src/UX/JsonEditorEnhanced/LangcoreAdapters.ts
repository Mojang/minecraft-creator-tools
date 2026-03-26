// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Monaco Adapters for Langcore
 *
 * This module provides adapters that convert langcore platform-agnostic types
 * to Monaco API types (monaco.languages.Hover, monaco.languages.CompletionItem, etc.)
 */

import * as monaco from "monaco-editor";
import { IHoverContent } from "../../langcore/json/JsonHoverContent";
import { ICompletionItem, CompletionItemKind } from "../../langcore/json/JsonCompletionItems";
import { IDiagnostic, DiagnosticSeverity, IDiagnosticFix } from "../../langcore/json/JsonDiagnostics";

/**
 * Convert langcore hover content to Monaco Hover
 */
export function toMonacoHover(content: IHoverContent, range?: monaco.IRange): monaco.languages.Hover {
  const contents: monaco.IMarkdownString[] = content.sections.map((section) => ({
    value: section.markdown,
    isTrusted: true,
    supportHtml: true,
  }));

  return {
    contents,
    range,
  };
}

/**
 * Convert langcore completion item kind to Monaco CompletionItemKind
 */
function toMonacoCompletionKind(kind: CompletionItemKind): monaco.languages.CompletionItemKind {
  switch (kind) {
    case CompletionItemKind.Property:
      return monaco.languages.CompletionItemKind.Property;
    case CompletionItemKind.Value:
      return monaco.languages.CompletionItemKind.Value;
    case CompletionItemKind.Enum:
      return monaco.languages.CompletionItemKind.EnumMember;
    case CompletionItemKind.Keyword:
      return monaco.languages.CompletionItemKind.Keyword;
    case CompletionItemKind.File:
      return monaco.languages.CompletionItemKind.File;
    case CompletionItemKind.Folder:
      return monaco.languages.CompletionItemKind.Folder;
    case CompletionItemKind.Reference:
      return monaco.languages.CompletionItemKind.Reference;
    case CompletionItemKind.Module:
      return monaco.languages.CompletionItemKind.Module;
    case CompletionItemKind.Class:
      return monaco.languages.CompletionItemKind.Class;
    case CompletionItemKind.Interface:
      return monaco.languages.CompletionItemKind.Interface;
    case CompletionItemKind.Function:
      return monaco.languages.CompletionItemKind.Function;
    case CompletionItemKind.Variable:
      return monaco.languages.CompletionItemKind.Variable;
    case CompletionItemKind.Constant:
      return monaco.languages.CompletionItemKind.Constant;
    case CompletionItemKind.Snippet:
      return monaco.languages.CompletionItemKind.Snippet;
    case CompletionItemKind.Event:
      return monaco.languages.CompletionItemKind.Event;
    case CompletionItemKind.EnumMember:
      return monaco.languages.CompletionItemKind.EnumMember;
    case CompletionItemKind.Entity:
    case CompletionItemKind.Block:
    case CompletionItemKind.Item:
    case CompletionItemKind.Component:
      return monaco.languages.CompletionItemKind.Reference;
    default:
      return monaco.languages.CompletionItemKind.Text;
  }
}

/**
 * Convert langcore completion item to Monaco CompletionItem
 */
export function toMonacoCompletionItem(item: ICompletionItem, range: monaco.IRange): monaco.languages.CompletionItem {
  const monacoItem: monaco.languages.CompletionItem = {
    label: item.label,
    kind: toMonacoCompletionKind(item.kind),
    insertText: item.insertText || item.label,
    range,
  };

  if (item.detail) {
    monacoItem.detail = item.detail;
  }

  if (item.documentation) {
    monacoItem.documentation = {
      value: item.documentation,
      isTrusted: true,
    };
  }

  if (item.isSnippet) {
    monacoItem.insertTextRules = monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet;
  }

  if (item.filterText) {
    monacoItem.filterText = item.filterText;
  }

  if (item.sortText) {
    monacoItem.sortText = item.sortText;
  }

  if (item.deprecated) {
    monacoItem.tags = [monaco.languages.CompletionItemTag.Deprecated];
  }

  return monacoItem;
}

/**
 * Convert langcore completion items to Monaco CompletionItems
 */
export function toMonacoCompletionItems(
  items: ICompletionItem[],
  range: monaco.IRange
): monaco.languages.CompletionItem[] {
  return items.map((item) => toMonacoCompletionItem(item, range));
}

/**
 * Convert langcore diagnostic severity to Monaco MarkerSeverity
 */
function toMonacoMarkerSeverity(severity: DiagnosticSeverity): monaco.MarkerSeverity {
  switch (severity) {
    case DiagnosticSeverity.Error:
      return monaco.MarkerSeverity.Error;
    case DiagnosticSeverity.Warning:
      return monaco.MarkerSeverity.Warning;
    case DiagnosticSeverity.Information:
      return monaco.MarkerSeverity.Info;
    case DiagnosticSeverity.Hint:
      return monaco.MarkerSeverity.Hint;
    default:
      return monaco.MarkerSeverity.Info;
  }
}

/**
 * Convert langcore diagnostic to Monaco IMarkerData
 */
export function toMonacoMarker(diagnostic: IDiagnostic): monaco.editor.IMarkerData {
  return {
    severity: toMonacoMarkerSeverity(diagnostic.severity),
    message: diagnostic.message,
    startLineNumber: diagnostic.startLine,
    startColumn: diagnostic.startColumn,
    endLineNumber: diagnostic.endLine,
    endColumn: diagnostic.endColumn,
    source: diagnostic.source,
    code: diagnostic.code,
  };
}

/**
 * Convert langcore diagnostics to Monaco markers
 */
export function toMonacoMarkers(diagnostics: IDiagnostic[]): monaco.editor.IMarkerData[] {
  return diagnostics.map(toMonacoMarker);
}

/**
 * Convert langcore diagnostic fix to Monaco CodeAction
 */
export function toMonacoCodeAction(fix: IDiagnosticFix, model: monaco.editor.ITextModel): monaco.languages.CodeAction {
  const action: monaco.languages.CodeAction = {
    title: fix.title,
    kind: "quickfix",
    isPreferred: fix.isPreferred,
  };

  if (fix.edits && fix.edits.length > 0) {
    action.edit = {
      edits: fix.edits.map((e) => ({
        resource: model.uri,
        textEdit: {
          range: {
            startLineNumber: e.startLine,
            startColumn: e.startColumn,
            endLineNumber: e.endLine,
            endColumn: e.endColumn,
          },
          text: e.newText,
        },
        versionId: model.getVersionId(),
      })),
    };
  }

  return action;
}

/**
 * Convert langcore diagnostic fixes to Monaco CodeActions
 */
export function toMonacoCodeActions(
  fixes: IDiagnosticFix[],
  model: monaco.editor.ITextModel
): monaco.languages.CodeAction[] {
  return fixes.map((fix) => toMonacoCodeAction(fix, model));
}
