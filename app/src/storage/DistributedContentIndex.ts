// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { IAnnotatedValue } from "../core/AnnotatedValue";
import ContentIndex, { AnnotationCategory, IAnnotatedIndexData } from "../core/ContentIndex";
import Utilities from "../core/Utilities";
import IFile from "./IFile";
import IFolder from "./IFolder";
import StorageUtilities from "./StorageUtilities";

export default class DistributedContentIndex {
  #fileIndexes: { [key: string]: { file: IFile; index: ContentIndex } | boolean | undefined } = {};
  #rootFolder: IFolder;
  #isLoaded = false;
  #isError = false;
  #items: string[] | undefined = [];

  get items() {
    return this.#items;
  }

  get isError() {
    return this.#isError;
  }

  get startLength() {
    return 6;
  }

  constructor(rootFolder: IFolder) {
    this.#rootFolder = rootFolder;
  }

  getValuesFromIndexArray(indices: (IAnnotatedIndexData | number)[]) {
    const results: IAnnotatedValue[] = [];

    if (!this.#items) {
      return results;
    }

    for (const index of indices) {
      if (typeof index === "object") {
        const indexN = (index as IAnnotatedIndexData).n;
        if (indexN >= 0 && indexN < this.#items.length) {
          results.push({ value: this.#items[indexN], annotation: (index as IAnnotatedIndexData).a });
        }
      } else if (index >= 0 && index < this.#items.length) {
        results.push({ value: this.#items[index], annotation: undefined });
      }
    }

    return results;
  }

  async ensureLoaded() {
    if (this.#isLoaded === true) {
      return;
    }

    const cItemsFile = this.#rootFolder.ensureFile("citems.json");

    const itemsExists = await cItemsFile.exists();

    if (!itemsExists) {
      this.#isError = true;
      this.#isLoaded = true;
      return;
    }

    if (!cItemsFile.isContentLoaded) {
      await cItemsFile.loadContent();
    }

    const jsonO = StorageUtilities.getJsonObject(cItemsFile);

    if (jsonO === undefined) {
      this.#isError = true;
      this.#isLoaded = true;
      return;
    }

    this.#items = jsonO;

    this.#isLoaded = true;
  }

  async getMatches(searchString: string, wholeTermSearch?: boolean, withAnyAnnotation?: AnnotationCategory[]) {
    if (typeof searchString !== "string") {
      return undefined;
    }

    searchString = searchString.trim().toLowerCase();

    let terms = [searchString];

    if (!wholeTermSearch) {
      terms = searchString.split(" ");
    }

    let termWasSearched = false;

    let andResults: number[] | undefined;

    for (const term of terms) {
      if (term.length > 3) {
        const results = await this.getTermMatch(term);
        termWasSearched = true;

        if (results && results.length) {
          if (andResults === undefined) {
            andResults = results;
          } else {
            const newArr = [];

            for (let num of results) {
              if (andResults.includes(num)) {
                newArr.push(num);
              }
            }
          }
        }
      }
    }

    if (andResults === undefined || andResults.length === 0) {
      if (termWasSearched) {
        return [];
      }

      return undefined;
    }

    return ContentIndex.processResultValues(this.getValuesFromIndexArray(andResults), withAnyAnnotation);
  }

  async getTermMatch(term: string) {
    await this.ensureLoaded();

    if (term.length >= 7) {
      const indexAddress = term.substring(0, 6);

      let res = this.#fileIndexes[indexAddress];

      if (res === false || res === true) {
        return undefined;
      } else if (res === undefined) {
        const firstFolder = this.#rootFolder.ensureFolder(StorageUtilities.sanitizePath(term.substring(0, 2)));
        const secondFolder = firstFolder.ensureFolder(StorageUtilities.sanitizePath(term.substring(2, 4)));

        const file = secondFolder.ensureFile(StorageUtilities.sanitizePath(term.substring(4, 6)) + ".json");

        const fileExists = await file.exists();

        if (!fileExists) {
          this.#fileIndexes[indexAddress] = false;
          return undefined;
        }

        if (!file.isContentLoaded) {
          await file.loadContent();
        }

        const jsonO = StorageUtilities.getJsonObject(file);

        if (jsonO === undefined) {
          this.#fileIndexes[indexAddress] = false;
          return undefined;
        }

        const contentIndex = new ContentIndex();
        contentIndex.setTrie(jsonO);

        if (this.#items) {
          contentIndex.setItems(this.#items);
        }

        res = {
          file: file,
          index: contentIndex,
        };

        this.#fileIndexes[indexAddress] = res;
      }

      return res.index.getTermMatch(term.substring(6));
    } else if (term.length >= 3) {
      const indexAddress = term.substring(0, 3);

      let res = this.#fileIndexes[indexAddress];

      if (res === false || res === true) {
        return undefined;
      } else if (res === undefined) {
        const firstFolder = this.#rootFolder.ensureFolder(StorageUtilities.sanitizePath(term.substring(0, 2)));

        const file = firstFolder.ensureFile(StorageUtilities.sanitizePath(term.substring(2, 3)) + ".json");

        const fileExists = await file.exists();

        if (!fileExists) {
          this.#fileIndexes[indexAddress] = false;
          return undefined;
        }

        if (!file.isContentLoaded) {
          await file.loadContent();
        }

        const jsonO = StorageUtilities.getJsonObject(file);

        if (jsonO === undefined) {
          this.#fileIndexes[indexAddress] = false;
          return undefined;
        }

        const contentIndex = new ContentIndex();
        contentIndex.setTrie(jsonO);

        if (this.#items) {
          contentIndex.setItems(this.#items);
        }

        res = {
          file: file,
          index: contentIndex,
        };

        this.#fileIndexes[indexAddress] = res;
      }

      return res.index.getTermMatch(term.substring(3));
    }
  }

  async getDescendentStrings(term: string) {
    await this.ensureLoaded();

    if (term.length >= 7) {
      const indexAddress = term.substring(0, 6);

      const newResults: { [fullKey: string]: IAnnotatedValue[] | undefined } = {};

      if (Utilities.isUsableAsObjectKey(indexAddress)) {
        let res = this.#fileIndexes[indexAddress];

        if (res === false || res === true) {
          return undefined;
        } else if (res === undefined) {
          const firstFolder = this.#rootFolder.ensureFolder(StorageUtilities.sanitizePath(term.substring(0, 2)));
          const secondFolder = firstFolder.ensureFolder(StorageUtilities.sanitizePath(term.substring(2, 4)));

          const file = secondFolder.ensureFile(StorageUtilities.sanitizePath(term.substring(4, 6)) + ".json");

          const fileExists = await file.exists();

          if (!fileExists) {
            this.#fileIndexes[indexAddress] = false;
            return undefined;
          }

          if (!file.isContentLoaded) {
            await file.loadContent();
          }

          const jsonO = StorageUtilities.getJsonObject(file);

          if (jsonO === undefined) {
            this.#fileIndexes[indexAddress] = false;
            return undefined;
          }

          const contentIndex = new ContentIndex();
          contentIndex.setTrie(jsonO);

          if (this.#items) {
            contentIndex.setItems(this.#items);
          }

          res = {
            file: file,
            index: contentIndex,
          };

          this.#fileIndexes[indexAddress] = res;
        }

        const results = await res.index.getDescendentStrings(term.substring(6));

        if (!results) {
          return undefined;
        }

        for (const key in results) {
          if (results[key] !== undefined) {
            if (Utilities.isUsableAsObjectKey(indexAddress + key)) {
              newResults[indexAddress + key] = results[key];
            }
          }
        }
      }
      return newResults;
    }

    return undefined;
  }

  static async saveContentIndexToFolder(contentIndex: ContentIndex, folder: IFolder) {
    const all = contentIndex.getAll();

    const fileIndexes: { [key: string]: { file: IFile; index: ContentIndex } } = {};

    const cItemsFile = folder.ensureFile("citems.json");

    Utilities.encodeObjectWithSequentialRunLengthEncodeUsingNegative(contentIndex.data.trie);

    cItemsFile.setContent(JSON.stringify(contentIndex.data.items));
    await cItemsFile.saveContent();

    for (const key in all) {
      if (key.length >= 3) {
        const firstFolder = folder.ensureFolder(StorageUtilities.sanitizePath(key.substring(0, 2)));

        if (key.length >= 7) {
          const secondFolder = firstFolder.ensureFolder(StorageUtilities.sanitizePath(key.substring(2, 4)));
          // /ab/cd/ef[g..]
          const res = fileIndexes[key.substring(0, 6)];
          if (!res) {
            const file = secondFolder.ensureFile(StorageUtilities.sanitizePath(key.substring(4, 6)) + ".json");
            const newContentIndex = new ContentIndex();
            newContentIndex.setItems(contentIndex.data.items);

            newContentIndex.insertArray(key.substring(6), all[key]);

            fileIndexes[key.substring(0, 6)] = { file: file, index: newContentIndex };
          } else {
            res.index.insertArray(key.substring(6), all[key]);
          }
        } else {
          // /ab/c[d|de|def]
          const res = fileIndexes[key.substring(0, 3)];
          if (!res) {
            const file = firstFolder.ensureFile(StorageUtilities.sanitizePath(key.substring(2, 3)) + ".json");
            const newContentIndex = new ContentIndex();
            newContentIndex.setItems(newContentIndex.data.items);

            newContentIndex.insertArray(key.substring(3), all[key]);

            fileIndexes[key.substring(0, 3)] = { file: file, index: newContentIndex };
          } else {
            res.index.insertArray(key.substring(3), all[key]);
          }
        }
      }
    }

    for (const fileIndexKey in fileIndexes) {
      const fileIndex = fileIndexes[fileIndexKey];

      Utilities.encodeObjectWithSequentialRunLengthEncodeUsingNegative(fileIndex.index.data.trie);

      fileIndex.file.setContent(JSON.stringify(fileIndex.index.data.trie));

      await fileIndex.file.saveContent();
    }
  }
}
