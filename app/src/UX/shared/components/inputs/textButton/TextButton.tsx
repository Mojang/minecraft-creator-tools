import { Link, LinkProps } from "@mui/material";
import { KeyboardEvent } from "react";

export default function TextButton(props: LinkProps) {
  const { sx, ...other } = props;

  // A MUI Link with no href renders a plain <a> with no href attribute, which
  // browsers leave out of the tab order — the control then works with a mouse
  // but cannot be reached or activated with a keyboard (WCAG 2.1.1). When it
  // acts as an action (no href) expose it as a focusable button: role + tabIndex
  // place it in the tab order, and the key handler activates it on Enter/Space
  // the way a native button does. The <a> element is intentionally kept so the
  // surrounding link styling (e.g. footer "& a" rules) and content nesting are
  // unaffected.
  const isAction = other.href === undefined;

  const handleKeyDown = (event: KeyboardEvent<HTMLAnchorElement>) => {
    if (isAction && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      event.currentTarget.click();
    }
    other.onKeyDown?.(event);
  };

  return (
    <Link
      sx={{
        textDecoration: "none",
        "&:hover": {
          cursor: "pointer",
          textDecoration: "underline",
        },
        "&:focus-visible": {
          outline: "2px solid currentColor",
          outlineOffset: 2,
        },
        ...sx,
      }}
      {...(isAction ? { role: "button", tabIndex: 0 } : {})}
      {...other}
      onKeyDown={handleKeyDown}
    >
      {props.children}
    </Link>
  );
}
