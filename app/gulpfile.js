const gulp = require("gulp");
const sourcemaps = require("gulp-sourcemaps");
const ts = require("gulp-typescript");
const del = require("del");
const importTransform = require("./tools/gulp-importTransform");
const nodeifyScript = require("./tools/gulp-nodeifyScript");
const jsonifyTypes = require("./tools/gulp-jsonifyTypes");
const downloadResources = require("./tools/gulp-downloadResources");
const updateVersions = require("./tools/gulp-updateVersions");
const textReplaceStream = require("./tools/gulp-textReplaceStream");
const gulpWebpack = require("webpack-stream");

const jsnbuildfilesigs = [
  "src/**/*.ts",
  "!src/vscode/*.ts",
  "!src/UX/*.ts",
  "!src/UXex/*.ts",
  "!out/**/*",
  "!build/**/*",
  "!toolbuild/**/*",
  "!scriptlibs/**/*",
  "!test/results/**/*",
  "!test/scenarios/**/*",
  "!dist/**/*",
  "!res/**/*",
  "!src/monaco/*.ts",
  "!src/setupTests.ts",
  "!src/worldux/*.ts",
  "!src/vscodeweb/*.ts",
  "!src/babylon/*.ts",
  "!node_modules/@types/leaflet/*.ts",
  "!node_modules/babylonjs/*.ts",
];

const jsnwebbuildfilesigs = [
  "src/**/*.ts",
  "!src/vscode/*.ts",
  "!src/vscodeweb/*.ts",
  "!out/**/*",
  "!build/**/*",
  "!toolbuild/**/*",
  "!scriptlibs/**/*",
  "!test/results/**/*",
  "!test/scenarios/**/*",
  "!dist/**/*",
  "!res/**/*",
  "!src/setupTests.ts",
  "!src/local/*.ts",
  "!node_modules/@types/leaflet/*.ts",
  "!node_modules/babylonjs/*.ts",
];

const mcbuildsigs = ["app/actionset/*.js", "app/tools/*.js"];

const mcstabletypedefsigs = ["node_modules_archive/@minecraft/server/1.0.0/*.d.ts"];

