// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export default class MinecraftLogItem {
  fileName: string | undefined;
  message: string | undefined;
  /** Local `HH:MM:SS` from the content log line, when it has one. */
  time?: string;
  category?: string;
  level?: "verbose" | "info" | "warning" | "error";
}
