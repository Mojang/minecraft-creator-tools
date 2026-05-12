const gulp = require("gulp");
const del = require("del");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const newer = require("gulp-newer");
const importTransform = require("./tools/gulp-importTransform");
const jsonifyTypes = require("./tools/gulp-jsonifyTypes");
const downloadResources = require("./tools/gulp-downloadResources");
const updateVersions = require("./tools/gulp-updateVersions");
const textReplaceStream = require("./tools/gulp-textReplaceStream");
const textReplace = require("./tools/gulp-textReplace");
const tgaToPng = require("./tools/gulp-tgaToPng");
const webpack = require("webpack");

const jsncorebuildfilesigs = [
  "src/**/*.ts",
  "!src/vscode/*.ts",
  "!src/UX/**/*",
  "!src/workers/**/*",
  "!src/UXex/**/*",
  "!src/test/**/*",
  "!src/test-ex/**/*",
  "!src/test-extra/**/*",
  "!src/testweb/**/*",
  "!src/monaco/*.ts",
  "!src/setupTests.ts",
  "!src/UX/world/*.ts",
  "!src/vscodeweb/*.ts",
  "!src/babylon/*.ts",
];

const libbuildfilesigs = [
  "src/**/*.ts",
  "!src/analytics/**/*",
  "!src/storage/**/FileSystem*",
  "!src/vscode/**/*",
  "!src/vscodeweb/**/*",
  "!src/UX/**/*",
  "!src/UXex/**/*",
  "!src/workers/**/*",
  "!src/UX/world/**/*",
  "!src/test/**/*",
  "!src/test-ex/**/*",
  "!src/test-extra/**/*",
  "!src/testweb/**/*",
  "!src/localserver/**/*",
  "!src/local/**/*",
  "!src/cli/**/*",
  "!src/mcp/**/*",
  "!src/electron/**/*",
  "!src/babylon/**/*",
  "!src/monaco/**/*",
  "!src/setupTests.ts",
  "!src/index.tsx",
  "!src/jsnwebindex.tsx",
  "!src/vscwebindex.tsx",
  "!**/*.test.ts",
  "!**/*.test.tsx",
];

const vsccorebuildfilesigs = [
  "src/**/*.ts",
  "!src/UX/*.ts",
  "!src/UXex/*.ts",
  "!src/workers/*.ts",
  "!src/test/**/*",
  "!src/testweb/**/*",
  "!src/test-ex/**/*",
  "!src/test-extra/**/*",
  "!src/testshared/**/*",
  "!src/testelectron/**/*",
  "!src/localserver/**/*",
  "!src/vscodeweb/*.ts",
  "!src/monaco/*.ts",
  "!src/setupTests.ts",
  "!src/UX/world/*.ts",
  "!src/local/*.ts",
  "!src/babylon/*.ts",
];

const jsnwebbuildfilesigs = [
  "src/**/*.ts",
  "!src/vscode/*.ts",
  "!src/vscodeweb/*.ts",
  "!src/test/**/*",
  "!src/test-ex/**/*",
  "!src/test-extra/**/*",
  "!src/testshared/**/*",
  "!src/testelectron/**/*",
  "!src/localserver/**/*",
  "!src/testweb/**/*",
  "!src/setupTests.ts",
  "!src/local/*.ts",
];

const mcbuildsigs = ["app/actionset/*.js", "app/tools/*.js"];

const mcstable10typedefsigs = [
  "node_modules_archive/@minecraft/server/1.19.0/*.d.ts",
  "node_modules_archive/@minecraft/server-ui/1.3.0/*.d.ts",
  "node_modules_archive/@minecraft/common/1.2.0/*.d.ts",
];

const mcstable20typedefsigs = [
  "node_modules/@minecraft/server/*.d.ts",
  "node_modules/@minecraft/server-gametest/*.d.ts",
  "node_modules/@minecraft/server-ui/*.d.ts",
  "node_modules/@minecraft/server-admin/*.d.ts",
  "node_modules/@minecraft/server-net/*.d.ts",
  "node_modules/@minecraft/server-editor/*.d.ts",
];

const mclibsigs = [
  "scriptlibs/@minecraft/math/minecraft-math.js",
  "scriptlibs/@minecraft/vanilla-data/minecraft-vanilla-data.ts",
];

const versionSource = ["toolbuild/jsn/package.json"];

const mcreslistsigs = ["reslist/schemas.resources.json"];
const mcreslistvanillasigs = ["reslist/packs.resources.json"];
const mcreslistpreviewvanillasigs = ["reslist/packs-preview.resources.json"];
const mcreslistsamplesigs = ["reslist/samples.resources.json"];
const mcreslistscriptsamplesigs = ["reslist/scriptsamples.resources.json"];
const mcreslistgametestsigs = ["reslist/gametestsamples.resources.json"];

