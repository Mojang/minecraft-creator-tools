/**
 * PackageValidationTest - Validates that the built JSNode CLI package is correct.
 *
 * After jsnbuild completes, this test:
 *   1. Runs `npm pack` in toolbuild/jsn/ to create a .tgz in debugoutput/packages/
 *   2. Unpacks the .tgz into debugoutput/packages/unpacked/
 *   3. Installs dependencies in the unpacked package
 *   4. Validates that the CLI entry point loads without crashing (--help)
 *   5. Validates that the library entry point is requireable
 *   6. Validates that the agent skills ship next to the CLI, that the installed MCP server
 *      serves them through getSkill, and that `mct skills` prints them (see
 *      src/local/McpSkillLibrary.ts)
 *
 * Run with: npm run test-package (from app/)
 * Requires: npm run jsnbuild to have completed first
 */

import { assert } from "chai";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import TestPaths from "./TestPaths";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const packagesDir = path.join(TestPaths.appRoot, "debugoutput", "packages");
const unpackedDir = path.join(packagesDir, "unpacked");

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/** Every file under `root`, relative to it with forward slashes. */
function listFiles(root: string, relative = ""): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(path.join(root, relative), { withFileTypes: true })) {
    const entryPath = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...listFiles(root, entryPath));
    } else {
      files.push(entryPath);
    }
  }
  return files.sort();
}

function cleanDir(dir: string) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true });
  }
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * Runs execSync, retrying when it fails with a transient ETIMEDOUT.
 *
 * The `timeout` option on execSync is a wall-clock timer, not a CPU-time
 * budget. If the machine suspends (sleep/hibernate) while the command is
 * running, the timer can elapse even though the command made no real progress,
 * surfacing as a spawn-level ETIMEDOUT. Retrying lets the test recover from
 * such ambient interruptions instead of failing the entire suite.
 */
function execWithRetry(command: string, options: Parameters<typeof execSync>[1], retries = 2): string | Buffer {
  for (let attempt = 0; ; attempt++) {
    try {
      return execSync(command, options);
    } catch (e) {
      const err = e as NodeJS.ErrnoException & { errno?: string };
      const isTransientTimeout = err && (err.code === "ETIMEDOUT" || err.errno === "ETIMEDOUT");
      if (isTransientTimeout && attempt < retries) {
        continue;
      }
      throw e;
    }
  }
}

