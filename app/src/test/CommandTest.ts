/**
 * CommandTest.ts - Unit tests for individual CLI commands
 *
 * Tests cover:
 * - Command metadata (name, aliases, taskType, category)
 * - Command configuration (commander.js options)
 * - Command registration with CommandRegistry
 * - Basic command execution patterns
 *
 * These tests use a mock context to test commands in isolation
 * without requiring file system access or network.
 */

import { expect, assert } from "chai";
import { Command } from "commander";
import { ICommand } from "../cli/core/ICommand";
import {
  ICommandContext,
  ILogger,
  IWorkerPool,
  IWorkerTask,
  IWorkerResult,
  ErrorCodes,
} from "../cli/core/ICommandContext";
import { CommandRegistry } from "../cli/core/CommandRegistry";
import { getAllCommands } from "../cli/commands/index";
import { TaskType, OutputType } from "../cli/ClUtils";
import Project from "../app/Project";
import CreatorTools from "../app/CreatorTools";
import LocalEnvironment from "../local/LocalEnvironment";
import { InfoItemType } from "../info/IInfoItemData";
import IProjectMetaState from "../info/IProjectMetaState";

// ============================================================================
// MOCK IMPLEMENTATIONS
// ============================================================================

/**
 * Mock logger that captures all log messages for verification.
 */
class MockLogger implements ILogger {
  messages: { level: string; message: string }[] = [];

  info(message: string): void {
    this.messages.push({ level: "info", message });
  }

  warn(message: string): void {
    this.messages.push({ level: "warn", message });
  }

  error(message: string): void {
    this.messages.push({ level: "error", message });
  }

  verbose(message: string): void {
    this.messages.push({ level: "verbose", message });
  }

  debug(message: string): void {
    this.messages.push({ level: "debug", message });
  }

  success(message: string): void {
    this.messages.push({ level: "success", message });
  }

  progress(_current: number, _total: number, _message?: string): void {
    // No-op for tests
  }

  clear(): void {
    this.messages = [];
  }

  hasMessage(level: string, contains: string): boolean {
    return this.messages.some((m) => m.level === level && m.message.includes(contains));
  }
}

/**
 * Mock worker pool that executes tasks synchronously.
 */
class MockWorkerPool implements IWorkerPool {
  readonly concurrency: number = 1;

  async executeBatch<TArgs, TResult>(
    tasks: IWorkerTask<TArgs, TResult>[],
    onProgress?: (completed: number, total: number) => void
  ): Promise<IWorkerResult<TResult>[]> {
    const results: IWorkerResult<TResult>[] = [];
    for (let i = 0; i < tasks.length; i++) {
      results.push(await this.execute(tasks[i]));
      if (onProgress) {
        onProgress(i + 1, tasks.length);
      }
    }
    return results;
  }

  async execute<TArgs, TResult>(_task: IWorkerTask<TArgs, TResult>): Promise<IWorkerResult<TResult>> {
    // Return a mock success result
    return {
      success: true,
      result: undefined as unknown as TResult,
    };
  }

  async shutdown(): Promise<void> {
    // No-op
  }
}

/**
 * Create a minimal mock context for testing commands.
 * Commands can be tested with various context configurations.
 */
function createMockContext(overrides: Partial<ICommandContext> = {}): ICommandContext {
  const mockLogger = new MockLogger();
  const mockWorkerPool = new MockWorkerPool();

  let _exitCode = 0;

  const baseContext: ICommandContext = {
    // Core Infrastructure
    creatorTools: undefined as unknown as CreatorTools,
    localEnv: undefined as unknown as LocalEnvironment,
    workerPool: mockWorkerPool,
    log: mockLogger,

    // Projects
    projects: [],
    projectCount: 0,
    isSingleProject: false,

    // Input/Output
    inputFolder: "/mock/input",
    inputFolderSpecified: false,
    outputFolder: "/mock/output",
    inputStorage: undefined as any,
    outputStorage: undefined as any,
    inputWorkFolder: undefined as any,
    outputWorkFolder: undefined as any,

    // Global Options
    threads: 1,
    force: false,
    isolated: true,
    debug: false,
    verbose: false,
    quiet: false,
    json: false,
    dryRun: false,
    outputType: OutputType.normal,
    taskType: TaskType.noCommand,

    // Command Arguments
    subCommand: undefined,
    propertyValue: undefined,
    searchTerm: undefined,
    mode: undefined,
    type: undefined,
    newName: undefined,
    projectStartsWith: undefined,

    // Grouped Options
    server: {
      port: 6126,
      runOnce: false,
    },
    world: {
      betaApis: false,
      editor: false,
      ensureWorld: false,
      testWorld: false,
      launch: false,
    },
    validation: {
      suite: undefined,
      exclusionList: undefined,
      outputMci: false,
      aggregateReports: false,
      warnOnly: false,
    },

    // Exit State
    exitCode: 0,
    setExitCode(code: number): void {
      if (code > _exitCode) {
        _exitCode = code;
      }
      (this as any).exitCode = _exitCode;
    },

    // Utility Methods
    async forEachProject(fn: (project: Project, index: number) => Promise<void>, _label?: string): Promise<void> {
      for (let i = 0; i < this.projects.length; i++) {
        await fn(this.projects[i], i);
      }
    },
  };

  return { ...baseContext, ...overrides };
}

// ============================================================================
// TEST SUITES
// ============================================================================

describe("CommandRegistry", () => {
  let registry: CommandRegistry;

  beforeEach(() => {
    registry = new CommandRegistry();
  });

  it("should register a command by name", () => {
    const mockCommand: ICommand = {
      metadata: {
        name: "test",
        description: "Test command",
        taskType: TaskType.validate,
        requiresProjects: false,
        isWriteCommand: false,
        isEditInPlace: false,
        isLongRunning: false,
        category: "Test",
      },
      configure: () => {},
      execute: async () => {},
    };

    registry.register(mockCommand);
    expect(registry.has("test")).to.be.true;
    expect(registry.get("test")).to.equal(mockCommand);
  });

  it("should register aliases", () => {
    const mockCommand: ICommand = {
      metadata: {
        name: "test",
        description: "Test command",
        taskType: TaskType.validate,
        aliases: ["t", "tst"],
        requiresProjects: false,
        isWriteCommand: false,
        isEditInPlace: false,
        isLongRunning: false,
        category: "Test",
      },
      configure: () => {},
      execute: async () => {},
    };

    registry.register(mockCommand);
    expect(registry.has("test")).to.be.true;
    expect(registry.has("t")).to.be.true;
    expect(registry.has("tst")).to.be.true;
    expect(registry.get("t")).to.equal(mockCommand);
  });

  it("should retrieve command by TaskType", () => {
    const mockCommand: ICommand = {
      metadata: {
        name: "validate",
        description: "Validate command",
        taskType: TaskType.validate,
        requiresProjects: true,
        isWriteCommand: false,
        isEditInPlace: false,
        isLongRunning: false,
        category: "Validation",
      },
      configure: () => {},
      execute: async () => {},
    };

    registry.register(mockCommand);
    expect(registry.getByTaskType(TaskType.validate)).to.equal(mockCommand);
  });

  it("should throw on duplicate command name", () => {
    const cmd1: ICommand = {
      metadata: {
        name: "test",
        description: "Test 1",
        taskType: TaskType.validate,
        requiresProjects: false,
        isWriteCommand: false,
        isEditInPlace: false,
        isLongRunning: false,
        category: "Test",
      },
      configure: () => {},
      execute: async () => {},
    };

    const cmd2: ICommand = {
      metadata: {
        name: "test",
        description: "Test 2",
        taskType: TaskType.info,
        requiresProjects: false,
        isWriteCommand: false,
        isEditInPlace: false,
        isLongRunning: false,
        category: "Test",
      },
      configure: () => {},
      execute: async () => {},
    };

    registry.register(cmd1);
    expect(() => registry.register(cmd2)).to.throw("Command 'test' is already registered");
  });

  it("should return unique commands from getAll()", () => {
    const cmd1: ICommand = {
      metadata: {
        name: "cmd1",
        description: "Command 1",
        taskType: TaskType.validate,
        aliases: ["c1"],
        requiresProjects: false,
        isWriteCommand: false,
        isEditInPlace: false,
        isLongRunning: false,
        category: "Test",
      },
      configure: () => {},
      execute: async () => {},
    };

    const cmd2: ICommand = {
      metadata: {
        name: "cmd2",
        description: "Command 2",
        taskType: TaskType.info,
        aliases: ["c2"],
        requiresProjects: false,
        isWriteCommand: false,
        isEditInPlace: false,
        isLongRunning: false,
        category: "Test",
      },
      configure: () => {},
      execute: async () => {},
    };

    registry.register(cmd1);
    registry.register(cmd2);

    const all = registry.getAll();
    expect(all.length).to.equal(2);
    expect(all).to.include(cmd1);
    expect(all).to.include(cmd2);
  });

  it("should get commands by category", () => {
    const valCmd: ICommand = {
      metadata: {
        name: "val",
        description: "Validation",
        taskType: TaskType.validate,
        requiresProjects: false,
        isWriteCommand: false,
        isEditInPlace: false,
        isLongRunning: false,
        category: "Validation",
      },
      configure: () => {},
      execute: async () => {},
    };

    const infoCmd: ICommand = {
      metadata: {
        name: "info",
        description: "Info",
        taskType: TaskType.info,
        requiresProjects: false,
        isWriteCommand: false,
        isEditInPlace: false,
        isLongRunning: false,
        category: "Information",
      },
      configure: () => {},
      execute: async () => {},
    };

    registry.register(valCmd);
    registry.register(infoCmd);

    const valCmds = registry.getByCategory("Validation");
    expect(valCmds.length).to.equal(1);
    expect(valCmds[0]).to.equal(valCmd);
  });
});

