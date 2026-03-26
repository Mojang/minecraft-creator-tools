/**
 * Validates that all dependency versions in package.json files are pinned
 * (no ^ or ~ prefixes). Unpinned versions can pull in breaking changes
 * from transitive dependencies on clean installs.
 *
 * Usage:
 *   node scripts/check-pinned-dependencies.js [file1.json] [file2.json] ...
 *
 * If no files are specified, defaults to checking:
 *   - package.json
 *   - jsnode/package.json
 *
 * Exit code 1 if any unpinned versions are found, 0 otherwise.
 */

const fs = require("fs");
const path = require("path");

const DEPENDENCY_KEYS = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"];

// Regex to detect version ranges with ^ or ~ prefixes
const UNPINNED_VERSION_RE = /^[\^~]/;

function checkFile(filePath) {
  const resolvedPath = path.resolve(filePath);

  if (!fs.existsSync(resolvedPath)) {
    console.error(`File not found: ${resolvedPath}`);
    return [];
  }

  const pkg = JSON.parse(fs.readFileSync(resolvedPath, "utf-8"));
  const violations = [];

  for (const depKey of DEPENDENCY_KEYS) {
    const deps = pkg[depKey];
    if (!deps) continue;

    for (const [name, version] of Object.entries(deps)) {
      if (typeof version === "string" && UNPINNED_VERSION_RE.test(version)) {
        const pinned = version.replace(/^[\^~]/, "");
        violations.push({ file: filePath, section: depKey, name, version, pinned });
      }
    }
  }

  return violations;
}

// Determine which files to check
let files = process.argv.slice(2);
if (files.length === 0) {
  files = ["package.json", "jsnode/package.json"];
}

let allViolations = [];
for (const file of files) {
  allViolations = allViolations.concat(checkFile(file));
}

if (allViolations.length > 0) {
  console.error(`\nFound ${allViolations.length} unpinned dependency version(s):\n`);
  for (const v of allViolations) {
    console.error(`  ${v.file} > ${v.section} > "${v.name}": "${v.version}"  →  pin to "${v.pinned}"`);
  }
  console.error(
    "\nAll dependency versions must be pinned (no ^ or ~ prefixes)." +
      "\nPin versions to prevent unexpected breaking changes from upstream packages." +
      "\nTo fix, remove the ^ or ~ prefix from each version above.\n"
  );
  process.exit(1);
} else {
  console.log("All dependency versions are pinned.");
}
