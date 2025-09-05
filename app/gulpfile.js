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
const textReplace = require("./tools/gulp-textReplace");
const gulpWebpack = require("webpack-stream");

const jsncorebuildfilesigs = [
  "src/**/*.ts",
  "!src/vscode/*.ts",
  "!src/UX/*.ts",
  "!src/UXex/*.ts",
  "!src/test/**/*",
  "!src/testweb/**/*",
  "!src/monaco/*.ts",
  "!src/setupTests.ts",
  "!src/worldux/*.ts",
  "!src/vscodeweb/*.ts",
  "!src/babylon/*.ts",
];

const vsccorebuildfilesigs = [
  "src/**/*.ts",
  "!src/UX/*.ts",
  "!src/UXex/*.ts",
  "!src/test/**/*",
  "!src/testweb/**/*",
  "!src/vscodeweb/*.ts",
  "!src/monaco/*.ts",
  "!src/setupTests.ts",
  "!src/worldux/*.ts",
  "!src/local/*.ts",
  "!src/babylon/*.ts",
];

const vscwebbuildfilesigs = [
  "src/**/*.ts",
  "!src/monaco/*.ts",
  "!src/vscode/*.ts",
  "!src/test/**/*",
  "!src/testweb/**/*",
  "!src/setupTests.ts",
  "!src/local/*.ts",
];

const jsnwebbuildfilesigs = [
  "src/**/*.ts",
  "!src/vscode/*.ts",
  "!src/vscodeweb/*.ts",
  "!src/test/**/*",
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
    target: "es2022",
    outDir: "jsn",
    moduleResolution: "node",
    sourceMap: true,
    skipLibCheck: true,
    allowSyntheticDefaultImports: true,
    noImplicitAny: true,
  });

  return gulp
    .src(jsncorebuildfilesigs, { base: "" })
    .pipe(sourcemaps.init())
    .pipe(tsProject())
    .pipe(
      sourcemaps.mapSources(function (sourcePath, file) {
        // source paths are prefixed with '../src/'

        let countOfSlashes = 0;

        let slashPath = sourcePath.indexOf("/");

        while (slashPath !== -1) {
          countOfSlashes++;
          slashPath = sourcePath.indexOf("/", slashPath + 1);
        }

        let str = sourcePath;

        if (countOfSlashes >= 1) {
          for (let i = 0; i < countOfSlashes - 1; i++) {
            str = "../" + str;
          }
        }

        return str;
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

function stripSourceMapA() {
  return gulp
    .src(["node_modules/blockly/blockly_compressed.js"])
    .pipe(
      textReplace("node_modules/blockly/blockly_compressed.js", [/sourceMappingURL=blockly_compressed.js.map/gi], [""])
    );
}

function customizeSiteBody() {
  return gulp
    .src(["site/index.body.html"], { base: "" })
    .pipe(textReplaceStream("build/index.html", /<div id="root"><\/div>/gi));
}

function copyCheckedInRes() {
  return gulp.src(["public_supplemental/**/*"]).pipe(gulp.dest("public/"));
}

function copyVscData() {
  return gulp.src(["public/data/**/*.json", "public/data/**/*.mcworld"]).pipe(gulp.dest("toolbuild/vsc/data/"));
}

function copyJsNodeData() {
  return gulp
    .src(["public/data/**/*.ogg", "public/data/**/*.png", "public/data/**/*.json", "public/data/**/*.mcworld"])
    .pipe(gulp.dest("toolbuild/jsn/data/"));
}

function copyJsNodeDist() {
  return gulp.src(["public/dist/**/*"]).pipe(gulp.dest("toolbuild/jsn/dist/"));
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

function copyVscRes() {
  return gulp.src(["public/res/**/*"]).pipe(gulp.dest("toolbuild/vsc/res/"));
}

function copyVscMc() {
  return gulp.src(["../mc/dist/**/*"]).pipe(gulp.dest("toolbuild/vsc/mc/"));
}

function copyJsNodeResSchemas() {
  return gulp.src(["public/res/latest/schemas/**/*"]).pipe(gulp.dest("toolbuild/jsn/res/latest/schemas/"));
}

function copyJsNodeMc() {
  return gulp.src(["../mc/dist/**/*"]).pipe(gulp.dest("toolbuild/jsn/mc/"));
}

function copyJsNodeAssets() {
  return gulp.src(["jsnode/**/*"]).pipe(gulp.dest("toolbuild/jsn/"));
}

function copyVscAssets() {
  return gulp.src(["vscode/**/*.json"]).pipe(gulp.dest("toolbuild/vsc/"));
}

function copyVscDocs() {
  return gulp.src(["../CHANGELOG.md", "../LICENSE.md", "vscode/README.md"]).pipe(gulp.dest("toolbuild/vsc/"));
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
    gulp.parallel(
      compileJsNodeBuild,
      copyJsNodeAssets,
      copyJsNodeData,
      copyJsNodeDocs,
      copyJsNodeResSchemas,
      copyJsNodeMc,
      compileJsnWebBuild
    ),
    "postclean-jsnwebbuild"
  )
);

gulp.task("jsncorebuild", gulp.series(compileJsNodeBuild));

gulp.task("copyjsnodedata", gulp.parallel(copyJsNodeData, copyJsNodeDist));

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
      copyVscMc
    )
  )
);