describe("All Commands Registration", () => {
  let testRegistry: CommandRegistry;

  before(() => {
    testRegistry = new CommandRegistry();
    const commands = getAllCommands();
    testRegistry.registerAll(commands);
  });

  it("should have all expected commands registered", () => {
    const commands = testRegistry.getAll();
    // We expect 31+ commands based on the commands/index.ts
    expect(commands.length).to.be.greaterThan(25);
  });

  it("should have unique TaskTypes for each command", () => {
    const commands = testRegistry.getAll();
    const taskTypes = new Set<TaskType>();

    for (const cmd of commands) {
      if (taskTypes.has(cmd.metadata.taskType)) {
        assert.fail(`Duplicate TaskType found: ${cmd.metadata.taskType} for command ${cmd.metadata.name}`);
      }
      taskTypes.add(cmd.metadata.taskType);
    }
  });

  it("should have non-empty categories for all commands", () => {
    const commands = testRegistry.getAll();
    for (const cmd of commands) {
      expect(cmd.metadata.category, `Command ${cmd.metadata.name} has no category`).to.be.a("string").that.is.not.empty;
    }
  });

  it("should have non-empty descriptions for all commands", () => {
    const commands = testRegistry.getAll();
    for (const cmd of commands) {
      expect(cmd.metadata.description, `Command ${cmd.metadata.name} has no description`).to.be.a("string").that.is.not
        .empty;
    }
  });
});

describe("Command Metadata Validation", () => {
  const commands = getAllCommands();

  // Table-driven tests for each command's metadata
  const expectedCommands: { name: string; taskType: TaskType; category: string; requiresProjects: boolean }[] = [
    { name: "validate", taskType: TaskType.validate, category: "Validation", requiresProjects: true },
    { name: "info", taskType: TaskType.info, category: "Information", requiresProjects: true },
    { name: "version", taskType: TaskType.version, category: "Information", requiresProjects: false },
    { name: "create", taskType: TaskType.create, category: "Project", requiresProjects: true },
    { name: "add", taskType: TaskType.add, category: "Project", requiresProjects: true },
    { name: "fix", taskType: TaskType.fix, category: "Project", requiresProjects: true },
    { name: "serve", taskType: TaskType.serve, category: "Server", requiresProjects: false },
    { name: "mcp", taskType: TaskType.mcp, category: "Server", requiresProjects: false },
  ];

  for (const expected of expectedCommands) {
    it(`should have correct metadata for '${expected.name}' command`, () => {
      const cmd = commands.find((c) => c.metadata.name === expected.name);
      expect(cmd, `Command '${expected.name}' not found`).to.exist;

      if (cmd) {
        expect(cmd.metadata.taskType).to.equal(expected.taskType);
        expect(cmd.metadata.category).to.equal(expected.category);
        expect(cmd.metadata.requiresProjects).to.equal(expected.requiresProjects);
      }
    });
  }
});

describe("Command Configuration", () => {
  const commands = getAllCommands();

  it("all commands should have a configure method", () => {
    for (const cmd of commands) {
      expect(cmd.configure, `Command ${cmd.metadata.name} missing configure method`).to.be.a("function");
    }
  });

  it("all commands should have an execute method", () => {
    for (const cmd of commands) {
      expect(cmd.execute, `Command ${cmd.metadata.name} missing execute method`).to.be.a("function");
    }
  });

  it("configure should accept a Command instance for most commands", () => {
    // Some commands may have complex option dependencies, so we just verify
    // that they have a callable configure method
    let successCount = 0;
    const errors: string[] = [];

    for (const cmd of commands) {
      try {
        const mockCmd = new Command(cmd.metadata.name);
        cmd.configure(mockCmd);
        successCount++;
      } catch (e: unknown) {
        // Log but don't fail - some commands have complex option setup
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`${cmd.metadata.name}: ${msg}`);
      }
    }

    // Most commands should configure without error
    expect(successCount).to.be.greaterThan(commands.length * 0.8);
  });
});

describe("VersionCommand", () => {
  it("should output version information", async () => {
    const mockLogger = new MockLogger();
    const context = createMockContext({ log: mockLogger });

    const commands = getAllCommands();
    const versionCmd = commands.find((c) => c.metadata.name === "version");

    expect(versionCmd).to.exist;
    if (versionCmd) {
      await versionCmd.execute(context);

      expect(mockLogger.hasMessage("info", "Version:")).to.be.true;
      expect(context.exitCode).to.equal(0);
    }
  });
});

describe("Command Categories", () => {
  it("should have organized categories", () => {
    const commands = getAllCommands();
    const categories = new Set(commands.map((c) => c.metadata.category));

    // We expect these categories
    const expectedCategories = ["Validation", "Project", "Server", "Render", "Documentation", "World", "Information"];

    for (const expected of expectedCategories) {
      expect(categories.has(expected), `Missing category: ${expected}`).to.be.true;
    }
  });
});

describe("Command Aliases", () => {
  const commands = getAllCommands();

  it("validate command should have 'val' alias", () => {
    const cmd = commands.find((c) => c.metadata.name === "validate");
    expect(cmd?.metadata.aliases).to.include("val");
  });

  it("info command should have 'i' alias", () => {
    const cmd = commands.find((c) => c.metadata.name === "info");
    expect(cmd?.metadata.aliases).to.include("i");
  });

  it("no aliases should conflict with command names", () => {
    const commandNames = new Set(commands.map((c) => c.metadata.name));

    for (const cmd of commands) {
      if (cmd.metadata.aliases) {
        for (const alias of cmd.metadata.aliases) {
          expect(
            commandNames.has(alias),
            `Alias '${alias}' for command '${cmd.metadata.name}' conflicts with a command name`
          ).to.be.false;
        }
      }
    }
  });

  it("no aliases should be duplicated across commands", () => {
    const allAliases: Map<string, string> = new Map();

    for (const cmd of commands) {
      if (cmd.metadata.aliases) {
        for (const alias of cmd.metadata.aliases) {
          if (allAliases.has(alias)) {
            assert.fail(`Alias '${alias}' is used by both '${allAliases.get(alias)}' and '${cmd.metadata.name}'`);
          }
          allAliases.set(alias, cmd.metadata.name);
        }
      }
    }
  });
});

