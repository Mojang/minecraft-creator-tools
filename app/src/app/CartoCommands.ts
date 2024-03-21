// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import Log from "../core/Log";
import CommandRegistry, { CommandScope } from "./CommandRegistry";
import { CommandStatus } from "./ICommand";
import IContext from "./IContext";

export default class CartoCommands {
  static async debugProjectInformation(context: IContext, name: string, args: string[]) {
    if (!context.project) {
      return { status: CommandStatus.invalidArguments };
    }

    let message = "N: " + context.project.name;

    if (context.project.projectFolder) {
      message += " PF: " + context.project.projectFolder.fullPath;
    }

    Log.message(message);

    return { status: CommandStatus.completed };
  }

  static async debugMinecraft(context: IContext, name: string, args: string[]) {
    let message = "LAM: " + context.carto.lastActiveMinecraftFlavor;

    if (context.carto.remoteServerUrl) {
      message += " RSURL: " + context.carto.remoteServerUrl;
    }

    if (context.carto.remoteServerPort) {
      message += " RSP: " + context.carto.remoteServerPort;
    }

    if (context.carto.dedicatedServerMode) {
      message += " DSM: " + context.carto.dedicatedServerMode;
    }

    if (context.carto.dedicatedServerPath) {
      message += " DSP: " + context.carto.dedicatedServerPath;
    }

    if (context.carto.dedicatedServerSlotCount) {
      message += " DSS: " + context.carto.dedicatedServerSlotCount;
    }

    Log.message(message);

    return { status: CommandStatus.completed };
  }

  static async startMinecraft(context: IContext, name: string, args: string[]) {
    if (!context.minecraft && !context.carto.lastActiveMinecraftFlavor) {
      return { status: CommandStatus.invalidEnvironment };
    }

    let mc = context.minecraft;

    if (!mc && context.carto.lastActiveMinecraftFlavor) {
      mc = context.carto.ensureMinecraft(context.carto.lastActiveMinecraftFlavor);
    }

    if (!mc) {
      return { status: CommandStatus.invalidEnvironment };
    }

    Log.message("Starting server.");
    await mc.prepareAndStart({
      project: context.project,
    });

    return { status: CommandStatus.completed };
  }

  static async stopMinecraft(context: IContext, name: string, args: string[]) {
    if (!context.minecraft) {
      return { status: CommandStatus.invalidEnvironment };
    }

    Log.message("Stopping server.");
    await context.minecraft.stop();

    return { status: CommandStatus.completed };
  }

  static async updateMinecraft(context: IContext, name: string, args: string[]) {
    if (context.minecraft) {
      context.minecraft.prepare(true);
    }

    return { status: CommandStatus.completed };
  }

  static registerCommonCommands() {
    CommandRegistry.main.registerCommand("dbgproj", CommandScope.debug, CartoCommands.debugProjectInformation);
    CommandRegistry.main.registerCommand("dbgmc", CommandScope.debug, CartoCommands.debugMinecraft);
    CommandRegistry.main.registerCommand("startmc", CommandScope.any, CartoCommands.startMinecraft);
    CommandRegistry.main.registerCommand("stopmc", CommandScope.minecraft, CartoCommands.stopMinecraft);
    CommandRegistry.main.registerCommand("updatemc", CommandScope.minecraft, CartoCommands.updateMinecraft);
  }
}
