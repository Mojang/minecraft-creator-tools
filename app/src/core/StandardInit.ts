// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IProjectTheme from "../UX/types/IProjectTheme";

export const minecraftToolDarkTheme: IProjectTheme = {
  bodyFontFamily: '"Noto Sans", "Segoe UI", system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif',
  mc0: "#131313",
  mc1: "#212121",
  mc2: "#212121",
  mc3: "#373737",
  mc4: "#3a3a3a",
  mc5: "#4e4e4e",
  mcc1: "#ffffff",
  background: "#3c8527", // accent background for things like buttons. complemented with foreground4
  background1: "#312f2d", // main outermost background. in a dark theme, this should be dark. complemented with foreground1
  background2: "#484644",
  background3: "#5a5856",
  background4: "#8f8b89",
  background5: "#5d7850", // subtle accent background
  background6: "#040404", // subtle theme background. complemented with foreground6
  foreground: "#5ca547",
  foreground1: "#f8f8f8", // main foreground color. in a dark theme, this should be light.
  foreground2: "#ffffff",
  foreground3: "#ffffff",
  foreground4: "#ffffff", // button complement and core accent color to background
  foreground5: "orange",
  foreground6: "#B3B3B3", // subtle.
  foregroundHover: "#242425",
  foregroundHover1: "#373737",
  foregroundHover2: "#373737",
  foregroundHover3: "#373737",
  backgroundHover: "#6cc349", // hover background color for core accent.
  backgroundHover1: "#5a5856",
  backgroundHover2: "#5a5856",
  backgroundHover3: "#5a5856",
  foregroundActive: "#cccccc",
  foregroundActive1: "#f8f8f8",
  backgroundActive: "#5ca547",
  backgroundActive1: "#2a641c", // filled checkbox color
  backgroundPressed: "#2a641c",
};

export const minecraftToolLightTheme: IProjectTheme = {
  bodyFontFamily: '"Noto Sans", "Segoe UI", system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif',
  mc0: "#131313",
  mc1: "#595759",
  mc2: "#656465",
  mc3: "#C0BFC0",
  mc4: "#C6C6C6",
  mc5: "#f7f7f7",
  mcc1: "#4C4C4C",
  background: "#6bc349", // accent background for things like buttons. complemented with foreground4
  background1: "#e6e4e2", // main outermost background. complemented with foreground1
  background2: "#cccac7", // complement background. complemented with foreground2
  background3: "#bfbbb9",
  background4: "#7b7876",
  background5: "#52a435", // subtle accent background
  background6: "#b3b3b3", // subtle theme background. complemented with foreground6
  foreground: "#3b9329",
  foreground1: "#1a1a1a", // main foreground color.
  foreground2: "#1a1a1a", // complement foreground color
  foreground3: "#1a1a1a",
  foreground4: "#000000", // button complement and core accent color to background
  foreground5: "#1a1a1a",
  foreground6: "#4d4d4d", // subtle.
  foregroundHover: "#242425",
  foregroundHover1: "#bfbbb9",
  foregroundHover2: "#bfbbb9",
  foregroundHover3: "#bfbbb9",
  backgroundHover: "#6cc349", // hover background color for core accent.
  backgroundHover1: "#bfbbb9",
  backgroundHover2: "#bfbbb9",
  backgroundHover3: "#bfbbb9",
  foregroundActive: "#4d4d4d", // used for toolbar buttons
  foregroundActive1: "#1a1a1a",
  backgroundActive: "#52a435",
  backgroundActive1: "#2a641c", // filled checkbox color
  backgroundPressed: "#2a641c",
};