function compileVscCoreExeBuild(done) {
  const config = require("./webpack.vsccore.config.js");
  webpack(config, (err, stats) => {
    if (err) {
      console.error(err);
      return done(err);
    }
    if (stats.hasErrors()) {
      console.error(stats.toString({ colors: true }));
      return done(new Error("Webpack compilation errors"));
    }
    console.log(stats.toString({ colors: true, chunks: false }));
    done();
  });
}

function compileVscCoreWebBuild(done) {
  const config = require("./webpack.vsccoreweb.config.js");
  webpack(config, (err, stats) => {
    if (err) {
      console.error(err);
      return done(err);
    }
    if (stats.hasErrors()) {
      console.error(stats.toString({ colors: true }));
      return done(new Error("Webpack compilation errors"));
    }
    console.log(stats.toString({ colors: true, chunks: false }));
    done();
  });
}

function compileVscWebBuild(done) {
  const config = require("./webpack.vscweb.config.js");
  webpack(config, (err, stats) => {
    if (err) {
      console.error(err);
      return done(err);
    }
    if (stats.hasErrors()) {
      console.error(stats.toString({ colors: true }));
      return done(new Error("Webpack compilation errors"));
    }
    console.log(stats.toString({ colors: true, chunks: false }));
    done();
  });
}

function compileJsnWebBuild(done) {
  const config = require("./webpack.jsnweb.config.js");
  webpack(config, (err, stats) => {
    if (err) {
      console.error(err);
      return done(err);
    }
    if (stats.hasErrors()) {
      console.error(stats.toString({ colors: true }));
      return done(new Error("Webpack compilation errors"));
    }
    console.log(stats.toString({ colors: true, chunks: false }));
    done();
  });
}

function compileJsNodeBuild(done) {
  // Use esbuild for fast ESM bundling (~300ms vs ~35s with webpack)
  try {
    execSync("node esbuild.jsn.config.mjs", { stdio: "inherit" });
    done();
  } catch (err) {
    done(err);
  }
}

function compileElectronBuild(done) {
  // Build bundled Electron main process and preload script
  try {
    execSync("node esbuild.electron.config.mjs", { stdio: "inherit" });
    done();
  } catch (err) {
    done(err);
  }
}

function compileLibBuild(done) {
  // Use direct tsc invocation instead of gulp-typescript for TypeScript 5.x compatibility
  try {
    execSync("npx tsc -p tsconfig.lib.json", { stdio: "inherit" });
    done();
  } catch (err) {
    done(err);
  }
}

function copyLibPackage() {
  return gulp.src(["libnode/package.json"]).pipe(gulp.dest("toolbuild/lib"));
}

function copyLibDocs() {
  return gulp.src(["libnode/README.md"], { allowEmpty: true }).pipe(gulp.dest("toolbuild/lib/"));
}

function customizeSiteHead() {
  return gulp.src(["site/index.head.html"], { base: "" }).pipe(textReplaceStream("build/index.html", /<\/head>/gi));
}

// Replace the local-dev CSP with a production CSP that allows telemetry endpoints.
// The local-dev index.html intentionally omits telemetry domains; this step adds them
// back for the mctools.dev production deployment.
function customizeSiteCsp() {
  const localCsp =
    /default-src 'self'; manifest-src 'self' https:\/\/github\.com; worker-src 'self' blob: ; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self' ws:\/\/localhost:\* wss:\/\/localhost:\* https:\/\/raw\.githubusercontent\.com\/ https:\/\/registry\.npmjs\.org\/ http:\/\/localhost:6126\/api\/; font-src 'self' https:\/\/res-1\.cdn\.office\.net; style-src 'self' 'unsafe-inline'; img-src 'self' data:/gi;
  const productionCsp =
    "default-src 'self'; manifest-src 'self' https://github.com; worker-src 'self' blob: ; script-src 'self' https://wcpstatic.microsoft.com/ https://js.monitor.azure.com/ 'wasm-unsafe-eval'; connect-src 'self' https://browser.events.data.microsoft.com/ https://js.monitor.azure.com/ https://raw.githubusercontent.com/ https://registry.npmjs.org/; form-action https://browser.events.data.microsoft.com/; font-src 'self' https://res-1.cdn.office.net; style-src 'self' 'unsafe-inline'; img-src 'self' data:";

  return gulp.src(["build/index.html"]).pipe(textReplace("build/index.html", [localCsp], [productionCsp]));
}

function stripSourceMapA() {
  return gulp
    .src(["node_modules/blockly/blockly_compressed.js"])
    .pipe(
      textReplace("node_modules/blockly/blockly_compressed.js", [/sourceMappingURL=blockly_compressed.js.map/gi], [""])
    );
}

