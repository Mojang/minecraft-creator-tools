// === CONFIGURABLE VARIABLES

const bpfoldername = "aop_mobwbp";
const rpfoldername = "aop_mobwrp";
const rpmashupfoldername = "aop_mobmwrp";
const wtfoldername = "aop_mobwt";
const useMinecraftPreview = false; // Whether to target the "Minecraft Preview" version of Minecraft vs. the main store version of Minecraft
const useMinecraftDedicatedServer = false; // Whether to use Bedrock Dedicated Server - see https://www.minecraft.net/download/server/bedrock
const dedicatedServerPath = "C:/mc/bds/1.21.110/"; // if using Bedrock Dedicated Server, where to find the extracted contents of the zip package

// === END CONFIGURABLE VARIABLES

const gulp = require("gulp");
const ts = require("gulp-typescript");
const del = require("del");
const os = require("os");
const zip = require("gulp-zip");
const spawn = require("child_process").spawn;
const sourcemaps = require("gulp-sourcemaps");

const worldsFolderName = useMinecraftDedicatedServer ? "worlds" : "minecraftWorlds";

const activeWorldFolderName = useMinecraftDedicatedServer ? "Bedrock level" : bpfoldername + "world";

const mcdir = useMinecraftDedicatedServer
  ? dedicatedServerPath
  : os.homedir() +
    (useMinecraftPreview
      ? "/AppData/Local/Packages/Microsoft.MinecraftWindowsBeta_8wekyb3d8bbwe/LocalState/games/com.mojang/"
      : "/AppData/Local/Packages/Microsoft.MinecraftUWP_8wekyb3d8bbwe/LocalState/games/com.mojang/");

function clean_build(callbackFunction) {
  del([
    "build/content_linkerrors/",
    "build/content_textureful/",
    "build/content_subpacks/",
    "build/content_mashup/",
    "build/content_texturefulvv/",
    "build/content_vibrantvisuals/",
    "build/content1/",
    "build/content2/",
    "build/packages/",
    "build/contentvnext/",
    "build/contentvnext2/",
    "build/contentvnext3/",
    "build/contentvnext4/",
    "build/contentvnext5/",
    "build/contentvnext6/",
    "build/resource_packs/",
  ]).then(
    (value) => {
      callbackFunction(); // success
    },
    (reason) => {
      callbackFunction(); // error
    }
  );
}

function copy_world_templates() {
  return gulp.src(["world_templates/**/*"]).pipe(gulp.dest("build/world_templates"));
}

function copy_resource_packs() {
  return gulp.src(["resource_packs/**/*"]).pipe(gulp.dest("build/resource_packs"));
}

const copy_content = gulp.parallel(copy_world_templates, copy_resource_packs);

function compile_scripts() {
  return gulp
    .src("scripts/**/*.ts")
    .pipe(sourcemaps.init())
    .pipe(
      ts({
        module: "es2020",
        moduleResolution: "node",
        lib: ["es2020", "dom"],
        strict: true,
        target: "es2020",
        noImplicitAny: true,
      })
    )
    .pipe(
      sourcemaps.write("../../_" + bpfoldername + "Debug", {
        destPath: bpfoldername + "/scripts/",
        sourceRoot: "./../../../scripts/",
      })
    )
    .pipe(gulp.dest("build/world_templates/" + wtfoldername + "/behavior_packs/" + bpfoldername + "/scripts"));
}

const build = gulp.series(clean_build, copy_content, compile_scripts);

function clean_localmc(callbackFunction) {
  if (!bpfoldername || !bpfoldername.length || bpfoldername.length < 2) {
    console.log("No bpfoldername specified.");
    callbackFunction();
    return;
  }

  del(
    [
      mcdir + "world_templates/" + wtfoldername,
      mcdir + "development_behavior_packs/" + bpfoldername,
      mcdir + "development_resource_packs/" + bpfoldername,
    ],
    {
      force: true,
    }
  ).then(
    (value) => {
      callbackFunction(); // Success
    },
    (reason) => {
      callbackFunction(); // Error
    }
  );
}

