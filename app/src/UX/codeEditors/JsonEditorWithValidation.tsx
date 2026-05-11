/**
 * JsonEditorWithValidation - Split view combining JSON editor with validation issues panel
 *
 * ARCHITECTURE:
 * This component provides a split view with:
 * - Top 80%: JsonEditor for viewing/editing JSON content
 * - Bottom 20%: ValidationIssuesPanel showing errors, warnings, and recommendations
 *
 * When a validation issue is clicked, this component attempts to navigate to the relevant
 * line in the JSON editor based on the JSON path information from the issue.
 *
 * KEY FEATURES:
 * - Split view layout with configurable heights
 * - Click-to-navigate from validation issues to JSON editor
 * - Supports finding line numbers from JSON paths
 *
 * RELATED FILES:
 * - JsonEditor.tsx - The Monaco-based JSON editor component
 * - ValidationIssuesPanel.tsx - The compact validation issues list
 * - ProjectInfoSet.ts - Provides validation items
 */

import { Component, createRef } from "react";
import "./JsonEditorWithValidation.css";
import IFile from "../../storage/IFile";
import ProjectItem from "../../app/ProjectItem";
import Project from "../../app/Project";
import ProjectInfoSet from "../../info/ProjectInfoSet";
import ProjectInfoItem from "../../info/ProjectInfoItem";
import { JsonEditor } from "./JsonEditor";
import ValidationIssuesPanel, { IValidationIssueClickInfo } from "../project/ValidationIssuesPanel";
import IPersistable from "../types/IPersistable";
import { InfoItemType } from "../../info/IInfoItemData";
import * as monaco from "monaco-editor";
import IProjectTheme from "../types/IProjectTheme";
import type { IProjectItemEditorNavigationTarget } from "../project/ProjectItemEditor";
import { WithLocalizationProps, withLocalization } from "../withLocalization";

// Split ratio: 80% editor, 20% validation panel
const EDITOR_HEIGHT_PERCENT = 80;
const PANEL_HEIGHT_PERCENT = 20;

interface IJsonEditorWithValidationProps extends WithLocalizationProps {
  heightOffset: number;
  readOnly: boolean;
  project: Project;
  theme: IProjectTheme;
  preferredTextSize: number;
  item: ProjectItem;
  file: IFile;
  infoSet: ProjectInfoSet;
  setActivePersistable?: (persistObject: IPersistable) => void;
  onUpdatePreferredTextSize?: (newSize: number) => void;
  onUpdateLivePreviewWidth?: (newWidth: number) => void;
  livePreviewWidth?: number;
  onOpenProjectItem?: (projectPath: string) => void;
  navigationTarget?: IProjectItemEditorNavigationTarget;
}

interface IJsonEditorWithValidationState {
  issues: ProjectInfoItem[];
}

class JsonEditorWithValidation extends Component<
  IJsonEditorWithValidationProps,
  IJsonEditorWithValidationState
