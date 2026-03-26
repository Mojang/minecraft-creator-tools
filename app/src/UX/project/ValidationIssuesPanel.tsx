/**
 * ValidationIssuesPanel - Compact scrollable list of validation issues for a project item
 *
 * ARCHITECTURE:
 * This component displays validation issues (errors, warnings, recommendations) for a single
 * project item in a compact, scrollable format designed to be used alongside a code editor.
 *
 * USAGE:
 * - Used in JsonEditorWithValidation as the bottom 20% panel
 * - Each issue is clickable and will trigger onIssueClick with JSON path info
 * - Issues with line number info can navigate to specific lines in the editor
 *
 * RELATED FILES:
 * - JsonEditorWithValidation.tsx - Parent component that combines this with JsonEditor
 * - ProjectInfoItem.ts - The validation issue data structure
 * - ProjectInfoSet.ts - Provides validation items by storage path
 * - ProjectInfoItemDisplay.tsx - Full-featured issue display (this is a compact version)
 */

import { Component } from "react";
import "./ValidationIssuesPanel.css";
import ProjectInfoItem from "../../info/ProjectInfoItem";
import ProjectInfoSet from "../../info/ProjectInfoSet";
import { InfoItemType } from "../../info/IInfoItemData";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { getThemeColors } from "../hooks/theme/useThemeColors";
import {
  faCircleExclamation,
  faCircleQuestion,
  faCircleArrowUp,
  faCircleInfo,
} from "@fortawesome/free-solid-svg-icons";
import IProjectTheme from "../types/IProjectTheme";

export interface IValidationIssueClickInfo {
  item: ProjectInfoItem;
  jsonPath?: string;
  lineNumber?: number;
}

interface IValidationIssuesPanelProps {
  theme: IProjectTheme;
  infoSet: ProjectInfoSet;
  issues: ProjectInfoItem[];
  height: string;
  onIssueClick?: (info: IValidationIssueClickInfo) => void;
}

interface IValidationIssuesPanelState {}

export default class ValidationIssuesPanel extends Component<IValidationIssuesPanelProps, IValidationIssuesPanelState> {
  constructor(props: IValidationIssuesPanelProps) {
    super(props);

    this._handleIssueClick = this._handleIssueClick.bind(this);
  }

  _handleIssueClick(issue: ProjectInfoItem) {
    if (this.props.onIssueClick) {
      // Try to extract JSON path from the content if available
      // The content often contains a JSON path like "($.minecraft:entity.components)" at the start
      let jsonPath: string | undefined;
      let lineNumber: number | undefined;

      const content = issue.content;
      if (content) {
        // Try to extract JSON path from content - often in format "($.<path>)" at the start
        const pathMatch = content.match(/^\(\$\.([^)]+)\)/);
        if (pathMatch) {
          jsonPath = "$." + pathMatch[1];
        }
      }

      this.props.onIssueClick({
        item: issue,
        jsonPath,
        lineNumber,
      });
    }
  }

  _getTypeIcon(itemType: InfoItemType) {
    switch (itemType) {
      case InfoItemType.error:
      case InfoItemType.internalProcessingError:
        return <FontAwesomeIcon icon={faCircleExclamation} className="vip-icon vip-icon-error" />;
      case InfoItemType.warning:
        return <FontAwesomeIcon icon={faCircleQuestion} className="vip-icon vip-icon-warning" />;
      case InfoItemType.recommendation:
        return <FontAwesomeIcon icon={faCircleArrowUp} className="vip-icon vip-icon-recommendation" />;
      case InfoItemType.info:
      default:
        return <FontAwesomeIcon icon={faCircleInfo} className="vip-icon vip-icon-info" />;
    }
  }

  _getTypeClass(itemType: InfoItemType): string {
    switch (itemType) {
      case InfoItemType.error:
      case InfoItemType.internalProcessingError:
        return "vip-issue vip-issue-error";
      case InfoItemType.warning:
        return "vip-issue vip-issue-warning";
      case InfoItemType.recommendation:
        return "vip-issue vip-issue-recommendation";
      case InfoItemType.info:
      default:
        return "vip-issue vip-issue-info";
    }
  }

  render() {
    const { issues, infoSet } = this.props;
    const colors = getThemeColors();

    // Count by type
    const errorCount = issues.filter(
      (i) => i.itemType === InfoItemType.error || i.itemType === InfoItemType.internalProcessingError
    ).length;
    const warningCount = issues.filter((i) => i.itemType === InfoItemType.warning).length;
    const recommendationCount = issues.filter((i) => i.itemType === InfoItemType.recommendation).length;
    const infoCount = issues.filter((i) => i.itemType === InfoItemType.info).length;
    const failedCount = issues.filter((i) => i.itemType === InfoItemType.testCompleteFail).length;

    const issueElements = issues.map((issue, index) => {
      const message = infoSet.getEffectiveMessage(issue);
      const topicData = ProjectInfoSet.getTopicData(issue.generatorId, issue.generatorIndex);
      const errorCode = `${issue.generatorId}${issue.generatorIndex}`;

      return (
        <div
          key={`issue-${index}`}
          className={this._getTypeClass(issue.itemType)}
          onClick={() => this._handleIssueClick(issue)}
          title={`${errorCode}: ${message}${issue.content ? "\n" + issue.content : ""}`}
        >
          <span className="vip-issue-icon">{this._getTypeIcon(issue.itemType)}</span>
          <span className="vip-issue-code">{errorCode}</span>
          <span className="vip-issue-message">{message}</span>
          {issue.content && <span className="vip-issue-content">{issue.contentSummary}</span>}
        </div>
      );
    });

    return (
      <div
        className="vip-container"
        style={{
          height: this.props.height,
          backgroundColor: colors.background2,
          borderTopColor: colors.background3,
        }}
      >
        <div
          className="vip-header"
          style={{
            backgroundColor: colors.background1,
            borderBottomColor: colors.background3,
          }}
        >
          <span className="vip-title">Validation Issues</span>
          <span className="vip-counts">
            {failedCount > 0 && <span className="vip-count vip-count-error">{failedCount} failed</span>}
            {errorCount > 0 && <span className="vip-count vip-count-error">{errorCount} errors</span>}
            {warningCount > 0 && <span className="vip-count vip-count-warning">{warningCount} warnings</span>}
            {recommendationCount > 0 && (
              <span className="vip-count vip-count-recommendation">{recommendationCount} recommendations</span>
            )}
            {infoCount > 0 && <span className="vip-count vip-count-info">{infoCount} info</span>}
          </span>
        </div>
        <div className="vip-issues-list">{issueElements}</div>
      </div>
    );
  }
}