function deploy_localmc_world_template() {
  console.log("Deploying to '" + mcdir + "development_world_templates/" + wtfoldername + "'");
  return gulp
    .src(["build/world_templates/" + wtfoldername + "/**/*"])
    .pipe(gulp.dest(mcdir + "development_behavior_packs/" + bpfoldername));
}

function create_content_layout_1_rp() {
  return gulp
    .src(["build/resource_packs/" + rpfoldername + "/**/*"])
    .pipe(gulp.dest("build/content1/Content/resource_packs/" + rpfoldername + "/"));
}

function create_content_layout_1_wt() {
  return gulp
    .src(["build/world_templates/" + wtfoldername + "/**/*"])
    .pipe(gulp.dest("build/content1/Content/world_templates/" + wtfoldername + "/"));
}

function create_content_layout_1_acc() {
  return gulp.src(["accessory_files/**/*"]).pipe(gulp.dest("build/content1/"));
}

function create_content_1_zip() {
  return gulp.src(["build/content1/**/*"]).pipe(zip("aop_moremobs_wellformed.zip")).pipe(gulp.dest("build/packages/"));
}

function create_content_layout_2_scripts() {
  return gulp
    .src(["build/world_templates/" + wtfoldername + "/scripts/**/*"])
    .pipe(gulp.dest("build/content2/Content/world_templates/" + "/behavior_packs/" + bpfoldername + "/scripts/"));
}

function create_content_layout_2_acc() {
  return gulp.src(["accessory_files/**/*"]).pipe(gulp.dest("build/content2/"));
}

function create_content_2_zip() {
  return gulp
    .src(["build/content2/**/*"])
    .pipe(zip("aop_moremobs_animationmanifesterrors.zip"))
    .pipe(gulp.dest("build/packages/"));
}

function create_content_layout_linkerrors_rp() {
  return gulp
    .src(["altdiffs/linkerrors/resource_packs/" + rpfoldername + "/**/*"])
    .pipe(gulp.dest("build/content_linkerrors/Content/resource_packs/" + rpfoldername + "/"));
}

function create_content_layout_linkerrors_base_wt() {
  return gulp
    .src(["build/world_templates/" + wtfoldername + "/**/*"])
    .pipe(gulp.dest("build/content_linkerrors/Content/world_templates/" + wtfoldername + "/"));
}

function create_content_layout_linkerrors_base_rp() {
  return gulp
    .src(["build/resource_packs/" + rpfoldername + "/**/*"])
    .pipe(gulp.dest("build/content_linkerrors/Content/resource_packs/" + rpfoldername + "/"));
}

function create_content_layout_linkerrors_base_acc() {
  return gulp.src(["accessory_files/**/*"]).pipe(gulp.dest("build/content_linkerrors/"));
}

function create_content_linkerrors_zip() {
  return gulp
    .src(["build/content_linkerrors/**/*"])
    .pipe(zip("aop_moremobs_linkerrors.zip"))
    .pipe(gulp.dest("build/packages/"));
}

function create_content_layout_mashup_rp() {
  return gulp
    .src(["altdiffs/mashup/resource_packs/" + rpmashupfoldername + "/**/*"])
    .pipe(gulp.dest("build/content_mashup/Content/resource_packs/" + rpmashupfoldername + "/"));
}

function create_content_layout_mashup_base_wt() {
  return gulp
    .src(["build/world_templates/" + wtfoldername + "/**/*"])
    .pipe(gulp.dest("build/content_mashup/Content/world_templates/" + wtfoldername + "/"));
}

function create_content_layout_mashup_base_rp() {
  return gulp
    .src(["build/resource_packs/" + rpfoldername + "/**/*"])
    .pipe(gulp.dest("build/content_mashup/Content/resource_packs/" + rpfoldername + "/"));
}

