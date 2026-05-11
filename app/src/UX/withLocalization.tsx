// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, { ComponentType } from "react";
import { useIntl, IntlShape } from "react-intl";

/**
 * Props injected by the withLocalization HOC
 */
export interface WithLocalizationProps {
  intl: IntlShape;
}

/**
 * Higher-Order Component that provides localization to class components.
 *
 * Usage:
 * ```typescript
 * interface MyComponentProps extends WithLocalizationProps {
 *   // ... other props
 * }
 *
 * class MyComponent extends Component<MyComponentProps> {
 *   render() {
 *     const { intl } = this.props;
 *     return <div>{intl.formatMessage({ id: "my.message.key" })}</div>;
 *   }
 * }
 *
 * export default withLocalization(MyComponent);
 * ```
 *
 * @param WrappedComponent - The class component to wrap with localization
 * @returns A new component with intl injected as a prop
 */
export function withLocalization<P extends WithLocalizationProps>(
  WrappedComponent: ComponentType<P>
): ComponentType<Omit<P, keyof WithLocalizationProps>> {
  const WithLocalizationComponent = (props: Omit<P, keyof WithLocalizationProps>) => {
    const intl = useIntl();

    // Cast props to include intl for the wrapped component
    return <WrappedComponent {...(props as P)} intl={intl} />;
  };

  // Set display name for debugging
  WithLocalizationComponent.displayName = `withLocalization(${
    WrappedComponent.displayName || WrappedComponent.name || "Component"
  })`;

  return WithLocalizationComponent;
}
