// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { ProjectItemType } from "../app/IProjectItemData";
import Project from "../app/Project";
import Lang from "./Lang";
import LocToken from "./LocToken";

export default class LocManager {
  private _project: Project;
  private _isLoaded: boolean;

  public tokens: { [name: string]: { [locale: string]: { [packContainer: string]: LocToken } } } = {};

  constructor(project: Project) {
    this._project = project;
    this._isLoaded = false;
  }

  async getTokenValue(tokenName: string) {
    if (!this._isLoaded) {
      await this.load();
    }

    return this.getTokenValueOrDefault(tokenName);
  }

  getExpandedValue(tokenName: string): string {
    if (!this._isLoaded) {
      return tokenName;
    }

    const tok = this.getToken(tokenName);

    if (!tok) {
      return tokenName;
    }

    return tok.value + " - (" + tokenName + ")";
  }

  getTokenValueOrDefault(tokenName: string): string {
    if (!this._isLoaded) {
      return tokenName;
    }

    const tok = this.getToken(tokenName);

    if (!tok) {
      return tokenName;
    }

    return tok.value;
  }

  getToken(tokenName: string, locale?: string, packContainer?: string): LocToken | undefined {
    const loc = this.tokens[tokenName];

    if (loc) {
      if (!locale) {
        locale = "en_US";
      }

      const tokenSetByLocale = loc[locale];

      if (tokenSetByLocale) {
        if (packContainer) {
          return tokenSetByLocale[packContainer];
        }

        // return the first available token
        for (const containerName in tokenSetByLocale) {
          return tokenSetByLocale[containerName];
        }
      }
    }

    return undefined;
  }

  async load(force?: boolean) {
    if (this._isLoaded && !force) {
      return;
    }

    await this._project.ensureLoadedProjectFolder();

    this.tokens = {};

    const itemsCopy = this._project.getItemsCopy();

    for (const pi of itemsCopy) {
      if (pi.itemType === ProjectItemType.lang) {
        await pi.ensureFileStorage();

        if (pi.defaultFile) {
          const lang = await Lang.ensureOnFile(pi.defaultFile);

          if (lang) {
            await lang.load();

            if (lang.language && lang.containerName !== undefined) {
              for (const tokenName in lang.tokens) {
                if (this.tokens[tokenName] === undefined) {
                  this.tokens[tokenName] = {};
                }

                if (this.tokens[tokenName][lang.language] === undefined) {
                  this.tokens[tokenName][lang.language] = {};
                }

                this.tokens[tokenName][lang.language][lang.containerName] = lang.tokens[tokenName];
              }
            }
          }
        }
      }
    }

    this._isLoaded = true;
  }
}