> {
  private _jsonEditorRef = createRef<JsonEditor>();

  constructor(props: IJsonEditorWithValidationProps) {
    super(props);

    this._handleIssueClick = this._handleIssueClick.bind(this);

    // Get issues for this file
    const issues = this._getIssuesForItem(props);

    this.state = {
      issues,
    };
  }

  componentDidUpdate(prevProps: IJsonEditorWithValidationProps) {
    // Refresh issues if item or infoSet changes
    if (prevProps.item !== this.props.item || prevProps.infoSet !== this.props.infoSet) {
      const issues = this._getIssuesForItem(this.props);
      this.setState({ issues });
    }
  }

  _getIssuesForItem(props: IJsonEditorWithValidationProps): ProjectInfoItem[] {
    if (!props.item.projectPath || !props.infoSet) {
      return [];
    }

    const allIssues = props.infoSet.getItemsByStoragePath(props.item.projectPath);
    if (!allIssues) {
      return [];
    }

    // Filter to actionable issues only - exclude pure info/metadata items
    // InfoItemType.info items are metadata like "Behavior Pack Name: X" which aren't actionable
    return allIssues.filter(
      (issue) =>
        issue.itemType === InfoItemType.error ||
        issue.itemType === InfoItemType.warning ||
        issue.itemType === InfoItemType.recommendation ||
        issue.itemType === InfoItemType.internalProcessingError
    );
  }

  /**
   * Attempts to find the line number in JSON content for a given JSON path.
   * This is a best-effort approach that parses property names from the path.
   */
  _findLineForJsonPath(content: string, jsonPath: string): number | undefined {
    if (!jsonPath || !content) {
      return undefined;
    }

    // Extract property names from path like "$.minecraft:entity.components.minecraft:health"
    const pathParts = jsonPath
      .replace(/^\$\.?/, "") // Remove leading $. or $
      .split(/\.|\[|\]/)
      .filter((p) => p && !p.match(/^\d+$/)); // Remove empty parts and array indices

    if (pathParts.length === 0) {
      return undefined;
    }

    const lines = content.split("\n");

    // Try to find the last property in the path
    const targetProperty = pathParts[pathParts.length - 1];

    // Look for the property in the content
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Match property names in JSON (with quotes)
      if (line.includes(`"${targetProperty}"`) || line.includes(`'${targetProperty}'`)) {
        return i + 1; // Line numbers are 1-based
      }
    }

    // If not found, try without quotes (for identifiers)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes(targetProperty)) {
        return i + 1;
      }
    }

    return undefined;
  }

  /**
   * Attempts to find a line number from the issue content.
   * Some validators include path information in the content.
   */
  _findLineFromIssueContent(content: string, issueContent: string | undefined): number | undefined {
    if (!issueContent) {
      return undefined;
    }

    // Try to extract JSON path from content - often in format "($.path)" or "($.<path>)"
    const pathMatch = issueContent.match(/\(\$\.([^)]+)\)/);
    if (pathMatch) {
      const path = "$." + pathMatch[1];
      return this._findLineForJsonPath(content, path);
    }

    // Try to find property names mentioned in the error
    // Often errors mention a property name directly
    const propertyMatch = issueContent.match(/"([^"]+)"/);
    if (propertyMatch) {
      const property = propertyMatch[1];
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(`"${property}"`)) {
          return i + 1;
        }
      }
    }

    return undefined;
  }

  /**
   * Attempts to find a line number by extracting keywords from issue message/content
   * and searching for them in the JSON.
   */
  _findLineFromKeywords(content: string, item: ProjectInfoItem): number | undefined {
    const lines = content.split("\n");

    // Common patterns to look for based on error messages
    const searchTerms: string[] = [];

    // Check if message mentions format_version
    const message = item.message?.toLowerCase() || "";
    if (message.includes("format") && message.includes("version")) {
      searchTerms.push('"format_version"');
    }

    // Check for entity type mentions
    if (message.includes("entity type")) {
      searchTerms.push('"minecraft:entity"');
    }

    // Extract quoted terms from message or content
    const quotedTerms = (item.message || "").match(/"([^"]+)"/g);
    if (quotedTerms) {
      searchTerms.push(...quotedTerms);
    }

    const contentQuotedTerms = (item.content || "").match(/"([^"]+)"/g);
    if (contentQuotedTerms) {
      searchTerms.push(...contentQuotedTerms);
    }

    // Try each search term
    for (const term of searchTerms) {
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(term) || lines[i].includes(term.replace(/"/g, ""))) {
          return i + 1;
        }
      }
    }

    return undefined;
  }

  _handleIssueClick(info: IValidationIssueClickInfo) {
    const editor = this._jsonEditorRef.current?.editor;
    if (!editor) {
      return;
    }

    // Try to get file content
    let content = "";
    if (this.props.file?.content && typeof this.props.file.content === "string") {
      content = this.props.file.content;
    } else {
      // Try to get from editor model
      content = editor.getValue();
    }

    // Try to find the line number
    let lineNumber = info.lineNumber;

    if (!lineNumber && info.jsonPath) {
      lineNumber = this._findLineForJsonPath(content, info.jsonPath);
    }

    if (!lineNumber && info.item.content) {
      lineNumber = this._findLineFromIssueContent(content, info.item.content);
    }

    // Try keyword-based search from message
    if (!lineNumber) {
      lineNumber = this._findLineFromKeywords(content, info.item);
    }

    if (lineNumber) {
      // Navigate to the line
      editor.revealLineInCenter(lineNumber);
      editor.setPosition({ lineNumber, column: 1 });
      editor.focus();

      // Highlight the line briefly
      const decorations = editor.createDecorationsCollection([
        {
          range: new monaco.Range(lineNumber, 1, lineNumber, 1),
          options: {
            isWholeLine: true,
            className: "jewv-highlight-line",
            glyphMarginClassName: "jewv-highlight-glyph",
          },
        },
      ]);

      // Remove highlight after a short delay
      setTimeout(() => {
        decorations.clear();
      }, 2000);
    } else {
      // If we can't find a line, just focus the editor
      editor.focus();
    }
  }

  async persist(): Promise<boolean> {
    if (this._jsonEditorRef.current) {
      return this._jsonEditorRef.current.persist();
    }
    return false;
  }

  render() {
    const totalHeight = `calc(100vh - ${this.props.heightOffset}px)`;
    const editorHeight = `calc((100vh - ${this.props.heightOffset}px) * ${EDITOR_HEIGHT_PERCENT / 100})`;
    const panelHeight = `calc((100vh - ${this.props.heightOffset}px) * ${PANEL_HEIGHT_PERCENT / 100})`;

    // Calculate height offset for the JsonEditor (its original heightOffset plus the panel height)
    const editorHeightOffset = this.props.heightOffset;

    return (
      <div className="jewv-container" style={{ height: totalHeight }}>
        <div className="jewv-editor" style={{ height: editorHeight }}>
          <JsonEditor
            ref={this._jsonEditorRef}
            heightOffset={
              editorHeightOffset +
              Math.round(((window.innerHeight - this.props.heightOffset) * PANEL_HEIGHT_PERCENT) / 100)
            }
            readOnly={this.props.readOnly}
            project={this.props.project}
            theme={this.props.theme}
            preferredTextSize={this.props.preferredTextSize}
            livePreviewWidth={this.props.livePreviewWidth}
            item={this.props.item}
            file={this.props.file}
            navigationTarget={this.props.navigationTarget}
            setActivePersistable={this.props.setActivePersistable}
            onUpdatePreferredTextSize={this.props.onUpdatePreferredTextSize}
            onUpdateLivePreviewWidth={this.props.onUpdateLivePreviewWidth}
            onOpenProjectItem={this.props.onOpenProjectItem}
            intl={this.props.intl}
          />
        </div>
        <ValidationIssuesPanel
          theme={this.props.theme}
          infoSet={this.props.infoSet}
          issues={this.state.issues}
          height={panelHeight}
          onIssueClick={this._handleIssueClick}
        />
      </div>
    );
  }
}

export default withLocalization(JsonEditorWithValidation);