const mcbetatypedefsigs = [
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
const mcreslistsamplesigs = ["reslist/samples.resources.json"];
const mcreslistscriptsamplesigs = ["reslist/scriptsamples.resources.json"];
const mcreslistgametestsigs = ["reslist/gametestsamples.resources.json"];

function compileJsnWebBuild() {
  return gulp
    .src(jsnwebbuildfilesigs, { base: "" })
    .pipe(gulpWebpack(require("./webpack.jsnweb.config.js")))
    .pipe(gulp.dest("toolbuild/jsn/web"))
    .on("end", function () {})
    .on("error", function () {});
}

function compileJsNodeBuild() {
  const tsProject = ts.createProject({
    module: "commonjs",
    target: "es2020",
    outDir: "jsn",
    moduleResolution: "node",
    sourceMap: true,
    allowSyntheticDefaultImports: true,
    noImplicitAny: true,
  });

  return gulp
    .src(jsnbuildfilesigs, { base: "" })
    .pipe(sourcemaps.init())
    .pipe(tsProject())
    .pipe(
      sourcemaps.mapSources(function (sourcePath, file) {
        // source paths are prefixed with '../src/'
        return "../../" + sourcePath;
      })
    )
    .pipe(nodeifyScript())
    .pipe(sourcemaps.write("./maps/"))
    .pipe(gulp.dest("toolbuild/jsn"))
    .on("end", function () {})
    .on("error", function () {});
}

function customizeSiteHead() {
  return gulp.src(["site/index.head.html"], { base: "" }).pipe(textReplaceStream("build/index.html", /<\/head>/gi));
}

function customizeSiteBody() {
  return gulp
    .src(["site/index.body.html"], { base: "" })
    .pipe(textReplaceStream("build/index.html", /<div id="root"><\/div>/gi));
}

function copyCheckedInRes() {
  return gulp.src(["public_ci/**/*"]).pipe(gulp.dest("public/"));
}

function copyJsNodeData() {
  return gulp.src(["public/data/**/*.json", "public/data/**/*.mcworld"]).pipe(gulp.dest("toolbuild/jsn/data/"));
}

function copyMonacoNpmDist() {
  return gulp.src(["node_modules/monaco-editor/min/vs/**/*"]).pipe(gulp.dest("public/dist/vs/"));
}

function copyMonacoMapsNpmDist() {
  return gulp.src(["node_modules/monaco-editor/min-maps/**/*"]).pipe(gulp.dest("public/min-maps/"));
}

function copyEsbuildWasmDist() {
  return gulp.src(["node_modules/esbuild-wasm/esbuild.wasm"]).pipe(gulp.dest("public/dist/esbuild-wasm/"));
}

function copyJsNodeDocs() {
  return gulp.src(["../CHANGELOG.md", "../NOTICE.md"]).pipe(gulp.dest("toolbuild/jsn/"));
}

function copyJsNodeResSchemas() {
  return gulp.src(["public/res/latest/schemas/**/*"]).pipe(gulp.dest("toolbuild/jsn/res/latest/schemas/"));
}

function copyJsNodeAssets() {
  return gulp.src(["jsnode/**/*"]).pipe(gulp.dest("toolbuild/jsn/"));
}

gulp.task("clean-jsnbuild", function () {
  return del(["toolbuild/jsn"]);
});

gulp.task("clean-jsnwebbuild", function () {
  return del(["toolbuild/jsn/web"]);
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

gulp.task(
  "jsnbuild",
  gulp.series(
    "clean-jsnbuild",
    copyCheckedInRes,
    gulp.parallel(compileJsNodeBuild, copyJsNodeAssets, copyJsNodeData, copyJsNodeDocs, copyJsNodeResSchemas)
  )
);

gulp.task("jsncorebuild", gulp.series(compileJsNodeBuild));

gulp.task("copyjsnodedata", gulp.series(copyJsNodeData));

function compileWebJsBuild() {
  const tsProject = ts.createProject({
    module: "esnext",
    target: "es2020",
    outDir: "web",
    moduleResolution: "node",
    sourceMap: true,
    allowSyntheticDefaultImports: true,
    noImplicitAny: true,
  });

  return gulp
    .src(jsnbuildfilesigs, { base: "" })
    .pipe(sourcemaps.init())
    .pipe(tsProject())
    .pipe(
      sourcemaps.mapSources(function (sourcePath, file) {
        // source paths are prefixed with '../src/'
        return "../" + sourcePath;
      })
    )
    .pipe(sourcemaps.write("./maps/"))
    .pipe(gulp.dest("out/web"))
    .on("end", function () {})
    .on("error", function () {});
}

function buildMinecraftJs() {
  return gulp.src(mcbuildsigs, { base: "" }).pipe(importTransform()).pipe(gulp.dest("out/mc"));
}

function buildIncludes() {
  return gulp.src(mclibsigs, { base: "" }).pipe(jsonifyTypes("public/data/libs.json", false));
}

function buildBetaJsonTypeDefs() {
  return gulp.src(mcbetatypedefsigs, { base: "" }).pipe(jsonifyTypes("public/data/typedefs.beta.json", false));
}

function buildStableJsonTypeDefs() {
  return gulp.src(mcstabletypedefsigs, { base: "" }).pipe(jsonifyTypes("public/data/typedefs.stable.json", false));
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
        "./src/core/Constants.ts",
      ])
    );
}


function runDownloadSamples() {
  return gulp.src(mcreslistsamplesigs, { base: "" }).pipe(downloadResources("public/res/samples/microsoft/"));
}

function runDownloadScriptSamples() {
  return gulp.src(mcreslistscriptsamplesigs, { base: "" }).pipe(downloadResources("public/res/samples/microsoft/"));
}

function runDownloadGameTests() {
  return gulp.src(mcreslistgametestsigs, { base: "" }).pipe(downloadResources("public/res/samples/microsoft/"));
}

function runDownloadVanillaResources() {
  return gulp.src(mcreslistvanillasigs, { base: "" }).pipe(downloadResources("public/res/latest/van/"));
}

gulp.task("jsnwebbuild", gulp.series("clean-jsnwebbuild", compileJsnWebBuild, "postclean-jsnwebbuild"));

gulp.task("clean-webbuild", function () {
  return del(["web"]);
});

gulp.task("clean-res", function () {
  return del(["public/res/latest", "public/res/samples"]);
});

gulp.task("customizesite", gulp.series(customizeSiteHead, customizeSiteBody));

gulp.task("webbuild", gulp.series("clean-webbuild", compileWebJsBuild));

gulp.task("mcbuild", gulp.series(gulp.parallel("clean-mcbuild", "webbuild"), buildMinecraftJs));

gulp.task("mctypes", gulp.parallel(buildBetaJsonTypeDefs, buildStableJsonTypeDefs, buildIncludes));

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
      copyCheckedInRes
    )
  )
);

gulp.task("devenv", gulp.parallel("mctypes", "dlres", copyMonacoNpmDist, copyMonacoMapsNpmDist, copyEsbuildWasmDist));

gulp.task("npmdepends", gulp.parallel(copyMonacoNpmDist, copyMonacoMapsNpmDist, copyEsbuildWasmDist));

gulp.task("default", gulp.parallel("jsnbuild"));

gulp.task("watch", function () {
  gulp.watch(jsnbuildfilesigs, gulp.series("jsnbuild"));
});