function customizeSiteBody() {
  // Match the root div with or without the translate="no"/notranslate opt-out attributes.
  // The HTML source declares them to prevent in-browser translation extensions from
  // breaking React/Monaco DOM, but the body inserted from site/index.body.html also
  // declares them, so the swap remains a no-op for those attributes.
  return gulp
    .src(["site/index.body.html"], { base: "" })
    .pipe(textReplaceStream("build/index.html", /<div id="root"(?:\s+[^>]*)?><\/div>/gi));
}

function copyCheckedInRes() {
  // Exclude public_supplemental/data/local_forms/ — those overrides are
  // applied by `mergeLocalFormsIntoPublic` and `mergeLocalFormsIntoVsc`
  // directly onto the bedrock-schemas baseline (single output location).
  // Without this exclusion, overrides would land at public/data/local_forms/
  // and require runtime fallback logic in Database.ts.
  return gulp
    .src(["public_supplemental/**/*", "!public_supplemental/data/local_forms/**"])
    .pipe(gulp.dest("public/"));
}

// Copy forms from @minecraft/bedrock-schemas package directly to VSC toolbuild
// (VSC extension is self-contained, so it needs its own copy)
function copyVscBedrockSchemasForms() {
  return gulp
    .src(["node_modules/@minecraft/bedrock-schemas/forms/**/*"])
    .pipe(newer("toolbuild/vsc/data/forms/"))
    .pipe(gulp.dest("toolbuild/vsc/data/forms/"));
}

// Overlay our checked-in form OVERRIDES on top of the bedrock-schemas baseline
// inside the VSC toolbuild output. Same files (e.g. pack/behavior_pack_header_json.form.json)
// in `public_supplemental/data/local_forms/` REPLACE the upstream copy. This produces
// a single canonical location (`toolbuild/vsc/data/forms/`) the VSC extension can read
// without runtime branching.
function mergeLocalFormsIntoVsc() {
  return gulp
    .src(["public_supplemental/data/local_forms/**/*"])
    .pipe(gulp.dest("toolbuild/vsc/data/forms/"));
}

// Copy forms from @minecraft/bedrock-schemas into public/data/forms/ so they are
// available to both the Vite dev server (web app) and unit tests.
function copyBedrockSchemaFormsToPublic() {
  return gulp.src(["node_modules/@minecraft/bedrock-schemas/forms/**/*"]).pipe(gulp.dest("public/data/forms/"));
}

// Overlay our checked-in form OVERRIDES on top of the bedrock-schemas baseline.
// Source-of-truth lives at `public_supplemental/data/local_forms/`; same-named
// files (e.g. pack/behavior_pack_header_json.form.json) REPLACE upstream copies.
// Producing a single canonical `public/data/forms/` location means consumers
// (Database.ensureFormLoaded, HttpFolder, tests) all hit one place — no runtime
// fallback chain needed.
//
// Why not patch node_modules directly? Because npm install would clobber it.
// Why not contribute upstream? We should — but the npm release cadence on
// `@minecraft/bedrock-schemas` is out of band, so the build-time merge is the
// bridge. When upstream catches up, delete the override file and the merge
// becomes a no-op for that form.
function mergeLocalFormsIntoPublic() {
  return gulp
    .src(["public_supplemental/data/local_forms/**/*"])
    .pipe(gulp.dest("public/data/forms/"));
}

// Generate index.json files for each forms subdirectory so the web app's
// HttpFolder can discover form files at runtime (Vite doesn't serve directory listings).
function generateFormIndexFiles(done) {
  const formsDir = path.join(__dirname, "public/data/forms");
  if (!fs.existsSync(formsDir)) {
    done();
    return;
  }

  const subdirs = fs.readdirSync(formsDir, { withFileTypes: true }).filter((d) => d.isDirectory());
  for (const dir of subdirs) {
    const dirPath = path.join(formsDir, dir.name);
    const files = fs.readdirSync(dirPath).filter((f) => f.endsWith(".json") && f !== "index.json");
    const indexData = { files: files, folders: [] };
    fs.writeFileSync(path.join(dirPath, "index.json"), JSON.stringify(indexData));
  }
  done();
}

function copyVscData() {
  return gulp
    .src(
      [
        "public/data/**/*.json",
        "public/data/**/*.zip",
        "public/data/**/*.mcworld",
        "public/data/atlases/**/*.png",
        "!public/data/forms/**",
      ],
      {
        encoding: false,
      }
    )
    .pipe(newer("toolbuild/vsc/data/"))
    .pipe(gulp.dest("toolbuild/vsc/data/"));
}

