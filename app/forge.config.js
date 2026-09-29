const path = require("path");

// Use a short output directory in CI to avoid Windows MAX_PATH (260 char) limits.
// The CI workspace path is very long, and NuGet/Squirrel can't handle long paths
// when packaging the asar-unpacked CLI tools directory.
const outDir = process.env.ELECTRON_OUT_DIR || "out";

// Set FORGE_DEBUG=1 to disable asar packaging for faster local iteration.
const isDebugBuild = process.env.FORGE_DEBUG === "1";

// ── Electron runtime dependencies ──────────────────────────────────────────
// Only these node_modules packages are kept in the packaged app.
// The Electron main process and preload are bundled via esbuild, but some
// packages are marked external because they have native bindings or use
// patterns that can't be bundled (dynamic require, __dirname-based paths).
const electronRuntimeDeps = new Set(["@resvg/resvg-js"]);

// Recursively collect the transitive dependencies of the runtime packages
// so their sub-dependencies are also kept.
function collectTransitiveDeps(packageDir, seen) {
  if (!seen) seen = new Set();
  const fs = require("fs");

  for (const dep of electronRuntimeDeps) {
    collectDep(dep, packageDir, seen, fs);
  }
  return seen;
}

function collectDep(name, baseDir, seen, fs) {
  if (seen.has(name)) return;
  seen.add(name);

  const pkgJsonPath = path.join(baseDir, "node_modules", name, "package.json");
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"));
    if (pkg.dependencies) {
      for (const sub of Object.keys(pkg.dependencies)) {
        collectDep(sub, baseDir, seen, fs);
      }
    }
  } catch {
    // Package may not exist or have no dependencies — that's fine
  }
}

// Build the full set of allowed packages (runtime deps + their transitive deps)
const allowedNodeModules = collectTransitiveDeps(__dirname);

module.exports = {
  outDir: outDir,
  packagerConfig: {
    icon: "./res/icons/icon",
    name: "mct",
    prune: true,
    junk: true,
    // Only unpack the CLI entry points and bundles that are spawned as child processes.
    // Node.js cannot spawn scripts from inside asar archives.
    // skills/ sits next to cli/ because the MCP child process looks for <package>/skills and runs the
    // skills' helper scripts with node, so it has to be unpacked too.
    // Data/web/res/samples stay inside asar (Electron can read them transparently).
    // The CLI subprocess accesses data/web/res via the unpacked cli+dist+lib bundles
    // which resolve paths relative to their own __dirname.
    // In debug builds (FORGE_DEBUG=1), asar is disabled entirely for faster iteration.
    asar: isDebugBuild
      ? false
      : {
          unpack:
            "{**/toolbuild/jsn/cli/**/*,**/toolbuild/jsn/dist/**/*,**/toolbuild/jsn/data/**/*,**/toolbuild/jsn/web/**/*,**/toolbuild/jsn/package.json,**/toolbuild/jsn/mc/**/*,**/toolbuild/jsn/docker/**/*,**/toolbuild/jsn/skills/**/*}",
        },
    win32metadata: {
      CompanyName: "Mojang",
      ProductName: "Minecraft Creator Tools",
    },
    ignore: (filePath) => {
      // Normalize to forward slashes for cross-platform consistency
      const p = filePath.replace(/\\/g, "/");

      // Always include the root
      if (p === "/" || p === "") return false;

      // ── node_modules: allow-list approach ──────────────────────────
      if (p.startsWith("/node_modules") || p === "node_modules") {
        // Allow the node_modules directory itself
        if (p === "/node_modules" || p === "node_modules") return false;

        // Extract the package name (handles scoped packages like @scope/pkg)
        const rel = p.replace(/^\/?node_modules\//, "");
        const parts = rel.split("/");
        const pkgName = parts[0].startsWith("@") ? `${parts[0]}/${parts[1]}` : parts[0];

        return !allowedNodeModules.has(pkgName);
      }

      // ── Directories to INCLUDE ─────────────────────────────────────
      // build/ — bundled web app loaded by Electron
      if (p.startsWith("/build") || p.startsWith("build")) {
        // Exclude large vanilla resource packs from build
        if (p.includes("/build/res/latest/van/")) return true;
        if (p.includes("/build/min-maps")) return true;
        return false;
      }
      // toolbuild/jsn/ — CLI and supporting files (also allow toolbuild/ itself)
      if (p === "/toolbuild" || p === "toolbuild") return false;
      if (p.startsWith("/toolbuild/jsn") || p.startsWith("toolbuild/jsn")) return false;
      // package.json is required by Electron
      if (p === "/package.json" || p === "package.json") return false;

      // ── Everything else is excluded ────────────────────────────────
      return true;
    },
  },
  makers: [
    {
      name: "@electron-forge/maker-squirrel",
      config: {
        name: "mct",
        title: "Minecraft Creator Tools",
        authors: "Mojang",
        owners: "Minecraft Creator Tools",
        copyright: "Copyright (c) 2026 Mojang AB",
        setupIcon: path.join(__dirname, "/res/icons/icon.ico"),
        loadingGif: path.join(__dirname, "/res/mctoolsloading.gif"),
        description: "Tools for developers and creators for working with Minecraft Bedrock Edition.",
      },
    },
    {
      name: "@electron-forge/maker-zip",
    },
  ],
};
