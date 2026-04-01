// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * MINECRAFT COMMANDS LANGUAGE SUPPORT
 *
 * This module provides Monaco editor language support for Minecraft Bedrock Edition commands.
 * It includes:
 * - Syntax highlighting via Monarch tokenizer
 * - Intelligent autocomplete with fuzzy matching
 * - Hover documentation for commands
 * - Signature help for command parameters
 * - Real-time validation with error markers
 *
 * Command metadata is loaded from mojang-commands.json which contains:
 * - ~100 commands with their overloads and parameters
 * - Command enums for valid parameter values
 */

import * as monaco from "monaco-editor";
import Database from "../../minecraft/Database";
import IDocCommandSet from "../../minecraft/docs/IDocCommandSet";
import IDocCommand from "../../minecraft/docs/IDocCommand";
import IDocCommandEnum from "../../minecraft/docs/IDocCommandEnum";
import Log from "../../core/Log";
import Utilities from "../../core/Utilities";

// Static cache for command metadata - shared across all editors
let _commandsMetadata: IDocCommandSet | null = null;
let _commandsMetadataLoading: boolean = false;
let _commandsMetadataLoaded: boolean = false;
let _commandsByName: Map<string, IDocCommand> = new Map();
let _enumsByName: Map<string, IDocCommandEnum> = new Map();
let _languageRegistered: boolean = false;

// Type metadata from form files - loaded separately for friendly names and suggestions
// Using IFormSample structure: { path: description, content: value }
interface IFormSample {
  path: string; // description of the sample
  content: string | number | boolean | object; // the actual value
}
interface ITypeMetadata {
  friendlyName: string;
  description: string;
  formatHint?: string; // format hint string
  samples?: { [category: string]: IFormSample[] }; // categorized samples
  aliasOf?: string[]; // array of type IDs this is an alias of
  note?: string;
}
let _typeMetadata: Map<string, ITypeMetadata> = new Map();
let _typeMetadataLoaded: boolean = false;

// Command metadata from form files - provides richer descriptions than mojang-commands.json
interface ICommandFormField {
  id: string;
  title?: string;
  description?: string;
  commandType?: string;
  isOptional?: boolean;
}
interface ICommandFormOverload {
  id: string;
  title?: string;
  description?: string;
  params: { name: string; type: string; isOptional?: boolean }[];
}
interface ICommandFormMetadata {
  id: string;
  title: string;
  description: string;
  fields: ICommandFormField[];
  overloads?: ICommandFormOverload[];
  aliases?: string[];
  permissionLevel?: number;
  requiresCheats?: boolean;
}
let _commandFormMetadata: Map<string, ICommandFormMetadata> = new Map();
let _commandFormMetadataLoaded: boolean = false;

/**
 * Load command metadata from the database
 */
export async function ensureCommandMetadataLoaded(): Promise<void> {
  if (_commandsMetadataLoaded || _commandsMetadataLoading) {
    return;
  }

  _commandsMetadataLoading = true;

  try {
    const metadata = await Database.getCommandsMetadata();

    if (metadata) {
      _commandsMetadata = metadata;

      // Build lookup maps for faster access
      for (const cmd of metadata.commands) {
        _commandsByName.set(cmd.name.toLowerCase(), cmd);
      }

      for (const enumDef of metadata.command_enums) {
        _enumsByName.set(enumDef.name.toLowerCase(), enumDef);
      }

      _commandsMetadataLoaded = true;
      Log.verbose("Loaded " + metadata.commands.length + " commands and " + metadata.command_enums.length + " enums");
    }
  } catch (e) {
    Log.fail("Failed to load command metadata: " + e);
  }

  _commandsMetadataLoading = false;

  // Also load type metadata and command form metadata (don't block on them)
  loadTypeMetadata();
  loadCommandFormMetadata();
}

/**
 * Load type metadata from form files
 * This provides friendly names, descriptions, and examples for command parameter types
 * Dynamically discovers type_*.form.json files from the folder index
 */
async function loadTypeMetadata(): Promise<void> {
  if (_typeMetadataLoaded) {
    return;
  }

  try {
    const basePath = "data/forms/command/";

    // Dynamically discover type form files from index.json
    let typeFormFiles: string[] = [];

    try {
      const indexResponse = await fetch(basePath + "index.json");
      if (indexResponse.ok) {
        const indexData = await indexResponse.json();
        // Filter to only type_*.form.json files, and strip the .form.json extension
        typeFormFiles = (indexData.files || [])
          .filter((f: string) => f.startsWith("type_") && f.endsWith(".form.json"))
          .map((f: string) => f.replace(".form.json", ""));
      }
    } catch (indexErr) {
      Log.debug("Could not load type form index: " + indexErr);
    }

    if (typeFormFiles.length === 0) {
      Log.debug("No type form files found in index, type metadata will not be available");
      _typeMetadataLoaded = true;
      return;
    }

    for (const formName of typeFormFiles) {
      try {
        const response = await fetch(basePath + formName + ".form.json");
        if (response.ok) {
          const data = await response.json();
          // Extract type name from form id (type_selection -> SELECTION)
          const typeName = formName.replace("type_", "").toUpperCase();
          const metadata: ITypeMetadata = {
            friendlyName: data.title || typeName,
            description: data.description || "",
            formatHint: data.formatHint,
            samples: data.samples,
            aliasOf: data.aliasOf,
            note: data.note,
          };
          _typeMetadata.set(typeName, metadata);
        }
      } catch (fileErr) {
        Log.debug("Could not load type form " + formName + ": " + fileErr);
      }
    }

    _typeMetadataLoaded = true;
    Log.verbose("Loaded type metadata for " + _typeMetadata.size + " types");
  } catch (e) {
    Log.debug("Failed to load type metadata: " + e);
  }
}

/**
 * Load command form metadata from cmd_*.form.json files
 * This provides richer descriptions than mojang-commands.json including:
 * - Human-readable command descriptions
 * - Per-parameter descriptions
 * - Overload titles and descriptions
 */