function create_content_layout_mashup_base_acc() {
  return gulp.src(["accessory_files/**/*"]).pipe(gulp.dest("build/content_mashup/"));
}

function create_content_mashup_mctemplate() {
  return gulp
    .src(["build/content_mashup/content/**/*"])
    .pipe(zip("aop_moremobs_world.mctemplate"))
    .pipe(gulp.dest("build/packages/"));
}

function create_content_mashup_zip() {
  return gulp.src(["build/content_mashup/**/*"]).pipe(zip("aop_moremobs_mashup.zip")).pipe(gulp.dest("build/packages/"));
}

function create_content_layout_subpacks_rp() {
  return gulp
    .src(["altdiffs/subpacks/resource_packs/" + rpfoldername + "/**/*"])
    .pipe(gulp.dest("build/content_subpacks/Content/resource_packs/" + rpfoldername + "/"));
}

function create_content_layout_subpacks_base_wt() {
  return gulp
    .src(["build/world_templates/" + wtfoldername + "/**/*"])
    .pipe(gulp.dest("build/content_subpacks/Content/world_templates/" + wtfoldername + "/"));
}

function create_content_layout_subpacks_base_rp() {
  return gulp
    .src(["build/resource_packs/" + rpfoldername + "/**/*"])
    .pipe(gulp.dest("build/content_subpacks/Content/resource_packs/" + rpfoldername + "/"));
}

function create_content_layout_subpacks_base_acc() {
  return gulp.src(["accessory_files/**/*"]).pipe(gulp.dest("build/content_subpacks/"));
}

function create_content_subpacks_mctemplate() {
  return gulp
    .src(["build/content_subpacks/content/**/*"])
    .pipe(zip("aop_moremobs_world.mctemplate"))
    .pipe(gulp.dest("build/packages/"));
}

function create_content_subpacks_zip() {
  return gulp
    .src(["build/content_subpacks/**/*"])
    .pipe(zip("aop_moremobs_subpacks.zip"))
    .pipe(gulp.dest("build/packages/"));
}

function create_content_textureful_zip() {
  return gulp
    .src(["build/content_textureful/**/*"])
    .pipe(zip("aop_moremobs_textureful.zip"))
    .pipe(gulp.dest("build/packages/"));
}

function create_content_layout_textureful_rp() {
  return gulp
    .src(["altdiffs/textureful/resource_packs/" + rpfoldername + "/**/*"])
    .pipe(gulp.dest("build/content_textureful/Content/resource_packs/" + rpfoldername + "/"));
}

function create_content_layout_textureful_base_wt() {
  return gulp
    .src(["build/world_templates/" + wtfoldername + "/**/*"])
    .pipe(gulp.dest("build/content_textureful/Content/world_templates/" + wtfoldername + "/"));
}

function create_content_layout_textureful_base_rp() {
  return gulp
    .src(["build/resource_packs/" + rpfoldername + "/**/*"])
    .pipe(gulp.dest("build/content_textureful/Content/resource_packs/" + rpfoldername + "/"));
}

function create_content_layout_textureful_base_acc() {
  return gulp.src(["accessory_files/**/*"]).pipe(gulp.dest("build/content_textureful/"));
}

function create_content_textureful_zip() {
  return gulp
    .src(["build/content_textureful/**/*"])
    .pipe(zip("aop_moremobs_textureful.zip"))
    .pipe(gulp.dest("build/packages/"));
}

function create_content_layout_texturefulvv_rp() {
  return gulp
    .src(["altdiffs/textureful/resource_packs/" + rpfoldername + "/**/*"])
    .pipe(gulp.dest("build/content_texturefulvv/Content/resource_packs/" + rpfoldername + "/"));
}

function create_content_layout_texturefulvv2_rp() {
  return gulp
    .src(["altdiffs/vibrantvisuals/resource_packs/" + rpfoldername + "/**/*"])
    .pipe(gulp.dest("build/content_texturefulvv/Content/resource_packs/" + rpfoldername + "/"));
}

