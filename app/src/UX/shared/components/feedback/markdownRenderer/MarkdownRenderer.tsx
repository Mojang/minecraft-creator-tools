// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ARCHITECTURE DOCUMENTATION: MarkdownRenderer
 * =============================================
 *
 * A reusable React component for rendering Markdown content with support for:
 * - GitHub Flavored Markdown (tables, strikethrough, task lists)
 * - Syntax-highlighted code blocks with copy button
 * - Safe HTML rendering (XSS protection via react-markdown)
 * - Optimized for streaming content (debounced parsing)
 *
 * ## Usage:
 * ```tsx
 * <MarkdownRenderer content={markdownString} />
 * <MarkdownRenderer content={markdownString} isStreaming={true} />
 * ```
 *
 * ## Dependencies:
 * - react-markdown: Core markdown parser
 * - remark-gfm: GitHub Flavored Markdown support
 * - react-syntax-highlighter: Code block highlighting
 *
 * ## Streaming Performance:
 * When isStreaming={true}, the component debounces re-renders to prevent
 * excessive parsing during rapid delta updates. Once streaming ends, it
 * immediately renders the final content.
 *
 * ## Related Files:
 * - src/UXex/AgentChatPanel.tsx - Primary consumer for AI chat responses
 * - src/UX/MarkdownRenderer.css - Styles for rendered markdown
 */

import React, { memo, useState, useEffect, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus, vs } from "react-syntax-highlighter/dist/esm/styles/prism";
import "./MarkdownRenderer.css";
import Log from "../../../../../core/Log";

interface IMarkdownRendererProps {
  /** The markdown content to render */
  content: string;
  /** Optional additional CSS class */
  className?: string;
  /** Use dark theme for code blocks (default: true) */
  darkMode?: boolean;
  /** Whether content is currently streaming (enables debouncing) */
  isStreaming?: boolean;
  /** Debounce interval in ms when streaming (default: 100) */
  streamingDebounceMs?: number;
}

/**
 * Code block component with copy button.
 */
interface ICodeBlockProps {
  language: string;
  children: string;
  darkMode: boolean;
}

function CodeBlock({ language, children, darkMode }: ICodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);

      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Reset after 2 seconds
      timeoutRef.current = setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (err) {
      Log.debug("Failed to copy: " + err);

      // Fallback: show a brief visual indication that copy failed
      setCopied(false);
    }
  }, [children]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="code-block-wrapper">
      <div className="code-block-header">
        {language && <span className="code-language">{language}</span>}
        <button
          className={`copy-button ${copied ? "copied" : ""}`}
          onClick={handleCopy}
          title={copied ? "Copied!" : "Copy code"}
          aria-label={copied ? "Copied!" : "Copy code"}
        >
          {copied ? <span className="copy-icon">✓</span> : <span className="copy-icon">📋</span>}
        </button>
      </div>
      <SyntaxHighlighter
        style={darkMode ? vscDarkPlus : vs}
        language={language || "text"}
        PreTag="div"
        className="code-block"
        showLineNumbers={false}
        wrapLines={true}
        wrapLongLines={true}
      >
        {children}
      </SyntaxHighlighter>
    </div>
  );
}

/**
 * Renders markdown content with syntax highlighting for code blocks.
 * Optimized for streaming with debounced updates.
 */
function MarkdownRenderer({
  content,
  className,
  darkMode = true,
  isStreaming = false,
  streamingDebounceMs = 100,
}: IMarkdownRendererProps) {
  // For streaming, we debounce the content to prevent excessive re-renders
  const [debouncedContent, setDebouncedContent] = useState(content);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastContentRef = useRef(content);

  useEffect(() => {
    lastContentRef.current = content;

    if (!isStreaming) {
      // Not streaming - update immediately
      setDebouncedContent(content);
      return;
    }

    // Streaming - debounce updates
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      setDebouncedContent(lastContentRef.current);
    }, streamingDebounceMs);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [content, isStreaming, streamingDebounceMs]);

  // When streaming ends, immediately show final content
  useEffect(() => {
    if (!isStreaming && debouncedContent !== content) {
      setDebouncedContent(content);
    }
  }, [isStreaming, content, debouncedContent]);

  return (
    <div className={`markdown-renderer ${className || ""}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Custom code block renderer with syntax highlighting and copy button
          code({ node, inline, className: codeClassName, children, ...props }: any) {
            const match = /language-(\w+)/.exec(codeClassName || "");
            const language = match ? match[1] : "";
            const codeString = String(children).replace(/\n$/, "");

            // For inline code, render as simple <code>
            if (inline) {
              return (
                <code className="inline-code" {...props}>
                  {children}
                </code>
              );
            }

            // For code blocks, use syntax highlighter with copy button
            return (
              <CodeBlock language={language} darkMode={darkMode}>
                {codeString}
              </CodeBlock>
            );
          },

          // Custom link renderer to open in new tab
          a({ node, children, href, ...props }: any) {
            return (
              <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
                {children}
              </a>
            );
          },

          // Custom table renderer with wrapper for scrolling
          table({ node, children, ...props }: any) {
            return (
              <div className="table-wrapper">
                <table {...props}>{children}</table>
              </div>
            );
          },

          // Custom list item for task lists
          li({ node, children, checked, ...props }: any) {
            if (typeof checked === "boolean") {
              return (
                <li className="task-list-item" {...props}>
                  <input type="checkbox" checked={checked} readOnly />
                  {children}
                </li>
              );
            }
            return <li {...props}>{children}</li>;
          },
        }}
      >
        {debouncedContent}
      </ReactMarkdown>
    </div>
  );
}

// Memoize to prevent re-renders when parent updates but content hasn't changed
export default memo(MarkdownRenderer);
