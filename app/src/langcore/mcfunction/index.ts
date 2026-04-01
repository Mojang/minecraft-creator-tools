// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * mcfunction Language Core
 *
 * Platform-agnostic editing intelligence for Minecraft command files (.mcfunction).
 * Provides completions, hover, and diagnostics for:
 * - Minecraft commands
 * - Selectors (@a, @e, @p, @r, @s, @initiator)
 * - Targets and arguments
 */

export * from "./CommandParser";
export * from "./CommandCompletions";
export * from "./CommandHover";
export * from "./CommandDiagnostics";
