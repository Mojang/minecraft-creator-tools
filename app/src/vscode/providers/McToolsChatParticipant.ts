// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * McToolsChatParticipant - @minecraft Chat Participant for VS Code Copilot
 *
 * This provides a chat participant that can be invoked with @minecraft in Copilot Chat.
 * It wraps the MCP server tool functionality to provide Minecraft-specific AI assistance.
 *
 * Example prompts:
 * - "@minecraft validate this entity"
 * - "@minecraft create a zombie variant that's fireproof"
 * - "@minecraft what's wrong with this manifest?"
 *
 * @see MinecraftMcpServer for the underlying tool implementations
 */

import * as vscode from "vscode";
import Log from "../../core/Log";
import IStorage from "../../storage/IStorage";
import Project from "../../app/Project";

/**
 * Chat participant ID - users invoke with @minecraft
 */
export const MINECRAFT_CHAT_PARTICIPANT_ID = "mctools.minecraft";

/**
 * Commands the chat participant can handle
 */
type ChatCommand = "validate" | "create" | "explain" | "fix";

export default class McToolsChatParticipant {
  private storageProvider: (uri: vscode.Uri) => IStorage | undefined;
  private projectProvider: (uri: vscode.Uri) => Promise<Project | undefined>;
  private participant: vscode.ChatParticipant | undefined;

  constructor(
    storageProvider: (uri: vscode.Uri) => IStorage | undefined,
    projectProvider: (uri: vscode.Uri) => Promise<Project | undefined>
  ) {
    this.storageProvider = storageProvider;
    this.projectProvider = projectProvider;
  }

  /**
   * Register the chat participant with VS Code
   */
  public register(context: vscode.ExtensionContext): void {
    // Check if chat API is available (requires VS Code 1.93+)
    if (!vscode.chat || !vscode.chat.createChatParticipant) {
      Log.debug("Chat participant API not available - skipping registration");
      return;
    }

    try {
      this.participant = vscode.chat.createChatParticipant(
        MINECRAFT_CHAT_PARTICIPANT_ID,
        this.handleRequest.bind(this)
      );

      this.participant.iconPath = vscode.Uri.joinPath(context.extensionUri, "res/images/logo512.png");

      // Add followup provider for suggested next actions
      this.participant.followupProvider = {
        provideFollowups: this.provideFollowups.bind(this),
      };

      context.subscriptions.push(this.participant);

      Log.debug("Minecraft chat participant registered successfully");
    } catch (error) {
      Log.debug(`Failed to register chat participant: ${error}`);
    }
  }