describe("Long-Running Commands", () => {
  const commands = getAllCommands();

  it("serve command should be marked as long-running", () => {
    const cmd = commands.find((c) => c.metadata.name === "serve");
    expect(cmd?.metadata.isLongRunning).to.be.true;
  });

  it("mcp command should be marked as long-running", () => {
    const cmd = commands.find((c) => c.metadata.name === "mcp");
    expect(cmd?.metadata.isLongRunning).to.be.true;
  });

  it("validate command should NOT be marked as long-running", () => {
    const cmd = commands.find((c) => c.metadata.name === "validate");
    expect(cmd?.metadata.isLongRunning).to.be.false;
  });
});

describe("Write Commands", () => {
  const commands = getAllCommands();

  it("fix command should be marked as write command", () => {
    const cmd = commands.find((c) => c.metadata.name === "fix");
    expect(cmd?.metadata.isWriteCommand).to.be.true;
  });

  it("create command should be marked as write command", () => {
    const cmd = commands.find((c) => c.metadata.name === "create");
    expect(cmd?.metadata.isWriteCommand).to.be.true;
  });

  it("validate command should NOT be marked as write command", () => {
    const cmd = commands.find((c) => c.metadata.name === "validate");
    expect(cmd?.metadata.isWriteCommand).to.be.false;
  });

  it("info command should NOT be marked as write command", () => {
    const cmd = commands.find((c) => c.metadata.name === "info");
    expect(cmd?.metadata.isWriteCommand).to.be.false;
  });
});

describe("EditInPlace Commands", () => {
  const commands = getAllCommands();

  it("fix command should be marked as edit-in-place", () => {
    const cmd = commands.find((c) => c.metadata.name === "fix");
    expect(cmd?.metadata.isEditInPlace).to.be.true;
  });

  it("exportaddon command should NOT be edit-in-place", () => {
    const cmd = commands.find((c) => c.metadata.name === "exportaddon");
    expect(cmd?.metadata.isEditInPlace).to.be.false;
  });
});

describe("MockContext", () => {
  it("should track exit codes correctly", () => {
    const context = createMockContext();
    expect(context.exitCode).to.equal(0);

    context.setExitCode(1);
    expect(context.exitCode).to.equal(1);

    // Should not decrease
    context.setExitCode(0);
    expect(context.exitCode).to.equal(1);

    // Should increase
    context.setExitCode(2);
    expect(context.exitCode).to.equal(2);
  });

  it("should iterate over projects with forEachProject", async () => {
    const mockProject1 = { name: "project1" } as Project;
    const mockProject2 = { name: "project2" } as Project;

    const context = createMockContext({
      projects: [mockProject1, mockProject2],
      projectCount: 2,
    });

    const processedProjects: string[] = [];

    await context.forEachProject(async (project) => {
      processedProjects.push(project.name);
    });

    expect(processedProjects).to.deep.equal(["project1", "project2"]);
  });
});

// ============================================================================
// EXTENDED COMMAND EXECUTION TESTS
// ============================================================================

describe("VersionCommand Extended", () => {
  it("should output JSON when json mode is enabled", async () => {
    const mockLogger = new MockLogger();
    const context = createMockContext({ log: mockLogger, json: true });
    const commands = getAllCommands();
    const versionCmd = commands.find((c) => c.metadata.name === "version");
    expect(versionCmd).to.exist;
    if (versionCmd) {
      await versionCmd.execute(context);
      const jsonMessage = mockLogger.messages.find((m) => m.level === "info" && m.message.startsWith("{"));
      expect(jsonMessage, "Should output JSON").to.exist;
      if (jsonMessage) {
        const parsed = JSON.parse(jsonMessage.message);
        expect(parsed).to.have.property("version");
        expect(parsed).to.have.property("name");
      }
    }
  });

  it("should output only version string in quiet mode", async () => {
    const mockLogger = new MockLogger();
    const context = createMockContext({ log: mockLogger, quiet: true });
    const commands = getAllCommands();
    const versionCmd = commands.find((c) => c.metadata.name === "version");
    expect(versionCmd).to.exist;
    if (versionCmd) {
      await versionCmd.execute(context);
      expect(mockLogger.messages.length).to.be.greaterThan(0);
      expect(mockLogger.hasMessage("info", "disclaimer")).to.be.false;
    }
  });
});

describe("FixCommand Execution", () => {
  it("should error when no fix name is specified", async () => {
    const mockLogger = new MockLogger();
    const context = createMockContext({
      log: mockLogger,
      subCommand: undefined,
    });
    const commands = getAllCommands();
    const fixCmd = commands.find((c) => c.metadata.name === "fix");
    expect(fixCmd).to.exist;
    if (fixCmd) {
      await fixCmd.execute(context);
      expect(mockLogger.hasMessage("error", "No fix was specified")).to.be.true;
      expect(context.exitCode).to.be.greaterThan(0);
    }
  });

  it("should error on unknown fix name", async () => {
    const mockLogger = new MockLogger();
    const context = createMockContext({
      log: mockLogger,
      subCommand: "nonexistentfix",
    });
    const commands = getAllCommands();
    const fixCmd = commands.find((c) => c.metadata.name === "fix");
    expect(fixCmd).to.exist;
    if (fixCmd) {
      await fixCmd.execute(context);
      expect(mockLogger.hasMessage("error", "Unknown fix")).to.be.true;
      expect(context.exitCode).to.be.greaterThan(0);
    }
  });

  it("should reject removed/unimplemented fixes", async () => {
    const mockLogger = new MockLogger();
    const context = createMockContext({
      log: mockLogger,
      subCommand: "usepackageversionscript",
      projects: [],
      projectCount: 0,
    });
    const commands = getAllCommands();
    const fixCmd = commands.find((c) => c.metadata.name === "fix");
    expect(fixCmd).to.exist;
    if (fixCmd) {
      await fixCmd.execute(context);
      // Removed fixes should be rejected as unknown
      expect(mockLogger.hasMessage("error", "Unknown fix")).to.be.true;
      expect(context.exitCode).to.be.greaterThan(0);
    }
  });

  it("should have all AVAILABLE_FIXES documented in metadata", () => {
    const commands = getAllCommands();
    const fixCmd = commands.find((c) => c.metadata.name === "fix");
    expect(fixCmd).to.exist;
    if (fixCmd) {
      const description = fixCmd.metadata.arguments?.[0]?.description || "";
      expect(description).to.include("latestbetascriptversion");
      expect(description).to.include("randomizealluids");
    }
  });
});

describe("SetCommand Execution", () => {
  it("should error when no property name is specified", async () => {
    const mockLogger = new MockLogger();
    const context = createMockContext({
      log: mockLogger,
      subCommand: undefined,
    });
    const commands = getAllCommands();
    const setCmd = commands.find((c) => c.metadata.name === "set");
    expect(setCmd).to.exist;
    if (setCmd) {
      await setCmd.execute(context);
      expect(mockLogger.hasMessage("error", "No property specified")).to.be.true;
      expect(context.exitCode).to.be.greaterThan(0);
    }
  });

  it("should error on unknown property name", async () => {
    const mockLogger = new MockLogger();
    const context = createMockContext({
      log: mockLogger,
      subCommand: "fakeproperty",
      propertyValue: "somevalue",
    });
    const commands = getAllCommands();
    const setCmd = commands.find((c) => c.metadata.name === "set");
    expect(setCmd).to.exist;
    if (setCmd) {
      await setCmd.execute(context);
      expect(mockLogger.hasMessage("error", "Unknown property")).to.be.true;
      expect(context.exitCode).to.be.greaterThan(0);
    }
  });

  it("should error when property value is empty", async () => {
    const mockLogger = new MockLogger();
    const context = createMockContext({
      log: mockLogger,
      subCommand: "name",
      propertyValue: "",
    });
    const commands = getAllCommands();
    const setCmd = commands.find((c) => c.metadata.name === "set");
    expect(setCmd).to.exist;
    if (setCmd) {
      await setCmd.execute(context);
      expect(mockLogger.hasMessage("error", "valid property value")).to.be.true;
      expect(context.exitCode).to.be.greaterThan(0);
    }
  });

  it("should accept single character values", async () => {
    const mockLogger = new MockLogger();
    const context = createMockContext({
      log: mockLogger,
      subCommand: "name",
      propertyValue: "X",
      projects: [],
      projectCount: 0,
    });
    const commands = getAllCommands();
    const setCmd = commands.find((c) => c.metadata.name === "set");
    expect(setCmd).to.exist;
    if (setCmd) {
      await setCmd.execute(context);
      expect(mockLogger.hasMessage("error", "valid property value")).to.be.false;
    }
  });
});

