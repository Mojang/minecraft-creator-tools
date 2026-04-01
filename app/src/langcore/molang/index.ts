// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Molang Language Core
 *
 * Platform-agnostic editing intelligence for Molang expressions.
 * Molang is Minecraft's expression language used in animations, particles, and entity definitions.
 *
 * Provides:
 * - Expression parsing and validation
 * - Completions for queries, math functions, and variables
 * - Hover documentation
 * - Diagnostics for common errors
 */

export * from "./MolangParser";
export * from "./MolangCompletions";
export * from "./MolangHover";
export * from "./MolangDiagnostics";
