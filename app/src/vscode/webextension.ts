import ExtensionManager from "./ExtensionManager";
import * as vscode from "vscode";

const _em = new ExtensionManager(true);

export function activate(context: vscode.ExtensionContext) {
  _em.activate(context);
}

export function deactivate() {
  _em.deactivate();
}
