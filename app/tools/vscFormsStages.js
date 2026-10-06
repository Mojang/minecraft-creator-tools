// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

// The stages that produce the VS Code extension's forms tree: the
// @minecraft/bedrock-schemas baseline first, then the checked-in overrides
// from public_supplemental/data/local_forms/ on top, same-named files
// replacing upstream copies. gulpfile.js runs them in that order in every
// task that fills toolbuild/vsc (copybedrockschemas, vscbuild, vscdevbuild),
// and LocalFormOverrides.spec.ts runs the same pair against a scratch root
// and checks the final tree, so the build cannot drift from what is tested.

const path = require("path");
const newer = require("gulp-newer");

const appRoot = path.resolve(__dirname, "..");

function toGlob(filePath) {
  return filePath.replace(/\\/g, "/");
}

/**
 * @param {typeof import("gulp")} gulp
 * @param {string} vscRoot the extension output root; toolbuild/vsc for the real build
 */
module.exports = function vscFormsStages(gulp, vscRoot = path.join(appRoot, "toolbuild", "vsc")) {
  const formsDest = path.join(vscRoot, "data", "forms");
  const upstreamForms = toGlob(path.join(appRoot, "node_modules", "@minecraft", "bedrock-schemas", "forms", "**", "*"));
  const localForms = toGlob(path.join(appRoot, "public_supplemental", "data", "local_forms", "**", "*"));

  // Copy forms from @minecraft/bedrock-schemas package directly to VSC toolbuild
  // (VSC extension is self-contained, so it needs its own copy)
  function copyVscBedrockSchemasForms() {
    return gulp.src([upstreamForms]).pipe(newer(formsDest)).pipe(gulp.dest(formsDest));
  }

  // Overlay our checked-in form OVERRIDES on top of the bedrock-schemas baseline
  // inside the VSC toolbuild output. Same files (e.g. pack/behavior_pack_header_json.form.json)
  // in `public_supplemental/data/local_forms/` REPLACE the upstream copy. This produces
  // a single canonical location (`toolbuild/vsc/data/forms/`) the VSC extension can read
  // without runtime branching. It has to run after every upstream copy, or the
  // packaged extension ships the upstream form again.
  function mergeLocalFormsIntoVsc() {
    return gulp.src([localForms]).pipe(gulp.dest(formsDest));
  }

  return { formsDest, copyVscBedrockSchemasForms, mergeLocalFormsIntoVsc };
};