function copyJsNodeData() {
  return gulp
    .src(
      [
        "public/data/**/*.ogg",
        "public/data/**/*.png",
        "public/data/**/*.json",
        "public/data/**/*.zip",
        "public/data/**/*.mcworld",
        "public/data/**/*.mcaddon",
        "!public/data/forms/**",
      ],
      { encoding: false }
    )
    .pipe(newer("toolbuild/jsn/data/"))
    .pipe(gulp.dest("toolbuild/jsn/data/"));
}

function copyJsNodeDist() {
  // Exclude esbuild-wasm — it's served from its npm package at runtime by HttpServer.
  return gulp
    .src(["public/dist/**/*", "!public/dist/esbuild-wasm/**"], { encoding: false })
    .pipe(newer("toolbuild/jsn/dist/"))
    .pipe(gulp.dest("toolbuild/jsn/dist/"));
}

function copyMonacoNpmDist() {
  // encoding: false is required for binary files (TTF fonts, etc.) to prevent UTF-8 corruption
  return gulp.src(["node_modules/monaco-editor/min/vs/**/*"], { encoding: false }).pipe(gulp.dest("public/dist/vs/"));
}

function copyMonacoMapsNpmDist() {
  return gulp
    .src(["node_modules/monaco-editor/min-maps/**/*"], { encoding: false })
    .pipe(gulp.dest("public/min-maps/"));
}

function copyEsbuildWasmDist() {
  return gulp
    .src(["node_modules/esbuild-wasm/esbuild.wasm"], { encoding: false })
    .pipe(gulp.dest("public/dist/esbuild-wasm/"));
}

function copyJsNodeDocs() {
  return gulp.src(["../CHANGELOG.md", "../NOTICE.md", "../LICENSE.md"]).pipe(gulp.dest("toolbuild/jsn/"));
}

// VSC builds retrieve vanilla resources and samples from mctools.dev, so we only copy
// metadata and schema files needed for offline validation/autocomplete.
// This mirrors the JSN build approach to keep the extension package size manageable.

function copyVscResPreviewMetadataVanillaData() {
  return gulp
    .src(["public/res/latest/van/preview/metadata/vanilladata_modules/**/*"], { allowEmpty: true })
    .pipe(newer("toolbuild/vsc/res/latest/van/preview/metadata/vanilladata_modules/"))
    .pipe(gulp.dest("toolbuild/vsc/res/latest/van/preview/metadata/vanilladata_modules/"));
}

function copyVscResPreviewMetadataCommandModules() {
  return gulp
    .src(["public/res/latest/van/preview/metadata/command_modules/**/*"], { allowEmpty: true })
    .pipe(newer("toolbuild/vsc/res/latest/van/preview/metadata/command_modules/"))
    .pipe(gulp.dest("toolbuild/vsc/res/latest/van/preview/metadata/command_modules/"));
}

function copyVscResPreviewMetadataIndex() {
  return gulp
    .src(["public/res/latest/van/preview/metadata/index.json", "public/res/latest/van/preview/metadata/README.md"], {
      allowEmpty: true,
    })
    .pipe(newer("toolbuild/vsc/res/latest/van/preview/metadata/"))
    .pipe(gulp.dest("toolbuild/vsc/res/latest/van/preview/metadata/"));
}

function copyVscResSchemas() {
  return gulp
    .src(["public/res/latest/schemas/**/*"])
    .pipe(newer("toolbuild/vsc/res/latest/schemas/"))
    .pipe(gulp.dest("toolbuild/vsc/res/latest/schemas/"));
}

// Copy official schemas from @minecraft/bedrock-schemas to toolbuild/vsc/schemas/
// These are used by Database.getOfficialSchema() for JSON validation
function copyVscSchemas() {
  return gulp
    .src(["node_modules/@minecraft/bedrock-schemas/schemas/**/*"])
    .pipe(newer("toolbuild/vsc/schemas/"))
    .pipe(gulp.dest("toolbuild/vsc/schemas/"));
}

function copyVscResImages() {
  return gulp
    .src(["public/res/images/**/*"], { encoding: false })
    .pipe(newer("toolbuild/vsc/res/images/"))
    .pipe(gulp.dest("toolbuild/vsc/res/images/"));
}

function copyVscResIcons() {
  return gulp
    .src(["public/res/icons/**/*"], { encoding: false })
    .pipe(newer("toolbuild/vsc/res/icons/"))
    .pipe(gulp.dest("toolbuild/vsc/res/icons/"));
}

function copyVscResSnapshots() {
  return gulp
    .src(["public/res/snapshots/**/*"], { encoding: false })
    .pipe(newer("toolbuild/vsc/res/snapshots/"))
    .pipe(gulp.dest("toolbuild/vsc/res/snapshots/"));
}

function copyVscResSamples() {
  return gulp
    .src(["public/res/samples/**/*"], { encoding: false })
    .pipe(newer("toolbuild/vsc/res/samples/"))
    .pipe(gulp.dest("toolbuild/vsc/res/samples/"));
}

