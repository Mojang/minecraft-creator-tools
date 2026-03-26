import React from "react";

/**
 * Returns onKeyDown + role + tabIndex props so a non-button element
 * behaves like an accessible click target (Enter / Space triggers the handler).
 *
 * Usage:
 * ```tsx
 * <div onClick={handler} {...clickableKeyHandler(handler)}>
 * ```
 */
export function clickableKeyHandler(handler: () => void) {
  return {
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handler();
      }
    },
    role: "button" as const,
    tabIndex: 0,
  };
}
