import * as vscode from "vscode";
import ExtensionManager from "./ExtensionManager";
import MinecraftTaskTerminal from "./MinecraftTaskTerminal";

interface MinecraftTaskDefinition extends vscode.TaskDefinition {
  task: string;
}

export class MinecraftTaskProvider implements vscode.TaskProvider {
  static MinecraftTasksType = "minecraft";
  private tasks: vscode.Task[] | undefined;
  private sharedState: string | undefined;
  private _extensionManager: ExtensionManager;

  constructor(extensionManager: ExtensionManager) {
    this._extensionManager = extensionManager;
  }

  public async provideTasks(): Promise<vscode.Task[]> {
    return this.getTasks();
  }

  public resolveTask(_task: vscode.Task): vscode.Task | undefined {
    const taskStr: string = _task.definition.task;
    if (taskStr) {
      const definition: MinecraftTaskDefinition = _task.definition as any;
      return this.getTask(definition.task, definition);
    }
    return undefined;
  }

  private getTasks(): vscode.Task[] {
    if (this.tasks !== undefined) {
      return this.tasks;
    }

    this.tasks = [];

    this.tasks.push(this.getTask("deployToRemote"));
    this.tasks.push(this.getTask("deployToLocal"));
    this.tasks.push(this.getTask("deploy"));
    this.tasks.push(this.getTask("deployToClient"));

    return this.tasks;
  }

  private getTask(taskStr: string, definition?: MinecraftTaskDefinition): vscode.Task {
    if (definition === undefined) {
      definition = {
        type: MinecraftTaskProvider.MinecraftTasksType,
        task: taskStr,
      };
    }

    return new vscode.Task(
      definition,
      vscode.TaskScope.Workspace,
      taskStr,
      MinecraftTaskProvider.MinecraftTasksType,
      new vscode.CustomExecution(async (): Promise<vscode.Pseudoterminal> => {
        return new MinecraftTaskTerminal(
          this._extensionManager,
          taskStr,
          [""],
          () => this.sharedState,
          (state: string) => (this.sharedState = state)
        );
      })
    );

    /*
    return new vscode.Task(
      definition,
      vscode.TaskScope.Workspace,
      `${taskStr}`,
      MinecraftTaskProvider.MinecraftScriptType,

      new vscode.CustomExecution(async (): Promise<any> => {
        return await this._extensionManager.publishWorldToRemote();
      })
    );*/
  }
}
