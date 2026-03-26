// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export default class Player {
  id: string | undefined;
  xuid: string | undefined;

  isValid(): boolean {
    if (this.id === undefined) {
      return false;
    }

    return true;
  }
}