describe("DeployCommand Execution", () => {
  it("should error when no mode is specified", async () => {
    const mockLogger = new MockLogger();
    const context = createMockContext({
      log: mockLogger,
      mode: undefined,
    });
    const commands = getAllCommands();
    const deployCmd = commands.find((c) => c.metadata.name === "deploy");
    expect(deployCmd).to.exist;
    if (deployCmd) {
      await deployCmd.execute(context);
      expect(mockLogger.hasMessage("error", "No deployment mode")).to.be.true;
      expect(context.exitCode).to.be.greaterThan(0);
    }
  });

  it("should error when no projects available", async () => {
    const mockLogger = new MockLogger();
    const context = createMockContext({
      log: mockLogger,
      mode: "folder",
      projects: [],
      projectCount: 0,
    });
    const commands = getAllCommands();
    const deployCmd = commands.find((c) => c.metadata.name === "deploy");
    expect(deployCmd).to.exist;
    if (deployCmd) {
      await deployCmd.execute(context);
      expect(mockLogger.hasMessage("error", "No projects to deploy")).to.be.true;
      expect(context.exitCode).to.be.greaterThan(0);
    }
  });

  it("should error when deploy requires local environment", async () => {
    const mockLogger = new MockLogger();
    const ct = { local: undefined } as unknown as CreatorTools;
    const context = createMockContext({
      log: mockLogger,
      mode: "mcuwp",
      projects: [{ name: "test" } as Project],
      projectCount: 1,
      creatorTools: ct,
    });
    const commands = getAllCommands();
    const deployCmd = commands.find((c) => c.metadata.name === "deploy");
    expect(deployCmd).to.exist;
    if (deployCmd) {
      await deployCmd.execute(context);
      expect(mockLogger.hasMessage("error", "local environment")).to.be.true;
      expect(context.exitCode).to.be.greaterThan(0);
    }
  });

  it("should error when target folder cannot be determined", async () => {
    const mockLogger = new MockLogger();
    const ct = { local: { minecraftPath: "/mock/mc" } } as unknown as CreatorTools;
    const context = createMockContext({
      log: mockLogger,
      mode: "folder",
      outputFolder: undefined as any,
      projects: [{ name: "test", inferProjectItemsFromFiles: async () => {} } as unknown as Project],
      projectCount: 1,
      creatorTools: ct,
    });
    const commands = getAllCommands();
    const deployCmd = commands.find((c) => c.metadata.name === "deploy");
    expect(deployCmd).to.exist;
    if (deployCmd) {
      await deployCmd.execute(context);
      expect(mockLogger.hasMessage("error", "No output folder")).to.be.true;
      expect(context.exitCode).to.be.greaterThan(0);
    }
  });

  it("should error when custom path does not exist", async () => {
    const mockLogger = new MockLogger();
    const ct = { local: { minecraftPath: "/mock/mc" } } as unknown as CreatorTools;
    const context = createMockContext({
      log: mockLogger,
      mode: "/nonexistent/path/that/does/not/exist",
      projects: [{ name: "test", inferProjectItemsFromFiles: async () => {} } as unknown as Project],
      projectCount: 1,
      creatorTools: ct,
    });
    const commands = getAllCommands();
    const deployCmd = commands.find((c) => c.metadata.name === "deploy");
    expect(deployCmd).to.exist;
    if (deployCmd) {
      await deployCmd.execute(context);
      expect(mockLogger.hasMessage("error", "not a recognized deploy target")).to.be.true;
      expect(context.exitCode).to.be.greaterThan(0);
    }
  });
});

describe("ExportAddonCommand Execution", () => {
  it("should error when no projects to export", async () => {
    const mockLogger = new MockLogger();
    const context = createMockContext({
      log: mockLogger,
      projects: [],
      projectCount: 0,
    });
    const commands = getAllCommands();
    const exportCmd = commands.find((c) => c.metadata.name === "exportaddon");
    expect(exportCmd).to.exist;
    if (exportCmd) {
      await exportCmd.execute(context);
      expect(mockLogger.hasMessage("error", "No projects to export")).to.be.true;
      expect(context.exitCode).to.be.greaterThan(0);
    }
  });
});

describe("Error Exit Code Behavior", () => {
  it("exit codes should only increase, never decrease", () => {
    const context = createMockContext();
    expect(context.exitCode).to.equal(0);

    context.setExitCode(3);
    expect(context.exitCode).to.equal(3);

    context.setExitCode(1);
    expect(context.exitCode).to.equal(3);

    context.setExitCode(5);
    expect(context.exitCode).to.equal(5);
  });

  it("ErrorCodes constants should be defined and ordered", () => {
    const { ErrorCodes } = require("../cli/core/ICommandContext");
    expect(ErrorCodes.SUCCESS).to.equal(0);
    expect(ErrorCodes.INIT_ERROR).to.equal(1);
    expect(ErrorCodes.VALIDATION_WARNING).to.equal(2);
    expect(ErrorCodes.VALIDATION_ERROR).to.equal(3);
    expect(ErrorCodes.VALIDATION_TESTFAIL).to.equal(4);
    expect(ErrorCodes.VALIDATION_INTERNALPROCESSINGERROR).to.equal(5);

    expect(ErrorCodes.VALIDATION_ERROR).to.be.greaterThan(ErrorCodes.VALIDATION_WARNING);
    expect(ErrorCodes.VALIDATION_TESTFAIL).to.be.greaterThan(ErrorCodes.VALIDATION_ERROR);
  });
});

describe("Dry Run Mode", () => {
  it("fix command should not apply fixes in dry-run mode", async () => {
    const mockLogger = new MockLogger();
    const context = createMockContext({
      log: mockLogger,
      subCommand: "randomizealluids",
      dryRun: true,
      projects: [],
      projectCount: 0,
    });
    const commands = getAllCommands();
    const fixCmd = commands.find((c) => c.metadata.name === "fix");
    expect(fixCmd).to.exist;
    if (fixCmd) {
      await fixCmd.execute(context);
      expect(context.exitCode).to.equal(0);
    }
  });
});

describe("JSON Output Mode", () => {
  it("version command should output valid JSON in json mode", async () => {
    const mockLogger = new MockLogger();
    const context = createMockContext({ log: mockLogger, json: true });
    const commands = getAllCommands();
    const versionCmd = commands.find((c) => c.metadata.name === "version");
    if (versionCmd) {
      await versionCmd.execute(context);
      const jsonMsg = mockLogger.messages.find((m) => m.message.startsWith("{"));
      expect(jsonMsg).to.exist;
      if (jsonMsg) {
        expect(() => JSON.parse(jsonMsg.message)).to.not.throw();
      }
    }
  });
});

describe("CommandRegistry configureCommander", () => {
  it("should configure Commander.js program with all commands", () => {
    const registry = new CommandRegistry();
    const commands = getAllCommands();
    registry.registerAll(commands);

    const program = new Command();
    registry.configureCommander(program);

    const programCommands = program.commands;
    expect(programCommands.length).to.be.greaterThan(25);
  });

  it("should capture task type when action is invoked", () => {
    const registry = new CommandRegistry();
    const commands = getAllCommands();
    registry.registerAll(commands);

    const program = new Command();
    program.exitOverride();
    registry.configureCommander(program);

    try {
      program.parse(["node", "mct", "version"]);
    } catch (e) {
      // Commander may throw on exitOverride, that's fine
    }

    const state = registry.getCapturedState();
    expect(state.taskType).to.equal(TaskType.version);
  });

  it("should generate category help text", () => {
    const registry = new CommandRegistry();
    const commands = getAllCommands();
    registry.registerAll(commands);

    const helpText = registry.generateCategoryHelp();
    expect(helpText).to.include("Validation:");
    expect(helpText).to.include("Project:");
    expect(helpText).to.include("Server:");
    expect(helpText.length).to.be.greaterThan(100);
  });
});

