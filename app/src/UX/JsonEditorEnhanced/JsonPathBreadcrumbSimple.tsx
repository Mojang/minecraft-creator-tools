/**
 * JsonPathBreadcrumbSimple.tsx
 *
 * A simplified breadcrumb component that shows the JSON path at the cursor position.
 * This is a standalone implementation that doesn't depend on the other provider files.
 */

import React, { useState, useEffect } from "react";
import * as monaco from "monaco-editor";
import IProjectTheme from "../types/IProjectTheme";
import { jsonPathResolver } from "./JsonPathResolver";
import Log from "../../core/Log";

/**
 * Props for JsonPathBreadcrumb component
 */
export interface IJsonPathBreadcrumbProps {
  editor: monaco.editor.IStandaloneCodeEditor | null;
  theme: IProjectTheme;
  onNavigate?: (path: string[], offset: number) => void;
  showCopyButton?: boolean;
  maxSegments?: number;
}

/**
 * Internal state for breadcrumb segment
 */
interface IBreadcrumbSegment {
  label: string;
  path: string[];
  offset: number;
  isComponent: boolean;
  isArray: boolean;
  isRoot: boolean;
}

/**
 * Simple JSON path parsing from cursor position
 */
function getJsonPathAtOffset(text: string, offset: number): string[] {
  return jsonPathResolver.getPathAtOffset(text, offset).path;
}

/**
 * A simple breadcrumb navigation component for JSON documents.
 */
export function JsonPathBreadcrumb({
  editor,
  theme,
  onNavigate,
  showCopyButton = true,
  maxSegments = 10,
}: IJsonPathBreadcrumbProps) {
  const [segments, setSegments] = useState<IBreadcrumbSegment[]>([]);

  useEffect(() => {
    if (!editor) {
      setSegments([]);
      return;
    }

    const updateBreadcrumb = () => {
      const model = editor.getModel();
      const position = editor.getPosition();

      if (!model || !position) {
        setSegments([]);
        return;
      }

      const text = model.getValue();
      const offset = model.getOffsetAt(position);

      const path = getJsonPathAtOffset(text, offset);

      // Build segments
      const newSegments: IBreadcrumbSegment[] = [
        { label: "Root", path: [], offset: 0, isComponent: false, isArray: false, isRoot: true },
      ];

      let currentPath: string[] = [];
      for (const segment of path) {
        currentPath = [...currentPath, segment];

        const isComponent = segment.startsWith("minecraft:");
        const isArray = /^\d+$/.test(segment);

        let label = segment;
        if (isArray) {
          label = `[${segment}]`;
        } else if (isComponent) {
          label = segment.replace("minecraft:", "mc:");
        }

        newSegments.push({
          label,
          path: currentPath,
          offset: 0, // Simplified - not calculating exact offset
          isComponent,
          isArray,
          isRoot: false,
        });
      }

      // Limit segments if needed
      if (newSegments.length > maxSegments) {
        const truncated = [newSegments[0], { ...newSegments[1], label: "..." }, ...newSegments.slice(-maxSegments + 2)];
        setSegments(truncated);
      } else {
        setSegments(newSegments);
      }
    };

    // Initial update
    updateBreadcrumb();

    // Subscribe to cursor changes
    const disposable = editor.onDidChangeCursorPosition(updateBreadcrumb);

    return () => {
      disposable.dispose();
    };
  }, [editor, maxSegments]);

  const handleCopyPath = async () => {
    if (segments.length > 1) {
      const pathStr = segments
        .slice(1)
        .map((s) => s.label)
        .join(" > ");
      try {
        await navigator.clipboard.writeText(pathStr);
      } catch {
        Log.debug("Failed to copy to clipboard");
      }
    }
  };

  const handleSegmentClick = (segment: IBreadcrumbSegment) => {
    if (onNavigate) {
      onNavigate(segment.path, segment.offset);
    }
  };

  if (segments.length === 0) {
    return (
      <div className="jpb-container">
        <span className="jpb-empty">No path</span>
      </div>
    );
  }

  return (
    <div className="jpb-container">
      <div className="jpb-segments">
        {segments.map((segment, index) => (
          <React.Fragment key={index}>
            {index > 0 && <span className="jpb-separator">›</span>}
            <span
              className={`jpb-segment ${segment.isRoot ? "root" : ""} ${segment.isComponent ? "component" : ""} ${
                segment.isArray ? "array" : ""
              } ${index === segments.length - 1 ? "current" : ""}`}
              onClick={() => handleSegmentClick(segment)}
            >
              {segment.label}
            </span>
          </React.Fragment>
        ))}
      </div>
      {showCopyButton && segments.length > 1 && (
        <button className="jpb-copy-btn" onClick={handleCopyPath} title="Copy path" aria-label="Copy path">
          📋
        </button>
      )}
    </div>
  );
}
