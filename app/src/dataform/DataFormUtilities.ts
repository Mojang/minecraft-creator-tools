// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFormDefinition from "./IFormDefinition";

export default class DataFormUtilities {
  static generateDefaultItem(formDefinition: IFormDefinition) {
    const newDataObject: any = {};

    for (let i = 0; i < formDefinition.fields.length; i++) {
      const field = formDefinition.fields[i];

      if (field.defaultValue !== undefined) {
        newDataObject[field.id] = field.defaultValue;
      }
    }

    return newDataObject;
  }
}
