export default interface IDialogueWrapper {
  format_version: string;
  __comment__?: string;
  "minecraft:npc_dialogue": IDialogue;
}

export interface IDialogue {
  scenes: IDialogueScene[];
}

export interface IDialogueScene {
  scene_tag: string;
  npc_name: object;
  on_open_commands?: string[];
  on_close_commands?: string[];
  text: object;
  buttons: IDialogueSceneButton[];
}

export interface IDialogueSceneButton {
  name: object;
  commands?: string[];
}

export interface IBehaviorAnimationTimeline {
  [timeStamp: string]: string[];
}

export interface IBehaviorAnimationTimelineWrapper {
  animationId: string;
  timestamp: string;
  timeline: string[];
}
