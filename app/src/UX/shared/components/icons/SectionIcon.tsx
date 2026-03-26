/* ═══════════════════════════════════════════════════════════════════════════
   SECTION ICON - Inline SVG icons for section headers in live previews

   Provides clean, monochrome SVG icons for use in section headers across
   all LivePreview components (EntityType, BlockType, ManifestLivePreview, etc).

   Design principles:
   - 16x16 viewBox, stroke-based (line art)
   - Uses currentColor so icons adapt to theme colors
   - Renders inline with text (display: inline-block, vertical-align: middle)
   - Each icon is a simple, recognizable shape at small sizes

   Usage:
     <SectionIcon type="chart" size={14} />
     <SectionIcon type="lightning" />

   See: docs/ux/Components.md
   ═══════════════════════════════════════════════════════════════════════════ */

import React from "react";

export interface ISectionIconProps {
  /** Icon type identifier */
  type: string;
  /** Icon size in pixels (default: 14) */
  size?: number;
  /** Optional CSS class */
  className?: string;
}

/**
 * Renders a small inline SVG icon for section headers and labels.
 * All icons use `currentColor` and adapt to surrounding text color.
 */
export default function SectionIcon({ type, size = 14, className }: ISectionIconProps): JSX.Element {
  const svgStyle: React.CSSProperties = {
    display: "inline-block",
    verticalAlign: "middle",
    flexShrink: 0,
  };

  const svgProps: React.SVGProps<SVGSVGElement> = {
    width: size,
    height: size,
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className: className || "",
    style: svgStyle,
    "aria-hidden": true,
  };

  const content = getIconContent(type);

  return <svg {...svgProps}>{content}</svg>;
}