function copyJsNodeResSamples() {
  return gulp
    .src(["public/res/samples/**/*"], { encoding: false })
    .pipe(newer("toolbuild/jsn/res/samples/"))
    .pipe(gulp.dest("toolbuild/jsn/res/samples/"));
}

function copyVscMc() {
  return gulp
    .src(["public/data/content/**/*.mcaddon"], { encoding: false })
    .pipe(newer("toolbuild/vsc/mc/"))
    .pipe(gulp.dest("toolbuild/vsc/mc/"));
}

function copyJsNodeResPreviewMetadataVanillaData() {
  return gulp
    .src(["public/res/latest/van/preview/metadata/vanilladata_modules/**/*"], { allowEmpty: true })
    .pipe(newer("toolbuild/jsn/res/latest/van/preview/metadata/vanilladata_modules/"))
    .pipe(gulp.dest("toolbuild/jsn/res/latest/van/preview/metadata/vanilladata_modules/"));
}

// Copy the command_modules folder needed for command autocomplete
function copyJsNodeResPreviewMetadataCommandModules() {
  return gulp
    .src(["public/res/latest/van/preview/metadata/command_modules/**/*"], { allowEmpty: true })
    .pipe(newer("toolbuild/jsn/res/latest/van/preview/metadata/command_modules/"))
    .pipe(gulp.dest("toolbuild/jsn/res/latest/van/preview/metadata/command_modules/"));
}

// Copy the metadata index.json file needed for headless rendering
function copyJsNodeResPreviewMetadataIndex() {
  return gulp
    .src(["public/res/latest/van/preview/metadata/index.json", "public/res/latest/van/preview/metadata/README.md"], {
      allowEmpty: true,
    })
    .pipe(gulp.dest("toolbuild/jsn/res/latest/van/preview/metadata/"));
}

function copyResLatestPreviewToServe() {
  return gulp
    .src(["public/res/latest/van/preview/**/*"], { encoding: false })
    .pipe(gulp.dest("public/res/latest/van/serve/"));
}

function copyJsNodeResSchemas() {
  const srcDir = "public/res/latest/schemas";
  if (!fs.existsSync(srcDir)) {
    console.log("copyJsNodeResSchemas: skipping — " + srcDir + " not found (run preparedevenv first)");
    return Promise.resolve();
  }
  return gulp
    .src(["public/res/latest/schemas/**/*"])
    .pipe(newer("toolbuild/jsn/res/latest/schemas/"))
    .pipe(gulp.dest("toolbuild/jsn/res/latest/schemas/"));
}

// copyJsNodeSchemas removed — schemas are now served from @minecraft/bedrock-schemas at runtime.

function copyJsNodeResImages() {
  return gulp
    .src(["public/res/images/**/*"], { encoding: false })
    .pipe(newer("toolbuild/jsn/res/images/"))
    .pipe(gulp.dest("toolbuild/jsn/res/images/"));
}

function copyJsNodeResIcons() {
  return gulp
    .src(["public/res/icons/**/*"], { encoding: false })
    .pipe(newer("toolbuild/jsn/res/icons/"))
    .pipe(gulp.dest("toolbuild/jsn/res/icons/"));
}

function copyJsNodeResSnapshots() {
  return gulp
    .src(["public/res/snapshots/**/*"], { encoding: false })
    .pipe(newer("toolbuild/jsn/res/snapshots/"))
    .pipe(gulp.dest("toolbuild/jsn/res/snapshots/"));
}

function copyJsNodeMc() {
  return gulp
    .src(["public/data/content/**/*.mcaddon"], { encoding: false })
    .pipe(newer("toolbuild/jsn/mc/"))
    .pipe(gulp.dest("toolbuild/jsn/mc/"));
}

function copyJsNodeAssets() {
  return gulp.src(["jsnode/**/*"]).pipe(gulp.dest("toolbuild/jsn/"));
}

// Copy docker-package folder to docker/ in the output (for TGZ distribution)
function copyJsNodeDocker() {
  return gulp.src(["docker-package/**/*"]).pipe(gulp.dest("toolbuild/jsn/docker/"));
}

function copyVscAssets() {
  return gulp.src(["vscode/**/*.json"]).pipe(newer("toolbuild/vsc/")).pipe(gulp.dest("toolbuild/vsc/"));
}

function copyVscDocs() {
  return gulp
    .src(["../CHANGELOG.md", "../LICENSE.md", "vscode/README.md"])
    .pipe(newer("toolbuild/vsc/"))
    .pipe(gulp.dest("toolbuild/vsc/"));
}

gulp.task("clean-jsnbuild", function () {
  return del(["toolbuild/jsn"]);
});

