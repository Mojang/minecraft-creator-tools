// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export default interface IRecipeBehavior {
  format_version?: string;
  "minecraft:recipe_shaped"?: IRecipeShaped;
  "minecraft:recipe_shapeless"?: IRecipeShapeless;
}

export interface IRecipeShaped {
  description: IRecipeDescription;
  tags?: string[];
  pattern: string[];
  key: { [name: string]: IRecipeKeyItem | undefined };
  group?: string;
  unlock?: IRecipeUnlock | IRecipeUnlock[];
  result: IRecipeResultItem;
}

export interface IRecipeShapeless {
  description: IRecipeDescription;
  tags?: string[];
  ingredients: (IRecipeKeyItem | undefined)[];
  unlock?: IRecipeUnlock | IRecipeUnlock[];
  result: IRecipeResultItem;
}

export interface IRecipeUnlock {
  context?: string;
  item?: string;
  data?: number;
}

export interface IRecipeKeyItem {
  item: string;
  data?: number;
}

export interface IRecipeResultItem {
  item: string;
  data?: number;
  count?: number;
}

export interface IRecipeDescription {
  identifier: string | undefined;
}