function create_content_layout_texturefulvv3_rp() {
  return gulp
    .src(["altdiffs/texturefulvv/resource_packs/" + rpfoldername + "/**/*"])
    .pipe(gulp.dest("build/content_texturefulvv/Content/resource_packs/" + rpfoldername + "/"));
}

function create_content_layout_texturefulvv_base_wt() {
  return gulp
    .src(["build/world_templates/" + wtfoldername + "/**/*"])
    .pipe(gulp.dest("build/content_texturefulvv/Content/world_templates/" + wtfoldername + "/"));
}

function create_content_layout_texturefulvv_base_rp() {
  return gulp
    .src(["build/resource_packs/" + rpfoldername + "/**/*"])
    .pipe(gulp.dest("build/content_texturefulvv/Content/resource_packs/" + rpfoldername + "/"));
}

function create_content_layout_texturefulvv_base_acc() {
  return gulp.src(["accessory_files/**/*"]).pipe(gulp.dest("build/content_texturefulvv/"));
}

function create_content_texturefulvv_zip() {
  return gulp
    .src(["build/content_texturefulvv/**/*"])
    .pipe(zip("aop_moremobs_texturefulvv.zip"))
    .pipe(gulp.dest("build/packages/"));
}

function create_content_layout_vibrantvisuals_rp() {
  return gulp
    .src(["altdiffs/vibrantvisuals/resource_packs/" + rpfoldername + "/**/*"])
    .pipe(gulp.dest("build/content_vibrantvisuals/Content/resource_packs/" + rpfoldername + "/"));
}

function create_content_layout_vibrantvisuals_base_wt() {
  return gulp
    .src(["build/world_templates/" + wtfoldername + "/**/*"])
    .pipe(gulp.dest("build/content_vibrantvisuals/Content/world_templates/" + wtfoldername + "/"));
}

function create_content_layout_vibrantvisuals_base_rp() {
  return gulp
    .src(["build/resource_packs/" + rpfoldername + "/**/*"])
    .pipe(gulp.dest("build/content_vibrantvisuals/Content/resource_packs/" + rpfoldername + "/"));
}

function create_content_layout_vibrantvisuals_base_acc() {
  return gulp.src(["accessory_files/**/*"]).pipe(gulp.dest("build/content_vibrantvisuals/"));
}

function create_content_vibrantvisuals_zip() {
  return gulp
    .src(["build/content_vibrantvisuals/**/*"])
    .pipe(zip("aop_moremobs_vibrantvisuals.zip"))
    .pipe(gulp.dest("build/packages/"));
}

function create_content_layout_vnext_base_rp() {
  return gulp
    .src(["build/resource_packs/" + rpfoldername + "/**/*"])
    .pipe(gulp.dest("build/contentvnext/Content/resource_packs/" + rpfoldername + "/"));
}

function create_content_layout_vnext_base_wt() {
  return gulp
    .src(["build/world_templates/" + wtfoldername + "/**/*"])
    .pipe(gulp.dest("build/contentvnext/Content/world_templates/" + wtfoldername + "/"));
}

function create_content_layout_vnext_rp() {
  return gulp
    .src(["altdiffs/vnext/resource_packs/" + rpfoldername + "/**/*"])
    .pipe(gulp.dest("build/contentvnext/Content/resource_packs/" + rpfoldername + "/"));
}

function create_content_layout_vnext_wt() {
  return gulp
    .src(["altdiffs/vnext/world_templates/" + wtfoldername + "/**/*"])
    .pipe(gulp.dest("build/contentvnext/Content/world_templates/" + wtfoldername + "/"));
}

function create_content_layout_vnext_scripts() {
  return gulp
    .src(["build/world_templates/" + wtfoldername + "/scripts/**/*"])
    .pipe(gulp.dest("build/contentvnext/Content/world_templates/behavior_packs/" + bpfoldername + "/scripts/"));
}

function create_content_layout_vnext_acc() {
  return gulp.src(["accessory_files/**/*"]).pipe(gulp.dest("build/contentvnext/"));
}

