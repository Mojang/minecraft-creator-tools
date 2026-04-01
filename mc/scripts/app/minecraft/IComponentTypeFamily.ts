// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IComponent from "./IComponent";

export default interface IComponentTypeFamily extends IComponent {
  on_death: string;
}
