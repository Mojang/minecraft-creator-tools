// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import Log from "../core/Log";
import CommandRegistry, { CommandScope } from "./CommandRegistry";
import { CommandStatus } from "./ICommand";
import IContext from "./IContext";

export default class CreatorToolsCommands {
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
    let message = "LAM: " + context.creatorTools.lastActiveMinecraftFlavor;

    if (context.creatorTools.remoteServerUrl) {
      message += " RSURL: " + context.creatorTools.remoteServerUrl;
    }

    if (context.creatorTools.remoteServerPort) {
      message += " RSP: " + context.creatorTools.remoteServerPort;
    }

    if (context.creatorTools.dedicatedServerMode) {
      message += " DSM: " + context.creatorTools.dedicatedServerMode;
    }

    if (context.creatorTools.dedicatedServerPath) {
      message += " DSP: " + context.creatorTools.dedicatedServerPath;
    }

    if (context.creatorTools.dedicatedServerSlotCount) {
      message += " DSS: " + context.creatorTools.dedicatedServerSlotCount;
    }

    Log.message(message);

    return { status: CommandStatus.completed };
  }

  static async startMinecraft(context: IContext, name: string, args: string[]) {
    if (!context.minecraft && !context.creatorTools.lastActiveMinecraftFlavor) {
      return { status: CommandStatus.invalidEnvironment };
    }

    let mc = context.minecraft;

    if (!mc && context.creatorTools.lastActiveMinecraftFlavor) {
      mc = context.creatorTools.ensureMinecraft(context.creatorTools.lastActiveMinecraftFlavor);
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
    CommandRegistry.main.registerCommand("dbgproj", CommandScope.debug, CreatorToolsCommands.debugProjectInformation);
    CommandRegistry.main.registerCommand("dbgmc", CommandScope.debug, CreatorToolsCommands.debugMinecraft);
    CommandRegistry.main.registerCommand("startmc", CommandScope.any, CreatorToolsCommands.startMinecraft);
    CommandRegistry.main.registerCommand("stopmc", CommandScope.minecraft, CreatorToolsCommands.stopMinecraft);
    CommandRegistry.main.registerCommand("updatemc", CommandScope.minecraft, CreatorToolsCommands.updateMinecraft);
  }
}