function create_content_vnext_zip() {
  return gulp.src(["build/contentvnext/**/*"]).pipe(zip("aop_moremobs_vnext.zip")).pipe(gulp.dest("build/packages/"));
}

function create_content_vnext_mctemplate() {
  return gulp
    .src(["build/contentvnext/content/**/*"])
    .pipe(zip("aop_moremobs_vnext.mctemplate"))
    .pipe(gulp.dest("build/packages/"));
}

function create_content_layout_vnext2_base_rp() {
  return gulp
    .src(["build/resource_packs/" + rpfoldername + "/**/*"])
    .pipe(gulp.dest("build/contentvnext2/Content/resource_packs/" + rpfoldername + "/"));
}

function create_content_layout_vnext2_base_wt() {
  return gulp
    .src(["build/world_templates/" + wtfoldername + "/**/*"])
    .pipe(gulp.dest("build/contentvnext2/Content/world_templates/" + wtfoldername + "/"));
}

function create_content_layout_vnext2_rp() {
  return gulp
    .src(["altdiffs/vnext2/resource_packs/" + rpfoldername + "/**/*"])
    .pipe(gulp.dest("build/contentvnext2/Content/resource_packs/" + rpfoldername + "/"));
}

function create_content_layout_vnext2_wt() {
  return gulp
    .src(["altdiffs/vnext2/world_templates/" + wtfoldername + "/**/*"])
    .pipe(gulp.dest("build/contentvnext2/Content/world_templates/" + wtfoldername + "/"));
}

function create_content_layout_vnext2_scripts() {
  return gulp
    .src(["build/world_templates/" + wtfoldername + "/behavior_packs/" + bpfoldername + "/scripts/**/*"])
    .pipe(gulp.dest("build/contentvnext2/Content/world_templates/behavior_packs/" + bpfoldername + "/scripts/"));
}

function create_content_layout_vnext2_acc() {
  return gulp.src(["accessory_files/**/*"]).pipe(gulp.dest("build/contentvnext2/"));
}

function create_content_vnext2_zip() {
  return gulp.src(["build/contentvnext2/**/*"]).pipe(zip("aop_moremobs_vnext2.zip")).pipe(gulp.dest("build/packages/"));
}

function create_content_vnext2_mctemplate() {
  return gulp
    .src(["build/contentvnext2/content/**/*"])
    .pipe(zip("aop_moremobs_vnext2.mctemplate"))
    .pipe(gulp.dest("build/packages/"));
}

function create_mctemplate() {
  return gulp
    .src(["build/world_templates/" + wtfoldername + "/**/*"])
    .pipe(zip(wtfoldername + ".mctemplate"))
    .pipe(gulp.dest("build/packages/"));
}

function deploy_localmc_resource_packs() {
  return gulp
    .src(["build/resource_packs/" + rpfoldername + "/**/*"])
    .pipe(gulp.dest(mcdir + "development_resource_packs/" + rpfoldername));
}

function getTargetWorldPath() {
  return mcdir + worldsFolderName + "/" + activeWorldFolderName;
}

function getTargetConfigPath() {
  return mcdir + "config";
}

function getTargetWorldBackupPath() {
  return "backups/worlds/" + activeWorldFolderName;
}

function getDevConfigPath() {
  return "config";
}

function getDevWorldPath() {
  return "worlds/default";
}

function getDevWorldBackupPath() {
  return "backups/worlds/devdefault";
}

function clean_localmc_world(callbackFunction) {
  console.log("Removing '" + getTargetWorldPath() + "'");

  del([getTargetWorldPath()], {
    force: true,
  }).then(
    (value) => {
      callbackFunction(); // Success
    },
    (reason) => {
      callbackFunction(); // Error
    }
  );
}

function clean_localmc_config(callbackFunction) {
  console.log("Removing '" + getTargetConfigPath() + "'");

  del([getTargetConfigPath()], {
    force: true,
  }).then(
    (value) => {
      callbackFunction(); // Success
    },
    (reason) => {
      callbackFunction(); // Error
    }
  );
}

