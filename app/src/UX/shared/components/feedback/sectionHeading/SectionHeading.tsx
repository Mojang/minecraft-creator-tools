import { ReactNode } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import "./SectionHeading.css";

export type SectionHeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

interface ISectionHeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  /** Heading level 1–6. Pick so the page nests h1 → h2 → h3 without skips. Defaults to 2. */
  level?: SectionHeadingLevel;
  /** Optional leading icon (matches the icon many styled section headers already render). */
  icon?: IconDefinition;
  /** Class for the leading icon (e.g. the existing `*-sectionIcon` class). */
  iconClassName?: string;
  children?: ReactNode;
}

/**
 * Semantic section/view heading.
 *
 * Many panels render text that *looks* like a heading inside a styled `<div>`,
 * which is invisible to screen-reader heading navigation (WCAG 1.3.1). Use this
 * instead: it renders a real `<h1>`–`<h6>` while keeping the call site's visual
 * styling (pass the existing class via `className`) and any leading icon. The
 * base class only neutralizes the browser's default heading margin so a styled
 * `<div>` can be swapped for a heading with no visual change — the call site's
 * class still owns font size/weight/color.
 */
export default function SectionHeading({
  level = 2,
  icon,
  iconClassName,
  className,
  children,
  ...rest
}: ISectionHeadingProps) {
  const Tag = `h${level}` as const;
  const classes = "msh-sectionHeading" + (className ? " " + className : "");

  return (
    <Tag className={classes} {...rest}>
      {icon && <FontAwesomeIcon icon={icon} className={iconClassName} />}
      {children}
    </Tag>
  );
}
