/**
 * Higher-Order Component (HOC) for injecting MUI Theme into class components
 *
 * This HOC is part of the Fluent UI Northstar → Material UI migration.
 * It allows class components to access the MUI theme without converting to functional components.
 *
 * @see docs/NorthstarToMuiMigration.md
 *
 * Usage:
 * ```tsx
 * import { withMuiTheme, WithMuiThemeProps } from "../hoc/withMuiTheme";
 *
 * interface IMyEditorProps extends WithMuiThemeProps {
 *   // your existing props
 * }
 *
 * class MyEditor extends Component<IMyEditorProps> {
 *   render() {
 *     const { muiTheme } = this.props;
 *     const isDark = muiTheme.palette.mode === "dark";
 *     // ...
 *   }
 * }
 *
 * export default withMuiTheme(MyEditor);
 * ```
 */

import React, { ComponentType } from "react";
import { Theme, useTheme } from "@mui/material";

/**
 * Props injected by the withMuiTheme HOC
 */
export interface WithMuiThemeProps {
  /**
   * The MUI Theme object, providing access to palette, typography, spacing, etc.
   */
  muiTheme: Theme;
}

/**
 * HOC that wraps a class component and injects the MUI theme as a prop.
 *
 * @param WrappedComponent - The class component to wrap
 * @returns A functional component that passes muiTheme to the wrapped component
 */
export function withMuiTheme<P extends WithMuiThemeProps>(
  WrappedComponent: ComponentType<P>
): React.FC<Omit<P, keyof WithMuiThemeProps>> {
  const displayName = WrappedComponent.displayName || WrappedComponent.name || "Component";

  const WithMuiThemeWrapper: React.FC<Omit<P, keyof WithMuiThemeProps>> = (props) => {
    const muiTheme = useTheme();

    return <WrappedComponent {...(props as P)} muiTheme={muiTheme} />;
  };

  WithMuiThemeWrapper.displayName = `withMuiTheme(${displayName})`;

  return WithMuiThemeWrapper;
}

export default withMuiTheme;