function clean_dev_world(callbackFunction) {
  console.log("Removing '" + getDevWorldPath() + "'");

  del([getDevWorldPath()], {
    force: true,
  }).then(
    (value) => {
      callbackFunction(); // Success
    },
    (reason) => {
      callbackFunction(); // Error
    }
  );
}

function clean_localmc_world_backup(callbackFunction) {
  console.log("Removing backup'" + getTargetWorldBackupPath() + "'");

  del([getTargetWorldBackupPath()], {
    force: true,
  }).then(
    (value) => {
      callbackFunction(); // Success
    },
    (reason) => {
      callbackFunction(); // Error
    }
  );
}

function clean_dev_world_backup(callbackFunction) {
  console.log("Removing backup'" + getDevWorldBackupPath() + "'");

  del([getTargetWorldBackupPath()], {
    force: true,
  }).then(
    (value) => {
      callbackFunction(); // Success
    },
    (reason) => {
      callbackFunction(); // Error
    }
  );
}

function backup_dev_world() {
  console.log("Copying world '" + getDevWorldPath() + "' to '" + getDevWorldBackupPath() + "'");
  return gulp
    .src([getTargetWorldPath() + "/**/*"])
    .pipe(gulp.dest(getDevWorldBackupPath() + "/worlds/" + activeWorldFolderName));
}

function deploy_localmc_config() {
  console.log("Copying world 'config/' to '" + getTargetConfigPath() + "'");
  return gulp.src([getDevConfigPath() + "/**/*"]).pipe(gulp.dest(getTargetConfigPath()));
}

function deploy_localmc_world() {
  console.log("Copying world 'worlds/default/' to '" + getTargetWorldPath() + "'");
  return gulp.src([getDevWorldPath() + "/**/*"]).pipe(gulp.dest(getTargetWorldPath()));
}

function ingest_localmc_world() {
  console.log("Ingesting world '" + getTargetWorldPath() + "' to '" + getDevWorldPath() + "'");
  return gulp.src([getTargetWorldPath() + "/**/*"]).pipe(gulp.dest(getDevWorldPath()));
}

function backup_localmc_world() {
  console.log("Copying world '" + getTargetWorldPath() + "' to '" + getTargetWorldBackupPath() + "/'");
  return gulp
    .src([getTargetWorldPath() + "/**/*"])
    .pipe(gulp.dest(getTargetWorldBackupPath() + "/" + activeWorldFolderName));
}

const deploy_localmc = gulp.series(
  clean_localmc,
  function (callbackFunction) {
    callbackFunction();
  },
  gulp.parallel(deploy_localmc_world_template, deploy_localmc_resource_packs)
);

function watch() {
  return gulp.watch(
    ["scripts/**/*.ts", "behavior_packs/**/*", "resource_packs/**/*"],
    gulp.series(build, deploy_localmc)
  );
}

function serve() {
  return gulp.watch(
    ["scripts/**/*.ts", "behavior_packs/**/*", "resource_packs/**/*"],
    gulp.series(stopServer, build, deploy_localmc, startServer)
  );
}

let activeServer = null;

function stopServer(callbackFunction) {
  if (activeServer) {
    activeServer.stdin.write("stop\n");
    activeServer = null;
  }

  callbackFunction();
}

function startServer(callbackFunction) {
  if (activeServer) {
    activeServer.stdin.write("stop\n");
    activeServer = null;
  }

  activeServer = spawn(dedicatedServerPath + "bedrock_server");

  let logBuffer = "";

  let serverLogger = function (buffer) {
    let incomingBuffer = buffer.toString();

    if (incomingBuffer.endsWith("\n")) {
      (logBuffer + incomingBuffer).split(/\n/).forEach(function (message) {
        if (message) {
          if (message.indexOf("Server started.") >= 0) {
            activeServer.stdin.write("script debugger listen 19144\n");
          }
          console.log("Server: " + message);
        }
      });
      logBuffer = "";
    } else {
      logBuffer += incomingBuffer;
    }
  };

  activeServer.stdout.on("data", serverLogger);
  activeServer.stderr.on("data", serverLogger);

  callbackFunction();
}

