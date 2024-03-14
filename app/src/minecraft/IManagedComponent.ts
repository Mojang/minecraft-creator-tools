// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IGetSetPropertyObject from "../dataform/IGetSetPropertyObject";
import IComponent from "./IComponent";

export default interface IManagedComponent extends IGetSetPropertyObject {
  id: string;

  getData(): IComponent | string | number | undefined;
}