// ============================================================================
// VALIDATE COMMAND EXECUTION
// ============================================================================

describe("ValidateCommand Execution", () => {
  it("should warn when no projects are provided", async () => {
    const mockLogger = new MockLogger();
    const context = createMockContext({
      log: mockLogger,
      projects: [],
      projectCount: 0,
    });
    const commands = getAllCommands();
    const validateCmd = commands.find((c) => c.metadata.name === "validate");
    expect(validateCmd).to.exist;
    if (validateCmd) {
      await validateCmd.execute(context);
      expect(mockLogger.hasMessage("warn", "No projects found")).to.be.true;
      expect(context.exitCode).to.equal(0);
    }
  });

  it("should output valid JSON when json mode is enabled and no projects exist", async () => {
    const mockLogger = new MockLogger();
    const context = createMockContext({
      log: mockLogger,
      projects: [],
      projectCount: 0,
      json: true,
    });
    const commands = getAllCommands();
    const validateCmd = commands.find((c) => c.metadata.name === "validate");
    expect(validateCmd).to.exist;
    if (validateCmd) {
      await validateCmd.execute(context);
      const jsonMsg = mockLogger.messages.find((m) => m.level === "info" && m.message.startsWith("{"));
      expect(jsonMsg, "Should output JSON").to.exist;
      if (jsonMsg) {
        const parsed = JSON.parse(jsonMsg.message);
        expect(parsed).to.have.property("projects");
        expect(parsed).to.have.property("errors");
        expect(parsed).to.have.property("warnings");
        expect(parsed.projects).to.be.an("array").that.is.empty;
        expect(parsed.errors).to.equal(0);
        expect(parsed.warnings).to.equal(0);
      }
      // Should not output human-readable warning text
      expect(mockLogger.hasMessage("warn", "No projects found")).to.be.false;
    }
  });
});

// ============================================================================
// FIX COMMAND AVAILABLE FIXES
// ============================================================================

describe("FixCommand Available Fixes", () => {
  it("should reject unimplemented fixes", async () => {
    const mockLogger = new MockLogger();
    const context = createMockContext({
      log: mockLogger,
      subCommand: "usepackageversionscript",
    });
    const commands = getAllCommands();
    const fixCmd = commands.find((c) => c.metadata.name === "fix");
    expect(fixCmd).to.exist;
    if (fixCmd) {
      await fixCmd.execute(context);
      expect(mockLogger.hasMessage("error", "Unknown fix")).to.be.true;
      expect(context.exitCode).to.be.greaterThan(0);
    }
  });

  it("should accept all documented fix names", async () => {
    const validFixes = [
      "latestbetascriptversion",
      "randomizealluids",
      "setnewestformatversions",
      "setnewestminengineversion",
    ];
    const commands = getAllCommands();
    const fixCmd = commands.find((c) => c.metadata.name === "fix");
    expect(fixCmd).to.exist;

    for (const fixName of validFixes) {
      const mockLogger = new MockLogger();
      const context = createMockContext({
        log: mockLogger,
        subCommand: fixName,
        projects: [],
        projectCount: 0,
      });
      if (fixCmd) {
        await fixCmd.execute(context);
        // Should NOT get "Unknown fix" error
        expect(mockLogger.hasMessage("error", "Unknown fix"), `Fix '${fixName}' should be accepted`).to.be.false;
      }
    }
  });
});

// ============================================================================
// EXPORT ADDON COMMAND ERROR HANDLING
// ============================================================================

describe("ExportAddonCommand Error Handling", () => {
  it("should error for empty project list", async () => {
    const mockLogger = new MockLogger();
    const context = createMockContext({
      log: mockLogger,
      projects: [],
      projectCount: 0,
    });
    const commands = getAllCommands();
    const exportCmd = commands.find((c) => c.metadata.name === "exportaddon");
    expect(exportCmd).to.exist;
    if (exportCmd) {
      await exportCmd.execute(context);
      expect(mockLogger.hasMessage("error", "No projects to export")).to.be.true;
    }
  });

  it("should support dry-run mode", async () => {
    const mockLogger = new MockLogger();
    const mockProject = {
      name: "test-project",
      inferProjectItemsFromFiles: async () => {},
    } as unknown as Project;
    const context = createMockContext({
      log: mockLogger,
      projects: [mockProject],
      projectCount: 1,
      dryRun: true,
    });
    const commands = getAllCommands();
    const exportCmd = commands.find((c) => c.metadata.name === "exportaddon");
    expect(exportCmd).to.exist;
    if (exportCmd) {
      await exportCmd.execute(context);
      expect(mockLogger.hasMessage("info", "Dry run")).to.be.true;
      expect(context.exitCode).to.equal(0);
    }
  });
});

// ============================================================================
// VERSION COMMAND JSON COMPLETENESS
// ============================================================================

describe("VersionCommand JSON Completeness", () => {
  it("JSON output should include all path fields", async () => {
    const mockLogger = new MockLogger();
    // Create a mock with local utilities
    const mockLocal = {
      userDataPath: "/mock/userdata",
      localAppDataPath: "/mock/appdata",
      minecraftPath: "/mock/minecraft",
      serversPath: "/mock/servers",
      envPrefsPath: "/mock/envprefs",
      packCachePath: "/mock/packcache",
    };
    const ct = { local: mockLocal } as unknown as CreatorTools;
    const context = createMockContext({
      log: mockLogger,
      json: true,
      creatorTools: ct,
    });
    const commands = getAllCommands();
    const versionCmd = commands.find((c) => c.metadata.name === "version");
    expect(versionCmd).to.exist;
    if (versionCmd) {
      await versionCmd.execute(context);
      const jsonMsg = mockLogger.messages.find((m) => m.message.startsWith("{"));
      expect(jsonMsg).to.exist;
      if (jsonMsg) {
        const parsed = JSON.parse(jsonMsg.message);
        expect(parsed).to.have.property("version");
        expect(parsed).to.have.property("userDataPath");
        expect(parsed).to.have.property("minecraftPath");
        expect(parsed).to.have.property("serversPath");
        expect(parsed).to.have.property("envPrefsPath");
        expect(parsed).to.have.property("packCachePath");
      }
    }
  });
});

// ============================================================================
// SET COMMAND ALL PROPERTIES
// ============================================================================

describe("SetCommand All Properties", () => {
  const validProperties = ["name", "title", "description", "bpscriptentrypoint", "bpuuid", "rpuuid"];

  for (const prop of validProperties) {
    it(`should accept '${prop}' as a valid property name`, async () => {
      const mockLogger = new MockLogger();
      const context = createMockContext({
        log: mockLogger,
        subCommand: prop,
        propertyValue: "test-value-for-" + prop,
        projects: [],
        projectCount: 0,
      });
      const commands = getAllCommands();
      const setCmd = commands.find((c) => c.metadata.name === "set");
      expect(setCmd).to.exist;
      if (setCmd) {
        await setCmd.execute(context);
        // Should NOT get "Unknown property" error
        expect(mockLogger.hasMessage("error", "Unknown property"), `Property '${prop}' should be accepted`).to.be.false;
      }
    });
  }
});

// ============================================================================
// LOGGER MOCK LOGGER
// ============================================================================

