// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IComponent from "./IComponent";

export type IComponentContainer = {
  [name: string]: IComponent | string | string[] | boolean | number[] | number | undefined;
};

export default interface IComponentDataItem {
  components: IComponentContainer;
}