  /**
   * Main request handler for the chat participant
   */
  private async handleRequest(
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<vscode.ChatResult> {
    const prompt = request.prompt.toLowerCase();

    try {
      // Route based on command or prompt content
      if (request.command === "validate" || prompt.includes("validate")) {
        return await this.handleValidate(request, context, stream, token);
      }

      if (request.command === "create" || prompt.includes("create") || prompt.includes("make")) {
        return await this.handleCreate(request, context, stream, token);
      }

      if (request.command === "explain" || prompt.includes("explain") || prompt.includes("what")) {
        return await this.handleExplain(request, context, stream, token);
      }

      if (request.command === "fix" || prompt.includes("fix") || prompt.includes("wrong")) {
        return await this.handleFix(request, context, stream, token);
      }

      // Default: provide general help with context
      return await this.handleGeneral(request, context, stream, token);
    } catch (error) {
      stream.markdown(`❌ **Error**: ${error instanceof Error ? error.message : String(error)}`);
      return { metadata: { error: true } };
    }
  }

  /**
   * Handle validation requests
   */
  private async handleValidate(
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<vscode.ChatResult> {
    stream.progress("Validating Minecraft content...");

    // Get the active document or workspace
    const activeEditor = vscode.window.activeTextEditor;
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (!workspaceFolders || workspaceFolders.length === 0) {
      stream.markdown("📂 No workspace folder open. Please open a Minecraft add-on folder first.");
      return { metadata: { command: "validate", success: false } };
    }

    // Try to get or create a project
    const project = await this.projectProvider(workspaceFolders[0].uri);

    if (!project) {
      stream.markdown("⚠️ Could not load project. Make sure you have a valid Minecraft add-on structure.");
      return { metadata: { command: "validate", success: false } };
    }

    // Run validation
    const infoSet = project.indevInfoSet;
    await infoSet.generateForProject();

    const data = infoSet.getDataObject(undefined, undefined, undefined);

    // Format results
    stream.markdown("## 📋 Validation Results\n\n");

    const errorCount = data.items?.filter((i: any) => i.iTp === 3).length || 0; // InfoItemType.error = 3
    const warningCount = data.items?.filter((i: any) => i.iTp === 4).length || 0; // InfoItemType.warning = 4
    const infoCount = data.items?.filter((i: any) => i.iTp === 2 || i.iTp === 6).length || 0; // info or recommendation

    if (errorCount === 0 && warningCount === 0) {
      stream.markdown("✅ **No issues found!** Your content looks good.\n\n");
    } else {
      stream.markdown(
        `Found **${errorCount}** errors, **${warningCount}** warnings, **${infoCount}** recommendations.\n\n`
      );

      // Show top issues
      const topIssues = data.items?.slice(0, 10) || [];
      for (const item of topIssues) {
        const icon = item.iTp === 3 ? "❌" : item.iTp === 4 ? "⚠️" : "ℹ️";
        stream.markdown(`${icon} **${item.gId}**: ${item.m}\n`);
        if (item.p) {
          stream.markdown(`   📄 ${item.p}\n`);
        }
      }

      if ((data.items?.length || 0) > 10) {
        stream.markdown(`\n... and ${(data.items?.length || 0) - 10} more issues.\n`);
      }
    }

    stream.markdown("\n💡 *Use the Problems panel (Ctrl+Shift+M) for the full list.*");

    return {
      metadata: {
        command: "validate",
        success: true,
        errorCount,
        warningCount,
      },
    };
  }

  /**
   * Handle creation requests - delegates to LLM with MCTools context
   */
  private async handleCreate(
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<vscode.ChatResult> {
    stream.progress("Analyzing your creation request...");

    // Provide context about what MCTools can create
    stream.markdown("## 🛠️ Creating Minecraft Content\n\n");
    stream.markdown("I can help you create various Minecraft Bedrock content. Here are the available templates:\n\n");

    stream.markdown(
      "**Entities**: allay, axolotl, cat, cow, creeper, enderman, rabbit, pig, sheep, skeleton, wolf, zombie\n"
    );
    stream.markdown("**Blocks**: basicUnitCubeBlock, crateBlock, basicDieBlock, sushiRollBlock, fishBowlBlock\n");
    stream.markdown("**Items**: hardBiscuit, pear, elixir, rod, key, customSword, wrench\n");
    stream.markdown("**Other**: spawn_rule, loot_table, recipe_shapeless, recipe_shaped, feature_rule, jigsaw\n\n");

    // Try to understand what they want to create
    const prompt = request.prompt.toLowerCase();
    let suggestion = "";

    if (prompt.includes("entity") || prompt.includes("mob") || prompt.includes("creature")) {
      suggestion = "entity_behavior";
    } else if (prompt.includes("block")) {
      suggestion = "basicUnitCubeBlock";
    } else if (prompt.includes("item")) {
      suggestion = "item_behavior";
    } else if (prompt.includes("loot") || prompt.includes("drop")) {
      suggestion = "loot_table";
    } else if (prompt.includes("recipe") || prompt.includes("craft")) {
      suggestion = "recipe_shaped";
    }

    if (suggestion) {
      stream.markdown(`Based on your request, I suggest starting with: **${suggestion}**\n\n`);
    }

    stream.markdown("To create content:\n");
    stream.markdown("1. Use Command Palette → `Minecraft: Add item to project`\n");
    stream.markdown("2. Or use the MCTools sidebar → Add button\n\n");

    stream.markdown("💡 *If you have the MCT MCP server configured, I can use those tools directly!*");

    return {
      metadata: {
        command: "create",
        success: true,
        suggestion,
      },
    };
  }

  /**
   * Handle explanation requests
   */
  private async handleExplain(
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<vscode.ChatResult> {
    stream.progress("Analyzing content...");

    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      stream.markdown("📄 No active file. Open a Minecraft JSON file to get an explanation.");
      return { metadata: { command: "explain", success: false } };
    }

    const document = activeEditor.document;
    const text = document.getText();

    try {
      const json = JSON.parse(text);
      const filePath = document.uri.fsPath;

      stream.markdown("## 📖 File Analysis\n\n");

      // Detect file type
      if (json.format_version) {
        stream.markdown(`**Format Version**: ${json.format_version}\n\n`);
      }

      if (json["minecraft:entity"]) {
        stream.markdown("**Type**: Entity Behavior Definition\n\n");
        const entity = json["minecraft:entity"];
        if (entity.description) {
          stream.markdown(`**Identifier**: \`${entity.description.identifier}\`\n`);
          stream.markdown(`**Runtime ID**: ${entity.description.is_spawnable ? "Spawnable" : "Not spawnable"}\n\n`);
        }
        if (entity.components) {
          const componentNames = Object.keys(entity.components);
          stream.markdown(`**Components** (${componentNames.length}):\n`);
          componentNames.slice(0, 10).forEach((c) => stream.markdown(`- \`${c}\`\n`));
          if (componentNames.length > 10) {
            stream.markdown(`- ... and ${componentNames.length - 10} more\n`);
          }
        }
      } else if (json["minecraft:block"]) {
        stream.markdown("**Type**: Block Definition\n\n");
        const block = json["minecraft:block"];
        if (block.description) {
          stream.markdown(`**Identifier**: \`${block.description.identifier}\`\n\n`);
        }
      } else if (json["minecraft:item"]) {
        stream.markdown("**Type**: Item Definition\n\n");
        const item = json["minecraft:item"];
        if (item.description) {
          stream.markdown(`**Identifier**: \`${item.description.identifier}\`\n\n`);
        }
      } else if (json.header && json.modules) {
        stream.markdown("**Type**: Manifest File\n\n");
        stream.markdown(`**Name**: ${json.header.name}\n`);
        stream.markdown(`**Description**: ${json.header.description}\n`);
        stream.markdown(`**UUID**: \`${json.header.uuid}\`\n`);
        stream.markdown(`**Version**: ${json.header.version?.join(".")}\n\n`);
        stream.markdown(`**Modules**: ${json.modules.length}\n`);
        json.modules.forEach((m: any) => {
          stream.markdown(`- ${m.type}: v${m.version?.join(".")}\n`);
        });
      } else {
        stream.markdown("**Type**: Unknown Minecraft JSON\n\n");
        stream.markdown("I don't recognize this file type. It may be a custom format or incomplete.\n");
      }
    } catch (error) {
      stream.markdown("⚠️ Could not parse the file as JSON. Please check for syntax errors.\n");
    }

    return { metadata: { command: "explain", success: true } };
  }

  /**
   * Handle fix requests
   */
  private async handleFix(
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<vscode.ChatResult> {
    stream.progress("Analyzing issues...");

    // First, run validation to find issues
    const result = await this.handleValidate(request, context, stream, token);

    stream.markdown("\n---\n\n## 🔧 Available Fixes\n\n");
    stream.markdown("MCTools can automatically fix some common issues:\n\n");
    stream.markdown("- **Outdated format versions** - Update to latest\n");
    stream.markdown("- **Outdated script module versions** - Update @minecraft/server, etc.\n");
    stream.markdown("- **Missing UUIDs** - Generate new UUIDs\n");
    stream.markdown("- **Base game version** - Update min_engine_version\n\n");
    stream.markdown("To apply fixes:\n");
    stream.markdown("1. Open the file with issues\n");
    stream.markdown("2. Click the lightbulb 💡 icon\n");
    stream.markdown("3. Select the quick fix to apply\n\n");
    stream.markdown("Or use Command Palette → `Minecraft: Show Minecraft project information and validation page`");

    return { metadata: { command: "fix", success: true } };
  }

  /**
   * Handle general/fallback requests
   */
  private async handleGeneral(
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<vscode.ChatResult> {
    stream.markdown("## 🎮 Minecraft Creator Tools\n\n");
    stream.markdown("I can help you with Minecraft Bedrock add-on development! Try asking me to:\n\n");
    stream.markdown("- **@minecraft validate** - Check your content for errors\n");
    stream.markdown("- **@minecraft create** - Create new entities, blocks, items\n");
    stream.markdown("- **@minecraft explain** - Explain the current file\n");
    stream.markdown("- **@minecraft fix** - Find and fix issues\n\n");
    stream.markdown("You can also ask questions about your Minecraft content!\n\n");

    // Provide context about the workspace if available
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      stream.markdown(`📂 **Current workspace**: ${workspaceFolders[0].name}\n`);
    }

    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
      const fileName = activeEditor.document.fileName.split(/[/\\]/).pop();
      stream.markdown(`📄 **Active file**: ${fileName}\n`);
    }

    return { metadata: { command: "general", success: true } };
  }

  /**
   * Provide follow-up suggestions after a response
   */
  private provideFollowups(
    result: vscode.ChatResult,
    context: vscode.ChatContext,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.ChatFollowup[]> {
    const metadata = result.metadata as { command?: string; errorCount?: number } | undefined;
    const followups: vscode.ChatFollowup[] = [];

    if (metadata?.command === "validate" && (metadata?.errorCount || 0) > 0) {
      followups.push({
        prompt: "fix these issues",
        label: "🔧 Fix Issues",
        command: "fix",
      });
    }

    if (metadata?.command === "explain") {
      followups.push({
        prompt: "validate this file",
        label: "✅ Validate",
        command: "validate",
      });
    }

    if (metadata?.command === "general") {
      followups.push(
        {
          prompt: "validate my project",
          label: "✅ Validate Project",
          command: "validate",
        },
        {
          prompt: "create a new entity",
          label: "🛠️ Create Entity",
          command: "create",
        }
      );
    }

    return followups;
  }

  /**
   * Dispose of the chat participant
   */
  public dispose(): void {
    this.participant?.dispose();
  }
}