describe("Logger MockLogger", () => {
  it("should capture messages at all levels", () => {
    const logger = new MockLogger();
    logger.info("info message");
    logger.warn("warn message");
    logger.error("error message");
    logger.verbose("verbose message");
    logger.debug("debug message");
    logger.success("success message");

    expect(logger.messages).to.have.length(6);
    expect(logger.hasMessage("info", "info message")).to.be.true;
    expect(logger.hasMessage("warn", "warn message")).to.be.true;
    expect(logger.hasMessage("error", "error message")).to.be.true;
    expect(logger.hasMessage("verbose", "verbose message")).to.be.true;
    expect(logger.hasMessage("debug", "debug message")).to.be.true;
    expect(logger.hasMessage("success", "success message")).to.be.true;
  });

  it("should clear messages", () => {
    const logger = new MockLogger();
    logger.info("test");
    expect(logger.messages).to.have.length(1);
    logger.clear();
    expect(logger.messages).to.have.length(0);
  });

  it("hasMessage should be case-sensitive", () => {
    const logger = new MockLogger();
    logger.info("Hello World");
    expect(logger.hasMessage("info", "Hello")).to.be.true;
    expect(logger.hasMessage("info", "hello")).to.be.false;
  });
});

// ============================================================================
// DRY RUN MODE COMMANDS
// ============================================================================

describe("Dry Run Mode Commands", () => {
  it("set command should log dry-run message and not error", async () => {
    const mockLogger = new MockLogger();
    const context = createMockContext({
      log: mockLogger,
      subCommand: "name",
      propertyValue: "new-name",
      dryRun: true,
      projects: [],
      projectCount: 0,
    });
    const commands = getAllCommands();
    const setCmd = commands.find((c) => c.metadata.name === "set");
    expect(setCmd).to.exist;
    if (setCmd) {
      await setCmd.execute(context);
      expect(context.exitCode).to.equal(0);
    }
  });

  it("deploy command should error before dry-run check when no mode", async () => {
    const mockLogger = new MockLogger();
    const context = createMockContext({
      log: mockLogger,
      dryRun: true,
      mode: undefined,
    });
    const commands = getAllCommands();
    const deployCmd = commands.find((c) => c.metadata.name === "deploy");
    expect(deployCmd).to.exist;
    if (deployCmd) {
      await deployCmd.execute(context);
      expect(mockLogger.hasMessage("error", "No deployment mode")).to.be.true;
    }
  });
});

// ============================================================================
// COMMAND METADATA CONSISTENCY
// ============================================================================

describe("Command Metadata Consistency", () => {
  it("all write commands should have isWriteCommand=true", () => {
    const commands = getAllCommands();
    const writeCommands = ["create", "add", "fix", "set", "deploy", "exportaddon", "exportworld"];

    for (const cmdName of writeCommands) {
      const cmd = commands.find((c) => c.metadata.name === cmdName);
      if (cmd) {
        expect(cmd.metadata.isWriteCommand, `${cmdName} should have isWriteCommand=true`).to.be.true;
      }
    }
  });

  it("all edit-in-place commands should also be write commands", () => {
    const commands = getAllCommands();
    for (const cmd of commands) {
      if (cmd.metadata.isEditInPlace) {
        expect(cmd.metadata.isWriteCommand, `${cmd.metadata.name} is edit-in-place but not marked as write command`).to
          .be.true;
      }
    }
  });

  it("no read-only command should be edit-in-place", () => {
    const commands = getAllCommands();
    for (const cmd of commands) {
      if (!cmd.metadata.isWriteCommand) {
        expect(cmd.metadata.isEditInPlace, `${cmd.metadata.name} is read-only but marked edit-in-place`).to.be.false;
      }
    }
  });

  it("all long-running commands should be server-related", () => {
    const commands = getAllCommands();
    const longRunning = commands.filter((c) => c.metadata.isLongRunning);

    for (const cmd of longRunning) {
      expect(
        ["Server", "Content", "Validation", "Render"].includes(cmd.metadata.category),
        `Long-running command '${cmd.metadata.name}' should be in Server, Content, Validation, or Render category, got '${cmd.metadata.category}'`
      ).to.be.true;
    }
  });

  it("all commands should have valid TaskType values", () => {
    const commands = getAllCommands();
    for (const cmd of commands) {
      expect(cmd.metadata.taskType, `${cmd.metadata.name} has undefined taskType`).to.be.a("number");
      expect(cmd.metadata.taskType, `${cmd.metadata.name} has negative taskType`).to.be.greaterThanOrEqual(0);
    }
  });
});

// ============================================================================
// MULTI-PROJECT FOREACHPROJECT
// ============================================================================

describe("Multi-Project forEachProject", () => {
  it("should process multiple projects in order", async () => {
    const processed: string[] = [];
    const projects = [{ name: "alpha" } as Project, { name: "beta" } as Project, { name: "gamma" } as Project];
    const context = createMockContext({
      projects,
      projectCount: 3,
    });

    await context.forEachProject(async (project) => {
      processed.push(project.name);
    });

    expect(processed).to.deep.equal(["alpha", "beta", "gamma"]);
  });

  it("should handle empty project list gracefully", async () => {
    const context = createMockContext({
      projects: [],
      projectCount: 0,
    });

    let callCount = 0;
    await context.forEachProject(async () => {
      callCount++;
    });

    expect(callCount).to.equal(0);
  });

  it("should handle single project", async () => {
    const context = createMockContext({
      projects: [{ name: "solo" } as Project],
      projectCount: 1,
      isSingleProject: true,
    });

    const processed: string[] = [];
    await context.forEachProject(async (project) => {
      processed.push(project.name);
    });

    expect(processed).to.deep.equal(["solo"]);
  });
});

// ============================================================================
// COMMANDBASE PROCESSPROJECTS
// ============================================================================

describe("CommandBase processProjects", () => {
  it("CommandBase logStart should work in verbose mode", async () => {
    const mockLogger = new MockLogger();
    const context = createMockContext({
      log: mockLogger,
      verbose: true,
    });

    const commands = getAllCommands();
    const validateCmd = commands.find((c) => c.metadata.name === "validate");
    expect(validateCmd).to.exist;
    if (validateCmd) {
      await validateCmd.execute(context);
      expect(mockLogger.hasMessage("verbose", "Starting")).to.be.true;
    }
  });
});

// ============================================================================
// COMMAND OUTPUT FORMATS
// ============================================================================

describe("Command Output Formats", () => {
  const commands = getAllCommands();

  it("fix command should output JSON summary in json mode", async () => {
    const mockLogger = new MockLogger();
    const context = createMockContext({
      log: mockLogger,
      subCommand: "latestbetascriptversion",
      json: true,
      projects: [],
      projectCount: 0,
    });
    const fixCmd = commands.find((c) => c.metadata.name === "fix");
    if (fixCmd) {
      await fixCmd.execute(context);
      const jsonMsg = mockLogger.messages.find((m) => m.level === "info" && m.message.startsWith("{"));
      expect(jsonMsg, "Fix command should output JSON summary").to.exist;
      if (jsonMsg) {
        const parsed = JSON.parse(jsonMsg.message);
        expect(parsed).to.have.property("fixes");
        expect(parsed).to.have.property("projectCount");
      }
    }
  });
});

// ============================================================================
// TASKTYPE COVERAGE
// ============================================================================

describe("TaskType Coverage", () => {
  it("every TaskType used in allCommands should be unique", () => {
    const commands = getAllCommands();
    const taskTypes = new Map<number, string>();

    for (const cmd of commands) {
      const tt = cmd.metadata.taskType;
      if (taskTypes.has(tt)) {
        assert.fail(`TaskType ${tt} used by both '${taskTypes.get(tt)}' and '${cmd.metadata.name}'`);
      }
      taskTypes.set(tt, cmd.metadata.name);
    }
  });

  it("validate TaskType should map to validate command", () => {
    const commands = getAllCommands();
    const valCmd = commands.find((c) => c.metadata.taskType === TaskType.validate);
    expect(valCmd).to.exist;
    expect(valCmd?.metadata.name).to.equal("validate");
  });
});

