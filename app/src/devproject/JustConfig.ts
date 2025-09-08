// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import { EventDispatcher, IEventHandler } from "ste-events";
import Project from "../app/Project";

const JustDefaultConfig = [
  "import { argv, parallel, series, task, tscTask } from 'just-scripts';",
  "import {",
  "  BundleTaskParameters,",
  "  CopyTaskParameters,",
  "  bundleTask,",
  "  cleanTask,",
  "  cleanCollateralTask,",
  "  copyTask,",
  "  coreLint,",
  "  mcaddonTask,",
  "  setupEnvironment,",
  "  ZipTaskParameters,",
  "  STANDARD_CLEAN_PATHS,",
  "  DEFAULT_CLEAN_DIRECTORIES,",
  "  getOrThrowFromProcess,",
  "  watchTask,",
  "} from '@minecraft/core-build-tasks';",
  "import path from 'path';",
  "setupEnvironment(path.resolve(__dirname, '.env'));",
  "const projectName = getOrThrowFromProcess('PROJECT_NAME');",
  "const bundleTaskOptions: BundleTaskParameters = {",
  "  entryPoint: path.join(__dirname, './scripts/main.ts'),",
  "  external: ['@minecraft/server', '@minecraft/server-ui'],",
  "  outfile: path.resolve(__dirname, './dist/scripts/main.js'),",
  "  minifyWhitespace: false,",
  "  sourcemap: true,",
  "  outputSourcemapPath: path.resolve(__dirname, './dist/debug'),",
  "};",
  "const copyTaskOptions: CopyTaskParameters = {",
  "  copyToBehaviorPacks: [`./behavior_packs/$_{projectName}`],",
  "  copyToScripts: ['./dist/scripts'],",
  "  copyToResourcePacks: [`./resource_packs/$_{projectName}`],",
  "};",
  "const mcaddonTaskOptions: ZipTaskParameters = {",
  "  ...copyTaskOptions,",
  "  outputFile: `./dist/packages/$_{projectName}.mcaddon`,",
  "};",
  "task('lint', coreLint(['scripts/**/*.ts'], argv().fix));",
  "task('typescript', tscTask());",
  "task('bundle', bundleTask(bundleTaskOptions));",
  "task('build', series('typescript', 'bundle'));",
  "task('clean-local', cleanTask(DEFAULT_CLEAN_DIRECTORIES));",
  "task('clean-collateral', cleanCollateralTask(STANDARD_CLEAN_PATHS));",
  "task('clean', parallel('clean-local', 'clean-collateral'));",
  "task('copyArtifacts', copyTask(copyTaskOptions));",
  "task('package', series('clean-collateral', 'copyArtifacts'));",
  "task(",
  "  'local-deploy',",
  "  watchTask(",
  "    ['scripts/**/*.ts', 'behavior_packs/**/*.{json,lang,tga,ogg,png}', 'resource_packs/**/*.{json,lang,tga,ogg,png}'],",
  "    series('clean-local', 'build', 'package')",
  "  )",
  ");",
  "task('createMcaddonFile', mcaddonTask(mcaddonTaskOptions));",
  "task('mcaddon', series('clean-local', 'build', 'createMcaddonFile'));",
];

export default class JustConfig {
  private _file?: IFile;
  private _id?: string;
  private _isLoaded: boolean = false;

  private _onLoaded = new EventDispatcher<JustConfig, JustConfig>();

  public project: Project | undefined = undefined;

  public get isLoaded() {
    return this._isLoaded;
  }

  public get file() {
    return this._file;
  }

  public set file(newFile: IFile | undefined) {
    this._file = newFile;
  }

  public get onLoaded() {
    return this._onLoaded.asEvent();
  }

  public get id() {
    return this._id;
  }

  public set id(newId: string | undefined) {
    this._id = newId;
  }

  static async ensureOnFile(file: IFile, loadHandler?: IEventHandler<JustConfig, JustConfig>) {
    let justf: JustConfig | undefined;

    if (file.manager === undefined) {
      justf = new JustConfig();

      justf.file = file;

      file.manager = justf;
    }

    if (file.manager !== undefined && file.manager instanceof JustConfig) {
      justf = file.manager as JustConfig;

      if (!justf.isLoaded && loadHandler) {
        justf.onLoaded.subscribe(loadHandler);
      }

      await justf.load();

      return justf;
    }

    return justf;
  }

  async ensureDefault() {
    if (this._file === undefined) {
      return;
    }

    await this.load();

    this._file.setContent(JustConfig.getDefaultContent());
  }

  async ensureMin() {
    if (this._file === undefined) {
      return;
    }

    await this.load();

    if (!this._file.content || typeof this._file.content !== "string") {
      this._file.setContent(JustConfig.getDefaultContent());
    }
  }

  async persist() {}

  async save() {
    if (this._file === undefined) {
      return;
    }

    await this._file.saveContent(false);
  }

  async load() {
    if (this._file === undefined || this._isLoaded) {
      return;
    }

    await this._file.loadContent(true);

    if (this._file.content === null || this._file.content instanceof Uint8Array) {
      return;
    }

    this._isLoaded = true;
  }

  static getDefaultContent() {
    return JustDefaultConfig.join("\n").replace(/'/gi, '"').replace(/\$_{/gi, "${");
  }
}