describe("PackageValidation", function () {
  this.timeout(120000);

  const jsnDir = path.join(TestPaths.appRoot, "toolbuild", "jsn");
  let tgzPath: string;

  before(function () {
    // Verify jsnbuild output exists
    const cliEntry = path.join(jsnDir, "cli", "index.mjs");
    if (!fs.existsSync(cliEntry)) {
      this.skip();
      return;
    }

    const packageJson = path.join(jsnDir, "package.json");
    if (!fs.existsSync(packageJson)) {
      this.skip();
      return;
    }

    ensureDir(packagesDir);
    cleanDir(unpackedDir);
  });

  describe("npm pack", function () {
    it("should create a .tgz package", function () {
      // npm pack outputs the filename of the created tarball to stdout
      const packOutput = execWithRetry("npm pack --pack-destination " + JSON.stringify(packagesDir), {
        cwd: jsnDir,
        encoding: "utf-8",
        timeout: 120000,
      });

      const result = (packOutput as string).trim();

      // result is the filename (e.g., "mctools-int-0.0.1.tgz")
      const tgzName = result.split("\n").pop()!.trim();
      tgzPath = path.join(packagesDir, tgzName);

      assert(fs.existsSync(tgzPath), `Expected .tgz at ${tgzPath}`);

      const stats = fs.statSync(tgzPath);
      assert(stats.size > 1000, `Package too small (${stats.size} bytes), likely empty`);
    });
  });

  describe("unpack and validate", function () {
    before(function () {
      if (!tgzPath || !fs.existsSync(tgzPath)) {
        this.skip();
        return;
      }

      // tar xzf extracts into a "package/" subdirectory by convention
      execWithRetry("tar xzf " + JSON.stringify(tgzPath), {
        cwd: unpackedDir,
        timeout: 30000,
      });
    });

    it("should contain package.json with correct bin entry", function () {
      const pkgJsonPath = path.join(unpackedDir, "package", "package.json");
      assert(fs.existsSync(pkgJsonPath), "package.json missing from unpacked package");

      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"));
      assert(pkg.bin, "package.json should have a bin entry");

      const binKeys = Object.keys(pkg.bin);
      assert(binKeys.length > 0, "bin entry should have at least one command");
    });

    it("should contain the CLI entry point", function () {
      const pkg = JSON.parse(fs.readFileSync(path.join(unpackedDir, "package", "package.json"), "utf-8"));
      const binEntries = Object.values(pkg.bin) as string[];

      for (const binPath of binEntries) {
        const fullPath = path.join(unpackedDir, "package", binPath);
        assert(fs.existsSync(fullPath), `CLI entry point missing: ${binPath}`);
      }
    });

    it("should contain the library entry point", function () {
      const pkg = JSON.parse(fs.readFileSync(path.join(unpackedDir, "package", "package.json"), "utf-8"));
      if (!pkg.main) {
        this.skip();
        return;
      }

      const mainPath = path.join(unpackedDir, "package", pkg.main);
      assert(fs.existsSync(mainPath), `Library entry point missing: ${pkg.main} — run libbuild before packaging`);
    });

    it("should contain the agent skills next to the CLI, and no evals", function () {
      const sourceSkills = path.join(TestPaths.repoRoot, "plugins", "minecraft", "skills");
      const packagedSkills = path.join(unpackedDir, "package", "skills");

      assert(fs.existsSync(packagedSkills), "skills/ missing from the package; check copyJsNodeSkills in gulpfile.js");
      assert.deepEqual(
        listFiles(packagedSkills),
        listFiles(sourceSkills),
        "packaged skills differ from plugins/minecraft/skills"
      );
      assert(!fs.existsSync(path.join(unpackedDir, "package", "evals")), "evals should not be shipped");
    });
  });

  describe("install and run", function () {
    const packageDir = path.join(unpackedDir, "package");

    before(function () {
      if (!fs.existsSync(path.join(packageDir, "package.json"))) {
        this.skip();
        return;
      }

      // Install production dependencies only
      execWithRetry("npm install --omit=dev --ignore-scripts", {
        cwd: packageDir,
        encoding: "utf-8",
        timeout: 60000,
        // Suppress npm output noise
        stdio: ["pipe", "pipe", "pipe"],
      });
    });

    it("CLI entry point should execute --help without error", function () {
      const pkg = JSON.parse(fs.readFileSync(path.join(packageDir, "package.json"), "utf-8"));
      const binEntries = Object.values(pkg.bin) as string[];
      const cliPath = path.join(packageDir, binEntries[0]);

      const result = execWithRetry(`node ${JSON.stringify(cliPath)} --help`, {
        cwd: packageDir,
        encoding: "utf-8",
        timeout: 15000,
        env: { ...process.env, NODE_NO_WARNINGS: "1" },
      });

      assert(result.length > 0, "CLI --help should produce output");
    });

    it("CLI entry point should execute version without error", function () {
      const pkg = JSON.parse(fs.readFileSync(path.join(packageDir, "package.json"), "utf-8"));
      const binEntries = Object.values(pkg.bin) as string[];
      const cliPath = path.join(packageDir, binEntries[0]);

      const result = execWithRetry(`node ${JSON.stringify(cliPath)} version`, {
        cwd: packageDir,
        encoding: "utf-8",
        timeout: 15000,
        env: { ...process.env, NODE_NO_WARNINGS: "1" },
      });

      assert(result.length > 0, "CLI version should produce output");
    });

    it("MCP server should serve the bundled skills through getSkill", async function () {
      this.timeout(60000);
      const pkg = JSON.parse(fs.readFileSync(path.join(packageDir, "package.json"), "utf-8"));
      const cliPath = path.join(packageDir, (Object.values(pkg.bin) as string[])[0]);
      const client = new Client({ name: "package-validation", version: "1.0.0" });

      await client.connect(
        new StdioClientTransport({
          command: process.execPath,
          args: [cliPath, "mcp"],
          cwd: packageDir,
          stderr: "ignore",
        })
      );
      try {
        const tools = (await client.listTools()).tools;
        assert(
          tools.some((tool) => tool.name === "getSkill"),
          "installed MCP server should register getSkill"
        );

        const result = await client.callTool({ name: "getSkill", arguments: { name: "debug-addon" } });
        const text = ((result as { content: { text?: string }[] }).content[0].text ?? "").toString();
        const skillFolder = path.join(packageDir, "skills", "debug-addon");
        assert(text.includes(`Skill folder: ${skillFolder}`), "getSkill should point at the installed skills folder");

        // The command the skill gives the agent must point at a script that exists in the install.
        const scriptPath = /node "([^"]+validate-summary\.mjs)"/.exec(text)?.[1];
        assert(scriptPath, "debug-addon should give a quoted validate-summary command");
        assert(fs.existsSync(scriptPath!), `validate-summary.mjs not found at ${scriptPath}`);
      } finally {
        await client.close();
      }
    });

    it("CLI should list and print the bundled skills with mct skills", function () {
      const pkg = JSON.parse(fs.readFileSync(path.join(packageDir, "package.json"), "utf-8"));
      const cliPath = path.join(packageDir, (Object.values(pkg.bin) as string[])[0]);
      const run = (args: string) =>
        execWithRetry(`node ${JSON.stringify(cliPath)} ${args}`, {
          cwd: packageDir,
          encoding: "utf-8",
          timeout: 15000,
          env: { ...process.env, NODE_NO_WARNINGS: "1" },
        }).toString();

      const list = JSON.parse(run("skills --json"));
      const sourceSkills = fs
        .readdirSync(path.join(TestPaths.repoRoot, "plugins", "minecraft", "skills"), { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();
      assert.deepEqual(
        list.skills.map((skill: { name: string }) => skill.name),
        sourceSkills,
        "mct skills should list every packaged skill"
      );
      for (const skill of list.skills as { name: string; folder: string }[]) {
        assert.equal(skill.folder, path.join(packageDir, "skills", skill.name), "skills should come from the install");
      }

      const text = run("skills debug-addon");
      const scriptPath = /node "([^"]+validate-summary\.mjs)"/.exec(text)?.[1];
      assert(scriptPath, "mct skills debug-addon should give a quoted validate-summary command");
      assert(fs.existsSync(scriptPath!), `validate-summary.mjs not found at ${scriptPath}`);
    });
  });
});