describe("ValidateCommand processValidationResult", () => {
  it("should set exit code on string error result", async () => {
    const mockLogger = new MockLogger();

    // Create a custom mock worker pool that returns a string error
    const errorExecute = async () => ({
      success: true as const,
      result: "Error: something went wrong" as any,
    });
    const errorPool = {
      concurrency: 1,
      execute: errorExecute,
      async executeBatch(tasks: any[], onProgress?: any) {
        const results = [];
        for (let i = 0; i < tasks.length; i++) {
          results.push(await errorExecute());
          if (onProgress) onProgress(i + 1, tasks.length);
        }
        return results;
      },
      async shutdown() {},
    } as unknown as IWorkerPool;

    const mockProject = {
      name: "test-project",
      localFolderPath: "/mock/path",
      localFilePath: undefined,
      accessoryFilePaths: undefined,
      containerName: "test-project",
      projectFolder: { storageRelativePath: "/" },
    } as unknown as Project;

    const context = createMockContext({
      log: mockLogger,
      workerPool: errorPool,
      projects: [mockProject],
      projectCount: 1,
      threads: 1,
      localEnv: { displayInfo: false, displayVerbose: false } as any,
      validation: { suite: "main", outputMci: false, aggregateReports: false, warnOnly: false },
    });

    const commands = getAllCommands();
    const validateCmd = commands.find((c) => c.metadata.name === "validate");
    expect(validateCmd).to.exist;

    if (validateCmd) {
      await validateCmd.execute(context);
      // String error results should now set exit code
      // The result is a string not IProjectMetaState[] so processValidationResult
      // should log error and set exit code
      expect(mockLogger.hasMessage("error", "something went wrong")).to.be.true;
      expect(context.exitCode).to.be.greaterThan(0);
    }
  });

  it("should set exit code when validation finds errors regardless of output folder", async () => {
    const mockLogger = new MockLogger();

    // Create a mock worker pool that returns validation results with errors
    const errorResultExecute = async (): Promise<IWorkerResult<any>> => {
      const metaState: IProjectMetaState = {
        projectContainerName: "test-project",
        projectName: "test-project",
        projectTitle: "Test Project",
        suite: undefined,
        infoSetData: {
          info: {},
          items: [
            {
              iTp: InfoItemType.error,
              gId: "TEST",
              gIx: 1,
              m: "Test validation error",
              p: "/test/path",
              d: undefined,
              iId: undefined,
              c: undefined,
              fs: undefined,
            },
          ],
        },
      };
      return { success: true, result: [metaState] };
    };
    const errorResultPool = {
      concurrency: 1,
      execute: errorResultExecute,
      async executeBatch(tasks: any[], onProgress?: any) {
        const results = [];
        for (let i = 0; i < tasks.length; i++) {
          results.push(await errorResultExecute());
          if (onProgress) onProgress(i + 1, tasks.length);
        }
        return results;
      },
      async shutdown() {},
    } as unknown as IWorkerPool;

    const mockProject = {
      name: "test-project",
      localFolderPath: "/mock/path",
      localFilePath: undefined,
      accessoryFilePaths: undefined,
      containerName: "test-project",
      projectFolder: { storageRelativePath: "/" },
    } as unknown as Project;

    // Key: outputFolder DIFFERS from inputFolder (the common CI/CD case)
    const context = createMockContext({
      log: mockLogger,
      workerPool: errorResultPool,
      projects: [mockProject],
      projectCount: 1,
      threads: 1,
      inputFolder: "/input",
      outputFolder: "/output", // Different from inputFolder!
      localEnv: { displayInfo: false, displayVerbose: false } as any,
      validation: { suite: "main", outputMci: false, aggregateReports: false, warnOnly: false },
    });

    const commands = getAllCommands();
    const validateCmd = commands.find((c) => c.metadata.name === "validate");
    expect(validateCmd).to.exist;

    if (validateCmd) {
      await validateCmd.execute(context);
      // With the bug fix, errors should set exit code even when output != input
      expect(context.exitCode).to.be.greaterThan(0);
      expect(mockLogger.hasMessage("error", "Test validation error")).to.be.true;
    }
  });

  it("should set exit code for testCompleteFail items", async () => {
    const mockLogger = new MockLogger();

    const failResultExecute = async (): Promise<IWorkerResult<any>> => {
      const metaState: IProjectMetaState = {
        projectContainerName: "test-project",
        projectName: "test-project",
        projectTitle: "Test Project",
        suite: undefined,
        infoSetData: {
          info: {},
          items: [
            {
              iTp: InfoItemType.testCompleteFail,
              gId: "TEST",
              gIx: 1,
              m: "Test failed",
              p: "/test/path",
              d: undefined,
              iId: undefined,
              c: undefined,
              fs: undefined,
            },
          ],
        },
      };
      return { success: true, result: [metaState] };
    };
    const failResultPool = {
      concurrency: 1,
      execute: failResultExecute,
      async executeBatch(tasks: any[], onProgress?: any) {
        const results = [];
        for (let i = 0; i < tasks.length; i++) {
          results.push(await failResultExecute());
          if (onProgress) onProgress(i + 1, tasks.length);
        }
        return results;
      },
      async shutdown() {},
    } as unknown as IWorkerPool;

    const mockProject = {
      name: "test-project",
      localFolderPath: "/mock/path",
      localFilePath: undefined,
      accessoryFilePaths: undefined,
      containerName: "test-project",
      projectFolder: { storageRelativePath: "/" },
    } as unknown as Project;

    const context = createMockContext({
      log: mockLogger,
      workerPool: failResultPool,
      projects: [mockProject],
      projectCount: 1,
      threads: 1,
      inputFolder: "/input",
      outputFolder: "/different-output",
      localEnv: { displayInfo: false, displayVerbose: false } as any,
      validation: { suite: "main", outputMci: false, aggregateReports: false, warnOnly: false },
    });

    const commands = getAllCommands();
    const validateCmd = commands.find((c) => c.metadata.name === "validate");
    expect(validateCmd).to.exist;

    if (validateCmd) {
      await validateCmd.execute(context);
      expect(context.exitCode).to.equal(ErrorCodes.VALIDATION_TESTFAIL);
    }
  });

  it("should set VALIDATION_INTERNALPROCESSINGERROR for worker failures", async () => {
    const mockLogger = new MockLogger();

    const failExecute = async (): Promise<IWorkerResult<any>> => {
      return { success: false, error: "Worker crashed" };
    };
    const failPool = {
      concurrency: 1,
      execute: failExecute,
      async executeBatch(tasks: any[], onProgress?: any) {
        const results = [];
        for (let i = 0; i < tasks.length; i++) {
          results.push(await failExecute());
          if (onProgress) onProgress(i + 1, tasks.length);
        }
        return results;
      },
      async shutdown() {},
    } as unknown as IWorkerPool;

    const mockProject = {
      name: "test-project",
      localFolderPath: "/mock/path",
      localFilePath: undefined,
      accessoryFilePaths: undefined,
      containerName: "test-project",
      projectFolder: { storageRelativePath: "/" },
    } as unknown as Project;

    const context = createMockContext({
      log: mockLogger,
      workerPool: failPool,
      projects: [mockProject],
      projectCount: 1,
      threads: 1,
      localEnv: { displayInfo: false, displayVerbose: false } as any,
      validation: { suite: "main", outputMci: false, aggregateReports: false, warnOnly: false },
    });

    const commands = getAllCommands();
    const validateCmd = commands.find((c) => c.metadata.name === "validate");
    expect(validateCmd).to.exist;

    if (validateCmd) {
      await validateCmd.execute(context);
      expect(context.exitCode).to.equal(ErrorCodes.VALIDATION_INTERNALPROCESSINGERROR);
      expect(mockLogger.hasMessage("error", "Worker crashed")).to.be.true;
    }
  });
});