async function loadCommandFormMetadata(): Promise<void> {
  if (_commandFormMetadataLoaded) {
    return;
  }

  try {
    const basePath = "data/forms/command/";

    // First, try to load the index to get all command form files
    let commandFormFiles: string[] = [];

    try {
      const indexResponse = await fetch(basePath + "index.json");
      if (indexResponse.ok) {
        const indexData = await indexResponse.json();
        // Filter to only cmd_*.form.json files, and strip the .form.json extension for uniform handling
        commandFormFiles = (indexData.files || [])
          .filter((f: string) => f.startsWith("cmd_") && f.endsWith(".form.json"))
          .map((f: string) => f.replace(".form.json", ""));
      }
    } catch (indexErr) {
      Log.debug("Could not load command form index: " + indexErr);
    }

    // If no index, fall back to the commands we know exist from mojang-commands.json
    if (commandFormFiles.length === 0 && _commandsMetadata) {
      commandFormFiles = _commandsMetadata.commands.map((cmd) => "cmd_" + cmd.name);
    }

    for (const formName of commandFormFiles) {
      try {
        const response = await fetch(basePath + formName + ".form.json");
        if (response.ok) {
          const data = await response.json();
          const commandName = formName.replace("cmd_", "").replace(".form.json", "").toLowerCase();
          _commandFormMetadata.set(commandName, data as ICommandFormMetadata);
        }
      } catch (fileErr) {
        // Silently ignore - not all commands may have form files
      }
    }

    _commandFormMetadataLoaded = true;
    Log.verbose("Loaded command form metadata for " + _commandFormMetadata.size + " commands");
  } catch (e) {
    Log.debug("Failed to load command form metadata: " + e);
  }
}

/**
 * Get command form metadata by command name
 */
function getCommandFormMetadata(commandName: string): ICommandFormMetadata | undefined {
  return _commandFormMetadata.get(commandName.toLowerCase());
}

/**
 * Get field description from command form metadata
 */
function getFieldDescription(commandName: string, fieldId: string): string | undefined {
  const formMeta = _commandFormMetadata.get(commandName.toLowerCase());
  if (formMeta?.fields) {
    const field = formMeta.fields.find((f) => f.id.toLowerCase() === fieldId.toLowerCase());
    return field?.description;
  }
  return undefined;
}

/**
 * Get overload description from command form metadata
 */
function getOverloadInfo(
  commandName: string,
  overloadId: string
): { title?: string; description?: string } | undefined {
  const formMeta = _commandFormMetadata.get(commandName.toLowerCase());
  if (formMeta?.overloads) {
    const overload = formMeta.overloads.find((o) => o.id === overloadId);
    if (overload) {
      return { title: overload.title, description: overload.description };
    }
  }
  return undefined;
}

/**
 * Humanify a type name from SCREAMING_CASE to Title Case
 * E.g., MESSAGE_ROOT -> Message Root, POSITION_FLOAT -> Position Float
 */
function humanifyTypeName(typeName: string | undefined): string {
  if (!typeName) {
    return "any";
  }
  // Use Utilities.humanifyJsName which handles underscores and casing
  // First convert SCREAMING_CASE to lowercase with underscores preserved
  const lowered = typeName.toLowerCase();
  // Then humanify it
  return Utilities.humanifyJsName(lowered);
}

/**
 * Check if command metadata is loaded
 */
export function isCommandMetadataLoaded(): boolean {
  return _commandsMetadataLoaded;
}

/**
 * Get a command by name
 */
export function getCommand(name: string): IDocCommand | undefined {
  return _commandsByName.get(name.toLowerCase());
}

/**
 * Get all commands
 */
export function getAllCommands(): IDocCommand[] {
  return _commandsMetadata?.commands || [];
}

/**
 * Calculate fuzzy match score - higher is better match
 * Returns -1 if no match
 */
function fuzzyMatch(text: string, pattern: string): number {
  if (!pattern) return 100;

  const textLower = text.toLowerCase();
  const patternLower = pattern.toLowerCase();

  // Exact match at start is best
  if (textLower.startsWith(patternLower)) {
    return 1000 - textLower.length; // Shorter matches rank higher
  }

  // Contains match
  const containsIndex = textLower.indexOf(patternLower);
  if (containsIndex >= 0) {
    return 500 - containsIndex - textLower.length; // Earlier and shorter is better
  }

  // Fuzzy subsequence match (e.g., "tdf" matches "toggledownfall")
  let patternIdx = 0;
  let score = 0;
  let lastMatchIdx = -1;

  for (let i = 0; i < textLower.length && patternIdx < patternLower.length; i++) {
    if (textLower[i] === patternLower[patternIdx]) {
      // Consecutive matches score higher
      if (lastMatchIdx === i - 1) {
        score += 20;
      } else {
        score += 10;
      }
      // Matching at word boundaries scores higher
      if (i === 0 || textLower[i - 1] === "_" || textLower[i - 1] === " ") {
        score += 15;
      }
      lastMatchIdx = i;
      patternIdx++;
    }
  }

  // All pattern characters must be found
  if (patternIdx === patternLower.length) {
    return score;
  }

  return -1; // No match
}

/**
 * Get the Monarch tokenizer for Minecraft commands
 */
