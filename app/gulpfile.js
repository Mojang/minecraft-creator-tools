const gulp = require("gulp");
const sourcemaps = require("gulp-sourcemaps");
const ts = require("gulp-typescript");
const del = require("del");
const importTransform = require("./tools/gulp-importTransform");
const nodeifyScript = require("./tools/gulp-nodeifyScript");
const jsonifyTypes = require("./tools/gulp-jsonifyTypes");
const downloadResources = require("./tools/gulp-downloadResources");
const gulpWebpack = require("webpack-stream");

const jsnbuildfilesigs = [
  "src/**/*.ts",
  "!src/vscode/*.ts",
  "!src/UX/*.ts",
  "!src/UXex/*.ts",
  "!out/**/*",
  "!build/**/*",
  "!toolbuild/**/*",
  "!src/monaco/*.ts",
  "!src/setupTests.ts",
  "!src/worldux/*.ts",
  "!src/vscodeweb/*.ts",
  "!src/babylon/*.ts",
  "!node_modules/@types/leaflet/*.ts",
  "!node_modules/babylonjs/*.ts",
];

const vsccorebuildfilesigs = [
  "src/**/*.ts",
  "!src/UX/*.ts",
  "!src/UXex/*.ts",
  "!out/**/*",
  "!build/**/*",
  "!toolbuild/**/*",
  "!src/vscodeweb/*.ts",
  "!src/monaco/*.ts",
  "!src/setupTests.ts",
  "!src/worldux/*.ts",
  "!src/local/*.ts",
  "!src/babylon/*.ts",
  "!node_modules/@types/leaflet/*.ts",
  "!node_modules/babylonjs/*.ts",
];

const vscwebbuildfilesigs = [
  "src/**/*.ts",
  "!src/monaco/*.ts",
  "!src/vscode/*.ts",
  "!out/**/*",
  "!build/**/*",
  "!toolbuild/**/*",
  "!src/setupTests.ts",
  "!src/local/*.ts",
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
  "!src/setupTests.ts",
  "!src/local/*.ts",
  "!node_modules/@types/leaflet/*.ts",
  "!node_modules/babylonjs/*.ts",
];

const mcbuildsigs = ["web/autoscript/*.js", "web/tools/*.js"];

const mcstabletypedefsigs = ["node_modules_archive/@minecraft/server/1.0.0/*.d.ts"];

const mcbetatypedefsigs = [
  "node_modules/@minecraft/server/*.d.ts",
  "node_modules/@minecraft/server-gametest/*.d.ts",
  "node_modules/@minecraft/server-ui/*.d.ts",
  "node_modules/@minecraft/server-admin/*.d.ts",
  "node_modules/@minecraft/server-net/*.d.ts",
];

const mcreslistsigs = ["reslist/schemas.resources.json"];
const mcreslistvanillasigs = ["reslist/packs.resources.json"];

function compileVscCoreExeBuild() {
  return gulp
    .src(vsccorebuildfilesigs, { base: "" })
    .pipe(gulpWebpack(require("./webpack.vsccore.config.js")))
    .pipe(gulp.dest("toolbuild/vsc"))
    .on("end", function () {})
    .on("error", function () {});
}

function compileVscCoreWebBuild() {
  return gulp
    .src(vsccorebuildfilesigs, { base: "" })
    .pipe(gulpWebpack(require("./webpack.vsccoreweb.config.js")))
    .pipe(gulp.dest("toolbuild/vsc"))
    .on("end", function () {})
    .on("error", function () {});
}

function compileVscWebBuild() {
  return gulp
    .src(vscwebbuildfilesigs, { base: "" })
    .pipe(gulpWebpack(require("./webpack.vscweb.config.js")))
    .pipe(gulp.dest("toolbuild/vsc/web"))
    .on("end", function () {})
    .on("error", function () {});
}

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

function copyCheckedInRes() {
  return gulp.src(["public_ci/**/*"]).pipe(gulp.dest("public/"));
}

function copyVscData() {
  return gulp.src(["public/data/**/*.json", "public/data/**/*.mcworld"]).pipe(gulp.dest("toolbuild/vsc/data/"));
}

function copyJsNodeData() {
  return gulp.src(["public/data/**/*.json", "public/data/**/*.mcworld"]).pipe(gulp.dest("toolbuild/jsn/data/"));
}

function copyMonacoNpmDist() {
  return gulp.src(["node_modules/monaco-editor/min/vs/**/*"]).pipe(gulp.dest("public/dist/vs/"));
}