gulp.task("clean-vscbuild", function () {
  return del(["toolbuild/vsc"]);
});

gulp.task("clean-vsccorebuild", function () {
  return del(["toolbuild/vsc/core"]);
});

gulp.task("clean-vscwebbuild", function () {
  return del(["toolbuild/vsc/web"]);
});

gulp.task("clean-jsnwebbuild", function () {
  return del(["toolbuild/jsn/web"]);
});

gulp.task("clean-libbuild", function () {
  return del(["toolbuild/lib"]);
});

gulp.task("clean-mcbuild", function () {
  return del(["toolbuild/mc"]);
});

gulp.task("postclean-jsnwebbuild-node_modules", function () {
  return del(["toolbuild/jsn/app/node_modules"]);
});

gulp.task("postclean-jsnwebbuild-toolbuild", function () {
  return del(["toolbuild/jsn/app/toolbuild"]);
});

gulp.task("postclean-jsnwebbuild-build", function () {
  return del(["toolbuild/jsn/app/build"]);
});

gulp.task(
  "postclean-jsnwebbuild",
  gulp.parallel("postclean-jsnwebbuild-node_modules", "postclean-jsnwebbuild-toolbuild", "postclean-jsnwebbuild-build")
);

// jsnbuild: Incremental build - skips clean, uses gulp-newer to only copy changed files,
// and uses webpack filesystem cache for fast recompilation.
// Use jsnfullbuild when you need a guaranteed clean-slate build.
// Includes libbuild + copyLibToJsn so the package is always complete
// (toolbuild/jsn/lib/index.lib.js is the declared "main" entry point).
gulp.task(
  "jsnbuild",
  gulp.series(
    copyCheckedInRes,
    gulp.parallel(
      compileJsNodeBuild,
      compileElectronBuild, // Build bundled Electron main process
      compileLibBuild, // Library build (tsc with declarations for npm consumers)
      copyJsNodeAssets,
      copyJsNodeData,
      copyJsNodeDocs,
      copyJsNodeResSchemas,
      copyJsNodeResPreviewMetadataVanillaData,
      copyJsNodeResPreviewMetadataCommandModules,
      copyJsNodeResPreviewMetadataIndex,
      copyJsNodeResImages,
      copyJsNodeResIcons,
      copyJsNodeResSnapshots,
      copyJsNodeResSamples,
      copyJsNodeMc,
      copyJsNodeDist,
      compileJsnWebBuild,
      copyLibPackage,
      copyLibDocs
    ),
    copyLibToJsn, // Copy compiled lib into jsn package after parallel tasks complete
    "postclean-jsnwebbuild"
  )
);

// jsnfullbuild: Clean build - deletes toolbuild/jsn and toolbuild/lib, then rebuilds everything from scratch.
// Use this when you suspect stale files or need a guaranteed clean output.
gulp.task("jsnfullbuild", gulp.series(gulp.parallel("clean-jsnbuild", "clean-libbuild"), "jsnbuild"));

gulp.task("libbuild", gulp.series("clean-libbuild", gulp.parallel(compileLibBuild, copyLibPackage, copyLibDocs)));

// Copy the compiled lib output into the JSN package so npm pack includes it.
// The jsnode/package.json main field is "./lib/index.lib.js", so lib/ must
// exist inside toolbuild/jsn/ for the packaged .tgz to be complete.
function copyLibToJsn() {
  return gulp.src(["toolbuild/lib/**/*"]).pipe(gulp.dest("toolbuild/jsn/lib/"));
}

gulp.task("jsnlibbuild", gulp.series("libbuild", copyLibToJsn));

gulp.task("jsncorebuild", gulp.series(compileJsNodeBuild, compileElectronBuild));

gulp.task("electronbuild", gulp.series(compileElectronBuild));

gulp.task("copyjsnodedata", gulp.series(copyJsNodeData));

gulp.task(
  "copybedrockschemas",
  gulp.series(
    // Step 1: lay down the bedrock-schemas baseline into both web (public/data/forms/)
    // and VSC (toolbuild/vsc/data/forms/) outputs in parallel.
    gulp.parallel(copyVscBedrockSchemasForms, copyVscSchemas, copyBedrockSchemaFormsToPublic),
    // Step 2: overlay our checked-in form OVERRIDES on top of the baseline.
    // Same-named files (e.g. pack/behavior_pack_header_json.form.json) replace
    // upstream copies, producing a single canonical output location with no
    // runtime fallback chain.
    gulp.parallel(mergeLocalFormsIntoPublic, mergeLocalFormsIntoVsc),
    // Step 3: regenerate index.json files for HttpFolder discovery.
    generateFormIndexFiles
  )
);