function compileWebJsBuild() {
  const tsProject = ts.createProject({
    module: "esnext",
    target: "es2022",
    outDir: "web",
    moduleResolution: "node",
    sourceMap: true,
    allowSyntheticDefaultImports: true,
    noImplicitAny: true,
  });

  return gulp
    .src(jsnwebbuildfilesigs, { base: "" })
    .pipe(sourcemaps.init())
    .pipe(tsProject())
    .pipe(
      sourcemaps.mapSources(function (sourcePath, file) {
        // source paths are prefixed with '../src/'

        let countOfSlashes = 0;

        let slashPath = sourcePath.indexOf("/");

        while (slashPath !== -1) {
          countOfSlashes++;
          slashPath = sourcePath.indexOf("/", slashPath + 1);
        }

        let str = sourcePath;

        if (countOfSlashes >= 1) {
          for (let i = 0; i < countOfSlashes - 1; i++) {
            str = "../" + str;
          }
        }

        return str;
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
  return gulp.src(mcreslistsamplesigs, { base: "" }).pipe(downloadResources("public/res/samples/microsoft/"));
}

function runDownloadScriptSamples() {
  return gulp.src(mcreslistscriptsamplesigs, { base: "" }).pipe(downloadResources("public/res/samples/microsoft/"));
}

function runDownloadGameTests() {
  return gulp.src(mcreslistgametestsigs, { base: "" }).pipe(downloadResources("public/res/samples/microsoft/"));
}

function runDownloadVanillaResources() {
  return gulp.src(mcreslistvanillasigs, { base: "" }).pipe(downloadResources("public/res/latest/van/release/"));
}

function runDownloadVanillaPreviewResources() {
  return gulp.src(mcreslistpreviewvanillasigs, { base: "" }).pipe(downloadResources("public/res/latest/van/preview/"));
}

gulp.task("vscwebbuild", gulp.series("clean-vscwebbuild", compileVscWebBuild, "postclean-vscwebbuild"));

gulp.task("jsnwebbuild", gulp.series("clean-jsnwebbuild", compileJsnWebBuild, "postclean-jsnwebbuild"));

gulp.task("clean-webbuild", function () {
  return del(["out/web"]);
});

gulp.task("clean-res", function () {
  return del(["public/res/latest", "public/res/samples"]);
});

gulp.task("customizesite", gulp.series(customizeSiteHead, customizeSiteBody));

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
    )
  )
);

gulp.task(
  "preparedevenv",
  gulp.parallel("mctypes", "dlres", copyMonacoNpmDist, copyMonacoMapsNpmDist, copyEsbuildWasmDist)
);

gulp.task("npmdepends", gulp.parallel(copyMonacoNpmDist, copyMonacoMapsNpmDist, copyEsbuildWasmDist));

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
