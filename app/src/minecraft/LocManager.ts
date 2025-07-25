// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { ProjectItemType } from "../app/IProjectItemData";
import Project from "../app/Project";
import Utilities from "../core/Utilities";
import Log from "../core/Log";
import Lang from "./Lang";
import LocToken from "./LocToken";

export default class LocManager {
  private _project: Project;
  private _isLoaded: boolean;
  private _languages: { [language: string]: Lang[] } = {};

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

  getAllTokenKeys() {
    return Object.keys(this.tokens);
  }

  getAllLanguages(): Lang[] {
    let langs: Lang[] = [];

    for (const langKey in this._languages) {
      langs.push(...this._languages[langKey]);
    }

    return langs;
  }

  static canonicalizeLanguageKey(locKey: string) {
    return locKey.toLowerCase().trim();
  }

  getEnUsLang(): Lang[] | undefined {
    const primary = this._languages["en_us"];

    Log.assert(!!primary, "No en-us language found.");

    return primary;
  }

  getNonEnUsLangs(): Lang[] {
    let langs: Lang[] = [];

    for (const langKey in this._languages) {
      if (LocManager.canonicalizeLanguageKey(langKey) !== "en_us") {
        langs.push(...this._languages[langKey]);
      }
    }

    return langs;
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
    const tokenSets = this.tokens[tokenName];

    if (tokenSets) {
      if (!locale) {
        locale = "en_US";
      }

      const tokenSetByLocale = tokenSets[LocManager.canonicalizeLanguageKey(locale)];

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

        if (pi.primaryFile) {
          const lang = await Lang.ensureOnFile(pi.primaryFile);

          if (lang) {
            await lang.load();

            if (lang.language && lang.containerName !== undefined && Utilities.isUsableAsObjectKey(lang.language)) {
              const language = LocManager.canonicalizeLanguageKey(lang.language);

              if (!this._languages[language]) {
                this._languages[language] = [];
              }

              this._languages[language].push(lang);

              for (const tokenName in lang.tokens) {
                if (Utilities.isUsableAsObjectKey(tokenName)) {
                  if (this.tokens[tokenName] === undefined) {
                    this.tokens[tokenName] = {};
                  }

                  if (Utilities.isUsableAsObjectKey(lang.containerName)) {
                    if (this.tokens[tokenName][language] === undefined) {
                      this.tokens[tokenName][language] = {};
                    }

                    this.tokens[tokenName][language][lang.containerName] = lang.tokens[tokenName];
                  }
                }
              }
            }
          }
        }
      }
    }

    this._isLoaded = true;
  }
}