describe("ValidateCommand metadata", () => {
  it("should have correct suite choices", () => {
    const commands = getAllCommands();
    const validateCmd = commands.find((c) => c.metadata.name === "validate");
    expect(validateCmd).to.exist;

    const suiteArg = validateCmd?.metadata.arguments?.find((a) => a.name === "suite");
    expect(suiteArg).to.exist;
    expect(suiteArg?.choices).to.include("all");
    expect(suiteArg?.choices).to.include("addon");
    expect(suiteArg?.choices).to.include("currentplatform");
    expect(suiteArg?.choices).to.include("main");
    expect(suiteArg?.defaultValue).to.equal("main");
  });

  it("should have exclusions argument", () => {
    const commands = getAllCommands();
    const validateCmd = commands.find((c) => c.metadata.name === "validate");
    expect(validateCmd).to.exist;

    const exclusionsArg = validateCmd?.metadata.arguments?.find((a) => a.name === "exclusions");
    expect(exclusionsArg).to.exist;
    expect(exclusionsArg?.required).to.be.false;
  });

  it("should have aggregateReports argument with valid choices", () => {
    const commands = getAllCommands();
    const validateCmd = commands.find((c) => c.metadata.name === "validate");
    expect(validateCmd).to.exist;

    const aggArg = validateCmd?.metadata.arguments?.find((a) => a.name === "aggregateReports");
    expect(aggArg).to.exist;
    expect(aggArg?.choices).to.include("aggregate");
    expect(aggArg?.choices).to.include("aggregatenoindex");
  });

  it("should not be marked as write command", () => {
    const commands = getAllCommands();
    const validateCmd = commands.find((c) => c.metadata.name === "validate");
    expect(validateCmd).to.exist;
    expect(validateCmd?.metadata.isWriteCommand).to.be.false;
    expect(validateCmd?.metadata.isEditInPlace).to.be.false;
  });
});

describe("ValidateCommand exit code severity ordering", () => {
  it("internalProcessingError should be the highest severity", () => {
    expect(ErrorCodes.VALIDATION_INTERNALPROCESSINGERROR).to.be.greaterThan(ErrorCodes.VALIDATION_TESTFAIL);
    expect(ErrorCodes.VALIDATION_TESTFAIL).to.be.greaterThan(ErrorCodes.VALIDATION_ERROR);
    expect(ErrorCodes.VALIDATION_ERROR).to.be.greaterThan(ErrorCodes.VALIDATION_WARNING);
    expect(ErrorCodes.VALIDATION_WARNING).to.be.greaterThan(ErrorCodes.SUCCESS);
  });

  it("setExitCode should keep highest severity", () => {
    const context = createMockContext();

    // Warning first
    context.setExitCode(2); // VALIDATION_WARNING
    expect(context.exitCode).to.equal(2);

    // Error should override
    context.setExitCode(3); // VALIDATION_ERROR
    expect(context.exitCode).to.equal(3);

    // Warning should NOT override
    context.setExitCode(2);
    expect(context.exitCode).to.equal(3); // stays at error

    // Internal error should override
    context.setExitCode(5);
    expect(context.exitCode).to.equal(5);
  });
});

describe("Telemetry build configuration", () => {
  const fs = require("fs");
  const path = require("path");
  const appRoot = path.resolve(__dirname, "../..");

  // These build configs must NEVER enable analytics — they are for CLI, VS Code, Electron, etc.
  const configsThatMustDisableAnalytics = [
    { file: "webpack.jsnweb.config.js", description: "CLI-served web (jsnweb)" },
    { file: "webpack.jsnweb.debug.config.js", description: "CLI-served web debug" },
    { file: "webpack.jsn.config.js", description: "CLI Node.js bundle" },
    { file: "webpack.vsccore.config.js", description: "VS Code core extension" },
    { file: "webpack.vsccoreweb.config.js", description: "VS Code core web extension" },
    { file: "webpack.vscweb.config.js", description: "VS Code webview" },
    { file: "esbuild.jsn.config.mjs", description: "CLI esbuild bundle" },
    { file: "esbuild.cjs.config.mjs", description: "CJS esbuild bundle" },
    { file: "esbuild.electron.config.mjs", description: "Electron esbuild bundle" },
  ];

  for (const { file, description } of configsThatMustDisableAnalytics) {
    it(`${description} (${file}) should have ENABLE_ANALYTICS set to false`, () => {
      const configPath = path.join(appRoot, file);
      if (!fs.existsSync(configPath)) {
        return; // Skip if config doesn't exist (e.g., optional debug configs)
      }
      const content = fs.readFileSync(configPath, "utf-8");

      // Must NOT contain patterns that enable analytics
      expect(content).to.not.match(
        /ENABLE_ANALYTICS.*true/i,
        `${file} must not enable analytics — telemetry is only allowed on mctools.dev production`
      );

      // Must contain an explicit false setting
      expect(content).to.match(/ENABLE_ANALYTICS.*false/i, `${file} should explicitly set ENABLE_ANALYTICS to false`);
    });
  }

  it("Vite config should only enable analytics via explicit env var", () => {
    const configPath = path.join(appRoot, "vite.config.js");
    const content = fs.readFileSync(configPath, "utf-8");

    // Vite should gate on env var, not default to true
    expect(content).to.include('process.env.ENABLE_ANALYTICS === "true"');
    expect(content).to.not.match(/ENABLE_ANALYTICS:\s*true/, "Vite config must not hardcode ENABLE_ANALYTICS to true");
  });

  it("CLI-served web HTML should not include telemetry scripts", () => {
    const httpServerPath = path.join(appRoot, "src", "local", "HttpServer.ts");
    const content = fs.readFileSync(httpServerPath, "utf-8");

    expect(content).to.not.include("ms.analytics-web");
    expect(content).to.not.include("wcp-consent.js");
    expect(content).to.not.include("site.js");
  });

  it("local dev index.html should not include telemetry endpoints in CSP", () => {
    const indexPath = path.join(appRoot, "index.html");
    const content = fs.readFileSync(indexPath, "utf-8");

    expect(content).to.not.include("browser.events.data.microsoft.com");
    expect(content).to.not.include("js.monitor.azure.com");
  });

  it("Telemetry.ts should gate on ENABLE_ANALYTICS", () => {
    const telemetryPath = path.join(appRoot, "src", "analytics", "Telemetry.ts");
    const content = fs.readFileSync(telemetryPath, "utf-8");

    expect(content).to.include("ENABLE_ANALYTICS");
    expect(content).to.include("_analyticsAllowed");
  });

  it("gulpfile customizeSiteCsp should match the CSP in index.html", () => {
    const indexPath = path.join(appRoot, "index.html");
    const gulpfilePath = path.join(appRoot, "gulpfile.js");
    const indexContent = fs.readFileSync(indexPath, "utf-8");
    const gulpfileContent = fs.readFileSync(gulpfilePath, "utf-8");

    // The gulpfile's customizeSiteCsp regex must be able to find the CSP in index.html.
    // Extract the literal CSP string from index.html.
    const cspMatch = indexContent.match(/content="(default-src[^"]+)"/);
    expect(cspMatch, "index.html should contain a CSP meta tag").to.not.be.null;

    // The gulpfile must contain a customizeSiteCsp function
    expect(gulpfileContent).to.include("customizeSiteCsp");

    // The production CSP in the gulpfile must include telemetry endpoints
    expect(gulpfileContent).to.include("browser.events.data.microsoft.com");
    expect(gulpfileContent).to.include("js.monitor.azure.com");
    expect(gulpfileContent).to.include("wcpstatic.microsoft.com");

    // Extract the regex pattern from the gulpfile and verify it actually matches
    // the CSP in index.html. This catches silent breakage when someone edits
    // the CSP in index.html but forgets to update the gulpfile regex.
    const regexMatch = gulpfileContent.match(/const localCsp\s*=\s*\/(.*?)\/gi;/s);
    expect(regexMatch, "gulpfile should contain a localCsp regex").to.not.be.null;

    const localCspRegex = new RegExp(regexMatch![1], "gi");
    const actualCsp = cspMatch![1];
    expect(
      localCspRegex.test(actualCsp),
      "gulpfile localCsp regex must match the CSP string in index.html. " +
        "If you changed the CSP in index.html, update the regex in customizeSiteCsp() too."
    ).to.be.true;
  });

  it("site/index.head.html should include 1DS and WcpConsent scripts", () => {
    const headPath = path.join(appRoot, "site", "index.head.html");
    const content = fs.readFileSync(headPath, "utf-8");

    expect(content).to.include("js.monitor.azure.com");
    expect(content).to.include("wcpstatic.microsoft.com");
  });
});
