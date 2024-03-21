// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IComponent from "./IComponent";

export default interface IComponentDataItem {
  components: { [name: string]: IComponent | string | number | undefined };
}