export function getMonarchTokenizer(): monaco.languages.IMonarchLanguage {
  return {
    defaultToken: "",
    tokenPostfix: ".mccommand",
    ignoreCase: true,

    tokenizer: {
      root: [
        // Comments start with #
        [/#.*$/, "comment"],
        // Commands start with / or at beginning of line
        [/^\s*\/?\w+/, { token: "keyword.command", next: "@arguments" }],
        // Target selectors
        [/@[aeprs]/, "variable.selector"],
        [/@[aeprs]\[/, { token: "variable.selector", next: "@selectorArgs" }],
        // Numbers
        [/-?\d+\.?\d*/, "number"],
        // Strings
        [/"[^"]*"/, "string"],
        // Coordinates (relative and local)
        [/[~^]-?\d*\.?\d*/, "number.coordinate"],
        // Namespaced identifiers
        [/[a-zA-Z_][a-zA-Z0-9_]*:[a-zA-Z0-9_\/]+/, "type.identifier"],
        // Regular identifiers
        [/[a-zA-Z_][a-zA-Z0-9_]*/, "identifier"],
        // Status messages
        [/\[error.*/, "custom-error"],
        [/\[notice.*/, "custom-notice"],
        [/\[info.*/, "custom-info"],
        [/\[[a-zA-Z 0-9:]+\]/, "custom-date"],
      ],
      arguments: [
        // Target selectors
        [/@[aeprs]/, "variable.selector"],
        [/@[aeprs]\[/, { token: "variable.selector", next: "@selectorArgs" }],
        // Numbers
        [/-?\d+\.?\d*/, "number"],
        // Strings
        [/"[^"]*"/, "string"],
        // Coordinates
        [/[~^]-?\d*\.?\d*/, "number.coordinate"],
        // Namespaced identifiers
        [/[a-zA-Z_][a-zA-Z0-9_]*:[a-zA-Z0-9_\/]+/, "type.identifier"],
        // Boolean keywords
        [/\b(true|false)\b/, "keyword.boolean"],
        // Regular identifiers
        [/[a-zA-Z_][a-zA-Z0-9_]*/, "identifier"],
        // Newline returns to root
        [/\n/, { token: "", next: "@root" }],
        [/\s+/, ""],
      ],
      selectorArgs: [
        // Key=value pairs in selector
        [/[a-zA-Z_][a-zA-Z0-9_]*/, "variable.parameter"],
        [/=/, "operator"],
        [/!/, "operator.negation"],
        [/-?\d+\.?\d*/, "number"],
        [/\.\./, "operator.range"],
        [/,/, "delimiter"],
        [/\]/, { token: "variable.selector", next: "@pop" }],
        [/"[^"]*"/, "string"],
        [/\{/, { token: "delimiter.bracket", next: "@nestedBracket" }],
      ],
      nestedBracket: [
        [/[a-zA-Z_][a-zA-Z0-9_]*/, "variable.parameter"],
        [/:/, "delimiter"],
        [/=/, "operator"],
        [/-?\d+\.?\d*/, "number"],
        [/,/, "delimiter"],
        [/\}/, { token: "delimiter.bracket", next: "@pop" }],
      ],
    },
  } as monaco.languages.IMonarchLanguage;
}

/**
 * Get theme rules for syntax highlighting
 */
export function getThemeRules(): monaco.editor.ITokenThemeRule[] {
  return [
    { token: "comment", foreground: "6A9955" },
    { token: "keyword.command", foreground: "569CD6", fontStyle: "bold" },
    { token: "keyword.boolean", foreground: "569CD6" },
    { token: "variable.selector", foreground: "DCDCAA" },
    { token: "variable.parameter", foreground: "9CDCFE" },
    { token: "number", foreground: "B5CEA8" },
    { token: "number.coordinate", foreground: "CE9178" },
    { token: "string", foreground: "CE9178" },
    { token: "type.identifier", foreground: "4EC9B0" },
    { token: "identifier", foreground: "D4D4D4" },
    { token: "operator", foreground: "D4D4D4" },
    { token: "operator.negation", foreground: "F44747" },
    { token: "operator.range", foreground: "D4D4D4" },
    { token: "delimiter", foreground: "D4D4D4" },
    { token: "custom-info", foreground: "FFFFFF" },
    { token: "custom-error", foreground: "F44747", fontStyle: "bold" },
    { token: "custom-notice", foreground: "FFA500" },
    { token: "custom-date", foreground: "FF88FF" },
  ];
}

/**
 * Provide completion items for Minecraft commands
 */
function provideCompletionItems(
  document: monaco.editor.ITextModel,
  position: monaco.Position,
  context: monaco.languages.CompletionContext,
  token: monaco.CancellationToken
): monaco.languages.ProviderResult<monaco.languages.CompletionList> {
  const lineContent = document.getLineContent(position.lineNumber);
  const textBeforeCursor = lineContent.substring(0, position.column - 1);

  // Determine what kind of completions to provide based on context
  const trimmedLine = textBeforeCursor.trim();

  // Handle optional leading slash (mcfunctions don't require it)
  const startsWithSlash = trimmedLine.startsWith("/");
  const commandPart = startsWithSlash ? trimmedLine.substring(1) : trimmedLine;

  // Split by whitespace to get tokens
  const tokens = commandPart.length > 0 ? commandPart.split(/\s+/) : [];

  // Get the word range for replacement
  const wordInfo = document.getWordUntilPosition(position);
  const range: monaco.IRange = {
    startLineNumber: position.lineNumber,
    startColumn: wordInfo.startColumn,
    endLineNumber: position.lineNumber,
    endColumn: wordInfo.endColumn,
  };

  // SPECIAL CASE: First token (command name) - always provide command suggestions
  // This handles: empty line, just "/", typing first word, etc.
  const isFirstToken =
    tokens.length === 0 || // Empty line
    (tokens.length === 1 && !textBeforeCursor.endsWith(" ")); // Typing first word (no space yet)

  if (isFirstToken) {
    const prefix = tokens[0] || "";
    return getCommandSuggestions(range, prefix);
  }

  // We're typing an argument - figure out which command and parameter position
  const commandName = tokens[0].toLowerCase();
  const command = _commandsByName.get(commandName);

  if (!command) {
    // Unknown command, provide generic suggestions
    return getGenericSuggestions(range);
  }

  // Figure out which parameter we're on (0-indexed, command name is not counted)
  const paramIndex = textBeforeCursor.endsWith(" ") ? tokens.length - 1 : tokens.length - 2;

  // Get already-typed arguments for filtering overloads
  // Include all typed tokens (excluding command name) - even the current one - for filtering
  // This way, as soon as user types @a, only selector-first overloads are shown
  const typedArgsForFiltering = tokens.slice(1);

  return getParameterSuggestions(command, paramIndex, range, typedArgsForFiltering);
}

/**
 * Get command name suggestions with fuzzy matching
 */
function getCommandSuggestions(range: monaco.IRange, prefix: string): monaco.languages.CompletionList {
  const suggestions: monaco.languages.CompletionItem[] = [];

  // If metadata not loaded yet, return a helpful message
  if (!_commandsMetadata || !_commandsMetadataLoaded) {
    Log.verbose("Command metadata not yet loaded, returning placeholder suggestions");
    suggestions.push({
      label: "Loading commands...",
      kind: monaco.languages.CompletionItemKind.Text,
      insertText: "",
      detail: "Command metadata is still loading",
      range: range,
    });
    return { suggestions };
  }

  const scoredCommands: { cmd: IDocCommand; score: number }[] = [];

  for (const cmd of _commandsMetadata.commands) {
    // Use fuzzy matching instead of just startsWith
    const score = fuzzyMatch(cmd.name, prefix);

    if (score >= 0) {
      scoredCommands.push({ cmd, score });
    }
  }

  // Sort by score descending
  scoredCommands.sort((a, b) => b.score - a.score);

  for (const { cmd, score } of scoredCommands) {
    // Get form metadata for richer descriptions
    const formMeta = getCommandFormMetadata(cmd.name);

    // Build a usage snippet from the first overload
    let insertText = cmd.name;
    // Prefer form description over mojang-commands description
    let documentation = formMeta?.description || cmd.description || "";

    if (cmd.overloads && cmd.overloads.length > 0) {
      const overload = cmd.overloads[0];
      const paramParts: string[] = [];

      if (overload.params) {
        for (let i = 0; i < overload.params.length; i++) {
          const param = overload.params[i];
          const paramName = param.name || param.type?.name || "arg" + i;
          const placeholder = param.is_optional ? `[\${${i + 1}:${paramName}}]` : `\${${i + 1}:${paramName}}`;
          paramParts.push(placeholder);
        }
      }

      if (paramParts.length > 0) {
        insertText = cmd.name + " " + paramParts.join(" ");
      }

      // Build documentation from all overloads with richer info from form metadata
      documentation += "\n\n**Overloads:**\n";
      for (const ol of cmd.overloads) {
        const overloadInfo = getOverloadInfo(cmd.name, ol.name);
        const paramStr = ol.params?.map((p) => (p.is_optional ? `[${p.name}]` : `<${p.name}>`)).join(" ") || "";
        if (overloadInfo?.title) {
          documentation += `- **${overloadInfo.title}**: \`${cmd.name} ${paramStr}\`\n`;
        } else {
          documentation += `- \`${cmd.name} ${paramStr}\`\n`;
        }
      }
    }

    // Add aliases if available from form metadata
    if (formMeta?.aliases && formMeta.aliases.length > 0) {
      documentation += `\n\n**Aliases:** ${formMeta.aliases.join(", ")}`;
    }

    if (cmd.permission_level) {
      documentation += `\n\n**Permission:** ${cmd.permission_level}`;
    }

    if (cmd.requires_cheats) {
      documentation += "\n**Requires cheats**";
    }

    // Calculate sortText to maintain fuzzy match ordering
    const sortText = String(10000 - score).padStart(5, "0") + cmd.name;

    suggestions.push({
      label: cmd.name,
      kind: monaco.languages.CompletionItemKind.Function,
      insertText: insertText,
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: { value: documentation },
      detail: cmd.description?.substring(0, 80) || "Minecraft command",
      range: range,
      sortText: sortText,
      filterText: cmd.name,
    });
  }

  return { suggestions };
}

/**
 * Get parameter suggestions based on the command and parameter position
 * Filters overloads based on already-typed arguments to show only relevant suggestions
 */
function getParameterSuggestions(
  command: IDocCommand,
  paramIndex: number,
  range: monaco.IRange,
  typedArgs: string[]
): monaco.languages.CompletionList {
  const suggestions: monaco.languages.CompletionItem[] = [];
  const seenValues = new Set<string>();

  // Look at all overloads to find possible parameter types at this position
  // but only consider overloads that are compatible with already-typed arguments
  for (const overload of command.overloads) {
    if (!overload.params || paramIndex >= overload.params.length) {
      continue;
    }

    // Filter out overloads that don't match the already-typed arguments
    if (!isOverloadCompatible(overload, typedArgs)) {
      continue;
    }

    const param = overload.params[paramIndex];
    const paramTypeName = param.type?.name || "";
    const paramTypeNameLower = paramTypeName.toLowerCase();

    // Get rich field description from form metadata
    // Normalize param name to match field id format (lowercase, underscores for spaces)
    const fieldId = param.name.replace(/\s+/g, "_").toLowerCase();
    const fieldDesc = getFieldDescription(command.name, fieldId);

    // Check if there's an enum with this type name
    const enumDef = _enumsByName.get(paramTypeNameLower);

    if (enumDef) {
      // Add enum values as suggestions
      for (const enumVal of enumDef.values) {
        const value = enumVal.value || (enumVal as any);
        if (typeof value === "string" && !seenValues.has(value)) {
          seenValues.add(value);
          suggestions.push({
            label: value,
            kind: monaco.languages.CompletionItemKind.EnumMember,
            insertText: value,
            detail: `${param.name} (${getFriendlyTypeName(paramTypeName)})`,
            documentation: fieldDesc || undefined,
            range: range,
          });
        }
      }
    } else {
      // Provide type-specific suggestions based on the actual type name
      addTypeSuggestions(suggestions, seenValues, param.name, paramTypeName, range, command.name, fieldDesc);
    }
  }

  // NO generic suggestions - only type-appropriate ones are added above

  return { suggestions };
}

/**
 * Map internal type names to friendly descriptions
 */
const TYPE_FRIENDLY_NAMES: Record<string, { name: string; description: string; format?: string }> = {
  // Selectors/Targets
  SELECTION: {
    name: "Entity Selector",
    description: "Targets entities using selector syntax",
    format: "@a, @e, @p, @r, @s or @e[type=...]",
  },
  PLAYER_SELECTOR: {
    name: "Player Selector",
    description: "Targets players using selector syntax",
    format: "@a, @p, @r, @s",
  },

  // Positions
  POSITION_FLOAT: {
    name: "Position (x y z)",
    description: "3D coordinates, can use ~ for relative or ^ for local",
    format: "x y z, ~ ~ ~, or ^ ^ ^",
  },
  POSITION: {
    name: "Position (x y z)",
    description: "3D coordinates (integers)",
    format: "x y z or ~ ~ ~",
  },
  BLOCKPOS: {
    name: "Block Position",
    description: "Block coordinates (integers)",
    format: "x y z or ~ ~ ~",
  },

  // Messages and text
  MESSAGE_ROOT: {
    name: "Message",
    description: "Text message to display",
    format: "Any text (can include @mentions)",
  },
  STRING: {
    name: "Text",
    description: "A text string value",
    format: 'text or "quoted text"',
  },
  PATHCOMMAND: {
    name: "Function Path",
    description: "Path to a function file",
    format: "namespace:path/to/function",
  },

  // Numbers
  INT: { name: "Integer", description: "A whole number", format: "e.g., 0, 1, -5, 100" },
  FLOAT: { name: "Decimal", description: "A decimal number", format: "e.g., 0.5, 1.0, -3.14" },
  RVAL: {
    name: "Rotation",
    description: "Rotation angle in degrees",
    format: "0-360 or ~ for relative",
  },
  VAL: { name: "Value", description: "A numeric value" },

  // Booleans
  BOOLEAN: { name: "Boolean", description: "True or false value", format: "true or false" },

  // Identifiers
  BLOCK: { name: "Block ID", description: "A block identifier", format: "minecraft:stone, stone" },
  ITEM: { name: "Item ID", description: "An item identifier", format: "minecraft:diamond, diamond" },
  ENTITY_TYPE: { name: "Entity Type", description: "An entity type identifier", format: "minecraft:pig, pig" },
  EFFECT: { name: "Effect", description: "A status effect", format: "speed, strength, etc." },
  ENCHANT: { name: "Enchantment", description: "An enchantment", format: "sharpness, protection, etc." },

  // JSON
  JSON_OBJECT: { name: "JSON Object", description: "A JSON object", format: '{"key": "value"}' },
  RAWTEXT: { name: "Raw Text JSON", description: "JSON text component", format: '{"rawtext":[{"text":"..."}]}' },

  // Game values
  GAMEMODE: { name: "Game Mode", description: "A game mode", format: "survival, creative, adventure, spectator" },
  DIFFICULTY: { name: "Difficulty", description: "Game difficulty", format: "peaceful, easy, normal, hard" },
};

/**
 * Get a friendly display name for a type
 * First checks loaded metadata from JSON files, then falls back to hardcoded names
 */
function getFriendlyTypeName(typeName: string): string {
  const upperName = typeName.toUpperCase();

  // First check dynamically loaded metadata
  const loadedMeta = _typeMetadata.get(upperName);
  if (loadedMeta?.friendlyName) {
    return loadedMeta.friendlyName;
  }

  // Fall back to hardcoded values
  const info = TYPE_FRIENDLY_NAMES[typeName];
  if (info?.name) {
    return info.name;
  }

  // Final fallback: humanify the type name
  return humanifyTypeName(typeName);
}

/**
 * Get a friendly description for a type
 * First checks loaded metadata from JSON files, then falls back to hardcoded descriptions
 */
function getTypeDescription(typeName: string): string | undefined {
  const upperName = typeName.toUpperCase();

  // First check dynamically loaded metadata
  const loadedMeta = _typeMetadata.get(upperName);
  if (loadedMeta) {
    let desc = loadedMeta.description;
    if (loadedMeta.formatHint) {
      desc += `\n\n**Format:** ${loadedMeta.formatHint}`;
    }
    if (loadedMeta.note) {
      desc += `\n\n**Note:** ${loadedMeta.note}`;
    }
    return desc;
  }

  // Fall back to hardcoded values
  const info = TYPE_FRIENDLY_NAMES[typeName];
  if (info) {
    let desc = info.description;
    if (info.format) {
      desc += `\n\n**Format:** ${info.format}`;
    }
    return desc;
  }
  return undefined;
}

/**
 * Check if a type represents an entity selector
 */
function isSelectionType(typeName: string): boolean {
  const upper = typeName.toUpperCase();
  return upper === "SELECTION" || upper === "PLAYER_SELECTOR" || upper.includes("SELECTOR");
}

/**
 * Check if a type represents a position
 */
function isPositionType(typeName: string): boolean {
  const upper = typeName.toUpperCase();
  return upper.includes("POSITION") || upper === "BLOCKPOS" || upper.includes("POS");
}

/**
 * Check if a typed argument value matches an expected parameter type.
 * Returns true if the value appears compatible with the type, false if definitely incompatible.
 * Used to filter overloads based on already-typed arguments.
 */
function doesArgumentMatchType(argValue: string, expectedType: string): boolean {
  const typeUpper = expectedType.toUpperCase();
  const trimmedArg = argValue.trim();

  // Empty argument matches anything (not yet typed)
  if (!trimmedArg) {
    return true;
  }

  // Selector types - must start with @
  if (isSelectionType(expectedType)) {
    return trimmedArg.startsWith("@");
  }

  // Position types - can be numbers, ~, ^, or coordinates
  if (isPositionType(expectedType)) {
    // Position is typically 3 space-separated values, but we might just see the first one
    // Accept: numbers, ~, ^, ~N, ^N, etc.
    return /^[~^]?-?\d*\.?\d*$/.test(trimmedArg) || /^\d+$/.test(trimmedArg);
  }

  // Boolean type
  if (typeUpper === "BOOLEAN" || typeUpper === "BOOL") {
    return trimmedArg === "true" || trimmedArg === "false";
  }

  // Integer type
  if (typeUpper === "INT" || typeUpper === "INTEGER") {
    return /^-?\d+$/.test(trimmedArg);
  }

  // Float type
  if (typeUpper === "FLOAT" || typeUpper === "RVAL" || typeUpper === "VAL") {
    return /^[~^]?-?\d*\.?\d*$/.test(trimmedArg);
  }

  // If argument starts with @ but type is not a selector, it's incompatible
  if (trimmedArg.startsWith("@") && !isSelectionType(expectedType)) {
    return false;
  }

  // For other types (strings, enums, identifiers), be permissive
  // We can't easily validate these without more context
  return true;
}

/**
 * Check if an overload is compatible with the already-typed arguments.
 * Returns true if all typed arguments match their expected types in this overload.
 */
function isOverloadCompatible(
  overload: { params?: { name: string; type?: { name: string }; is_optional?: boolean }[] },
  typedArgs: string[]
): boolean {
  if (!overload.params) {
    return typedArgs.length === 0;
  }

  // Check each typed argument against the expected parameter type
  for (let i = 0; i < typedArgs.length; i++) {
    // If we've typed more args than this overload has params, check if extras are allowed
    if (i >= overload.params.length) {
      return false; // Too many arguments for this overload
    }

    const param = overload.params[i];
    const typedArg = typedArgs[i];
    const expectedType = param.type?.name || "";

    // Skip empty args (not yet fully typed)
    if (!typedArg.trim()) {
      continue;
    }

    // Check if this argument matches the expected type
    if (!doesArgumentMatchType(typedArg, expectedType)) {
      return false;
    }
  }

  return true;
}

/**
 * Get examples for a type from loaded metadata
 * Returns flattened samples array or undefined if not available
 * Samples are stored in categories, this flattens them into a single array
 */
function getTypeExamples(typeName: string): IFormSample[] | undefined {
  const upperName = typeName.toUpperCase();
  const meta = _typeMetadata.get(upperName);
  if (meta?.samples) {
    // Flatten all sample categories into a single array
    const allSamples: IFormSample[] = [];
    for (const category in meta.samples) {
      const categorySamples = meta.samples[category];
      if (Array.isArray(categorySamples)) {
        allSamples.push(...categorySamples);
      }
    }
    if (allSamples.length > 0) {
      return allSamples;
    }
  }
  return undefined;
}

/**
 * Add type-specific suggestions based on parameter type
 * @param commandName - Optional command name for looking up field-specific descriptions
 * @param fieldDesc - Optional pre-loaded field description from form metadata
 */
function addTypeSuggestions(
  suggestions: monaco.languages.CompletionItem[],
  seenValues: Set<string>,
  paramName: string,
  typeName: string,
  range: monaco.IRange,
  commandName?: string,
  fieldDesc?: string
): void {
  const typeUpper = typeName.toUpperCase();
  const friendlyName = getFriendlyTypeName(typeName);
  // Use field description if available, otherwise fall back to type description
  const typeDesc = fieldDesc || getTypeDescription(typeName);

  // SELECTION types - entity selectors
  if (isSelectionType(typeName)) {
    const selectors = [
      { label: "@a", detail: "All players", doc: "Selects all players in the world" },
      { label: "@p", detail: "Nearest player", doc: "Selects the nearest player to the command's position" },
      { label: "@r", detail: "Random player", doc: "Selects a random player" },
      { label: "@e", detail: "All entities", doc: "Selects all entities (mobs, items, etc.)" },
      { label: "@s", detail: "Self (executing entity)", doc: "Selects the entity that executed the command" },
      { label: "@e[type=", detail: "Entities by type...", doc: "Filter entities by their type" },
      { label: "@a[r=", detail: "Players within radius...", doc: "Filter players by distance" },
      {
        label: "@e[name=",
        detail: "Entities by name...",
        doc: "Filter entities by their custom name",
      },
    ];
    for (const sel of selectors) {
      if (!seenValues.has(sel.label)) {
        seenValues.add(sel.label);
        suggestions.push({
          label: sel.label,
          kind: monaco.languages.CompletionItemKind.Variable,
          insertText: sel.label,
          detail: sel.detail,
          documentation: sel.doc,
          range: range,
        });
      }
    }
    return;
  }

  // POSITION types - coordinates
  if (isPositionType(typeName)) {
    const positions = [
      { label: "~ ~ ~", detail: "Current position", doc: "Relative coordinates at the execution point" },
      { label: "~0 ~1 ~0", detail: "One block up", doc: "Relative: same X/Z, one block higher" },
      { label: "~0 ~-1 ~0", detail: "One block down", doc: "Relative: same X/Z, one block lower" },
      { label: "^ ^ ^1", detail: "One block forward", doc: "Local: one block in facing direction" },
      { label: "^ ^ ^", detail: "Local coordinates", doc: "Uses entity's facing direction (left/up/forward)" },
      { label: "0 64 0", detail: "Absolute position", doc: "World coordinates at X=0, Y=64, Z=0" },
    ];
    for (const pos of positions) {
      if (!seenValues.has(pos.label)) {
        seenValues.add(pos.label);
        suggestions.push({
          label: pos.label,
          kind: monaco.languages.CompletionItemKind.Value,
          insertText: pos.label,
          detail: pos.detail,
          documentation: pos.doc,
          range: range,
        });
      }
    }
    return;
  }

  // MESSAGE types - just show a helpful hint
  if (typeUpper === "MESSAGE_ROOT" || typeUpper === "MESSAGE") {
    suggestions.push({
      label: "<type your message>",
      kind: monaco.languages.CompletionItemKind.Text,
      insertText: "",
      detail: "Type any text message",
      documentation: "Enter the message you want to send. You can include @mentions like @a to show player names.",
      range: range,
      sortText: "0",
    });
    return;
  }

  // BOOLEAN types
  if (typeUpper === "BOOLEAN" || typeUpper === "BOOL") {
    for (const val of ["true", "false"]) {
      if (!seenValues.has(val)) {
        seenValues.add(val);
        suggestions.push({
          label: val,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: val,
          detail: `${paramName}: ${friendlyName}`,
          range: range,
        });
      }
    }
    return;
  }

  // INT types
  if (typeUpper === "INT" || typeUpper === "INTEGER") {
    suggestions.push({
      label: "0",
      kind: monaco.languages.CompletionItemKind.Value,
      insertText: "0",
      detail: `${paramName}: ${friendlyName}`,
      documentation: typeDesc,
      range: range,
    });
    return;
  }

  // FLOAT/RVAL types
  if (typeUpper === "FLOAT" || typeUpper === "RVAL" || typeUpper === "VAL") {
    suggestions.push({
      label: "0",
      kind: monaco.languages.CompletionItemKind.Value,
      insertText: "0",
      detail: `${paramName}: ${friendlyName}`,
      documentation: typeDesc,
      range: range,
    });
    if (typeUpper === "RVAL") {
      suggestions.push({
        label: "~",
        kind: monaco.languages.CompletionItemKind.Value,
        insertText: "~",
        detail: "Relative rotation",
        documentation: "Keep current rotation or add/subtract from it (e.g., ~90)",
        range: range,
      });
    }
    return;
  }

  // STRING types
  if (typeUpper === "STRING" || typeUpper === "PATHCOMMAND") {
    suggestions.push({
      label: '""',
      kind: monaco.languages.CompletionItemKind.Value,
      insertText: '"$0"',
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      detail: `${paramName}: ${friendlyName}`,
      documentation: typeDesc,
      range: range,
    });
    return;
  }

  // Check for examples from loaded type metadata
  const examples = getTypeExamples(typeName);
  if (examples && examples.length > 0) {
    for (const example of examples) {
      // IFormSample uses path for description, content for value
      const value = String(example.content);
      if (!seenValues.has(value)) {
        seenValues.add(value);
        suggestions.push({
          label: value,
          kind: monaco.languages.CompletionItemKind.Value,
          insertText: value,
          detail: example.path || `${paramName}: ${friendlyName}`,
          documentation: typeDesc,
          range: range,
        });
      }
    }
    return;
  }

  // For unknown types, show a placeholder with the friendly name
  if (typeDesc) {
    suggestions.push({
      label: `<${friendlyName}>`,
      kind: monaco.languages.CompletionItemKind.Text,
      insertText: "",
      detail: paramName,
      documentation: typeDesc,
      range: range,
      sortText: "zzz",
    });
  }
}

/**
 * Get generic suggestions when command is unknown
 * Returns empty - we don't want to suggest irrelevant selectors/positions
 */
function getGenericSuggestions(range: monaco.IRange): monaco.languages.CompletionList {
  // Return empty - don't suggest things that might be irrelevant
  return { suggestions: [] };
}

/**
 * Provide hover information for commands
 */
function provideHover(
  document: monaco.editor.ITextModel,
  position: monaco.Position,
  token: monaco.CancellationToken
): monaco.languages.ProviderResult<monaco.languages.Hover> {
  const wordInfo = document.getWordAtPosition(position);

  if (!wordInfo || !_commandsMetadataLoaded) {
    return null;
  }

  const word = wordInfo.word.toLowerCase();
  const lineContent = document.getLineContent(position.lineNumber);

  // Check if hovering over a command name
  const trimmedLine = lineContent.trim();
  const startsWithSlash = trimmedLine.startsWith("/");
  const commandPart = startsWithSlash ? trimmedLine.substring(1) : trimmedLine;
  const tokens = commandPart.split(/\s+/);

  if (tokens.length > 0 && tokens[0].toLowerCase() === word) {
    const command = _commandsByName.get(word);

    if (command) {
      // Get form metadata for richer descriptions
      const formMeta = getCommandFormMetadata(command.name);

      let markdown = `**/${command.name}**\n\n`;
      // Prefer form description over mojang-commands description
      markdown += formMeta?.description || command.description || "";
      markdown += "\n\n---\n\n";
      markdown += "**Syntax:**\n";

      for (const overload of command.overloads) {
        // Get overload info from form metadata
        const overloadInfo = getOverloadInfo(command.name, overload.name);
        const params =
          overload.params
            ?.map((p) => {
              const humanType = humanifyTypeName(p.type?.name);
              return p.is_optional ? `[${p.name}: ${humanType}]` : `<${p.name}: ${humanType}>`;
            })
            .join(" ") || "";
        if (overloadInfo?.title) {
          markdown += `**${overloadInfo.title}**\n`;
        }
        markdown += `\`/${command.name} ${params}\`\n`;
        if (overloadInfo?.description) {
          markdown += `${overloadInfo.description}\n`;
        }
        markdown += "\n";
      }

      // Add aliases from form metadata
      if (formMeta?.aliases && formMeta.aliases.length > 0) {
        markdown += `\n**Aliases:** ${formMeta.aliases.join(", ")}`;
      }

      if (command.permission_level) {
        markdown += `\n**Permission:** ${command.permission_level}`;
      }

      if (command.requires_cheats) {
        markdown += "\n\n⚠️ **Requires cheats enabled**";
      }

      return {
        range: {
          startLineNumber: position.lineNumber,
          startColumn: wordInfo.startColumn,
          endLineNumber: position.lineNumber,
          endColumn: wordInfo.endColumn,
        },
        contents: [{ value: markdown, isTrusted: true }],
      };
    }
  }

  return null;
}

/**
 * Provide signature help (parameter hints) when typing command arguments
 */
function provideSignatureHelp(
  document: monaco.editor.ITextModel,
  position: monaco.Position,
  token: monaco.CancellationToken,
  context: monaco.languages.SignatureHelpContext
): monaco.languages.ProviderResult<monaco.languages.SignatureHelpResult> {
  const lineContent = document.getLineContent(position.lineNumber);
  const textBeforeCursor = lineContent.substring(0, position.column - 1);

  const trimmedLine = textBeforeCursor.trim();
  const startsWithSlash = trimmedLine.startsWith("/");
  const commandPart = startsWithSlash ? trimmedLine.substring(1) : trimmedLine;
  const tokens = commandPart.split(/\s+/);

  if (tokens.length === 0) {
    return null;
  }

  const commandName = tokens[0].toLowerCase();
  const command = _commandsByName.get(commandName);

  if (!command || !command.overloads || command.overloads.length === 0) {
    return null;
  }

  // Get form metadata for richer descriptions
  const formMeta = getCommandFormMetadata(commandName);

  // Figure out which parameter we're on
  const paramIndex = textBeforeCursor.endsWith(" ") ? tokens.length - 1 : tokens.length - 2;

  if (paramIndex < 0) {
    return null;
  }

  // Get already-typed arguments for filtering overloads
  // Include all typed tokens (excluding command name) - even the current one - for filtering
  // This way, as soon as user types @a, only selector-first overloads are shown
  const typedArgs = tokens.slice(1);

  const signatures: monaco.languages.SignatureInformation[] = [];

  for (const overload of command.overloads) {
    if (!overload.params) {
      continue;
    }

    // Filter out overloads that don't match the already-typed arguments
    if (!isOverloadCompatible(overload, typedArgs)) {
      continue;
    }

    // Get overload info from form metadata
    const overloadInfo = getOverloadInfo(commandName, overload.name);

    const paramLabels: string[] = [];
    const parameters: monaco.languages.ParameterInformation[] = [];

    for (const param of overload.params) {
      const humanTypeName = humanifyTypeName(param.type?.name);
      const paramStr = param.is_optional ? `[${param.name}: ${humanTypeName}]` : `<${param.name}: ${humanTypeName}>`;
      paramLabels.push(paramStr);

      // Get field description from form metadata
      const fieldId = param.name.replace(/\s+/g, "_").toLowerCase();
      const fieldDesc = getFieldDescription(commandName, fieldId);

      let paramDoc = `${param.name} - Type: ${humanTypeName}${param.is_optional ? " (optional)" : ""}`;
      if (fieldDesc) {
        paramDoc += `\n\n${fieldDesc}`;
      }

      parameters.push({
        label: paramStr,
        documentation: paramDoc,
      });
    }

    const signatureLabel = `/${command.name} ${paramLabels.join(" ")}`;

    // Use overload title if available, otherwise fall back to command description
    let signatureDoc = overloadInfo?.description || formMeta?.description || command.description || "";
    if (overloadInfo?.title) {
      signatureDoc = `**${overloadInfo.title}**\n\n${signatureDoc}`;
    }

    signatures.push({
      label: signatureLabel,
      documentation: signatureDoc,
      parameters: parameters,
    });
  }

  if (signatures.length === 0) {
    return null;
  }

  // Find the best matching signature based on argument count
  let activeSignature = 0;
  for (let i = 0; i < signatures.length; i++) {
    const sig = signatures[i];
    if (paramIndex < sig.parameters.length) {
      activeSignature = i;
      break;
    }
  }

  return {
    value: {
      signatures: signatures,
      activeSignature: activeSignature,
      activeParameter: Math.min(paramIndex, signatures[activeSignature].parameters.length - 1),
    },
    dispose: () => {},
  };
}

/**
 * Validate commands in an editor and return markers
 */
export function validateCommands(model: monaco.editor.ITextModel): monaco.editor.IMarkerData[] {
  if (!_commandsMetadataLoaded) {
    return [];
  }

  const markers: monaco.editor.IMarkerData[] = [];
  const lineCount = model.getLineCount();

  for (let lineNum = 1; lineNum <= lineCount; lineNum++) {
    const lineContent = model.getLineContent(lineNum).trim();

    // Skip empty lines and comments
    if (!lineContent || lineContent.startsWith("#")) {
      continue;
    }

    // Parse the command
    const startsWithSlash = lineContent.startsWith("/");
    const commandPart = startsWithSlash ? lineContent.substring(1) : lineContent;
    const tokens = commandPart.split(/\s+/);

    if (tokens.length === 0) {
      continue;
    }

    const commandName = tokens[0].toLowerCase();
    const command = _commandsByName.get(commandName);

    if (!command) {
      // Unknown command - add warning marker
      markers.push({
        severity: monaco.MarkerSeverity.Warning,
        message: `Unknown command: ${tokens[0]}`,
        startLineNumber: lineNum,
        startColumn: startsWithSlash ? 2 : 1,
        endLineNumber: lineNum,
        endColumn: startsWithSlash ? tokens[0].length + 2 : tokens[0].length + 1,
      });
    } else {
      // Validate arguments against overloads
      const argCount = tokens.length - 1;
      let hasValidOverload = false;
      let minRequired = Infinity;
      let maxParams = 0;

      for (const overload of command.overloads) {
        const params = overload.params || [];
        const requiredCount = params.filter((p) => !p.is_optional).length;
        const totalCount = params.length;

        minRequired = Math.min(minRequired, requiredCount);
        maxParams = Math.max(maxParams, totalCount);

        if (argCount >= requiredCount && argCount <= totalCount) {
          hasValidOverload = true;
          break;
        }
      }

      if (!hasValidOverload && command.overloads.length > 0) {
        if (argCount < minRequired) {
          markers.push({
            severity: monaco.MarkerSeverity.Error,
            message: `Missing required arguments. Expected at least ${minRequired} argument(s).`,
            startLineNumber: lineNum,
            startColumn: 1,
            endLineNumber: lineNum,
            endColumn: lineContent.length + 1,
          });
        } else if (argCount > maxParams && maxParams > 0) {
          markers.push({
            severity: monaco.MarkerSeverity.Warning,
            message: `Too many arguments. Expected at most ${maxParams} argument(s).`,
            startLineNumber: lineNum,
            startColumn: 1,
            endLineNumber: lineNum,
            endColumn: lineContent.length + 1,
          });
        }
      }
    }
  }

  return markers;
}

/**
 * Register the Minecraft commands language with Monaco
 * Only call this once globally
 */
export function registerMinecraftCommandsLanguage(monacoInstance: typeof monaco): void {
  if (_languageRegistered) {
    return;
  }

  _languageRegistered = true;

  // Register the language
  monacoInstance.languages.register({ id: "mcCommands" });

  // Set up the tokenizer
  monacoInstance.languages.setMonarchTokensProvider("mcCommands", getMonarchTokenizer());

  // Register completion provider with VERY aggressive triggering
  // Include all letters so autocomplete triggers on every keystroke for command names
  const triggerChars = [
    "/",
    " ",
    "@",
    "[",
    "]",
    "=",
    ":",
    "~",
    "^",
    "_",
    "-",
    ".",
    "'",
    '"',
    // All lowercase letters to trigger on every keystroke
    "a",
    "b",
    "c",
    "d",
    "e",
    "f",
    "g",
    "h",
    "i",
    "j",
    "k",
    "l",
    "m",
    "n",
    "o",
    "p",
    "q",
    "r",
    "s",
    "t",
    "u",
    "v",
    "w",
    "x",
    "y",
    "z",
  ];

  monacoInstance.languages.registerCompletionItemProvider("mcCommands", {
    triggerCharacters: triggerChars,
    provideCompletionItems: provideCompletionItems,
  });

  // Register hover provider
  monacoInstance.languages.registerHoverProvider("mcCommands", {
    provideHover: provideHover,
  });

  // Register signature help provider
  monacoInstance.languages.registerSignatureHelpProvider("mcCommands", {
    signatureHelpTriggerCharacters: [" "],
    signatureHelpRetriggerCharacters: [" "],
    provideSignatureHelp: provideSignatureHelp,
  });
}