gulp.task("vsccoreexebuild", compileVscCoreExeBuild);
gulp.task("vsccorewebbuild", compileVscCoreWebBuild);

gulp.task("vsccorebuild", gulp.series("clean-vsccorebuild", gulp.parallel("vsccoreexebuild", "vsccorewebbuild")));

gulp.task("postclean-vscwebbuild-node_modules", function () {
  return del(["toolbuild/vsc/app/node_modules"]);
});

gulp.task("postclean-vscwebbuild-toolbuild", function () {
  return del(["toolbuild/vsc/app/toolbuild"]);
});

gulp.task("postclean-vscwebbuild-build", function () {
  return del(["toolbuild/vsc/app/build"]);
});

gulp.task(
  "postclean-vscwebbuild",
  gulp.parallel("postclean-vscwebbuild-node_modules", "postclean-vscwebbuild-toolbuild", "postclean-vscwebbuild-build")
);

// Package the VS Code extension into a .vsix file using @vscode/vsce.
// The .vsix is written into toolbuild/vsc/ so semantic-release can find it
// via the "app/toolbuild/vsc/*.vsix" asset glob.
function packageVsix(done) {
  try {
    const vscePath = require.resolve("@vscode/vsce/vsce");
    execSync(`node "${vscePath}" package --no-dependencies -o .`, {
      cwd: "toolbuild/vsc",
      stdio: "inherit",
    });
    done();
  } catch (err) {
    done(err);
  }
}

gulp.task(
  "vscbuild",
  gulp.series(
    "clean-vscbuild",
    copyCheckedInRes,
    gulp.parallel(
      "vsccoreexebuild",
      "vsccorewebbuild",
      gulp.series(compileVscWebBuild, "postclean-vscwebbuild"),
      copyVscAssets,
      copyVscDocs,
      copyVscData,
      copyVscBedrockSchemasForms,
      copyVscResPreviewMetadataVanillaData,
      copyVscResPreviewMetadataCommandModules,
      copyVscResPreviewMetadataIndex,
      copyVscResSchemas,
      copyVscSchemas,
      copyVscResImages,
      copyVscResIcons,
      copyVscResSnapshots,
      copyVscResSamples,
      copyVscMc
    ),
    packageVsix
  )
);

// vscdevbuild: Fastest incremental VSC build for F5 debugging.
// Skips the .vsix packaging step — the extensionDevelopmentPath launch config
// loads directly from toolbuild/vsc/, so there's no need to repackage on every run.
// Also skips clean-vscbuild for fast iteration; use vscbuild or vscfullbuild for
// a clean-slate build before packaging or release.
gulp.task(
  "vscdevbuild",
  gulp.series(
    copyCheckedInRes,
    gulp.parallel(
      "vsccoreexebuild",
      "vsccorewebbuild",
      gulp.series(compileVscWebBuild, "postclean-vscwebbuild"),
      copyVscAssets,
      copyVscDocs,
      copyVscData,
      copyVscBedrockSchemasForms,
      copyVscResPreviewMetadataVanillaData,
      copyVscResPreviewMetadataCommandModules,
      copyVscResPreviewMetadataIndex,
      copyVscResSchemas,
      copyVscSchemas,
      copyVscResImages,
      copyVscResIcons,
      copyVscResSnapshots,
      copyVscResSamples,
      copyVscMc
    )
  )
);

// vscfullbuild: Clean + build + package. Equivalent to vscbuild now that
// vscbuild includes its own clean-vscbuild step; retained for clarity in
// CI/release scripts and for symmetry with other *fullbuild tasks.
gulp.task("vscfullbuild", gulp.series("clean-vscbuild", "vscbuild"));

function compileWebJsBuild(done) {
  // Use direct tsc invocation instead of gulp-typescript for TypeScript 5.x compatibility
  try {
    execSync("npx tsc -p tsconfig.webbuild.json", { stdio: "inherit" });
    done();
  } catch (err) {
    done(err);
  }
}

function buildMinecraftJs() {
  return gulp.src(mcbuildsigs, { base: "" }).pipe(importTransform()).pipe(gulp.dest("out/mc"));
}

function buildIncludes() {
  return gulp.src(mclibsigs, { base: "" }).pipe(jsonifyTypes("public/data/libs.json", false));
}

function buildStable20JsonTypeDefs() {
  return gulp.src(mcstable20typedefsigs, { base: "" }).pipe(jsonifyTypes("public/data/typedefs.stable20.json", false));
}

function buildStable10JsonTypeDefs() {
  return gulp.src(mcstable10typedefsigs, { base: "" }).pipe(jsonifyTypes("public/data/typedefs.stable10.json", false));
}

function runDownloadResources() {
  return gulp.src(mcreslistsigs, { base: "" }).pipe(downloadResources("public/res/latest/"));
}

