/**
 * Global Setup for Server UI Tests
 *
 * This module starts the MCT server on a random port before tests run
 * and stores the port number for tests to use.
 *
 * The server is started with the test admin passcode and configured
 * to skip signature verification for faster test startup.
 */
import { spawn, ChildProcess } from "child_process";
import * as path from "path";
import * as http from "http";
import * as fs from "fs";

// Store the server process globally so teardown can access it
declare global {
  // eslint-disable-next-line no-var
  var __MCT_SERVER_PROCESS__: ChildProcess | undefined;
  // eslint-disable-next-line no-var
  var __MCT_SERVER_PORT__: number | undefined;
  // eslint-disable-next-line no-var
  var __MCT_SERVER_SLOT__: number | undefined;
}

// Port range for random port selection (6446-6546)
// See src/cli/index.ts for full MCT port allocation map
// Avoids conflict with:
// - Default serve port (6126)
// - MCP internal server range (6136-6336)
// - CLI render commands (6346-6446)
const PORT_RANGE_START = 6446;
const PORT_RANGE_END = 6546;

// Slot range for random slot selection (avoid slot 0 which uses port 19132)
// Slots 1-10 use ports 19164, 19196, 19228, etc. (each slot adds 32 to the base port)
const SLOT_RANGE_START = 1;
const SLOT_RANGE_END = 10;

// Test admin passcode - must match what tests expect
const TEST_ADMIN_PASSCODE = "testpswd";

// File to store the port number for tests to read
const PORT_FILE = path.resolve(__dirname, "../../debugoutput/.serverui-test-port");

// File to store the slot number for tests to read
const SLOT_FILE = path.resolve(__dirname, "../../debugoutput/.serverui-test-slot");

/**
 * Generate a random port in the configured range.
 */
function getRandomPort(): number {
  return Math.floor(Math.random() * (PORT_RANGE_END - PORT_RANGE_START + 1)) + PORT_RANGE_START;
}

/**
 * Generate a random slot in the configured range.
 * Avoids slot 0 (port 19132) which is commonly used.
 */
function getRandomSlot(): number {
  return Math.floor(Math.random() * (SLOT_RANGE_END - SLOT_RANGE_START + 1)) + SLOT_RANGE_START;
}

/**
 * Check if a port is available.
 */
async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = http.createServer();
    server.listen(port, "127.0.0.1");
    server.on("listening", () => {
      server.close();
      resolve(true);
    });
    server.on("error", () => {
      resolve(false);
    });
  });
}

/**
 * Find an available port in the range.
 */
async function findAvailablePort(): Promise<number> {
  const maxAttempts = 20;
  for (let i = 0; i < maxAttempts; i++) {
    const port = getRandomPort();
    if (await isPortAvailable(port)) {
      return port;
    }
    console.log(`Port ${port} is in use, trying another...`);
  }
  throw new Error(`Could not find available port in range ${PORT_RANGE_START}-${PORT_RANGE_END}`);
}

/**
 * Wait for the server to be ready by polling the health endpoint.
 */
async function waitForServerReady(port: number, maxWaitMs: number = 30000): Promise<boolean> {
  const startTime = Date.now();
  const pollInterval = 500;

  while (Date.now() - startTime < maxWaitMs) {
    try {
      const response = await new Promise<boolean>((resolve) => {
        const req = http.get(`http://localhost:${port}/`, (res) => {
          resolve(res.statusCode === 200);
        });
        req.on("error", () => resolve(false));
        req.setTimeout(2000, () => {
          req.destroy();
          resolve(false);
        });
      });

      if (response) {
        console.log(`MCT server is ready on port ${port}`);
        return true;
      }
    } catch {
      // Ignore errors, keep polling
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  console.error(`MCT server failed to start within ${maxWaitMs}ms`);
  return false;
}

/**
 * Global setup function called by Playwright before all tests.
 */
async function globalSetup(): Promise<void> {
  console.log("Starting MCT server for Server UI tests...");

  // Find an available port
  const port = await findAvailablePort();
  console.log(`Using port ${port} for MCT server`);

  // Pick a random slot to avoid conflicts with other Minecraft instances
  const slot = getRandomSlot();
  const minecraftPort = 19132 + slot * 32;
  console.log(`Using slot ${slot} (Minecraft port ${minecraftPort}) for dedicated server`);

  // Ensure the debugoutput directory exists
  const debugOutputDir = path.dirname(PORT_FILE);
  if (!fs.existsSync(debugOutputDir)) {
    fs.mkdirSync(debugOutputDir, { recursive: true });
  }

  // Write the port and slot to files so tests can read them
  fs.writeFileSync(PORT_FILE, port.toString());
  fs.writeFileSync(SLOT_FILE, slot.toString());

  // Path to the MCT CLI entry point (compiled from cli/index.ts)
  const mctPath = path.resolve(__dirname, "../../toolbuild/jsn/cli/index.mjs");

  // Start the MCT server with the test passcode and random slot
  // Command format: mct --adminpc <passcode> serve <features> <domain> <port> --slot <slot>
  // The --adminpc is a global option (before serve)
  // The port is a positional argument after 'serve all localhost'
  // The --slot option specifies which Minecraft port range to use
  // Note: We keep signature verification enabled to test the full security flow
  const serverProcess = spawn(
    "node",
    [
      mctPath,
      "--adminpc",
      TEST_ADMIN_PASSCODE,
      "serve",
      "all",
      "localhost",
      port.toString(),
      "--slot",
      slot.toString(),
    ],
    {
      cwd: path.resolve(__dirname, "../.."),
      stdio: ["ignore", "pipe", "pipe"],
      detached: false,
    }
  );

  // Store the process and config globally for teardown
  global.__MCT_SERVER_PROCESS__ = serverProcess;
  global.__MCT_SERVER_PORT__ = port;
  global.__MCT_SERVER_SLOT__ = slot;

  // Log server output for debugging
  serverProcess.stdout?.on("data", (data: Buffer) => {
    const output = data.toString().trim();
    if (output) {
      console.log(`[MCT Server] ${output}`);
    }
  });

  serverProcess.stderr?.on("data", (data: Buffer) => {
    const output = data.toString().trim();
    if (output) {
      console.error(`[MCT Server Error] ${output}`);
    }
  });

  serverProcess.on("error", (err) => {
    console.error(`Failed to start MCT server: ${err.message}`);
  });

  serverProcess.on("exit", (code, signal) => {
    if (code !== null) {
      console.log(`MCT server exited with code ${code}`);
    } else if (signal !== null) {
      console.log(`MCT server killed with signal ${signal}`);
    }
  });

  // Wait for the server to be ready
  const isReady = await waitForServerReady(port);

  if (!isReady) {
    // Clean up if server failed to start
    serverProcess.kill();
    throw new Error("MCT server failed to start");
  }

  console.log(`MCT server started successfully on port ${port}`);
}

export default globalSetup;