exports.clean_build = clean_build;
exports.copy_behavior_packs = copy_world_templates;
exports.copy_resource_packs = copy_resource_packs;
exports.compile_scripts = compile_scripts;
exports.copy_content = copy_content;
exports.build = build;
exports.clean_localmc = clean_localmc;
exports.deploy_localmc = deploy_localmc;
exports.default = gulp.series(build, deploy_localmc);
exports.clean = gulp.series(clean_build, clean_localmc);
exports.watch = gulp.series(build, deploy_localmc, watch);
exports.deploy = gulp.series(build, deploy_localmc);
exports.serve = gulp.series(build, deploy_localmc, startServer, serve);
exports.package = gulp.series(
  build,
  gulp.parallel(
    create_content_layout_1_rp,
    create_content_layout_1_wt,
    create_content_layout_1_acc,
    create_content_layout_linkerrors_base_wt,
    create_content_layout_linkerrors_base_rp,
    create_content_layout_linkerrors_base_acc,
    create_content_layout_mashup_base_wt,
    create_content_layout_mashup_base_rp,
    create_content_layout_mashup_base_acc,
    create_content_layout_subpacks_base_wt,
    create_content_layout_subpacks_base_rp,
    create_content_layout_subpacks_base_acc,
    create_content_layout_textureful_base_wt,
    create_content_layout_textureful_base_rp,
    create_content_layout_textureful_base_acc,
    create_content_layout_texturefulvv_base_wt,
    create_content_layout_texturefulvv_base_rp,
    create_content_layout_texturefulvv_base_acc,
    create_content_layout_vibrantvisuals_base_wt,
    create_content_layout_vibrantvisuals_base_rp,
    create_content_layout_vibrantvisuals_base_acc,
    create_content_layout_vnext_base_rp,
    create_content_layout_vnext_base_wt,
    create_content_layout_vnext_scripts,
    create_content_layout_vnext2_base_rp,
    create_content_layout_vnext2_base_wt,
    create_content_layout_vnext2_scripts
  ),
  gulp.parallel(
    create_content_layout_linkerrors_rp,
    create_content_layout_mashup_rp,
    create_content_layout_subpacks_rp,
    create_content_layout_textureful_rp,
    create_content_layout_texturefulvv_rp,
    create_content_layout_vibrantvisuals_rp,
    create_content_layout_vnext_rp,
    create_content_layout_vnext_wt,
    create_content_layout_vnext_acc,
    create_content_layout_vnext2_rp,
    create_content_layout_vnext2_wt,
    create_content_layout_vnext2_acc
  ),
  gulp.parallel(create_content_layout_texturefulvv2_rp),
  gulp.parallel(create_content_layout_texturefulvv3_rp),
  gulp.parallel(
    create_mctemplate,
    create_content_1_zip,
    create_content_2_zip,
    create_content_linkerrors_zip,
    create_content_textureful_zip,
    create_content_mashup_zip,
    create_content_mashup_mctemplate,
    create_content_subpacks_zip,
    create_content_subpacks_mctemplate,
    create_content_texturefulvv_zip,
    create_content_vibrantvisuals_zip,
    create_content_vnext_zip,
    create_content_vnext_mctemplate,
    create_content_vnext2_zip,
    create_content_vnext2_mctemplate
  )
);
exports.updateworld = gulp.series(
  clean_localmc_world_backup,
  backup_localmc_world,
  clean_localmc_world,
  deploy_localmc_world
);
exports.ingestworld = gulp.series(clean_dev_world_backup, backup_dev_world, clean_dev_world, ingest_localmc_world);
exports.updateconfig = gulp.series(clean_localmc_config, deploy_localmc_config);
