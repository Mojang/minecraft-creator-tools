// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import HttpFolder from "./HttpFolder";
import StorageBase from "./StorageBase";
import IStorage from "./IStorage";

export default class HttpStorage extends StorageBase implements IStorage {
  rootFolder: HttpFolder;

  baseUrl: string;

  constructor(newUrl: string) {
    super();

    this.baseUrl = newUrl;

    if (!this.baseUrl.endsWith(StorageBase.slashFolderDelimiter)) {
      this.baseUrl += StorageBase.slashFolderDelimiter;
    }

    this.rootFolder = new HttpFolder(this, null, "");
  }
}