function copyJsNodeDocs() {
  return gulp.src(["../CHANGELOG.md", "../NOTICE.md", "jsnode/README.md"]).pipe(gulp.dest("toolbuild/jsn/"));
}

function copyVscRes() {
  return gulp.src(["public/res/**/*"]).pipe(gulp.dest("toolbuild/vsc/res/"));
}

function copyVscMc() {
  return gulp.src(["../mc/toolsAddon/**/*"]).pipe(gulp.dest("toolbuild/vsc/mc/"));
}

function copyVscDist() {
  return gulp.src(["public/dist/**/*"]).pipe(gulp.dest("toolbuild/vsc/dist/"));
}

function copyJsNodeResSchemas() {
  return gulp.src(["public/res/latest/schemas/**/*"]).pipe(gulp.dest("toolbuild/jsn/res/latest/schemas/"));
}

function copyJsNodeAssets() {
  return gulp.src(["jsnode/**/*"]).pipe(gulp.dest("toolbuild/jsn/"));
}

function copyVscAssets() {
  return gulp.src(["vscode/**/*.json"]).pipe(gulp.dest("toolbuild/vsc/"));
}

function copyVscDocs() {
  return gulp
    .src(["../**/CHANGELOG.md", "../**/LICENSE.md", "../**/LICENSE.md", "vscode/**/README.md"])
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

gulp.task(
  "vsccorebuild",
  gulp.series("clean-vsccorebuild", gulp.parallel(compileVscCoreExeBuild, compileVscCoreWebBuild))
);

gulp.task("vsccoreexebuild", compileVscCoreExeBuild);
gulp.task("vsccorewebbuild", compileVscCoreExeBuild);

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

gulp.task(
  "vscbuild",
  gulp.series(
    "clean-vscbuild",
    copyCheckedInRes,
    gulp.parallel(
      compileVscCoreExeBuild,
      compileVscCoreWebBuild,
      gulp.series(compileVscWebBuild, "postclean-vscwebbuild"),
      copyVscAssets,
      copyVscDocs,
      copyVscData,
      copyVscRes,
      copyVscMc,
      copyVscDist
    )
  )
);

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
  return gulp.src(mcbuildsigs, { base: "" }).pipe(importTransform("foo", {})).pipe(gulp.dest("out/mc"));
}

function buildBetaJsonTypeDefs() {
  return gulp.src(mcbetatypedefsigs, { base: "" }).pipe(jsonifyTypes("public/data/typedefs.beta.json"));
}

function buildStableJsonTypeDefs() {
  return gulp.src(mcstabletypedefsigs, { base: "" }).pipe(jsonifyTypes("public/data/typedefs.stable.json"));
}

function runDownloadResources() {
  return gulp.src(mcreslistsigs, { base: "" }).pipe(downloadResources("public/res/latest/"));
}

function runDownloadVanillaResources() {
  return gulp.src(mcreslistvanillasigs, { base: "" }).pipe(downloadResources("public/res/latest/van/"));
}

gulp.task("vscwebbuild", gulp.series("clean-vscwebbuild", compileVscWebBuild, "postclean-vscwebbuild"));

gulp.task("jsnwebbuild", gulp.series("clean-jsnwebbuild", compileJsnWebBuild, "postclean-jsnwebbuild"));

gulp.task("clean-webbuild", function () {
  return del(["web"]);
});

gulp.task("webbuild", gulp.series("clean-webbuild", compileWebJsBuild));

gulp.task("mcbuild", gulp.series(gulp.parallel("clean-mcbuild", "webbuild"), buildMinecraftJs));

gulp.task("mctypes", gulp.parallel(buildBetaJsonTypeDefs, buildStableJsonTypeDefs));

gulp.task("dlres", gulp.parallel(runDownloadResources, runDownloadVanillaResources, copyCheckedInRes));

gulp.task("devenv", gulp.parallel("mctypes", "dlres", copyMonacoNpmDist));

gulp.task("npmdepends", gulp.parallel(copyMonacoNpmDist));

gulp.task("default", gulp.parallel("jsnbuild", "vscbuild"));

gulp.task("watch", function () {
  gulp.watch(jsnbuildfilesigs, gulp.series("jsnbuild"));
});

gulp.task(
  "watchvsccore",
  gulp.parallel("vsccorebuild", function () {
    gulp.watch(vsccorebuildfilesigs, gulp.series("vsccorebuild"));
  })
);