function runUpdateVersions() {
  return gulp
    .src(versionSource, { base: "" })
    .pipe(
      updateVersions([
        "./package.json",
        "./package-lock.json",
        "./jsnode/package.json",
        "./vscode/package.json",
        "./src/core/Constants.ts",
      ])
    );
}

function runDownloadSamples() {
  return gulp
    .src(mcreslistsamplesigs, { base: "", encoding: false })
    .pipe(downloadResources("public/res/samples/microsoft/"));
}

function runDownloadScriptSamples() {
  return gulp
    .src(mcreslistscriptsamplesigs, { base: "", encoding: false })
    .pipe(downloadResources("public/res/samples/microsoft/"));
}

function runDownloadGameTests() {
  return gulp
    .src(mcreslistgametestsigs, { base: "", encoding: false })
    .pipe(downloadResources("public/res/samples/microsoft/"));
}

function runDownloadVanillaResources() {
  return gulp
    .src(mcreslistvanillasigs, { base: "", encoding: false })
    .pipe(downloadResources("public/res/latest/van/release/"));
}

function runDownloadVanillaPreviewResources() {
  return gulp
    .src(mcreslistpreviewvanillasigs, { base: "", encoding: false })
    .pipe(downloadResources("public/res/latest/van/preview/"));
}

function convertVanillaTgaToPng() {
  const vanillaDirectories = ["public/res/latest/van/serve/resource_pack/textures"];

  return gulp.src("package.json").pipe(tgaToPng(vanillaDirectories));
}

function generateItemCatalog(done) {
  const { execSync } = require("child_process");
  try {
    console.log("Generating item catalog and sprite atlas...");
    execSync("node scripts/generate-item-catalog.mjs", { stdio: "inherit", cwd: __dirname });
    done();
  } catch (err) {
    console.error("Item catalog generation failed:", err.message);
    done(err);
  }
}

gulp.task("createresserve", copyResLatestPreviewToServe);
gulp.task("tgatopng", convertVanillaTgaToPng);
gulp.task("generateitemcatalog", generateItemCatalog);

gulp.task("vscwebbuild", gulp.series("clean-vscwebbuild", compileVscWebBuild, "postclean-vscwebbuild"));

gulp.task("jsnwebbuild", gulp.series("clean-jsnwebbuild", compileJsnWebBuild, "postclean-jsnwebbuild"));

gulp.task("clean-webbuild", function () {
  return del(["out/web"]);
});

gulp.task("clean-res", function () {
  return del(["public/res/latest", "public/res/samples"]);
});

gulp.task("customizesite", gulp.series(customizeSiteCsp, customizeSiteHead, customizeSiteBody));

gulp.task("webbuild", gulp.series("clean-webbuild", compileWebJsBuild));

gulp.task("mcbuild", gulp.series(gulp.parallel("clean-mcbuild", "webbuild"), buildMinecraftJs));

gulp.task("mctypes", gulp.parallel(buildStable20JsonTypeDefs, buildStable10JsonTypeDefs, buildIncludes));

gulp.task("updateversions", gulp.series(runUpdateVersions));

gulp.task(
  "dlres",
  gulp.series(
    "clean-res",
    gulp.parallel(
      runDownloadResources,
      runDownloadSamples,
      runDownloadScriptSamples,
      runDownloadGameTests,
      runDownloadVanillaResources,
      runDownloadVanillaPreviewResources,
      copyCheckedInRes
    ),
    copyResLatestPreviewToServe,
    convertVanillaTgaToPng,
    generateItemCatalog
  )
);

gulp.task(
  "preparedevenvlocal",
  gulp.parallel(stripSourceMapA, copyMonacoNpmDist, copyMonacoMapsNpmDist, copyEsbuildWasmDist)
);

gulp.task("preparedevenv", gulp.parallel("mctypes", "dlres", "preparedevenvlocal"));

gulp.task("npmdepends", gulp.parallel(copyMonacoNpmDist, copyMonacoMapsNpmDist, copyEsbuildWasmDist));

// Generate JSON schemas from TypeScript types
function generateJsonSchemas(done) {
  const { execSync } = require("child_process");
  try {
    execSync("node scripts/generateJsonSchemas.js", { stdio: "inherit" });
    done();
  } catch (err) {
    done(err);
  }
}

gulp.task("generate-schemas", generateJsonSchemas);

gulp.task("default", gulp.parallel("jsnbuild", "vscbuild"));

gulp.task("watch", function () {
  gulp.watch(jsncorebuildfilesigs, gulp.series("jsnbuild"));
});

gulp.task(
  "watchvsccore",
  gulp.parallel("vsccorebuild", function () {
    gulp.watch(vsccorebuildfilesigs, gulp.series("vsccorebuild"));
  })
);