function getIconContent(type: string): React.ReactNode {
  switch (type) {
    // ── Data & Statistics ──────────────────────────────────────────────
    case "chart":
      // Bar chart - three vertical bars
      return (
        <>
          <rect x="2" y="9" width="3" height="5" rx="0.5" />
          <rect x="6.5" y="5" width="3" height="9" rx="0.5" />
          <rect x="11" y="2" width="3" height="12" rx="0.5" />
        </>
      );

    // ── Containers & Structure ─────────────────────────────────────────
    case "cube":
      // 3D isometric cube
      return (
        <>
          <path d="M8 1.5L14 5v6.5L8 15 2 11.5V5Z" />
          <path d="M8 8.5L14 5" />
          <path d="M8 8.5L2 5" />
          <path d="M8 8.5V15" />
        </>
      );

    case "folder":
      // Folder shape
      return <path d="M2 4.5h4l1.5-2H14v10H2z" />;

    case "grid":
      // 2x2 grid
      return (
        <>
          <rect x="2" y="2" width="12" height="12" rx="1" />
          <line x1="8" y1="2" x2="8" y2="14" />
          <line x1="2" y1="8" x2="14" y2="8" />
        </>
      );

    // ── Actions & Events ───────────────────────────────────────────────
    case "lightning":
      // Lightning bolt
      return <path d="M9.5 1.5L4 8.5h4L6.5 14.5 12 7.5H8z" />;

    case "refresh":
      // Circular refresh arrows
      return (
        <>
          <path d="M13 3.5A6 6 0 1 0 14 8" />
          <path d="M13 1v3h-3" />
        </>
      );

    case "shuffle":
      // Crossed arrows (shapeless)
      return (
        <>
          <path d="M3 4h7l3 3.5-3 3.5" />
          <path d="M3 12h7" />
          <path d="M11 2l3 2-3 2" />
          <path d="M11 10l3 2-3 2" />
        </>
      );

    // ── Feedback & Status ──────────────────────────────────────────────
    case "warning":
      // Triangle with exclamation
      return (
        <>
          <path d="M8 2L14.5 13.5h-13z" />
          <line x1="8" y1="6.5" x2="8" y2="9.5" />
          <circle cx="8" cy="11.5" r="0.7" fill="currentColor" stroke="none" />
        </>
      );

    case "error":
      // Circle with X
      return (
        <>
          <circle cx="8" cy="8" r="6" />
          <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" />
        </>
      );

    case "check":
      // Checkmark
      return <path d="M3 8.5L6.5 12 13 4" />;

    // ── Building & Materials ───────────────────────────────────────────
    case "block":
      // Brick pattern
      return (
        <>
          <rect x="2" y="2" width="12" height="12" rx="1" />
          <line x1="2" y1="7" x2="14" y2="7" />
          <line x1="8" y1="2" x2="8" y2="7" />
          <line x1="5" y1="7" x2="5" y2="12" />
          <line x1="11" y1="7" x2="11" y2="12" />
        </>
      );

    // ── Mechanical & Settings ──────────────────────────────────────────
    case "gear":
      // Gear / cog
      return (
        <>
          <circle cx="8" cy="8" r="2.5" />
          <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.8 3.8l1.4 1.4M10.8 10.8l1.4 1.4M3.8 12.2l1.4-1.4M10.8 5.2l1.4-1.4" />
        </>
      );

    // ── Measurement ────────────────────────────────────────────────────
    case "ruler":
      // Ruler with tick marks
      return (
        <>
          <rect x="1" y="4" width="14" height="8" rx="1" />
          <line x1="4" y1="4" x2="4" y2="7.5" />
          <line x1="8" y1="4" x2="8" y2="8.5" />
          <line x1="12" y1="4" x2="12" y2="7.5" />
        </>
      );

    case "scale":
      // Balance scale
      return (
        <>
          <line x1="8" y1="2" x2="8" y2="14" />
          <line x1="5" y1="14" x2="11" y2="14" />
          <path d="M3 5l5-2 5 2" />
          <path d="M1.5 9L3 5l1.5 4z" />
          <path d="M11.5 9L13 5l1.5 4z" />
        </>
      );

    // ── Art & Visual ───────────────────────────────────────────────────
    case "palette":
      // Paint palette / color circle with brush stroke
      return (
        <>
          <circle cx="8" cy="8" r="6" />
          <circle cx="5.5" cy="6" r="1" fill="currentColor" stroke="none" />
          <circle cx="8" cy="4.5" r="1" fill="currentColor" stroke="none" />
          <circle cx="10.5" cy="6" r="1" fill="currentColor" stroke="none" />
          <circle cx="5.5" cy="9.5" r="1" fill="currentColor" stroke="none" />
        </>
      );

    case "image":
      // Picture frame with mountain/sun
      return (
        <>
          <rect x="2" y="3" width="12" height="10" rx="1" />
          <circle cx="5.5" cy="6" r="1.5" />
          <path d="M2 11l3.5-3.5L8 10l2.5-3L14 11" />
        </>
      );

    // ── Geometry & Shape ───────────────────────────────────────────────
    case "triangle":
      // Protractor / triangle ruler
      return (
        <>
          <path d="M2 14L2 3l11 11z" />
          <path d="M2 9h5" />
        </>
      );

    // ── Animation & Media ──────────────────────────────────────────────
    case "film":
      // Film strip / clapperboard
      return (
        <>
          <rect x="2" y="3" width="12" height="11" rx="1" />
          <line x1="2" y1="7" x2="14" y2="7" />
          <line x1="5" y1="3" x2="7" y2="7" />
          <line x1="9" y1="3" x2="11" y2="7" />
        </>
      );

    case "gamepad":
      // Game controller
      return (
        <>
          <path d="M4 5h8a3 3 0 0 1 3 3v1a3 3 0 0 1-3 3H4a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3z" />
          <circle cx="10.5" cy="8.5" r="1" fill="currentColor" stroke="none" />
          <line x1="5" y1="7" x2="5" y2="10" />
          <line x1="3.5" y1="8.5" x2="6.5" y2="8.5" />
        </>
      );

    // ── Effects & Particles ────────────────────────────────────────────
    case "sparkle":
      // Four-point sparkle / star
      return (
        <>
          <path d="M8 1.5L9.5 6.5 14.5 8 9.5 9.5 8 14.5 6.5 9.5 1.5 8 6.5 6.5z" />
        </>
      );

    case "lightbulb":
      // Light bulb
      return (
        <>
          <path d="M6 12h4M6.5 14h3" />
          <path d="M5 10c-1.5-1.2-2-3-2-4.5C3 3 5.2 1 8 1s5 2 5 4.5c0 1.5-.5 3.3-2 4.5-.5.5-.7 1.3-1 2H6c-.3-.7-.5-1.5-1-2z" />
        </>
      );

    // ── Audio ──────────────────────────────────────────────────────────
    case "speaker":
      // Speaker with sound waves
      return (
        <>
          <path d="M3 6h2l4-3v10l-4-3H3z" />
          <path d="M11 5.5a3 3 0 0 1 0 5" />
          <path d="M12.5 3.5a6 6 0 0 1 0 9" />
        </>
      );

    case "music":
      // Music note
      return (
        <>
          <path d="M6 12V4l7-2v8" />
          <circle cx="4.5" cy="12" r="2" />
          <circle cx="11.5" cy="10" r="2" />
        </>
      );

    case "broadcast":
      // Broadcast / radio waves
      return (
        <>
          <circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none" />
          <path d="M4.5 4.5a5 5 0 0 1 7 0" />
          <path d="M3 3a7.5 7.5 0 0 1 10 0" />
          <path d="M4.5 11.5a5 5 0 0 0 7 0" />
          <path d="M3 13a7.5 7.5 0 0 0 10 0" />
        </>
      );

    // ── Nature & World ─────────────────────────────────────────────────
    case "tree":
      // Simple tree shape
      return (
        <>
          <path d="M8 1L3 7h2.5L3 10h2l-1.5 3h9L11 10h2l-2.5-3H13z" />
          <line x1="8" y1="13" x2="8" y2="15" />
        </>
      );

    case "globe":
      // Globe / world sphere
      return (
        <>
          <circle cx="8" cy="8" r="6" />
          <ellipse cx="8" cy="8" rx="3" ry="6" />
          <path d="M2.5 5.5h11" />
          <path d="M2.5 10.5h11" />
        </>
      );

    case "sun":
      // Sun with rays
      return (
        <>
          <circle cx="8" cy="8" r="3" />
          <path d="M8 2v2M8 12v2M2 8h2M12 8h2M4 4l1.5 1.5M10.5 10.5L12 12M4 12l1.5-1.5M10.5 5.5L12 4" />
        </>
      );

    case "egg":
      // Egg / spawn shape
      return <ellipse cx="8" cy="8.5" rx="4.5" ry="5.5" />;

    case "flame":
      // Fire / flame
      return <path d="M8 2C6 5 4 7 4 9.5a4 4 0 0 0 8 0c0-1.5-.5-2.5-1.5-3.5.5 1.5 0 3-1 3.5 1-2.5-.5-5-1.5-7.5z" />;

    case "diamond":
      // Diamond / gem shape
      return (
        <>
          <path d="M3 6l5-4 5 4-5 8z" />
          <path d="M3 6h10" />
          <path d="M5 2L6.5 6 8 14" />
          <path d="M11 2L9.5 6 8 14" />
        </>
      );

    // ── People & Entities ──────────────────────────────────────────────
    case "figure":
      // Entity / creature silhouette
      return (
        <>
          <circle cx="8" cy="4" r="2.5" />
          <path d="M4 14c0-3 1.5-5 4-5s4 2 4 5" />
        </>
      );

    case "person":
      // Person head + shoulders (profile)
      return (
        <>
          <circle cx="8" cy="5.5" r="3" />
          <path d="M2 14.5c0-3 2.5-5 6-5s6 2 6 5" />
        </>
      );

    case "herd":
      // Group of people
      return (
        <>
          <circle cx="6" cy="5" r="2" />
          <path d="M2 12c0-2 1.5-4 4-4s4 2 4 4" />
          <circle cx="11" cy="4" r="2" />
          <path d="M8 11c0-2 1.2-3.5 3-3.5s3 1.5 3 3.5" />
        </>
      );

    // ── Documents & Code ───────────────────────────────────────────────
    case "scroll":
      // Scroll / script
      return (
        <>
          <path d="M4 2.5h9a1 1 0 0 1 1 1v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4.5a2 2 0 0 1 2-2z" />
          <line x1="6" y1="6" x2="11" y2="6" />
          <line x1="6" y1="8.5" x2="11" y2="8.5" />
          <line x1="6" y1="11" x2="9" y2="11" />
        </>
      );

    case "clipboard":
      // Clipboard
      return (
        <>
          <rect x="3" y="3" width="10" height="11" rx="1" />
          <path d="M6 1.5h4v3H6z" />
          <line x1="6" y1="7" x2="10" y2="7" />
          <line x1="6" y1="9.5" x2="10" y2="9.5" />
        </>
      );

    // ── Objects & Items ────────────────────────────────────────────────
    case "chest":
      // Treasure chest
      return (
        <>
          <rect x="2" y="6" width="12" height="8" rx="1" />
          <path d="M2 9h12" />
          <rect x="6.5" y="8" width="3" height="2" rx="0.5" />
          <path d="M3 6c0-2 2-4 5-4s5 2 5 4" />
        </>
      );

    case "gift":
      // Gift box
      return (
        <>
          <rect x="2" y="6" width="12" height="8" rx="1" />
          <rect x="1.5" y="4" width="13" height="3" rx="1" />
          <line x1="8" y1="4" x2="8" y2="14" />
          <path d="M8 4c-1-2-3-3-4-2" />
          <path d="M8 4c1-2 3-3 4-2" />
        </>
      );

    case "key":
      // Key
      return (
        <>
          <circle cx="5" cy="6" r="3" />
          <path d="M7.5 7.5L14 14" />
          <path d="M11 11l2-1" />
          <path d="M12.5 12.5l2-1" />
        </>
      );

    case "tag":
      // Label / tag
      return (
        <>
          <path d="M2 3v5l7 6 5-5-7-7z" />
          <circle cx="5" cy="6" r="1" fill="currentColor" stroke="none" />
        </>
      );

    case "link":
      // Chain link
      return (
        <>
          <path d="M7 9l2-2" />
          <path d="M9.5 4.5l-1 1a2.5 2.5 0 0 0 0 3.5l0 0a2.5 2.5 0 0 0 3.5 0l1-1" />
          <path d="M6.5 11.5l-1 1a2.5 2.5 0 0 1-3.5 0l0 0a2.5 2.5 0 0 1 0-3.5l1-1" />
        </>
      );

    case "backpack":
      // Backpack / attachable
      return (
        <>
          <rect x="3" y="5" width="10" height="9" rx="2" />
          <path d="M5.5 5c0-2 1-3.5 2.5-3.5S10.5 3 10.5 5" />
          <rect x="5" y="8" width="6" height="3" rx="1" />
        </>
      );

    // ── Tools ──────────────────────────────────────────────────────────
    case "hammer":
      // Hammer
      return (
        <>
          <path d="M3 13L9.5 6.5" />
          <rect x="9" y="2" width="5" height="4" rx="1" transform="rotate(15 11.5 4)" />
        </>
      );

    case "flask":
      // Erlenmeyer flask / brewing
      return (
        <>
          <path d="M6 2h4v4l3 7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1l3-7z" />
          <line x1="5" y1="2" x2="11" y2="2" />
        </>
      );

    // ── Navigation & Location ──────────────────────────────────────────
    case "pin":
      // Map pin
      return (
        <>
          <path d="M8 14.5s-5-4-5-7.5a5 5 0 0 1 10 0c0 3.5-5 7.5-5 7.5z" />
          <circle cx="8" cy="7" r="1.5" />
        </>
      );

    case "dice":
      // Die face
      return (
        <>
          <rect x="2" y="2" width="12" height="12" rx="2" />
          <circle cx="5.5" cy="5.5" r="1" fill="currentColor" stroke="none" />
          <circle cx="10.5" cy="5.5" r="1" fill="currentColor" stroke="none" />
          <circle cx="8" cy="8" r="1" fill="currentColor" stroke="none" />
          <circle cx="5.5" cy="10.5" r="1" fill="currentColor" stroke="none" />
          <circle cx="10.5" cy="10.5" r="1" fill="currentColor" stroke="none" />
        </>
      );

    case "clock":
      // Clock face
      return (
        <>
          <circle cx="8" cy="8" r="6" />
          <path d="M8 4v4l2.5 2.5" />
        </>
      );

    case "eye":
      // Eye / visibility
      return (
        <>
          <path d="M2 8s2.5-4.5 6-4.5S14 8 14 8s-2.5 4.5-6 4.5S2 8 2 8z" />
          <circle cx="8" cy="8" r="2" />
        </>
      );

    // ── I/O ────────────────────────────────────────────────────────────
    case "inbox":
      // Tray with down arrow
      return (
        <>
          <path d="M3 9l-1 4h12l-1-4" />
          <path d="M8 2v7" />
          <path d="M5.5 6.5L8 9l2.5-2.5" />
        </>
      );

    case "outbox":
      // Tray with up arrow
      return (
        <>
          <path d="M3 9l-1 4h12l-1-4" />
          <path d="M8 9V2" />
          <path d="M5.5 4.5L8 2l2.5 2.5" />
        </>
      );

    case "stone":
      // Stone / chisel
      return (
        <>
          <rect x="2" y="5" width="8" height="8" rx="1" />
          <path d="M12 3l2 2-5 5" />
        </>
      );

    case "question":
      // Question mark in circle
      return (
        <>
          <circle cx="8" cy="8" r="6" />
          <path d="M6 6a2 2 0 0 1 4 0c0 1.5-2 1.5-2 3" />
          <circle cx="8" cy="11.5" r="0.7" fill="currentColor" stroke="none" />
        </>
      );

    case "pool":
      // Pool / collection circle
      return (
        <>
          <circle cx="8" cy="8" r="6" />
          <circle cx="6" cy="6.5" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="10" cy="6.5" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="8" cy="10" r="1.2" fill="currentColor" stroke="none" />
        </>
      );

    case "mobile":
      // Mobile device
      return (
        <>
          <rect x="4" y="1" width="8" height="14" rx="1.5" />
          <line x1="4" y1="4" x2="12" y2="4" />
          <line x1="4" y1="12" x2="12" y2="12" />
          <circle cx="8" cy="13.2" r="0.5" fill="currentColor" stroke="none" />
        </>
      );

    default:
      // Fallback: simple circle
      return <circle cx="8" cy="8" r="5" />;
  }
}
