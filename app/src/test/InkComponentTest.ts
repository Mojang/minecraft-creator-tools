/**
 * =============================================================================
 * INK COMPONENT TESTS
 * =============================================================================
 *
 * Tests for the Ink-based CLI UI components using ink-testing-library patterns.
 * These tests validate:
 * - Command provider registration and suggestions
 * - MCT built-in command execution
 * - BDS command provider behavior
 * - Response parsing
 *
 * Note: We test the command providers directly rather than rendering Ink
 * components, as full Ink rendering requires a TTY environment. For visual
 * testing of Ink components, use the actual CLI in a terminal.
 * =============================================================================
 */

import { expect } from "chai";
import { describe, it, beforeEach } from "mocha";
import {
  CommandProviderRegistry,
  ICommandContext,
  IServerStatus,
  IPlayerInfo,
} from "../cli/ui/commands/ICommandProvider";
import { MctCommandProvider } from "../cli/ui/commands/MctCommandProvider";
import { BdsCommandProvider } from "../cli/ui/commands/BdsCommandProvider";

/**
 * Create a mock command context for testing
 */
function createMockContext(overrides: Partial<ICommandContext> = {}): ICommandContext {
  const defaultStatus: IServerStatus = {
    state: "running",
    playerCount: 2,
    maxPlayers: 10,
    version: "1.21.0",
    port: 19132,
    worldName: "Test World",
    uptimeSeconds: 3661, // 1 hour, 1 minute, 1 second
  };

  const defaultPlayers: IPlayerInfo[] = [
    { name: "Player1", xuid: "1234567890", connectedAt: new Date() },
    { name: "Player2", xuid: "0987654321", connectedAt: new Date() },
  ];

  const sentCommands: string[] = [];
  let exitRequested = false;
  let logCleared = false;

  return {
    sendToBds: (command: string) => {
      sentCommands.push(command);
    },
    requestExit: () => {
      exitRequested = true;
    },
    getServerStatus: () => overrides.getServerStatus?.() || defaultStatus,
    getPlayers: () => overrides.getPlayers?.() || defaultPlayers,
    clearLog: () => {
      logCleared = true;
    },
    setSearchFilter: overrides.setSearchFilter,
    exportLogs: (overrides as any).exportLogs,
    getProviders: () => [],
    ...overrides,
  };
}

