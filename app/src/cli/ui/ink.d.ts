/**
 * Type declarations for Ink and related packages
 * These ambient declarations allow TypeScript to resolve ESM-only Ink modules
 * when using moduleResolution: "node"
 */

declare module "ink" {
  import { FC, ReactNode } from "react";

  export interface BoxProps {
    flexDirection?: "row" | "column" | "row-reverse" | "column-reverse";
    flexGrow?: number;
    flexShrink?: number;
    flexBasis?: string | number;
    flexWrap?: "wrap" | "nowrap" | "wrap-reverse";
    alignItems?: "flex-start" | "flex-end" | "center" | "stretch";
    alignSelf?: "flex-start" | "flex-end" | "center" | "auto";
    justifyContent?: "flex-start" | "flex-end" | "center" | "space-between" | "space-around" | "space-evenly";
    width?: number | string;
    height?: number | string;
    minWidth?: number | string;
    minHeight?: number | string;
    padding?: number;
    paddingTop?: number;
    paddingBottom?: number;
    paddingLeft?: number;
    paddingRight?: number;
    paddingX?: number;
    paddingY?: number;
    margin?: number;
    marginTop?: number;
    marginBottom?: number;
    marginLeft?: number;
    marginRight?: number;
    marginX?: number;
    marginY?: number;
    gap?: number;
    borderStyle?: "single" | "double" | "round" | "bold" | "singleDouble" | "doubleSingle" | "classic" | "arrow";
    borderColor?: string;
    borderTop?: boolean;
    borderBottom?: boolean;
    borderLeft?: boolean;
    borderRight?: boolean;
    display?: "flex" | "none";
    overflowX?: "visible" | "hidden";
    overflowY?: "visible" | "hidden";
    overflow?: "visible" | "hidden";
    children?: ReactNode;
  }

  export interface TextProps {
    color?: string;
    backgroundColor?: string;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strikethrough?: boolean;
    inverse?: boolean;
    dimColor?: boolean;
    wrap?: "wrap" | "truncate" | "truncate-start" | "truncate-middle" | "truncate-end";
    children?: ReactNode;
  }

  export interface StaticProps<T> {
    items: T[];
    children: (item: T, index: number) => ReactNode;
    style?: BoxProps;
  }

  export interface NewlineProps {
    count?: number;
  }

  export interface SpacerProps {}

  export interface TransformProps {
    transform: (children: string) => string;
    children?: ReactNode;
  }

  export const Box: FC<BoxProps>;
  export const Text: FC<TextProps>;
  export function Static<T>(props: StaticProps<T>): JSX.Element;
  export const Newline: FC<NewlineProps>;
  export const Spacer: FC<SpacerProps>;
  export const Transform: FC<TransformProps>;

  export interface Key {
    upArrow: boolean;
    downArrow: boolean;
    leftArrow: boolean;
    rightArrow: boolean;
    return: boolean;
    escape: boolean;
    ctrl: boolean;
    shift: boolean;
    tab: boolean;
    backspace: boolean;
    delete: boolean;
    pageDown: boolean;
    pageUp: boolean;
    meta: boolean;
  }

  export type InputHandler = (input: string, key: Key) => void;

  export interface UseInputOptions {
    isActive?: boolean;
  }

  export function useInput(handler: InputHandler, options?: UseInputOptions): void;

  export function useApp(): {
    exit: (error?: Error) => void;
  };

  export function useStdin(): {
    stdin: NodeJS.ReadStream;
    setRawMode: (value: boolean) => void;
    isRawModeSupported: boolean;
    internal_exitOnCtrlC: boolean;
  };

  export function useStdout(): {
    stdout: NodeJS.WriteStream;
    write: (data: string) => void;
  };

  export function useStderr(): {
    stderr: NodeJS.WriteStream;
    write: (data: string) => void;
  };

  export function useFocus(options?: { id?: string; autoFocus?: boolean; isActive?: boolean }): {
    isFocused: boolean;
    focus: () => void;
  };

  export function useFocusManager(): {
    enableFocus: () => void;
    disableFocus: () => void;
    focusNext: () => void;
    focusPrevious: () => void;
    focus: (id: string) => void;
  };

  export interface RenderOptions {
    stdout?: NodeJS.WriteStream;
    stdin?: NodeJS.ReadStream;
    stderr?: NodeJS.WriteStream;
    debug?: boolean;
    exitOnCtrlC?: boolean;
    patchConsole?: boolean;
  }

  export interface Instance {
    rerender: (tree: ReactNode) => void;
    unmount: () => void;
    waitUntilExit: () => Promise<void>;
    cleanup: () => void;
    clear: () => void;
  }

  export function render(tree: ReactNode, options?: RenderOptions): Instance;

  export function measureElement(ref: { current: any }): {
    width: number;
    height: number;
  };

  // Re-export Key type for external use
  export { Key };
}

declare module "ink-text-input" {
  import { FC } from "react";

  export interface TextInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    focus?: boolean;
    mask?: string;
    showCursor?: boolean;
    highlightPastedText?: boolean;
    onSubmit?: (value: string) => void;
  }

  const TextInput: FC<TextInputProps>;
  export default TextInput;
}

declare module "ink-spinner" {
  import { FC } from "react";

  export interface SpinnerProps {
    type?:
      | "dots"
      | "dots2"
      | "dots3"
      | "dots4"
      | "dots5"
      | "dots6"
      | "dots7"
      | "dots8"
      | "dots9"
      | "dots10"
      | "dots11"
      | "dots12"
      | "line"
      | "line2"
      | "pipe"
      | "simpleDots"
      | "simpleDotsScrolling"
      | "star"
      | "star2"
      | "flip"
      | "hamburger"
      | "growVertical"
      | "growHorizontal"
      | "balloon"
      | "balloon2"
      | "noise"
      | "bounce"
      | "boxBounce"
      | "boxBounce2"
      | "triangle"
      | "arc"
      | "circle"
      | "squareCorners"
      | "circleQuarters"
      | "circleHalves"
      | "squish"
      | "toggle"
      | "toggle2"
      | "toggle3"
      | "toggle4"
      | "toggle5"
      | "toggle6"
      | "toggle7"
      | "toggle8"
      | "toggle9"
      | "toggle10"
      | "toggle11"
      | "toggle12"
      | "toggle13"
      | "arrow"
      | "arrow2"
      | "arrow3"
      | "bouncingBar"
      | "bouncingBall"
      | "smiley"
      | "monkey"
      | "hearts"
      | "clock"
      | "earth"
      | "moon"
      | "runner"
      | "pong"
      | "shark"
      | "dqpb";
  }

  const Spinner: FC<SpinnerProps>;
  export default Spinner;
}

declare module "ink-select-input" {
  import { FC } from "react";

  export interface Item<V = any> {
    label: string;
    value: V;
    key?: string;
  }

  export interface SelectInputProps<V = any> {
    items?: Item<V>[];
    isFocused?: boolean;
    initialIndex?: number;
    indicatorComponent?: FC<{ isSelected: boolean }>;
    itemComponent?: FC<{ isSelected: boolean; label: string }>;
    limit?: number;
    onSelect?: (item: Item<V>) => void;
    onHighlight?: (item: Item<V>) => void;
  }

  function SelectInput<V = any>(props: SelectInputProps<V>): JSX.Element;
  export default SelectInput;
}