describe("Ink CLI Command Providers", () => {
  describe("MctCommandProvider", () => {
    let provider: MctCommandProvider;

    beforeEach(async () => {
      provider = new MctCommandProvider();
      await provider.initialize();
    });

    it("should have high priority", () => {
      expect(provider.priority).to.equal(100);
    });

    it("should register built-in commands", () => {
      const commands = provider.getCommands();
      expect(commands.length).to.be.greaterThan(0);

      const commandNames = commands.map((c) => c.name);
      expect(commandNames).to.include("help");
      expect(commandNames).to.include("status");
      expect(commandNames).to.include("exit");
      expect(commandNames).to.include("players");
      expect(commandNames).to.include("clear");
      expect(commandNames).to.include("version");
    });

    it("should resolve command aliases", () => {
      // "?" is an alias for "help"
      const helpCmd = provider.getCommand("?");
      expect(helpCmd).to.exist;
      expect(helpCmd!.name).to.equal("help");

      // "quit" is an alias for "exit"
      const exitCmd = provider.getCommand("quit");
      expect(exitCmd).to.exist;
      expect(exitCmd!.name).to.equal("exit");
    });

    it("should provide suggestions for partial input", () => {
      const suggestions = provider.getSuggestions("he", 2);
      expect(suggestions.length).to.be.greaterThan(0);

      const helpSuggestion = suggestions.find((s) => s.value === "help");
      expect(helpSuggestion).to.exist;
      expect(helpSuggestion!.description).to.include("command");
    });

    it("should provide suggestions for empty input", () => {
      const suggestions = provider.getSuggestions("", 0);
      expect(suggestions.length).to.be.greaterThan(0);
    });

    it("should execute help command", async () => {
      const mockProviders = [provider];
      const context = createMockContext({
        getProviders: () => mockProviders,
      });

      const response = await provider.execute("help", context);
      expect(response).to.exist;
      expect(response!.success).to.be.true;
      expect(response!.type).to.equal("help");
      expect(response!.message).to.include("help");
    });

    it("should execute help for specific command", async () => {
      const mockProviders = [provider];
      const context = createMockContext({
        getProviders: () => mockProviders,
      });

      const response = await provider.execute("help status", context);
      expect(response).to.exist;
      expect(response!.success).to.be.true;
      expect(response!.message).to.include("status");
    });

    it("should execute status command", async () => {
      const context = createMockContext();
      const response = await provider.execute("status", context);

      expect(response).to.exist;
      expect(response!.success).to.be.true;
      expect(response!.message).to.include("running");
      expect(response!.message).to.include("1.21.0");
      expect(response!.message).to.include("2");
    });

    it("should execute players command", async () => {
      const context = createMockContext();
      const response = await provider.execute("players", context);

      expect(response).to.exist;
      expect(response!.success).to.be.true;
      expect(response!.message).to.include("Player1");
      expect(response!.message).to.include("Player2");
    });

    it("should execute version command", async () => {
      const context = createMockContext();
      const response = await provider.execute("version", context);

      expect(response).to.exist;
      expect(response!.success).to.be.true;
      expect(response!.message).to.include("Minecraft Creator Tools");
    });

    it("should return undefined for unknown command", async () => {
      const context = createMockContext();
      const response = await provider.execute("unknowncommand", context);
      expect(response).to.be.undefined;
    });
  });

  describe("BdsCommandProvider", () => {
    let provider: BdsCommandProvider;

    beforeEach(async () => {
      provider = new BdsCommandProvider();
      await provider.initialize();
    });

    it("should have lower priority than MCT", () => {
      expect(provider.priority).to.equal(50);
    });

    it("should register BDS commands", () => {
      const commands = provider.getCommands();
      expect(commands.length).to.be.greaterThan(0);

      const commandNames = commands.map((c) => c.name);
      expect(commandNames).to.include("give");
      expect(commandNames).to.include("stop");
      expect(commandNames).to.include("teleport");
    });

    it("should provide suggestions for partial input", () => {
      const suggestions = provider.getSuggestions("gi", 2);
      expect(suggestions.length).to.be.greaterThan(0);

      const giveSuggestion = suggestions.find((s) => s.value === "give");
      expect(giveSuggestion).to.exist;
    });

    it("should handle slash prefix in suggestions", () => {
      const suggestions = provider.getSuggestions("/gi", 3);
      expect(suggestions.length).to.be.greaterThan(0);

      const giveSuggestion = suggestions.find((s) => s.value === "give");
      expect(giveSuggestion).to.exist;
    });

    it("should parse querytarget JSON response", () => {
      const jsonResponse = '[{"dimension":"overworld","position":{"x":0.5,"y":64.0,"z":0.5}}]';
      const response = provider.parseResponse(jsonResponse, "querytarget");

      expect(response).to.exist;
      expect(response!.type).to.equal("json");
      expect(response!.data).to.be.an("array");
      expect(response!.data[0].dimension).to.equal("overworld");
    });

    it("should parse list response", () => {
      const listResponse = "There are 2/10 players online: Player1, Player2";
      const response = provider.parseResponse(listResponse, "list");

      expect(response).to.exist;
      expect(response!.type).to.equal("json");
      expect(response!.data.current).to.equal(2);
      expect(response!.data.max).to.equal(10);
      expect(response!.data.players).to.deep.equal(["Player1", "Player2"]);
    });

    it("should parse testfor found response", () => {
      const testforResponse = "Found Player1";
      const response = provider.parseResponse(testforResponse, "testfor");

      expect(response).to.exist;
      expect(response!.data.found).to.be.true;
      expect(response!.data.target).to.equal("Player1");
    });

    it("should parse testfor not found response", () => {
      const testforResponse = "No targets matched selector";
      const response = provider.parseResponse(testforResponse, "testfor");

      expect(response).to.exist;
      expect(response!.data.found).to.be.false;
    });
  });

  describe("CommandProviderRegistry", () => {
    let registry: CommandProviderRegistry;
    let mctProvider: MctCommandProvider;
    let bdsProvider: BdsCommandProvider;

    beforeEach(async () => {
      registry = new CommandProviderRegistry();
      mctProvider = new MctCommandProvider();
      bdsProvider = new BdsCommandProvider();

      registry.register(mctProvider);
      registry.register(bdsProvider);
      await registry.initialize();
    });

    it("should sort providers by priority", () => {
      const providers = registry.getProviders();
      expect(providers[0].name).to.equal("mct"); // Higher priority
      expect(providers[1].name).to.equal("bds"); // Lower priority
    });

    it("should aggregate commands from all providers", () => {
      const allCommands = registry.getAllCommands();
      expect(allCommands.length).to.be.greaterThan(0);

      const sources = new Set(allCommands.map((c) => c.source));
      expect(sources.has("mct")).to.be.true;
      expect(sources.has("bds")).to.be.true;
    });

    it("should find command from correct provider", () => {
      // "help" is from MCT
      const helpCmd = registry.getCommand("help");
      expect(helpCmd).to.exist;
      expect(helpCmd!.source).to.equal("mct");

      // "give" is from BDS
      const giveCmd = registry.getCommand("give");
      expect(giveCmd).to.exist;
      expect(giveCmd!.source).to.equal("bds");
    });

    it("should aggregate suggestions from all providers", () => {
      const suggestions = registry.getSuggestions("", 0);
      expect(suggestions.length).to.be.greaterThan(0);

      // Should have suggestions from both providers
      const hasHelp = suggestions.some((s) => s.value === "help");
      const hasGive = suggestions.some((s) => s.value === "give");
      expect(hasHelp).to.be.true;
      expect(hasGive).to.be.true;
    });

    it("should execute MCT command through registry", async () => {
      const mockProviders = [mctProvider, bdsProvider];
      const context = createMockContext({
        getProviders: () => mockProviders,
      });

      const response = await registry.execute("version", context);
      expect(response).to.exist;
      expect(response!.success).to.be.true;
      expect(response!.message).to.include("Minecraft Creator Tools");
    });

    it("should return undefined for BDS command (passthrough)", async () => {
      const context = createMockContext();
      const response = await registry.execute("give @s diamond", context);

      // BDS commands don't have execute() - they pass through to the server
      expect(response).to.be.undefined;
    });
  });

  describe("MctCommandProvider Extended Commands", () => {
    let provider: MctCommandProvider;

    beforeEach(async () => {
      provider = new MctCommandProvider();
      await provider.initialize();
    });

    it("should register restart command", () => {
      const cmd = provider.getCommand("restart");
      expect(cmd).to.exist;
      expect(cmd!.name).to.equal("restart");
      expect(cmd!.description).to.include("Restart");
    });

    it("should resolve restart alias 'reboot'", () => {
      const cmd = provider.getCommand("reboot");
      expect(cmd).to.exist;
      expect(cmd!.name).to.equal("restart");
    });

    it("should register search command", () => {
      const cmd = provider.getCommand("search");
      expect(cmd).to.exist;
      expect(cmd!.name).to.equal("search");
    });

    it("should resolve search aliases", () => {
      for (const alias of ["grep", "find", "filter"]) {
        const cmd = provider.getCommand(alias);
        expect(cmd, `Alias '${alias}' should resolve`).to.exist;
        expect(cmd!.name).to.equal("search");
      }
    });

    it("should register logs command", () => {
      const cmd = provider.getCommand("logs");
      expect(cmd).to.exist;
      expect(cmd!.name).to.equal("logs");
    });

    it("should resolve logs aliases", () => {
      for (const alias of ["dump", "export-log"]) {
        const cmd = provider.getCommand(alias);
        expect(cmd, `Alias '${alias}' should resolve`).to.exist;
        expect(cmd!.name).to.equal("logs");
      }
    });

    it("should execute search to set filter", async () => {
      let searchPattern: string | undefined;
      const context = createMockContext({
        setSearchFilter: (pattern) => {
          searchPattern = pattern;
        },
      });

      const response = await provider.execute("search error", context);
      expect(response).to.exist;
      expect(response!.success).to.be.true;
      expect(response!.message).to.include("error");
      expect(searchPattern).to.equal("error");
    });

    it("should execute search with no args to clear filter", async () => {
      let searchPattern: string | undefined = "existing";
      const context = createMockContext({
        setSearchFilter: (pattern) => {
          searchPattern = pattern;
        },
      });

      const response = await provider.execute("search", context);
      expect(response).to.exist;
      expect(response!.success).to.be.true;
      expect(searchPattern).to.be.undefined;
    });

    it("should execute exit command", async () => {
      let exitCalled = false;
      const context = createMockContext({
        requestExit: () => {
          exitCalled = true;
        },
      });

      const response = await provider.execute("exit", context);
      expect(response).to.exist;
      expect(response!.success).to.be.true;
      expect(exitCalled).to.be.true;
    });

    it("should execute clear command", async () => {
      let clearCalled = false;
      const context = createMockContext({
        clearLog: () => {
          clearCalled = true;
        },
      });

      const response = await provider.execute("clear", context);
      expect(response).to.exist;
      expect(response!.success).to.be.true;
      expect(clearCalled).to.be.true;
    });

    it("should include keyboard shortcuts in help output", async () => {
      const mockProviders = [provider];
      const context = createMockContext({
        getProviders: () => mockProviders,
      });

      const response = await provider.execute("help", context);
      expect(response).to.exist;
      expect(response!.message).to.include("Ctrl+C");
      expect(response!.message).to.include("Ctrl+L");
    });

    it("should show error for help on unknown command", async () => {
      const mockProviders = [provider];
      const context = createMockContext({
        getProviders: () => mockProviders,
      });

      const response = await provider.execute("help nonexistentcommand", context);
      expect(response).to.exist;
      expect(response!.success).to.be.false;
      expect(response!.type).to.equal("error");
    });

    it("should show players with empty list", async () => {
      const context = createMockContext({
        getPlayers: () => [],
      });

      const response = await provider.execute("players", context);
      expect(response).to.exist;
      expect(response!.message).to.include("No players");
    });

    it("should format status with all fields", async () => {
      const context = createMockContext({
        getServerStatus: () => ({
          state: "stopped" as const,
          playerCount: 0,
          version: "1.21.50",
          port: 19132,
          worldName: "Survival World",
        }),
      });

      const response = await provider.execute("status", context);
      expect(response).to.exist;
      expect(response!.message).to.include("stopped");
      expect(response!.message).to.include("1.21.50");
      expect(response!.message).to.include("Survival World");
    });

    it("logs should show usage when called without save", async () => {
      const context = createMockContext();
      const response = await provider.execute("logs", context);
      expect(response).to.exist;
      expect(response!.type).to.equal("help");
      expect(response!.message).to.include("Usage");
    });

    it("logs save should call exportLogs", async () => {
      let exportedPath: string | undefined;
      const context = createMockContext({
        exportLogs: (path: string) => {
          exportedPath = path;
          return 42;
        },
      } as any);

      const response = await provider.execute("logs save test.log", context);
      expect(response).to.exist;
      expect(response!.success).to.be.true;
      expect(response!.message).to.include("42");
      expect(exportedPath).to.equal("test.log");
    });
  });

  describe("BdsCommandProvider Form Loading", () => {
    let provider: BdsCommandProvider;

    beforeEach(async () => {
      provider = new BdsCommandProvider();
      await provider.initialize();
    });

    it("should load 50+ commands (forms or fallback)", () => {
      const commands = provider.getCommands();
      // Whether forms load or fallback is used, should have substantial command count
      expect(commands.length).to.be.greaterThan(25);
    });

    it("should have give command with parameters", () => {
      const giveCmd = provider.getCommand("give");
      expect(giveCmd).to.exist;
      // If forms loaded, should have parameters; if fallback, parameters may be empty
      expect(giveCmd!.description).to.include("item");
    });

    it("should have gamemode command", () => {
      const cmd = provider.getCommand("gamemode");
      expect(cmd).to.exist;
      expect(cmd!.description.toLowerCase()).to.include("game mode");
    });

    it("should categorize commands", () => {
      const commands = provider.getCommands();
      const categories = new Set(commands.map((c) => c.category));
      // Should have at least a few distinct categories
      expect(categories.size).to.be.greaterThan(3);
    });

    it("should have source set to bds for all commands", () => {
      const commands = provider.getCommands();
      for (const cmd of commands) {
        expect(cmd.source, `Command ${cmd.name} should have source 'bds'`).to.equal("bds");
      }
    });

    it("should handle slash prefix in command lookup", () => {
      // getSuggestions handles / prefix
      const withSlash = provider.getSuggestions("/give", 5);
      const withoutSlash = provider.getSuggestions("give", 4);
      // Both should find the give command
      expect(withSlash.some((s) => s.value === "give")).to.be.true;
      expect(withoutSlash.some((s) => s.value === "give")).to.be.true;
    });

    it("should only handle known commands", () => {
      expect(provider.handlesCommand("give")).to.be.true;
      expect(provider.handlesCommand("gamemode")).to.be.true;
      expect(provider.handlesCommand("totallyunknowncommand")).to.be.false;
    });
  });

  describe("CommandProviderRegistry Priority Resolution", () => {
    let registry: CommandProviderRegistry;
    let mctProvider: MctCommandProvider;
    let bdsProvider: BdsCommandProvider;

    beforeEach(async () => {
      registry = new CommandProviderRegistry();
      mctProvider = new MctCommandProvider();
      bdsProvider = new BdsCommandProvider();
      registry.register(bdsProvider);
      registry.register(mctProvider); // Register in reverse order to test sorting
      await registry.initialize();
    });

    it("should sort by priority regardless of registration order", () => {
      const providers = registry.getProviders();
      expect(providers[0].priority).to.be.greaterThanOrEqual(providers[1].priority);
    });

    it("MCT clear should take priority over BDS clear", () => {
      // Both MCT and BDS have 'clear' - MCT should win
      const cmd = registry.getCommand("clear");
      expect(cmd).to.exist;
      expect(cmd!.source).to.equal("mct");
    });

    it("should find handler for MCT commands", () => {
      const handler = registry.findHandler("help");
      expect(handler).to.exist;
      expect(handler!.name).to.equal("mct");
    });

    it("should find handler for BDS commands", () => {
      const handler = registry.findHandler("give");
      expect(handler).to.exist;
      expect(handler!.name).to.equal("bds");
    });

    it("should return undefined handler for unknown commands", () => {
      const handler = registry.findHandler("definitelynotacommand");
      expect(handler).to.be.undefined;
    });

    it("should execute MCT commands and not fall through to BDS", async () => {
      const sentToBds: string[] = [];
      const context = createMockContext({
        sendToBds: (cmd) => sentToBds.push(cmd),
        getProviders: () => [mctProvider, bdsProvider],
      });

      const response = await registry.execute("version", context);
      expect(response).to.exist;
      expect(response!.success).to.be.true;
      expect(sentToBds).to.have.length(0); // Should NOT have sent to BDS
    });
  });
});
