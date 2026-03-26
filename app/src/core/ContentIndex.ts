// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ARCHITECTURE: ContentIndex — Trie-Based Search Index
 *
 * ContentIndex provides a compressed trie data structure for fast term lookup
 * across project content. It is the shared search engine used by:
 *
 * 1. **Omni Search (Ctrl+E)** — Bottom status bar in the editor. Uses
 *    `getDescendentStrings()` for autocomplete term suggestions and
 *    `getMatches()` for finding matched project item paths.
 *
 * 2. **Search in Files (Ctrl+Shift+F)** — ProjectSearchDialog uses the
 *    index to prioritize candidate files before doing brute-force text scan.
 *
 * 3. **Quick Open (Ctrl+P)** — QuickOpenDialog uses simple path includes()
 *    but could be enhanced to use this index in the future.
 *
 * **Data Structure:**
 * - `items[]` — Array of indexed values (file paths like `/bp/entities/pig.json`)
 * - `trie{}` — Compressed trie mapping search terms → arrays of item indices
 *   - Terminal nodes use `±` or `$` markers
 *   - Annotated entries use `IAnnotatedIndexData { n: number, a: string }`
 *
 * **Index Population (ProjectInfoSet.ts):**
 * - File base names (e.g., "pig" from "pig.json")
 * - Storage relative paths (e.g., "entities/pig.json")
 * - Parsed JSON content tokens (words > 2 chars)
 * - Parsed JS/TS tokens via esprima
 * - Entity/block/item type IDs from info generators (with annotation categories)
 *
 * **Key Methods:**
 * - `getMatches(searchString)` — Multi-term AND search. Splits on spaces,
 *   intersects results across terms. Each term is matched via both trie
 *   traversal and linear substring scan of items[].
 * - `getDescendentStrings(term)` — Returns all trie entries starting with
 *   the given prefix (for autocomplete dropdown).
 * - `getTermMatch(term)` — Single-term lookup: trie traversal + linear
 *   substring scan of items[] for path matching.
 * - `insert(key, item, annotation?)` — Inserts a term into the trie.
 *
 * **Configuration:**
 * - `startLength` — Minimum input length before autocomplete triggers (currently 3).
 * - JSON token threshold — Tokens > 2 chars are indexed from parsed content.
 *
 * Last updated: February 2026
 */

import ProjectUtilities from "../app/ProjectUtilities";
import StorageUtilities from "../storage/StorageUtilities";
import { IAnnotatedValue } from "./AnnotatedValue";
import { HashCatalog } from "./HashUtilities";
import IContextIndexData from "./IContentIndexData";
import Log from "./Log";
import Utilities from "./Utilities";
import esprima from "esprima-next";

export enum AnnotationCategory {
  blockTextureReferenceSource = "a",
  blockTypeDependent = "b",
  entityComponentDependent = "c",
  blockComponentDependent = "d",
  entityTypeDependent = "e",
  entityFilter = "f",
  entityComponentDependentInGroup = "g",
  blockTextureReferenceDependent = "h",
  itemTypeDependent = "i",
  itemComponentDependent = "j",
  itemTextureReferenceSource = "k",
  featureSource = "l",
  featureDependent = "m",
  featureRuleSource = "n",
  blockComponentDependentInPermutation = "p",
  storagePathDependent = "s",
  textureFile = "t",
  entityEvent = "v",
  blockTypeSource = "B",
  entityTypeSource = "E",
  itemTypeSource = "I",
  itemTextureSource = "J",
  blockSounds = "L",
  musicDefinitionSource = "M",
  entitySounds = "N",
  interactiveSounds = "R",
  jsSource = "S",
  terrainTextureSource = "T",
  soundDefinitionSource = "U",
  individualEventSoundsSource = "V",
  worldProperty = "W",
  experiment = "X",

  // Cross-reference completion annotation categories
  geometrySource = "G",
  animationSource = "A",
  animationControllerSource = "C",
  renderControllerSource = "D",
  particleSource = "P",
  fogSource = "F",
  lootTableSource = "O",
  recipeSource = "Q",
  biomeSource = "Y",
  spawnRuleSource = "Z",
  structureSource = "r",
  dialogueSource = "q",
  functionSource = "u",
  soundEventSource = "w",

  // Component-level annotation categories for biomes and particles
  biomeBehaviorComponentDependent = "x",
  biomeClientComponentDependent = "y",
  particleEmitterComponentDependent = "z",
  particleComponentDependent = "pc",
}

export interface IAnnotatedIndexData {
  n: number;
  a: string;
}

export interface IContentIndex {
  getDescendentStrings(term: string): Promise<{ [fullKey: string]: IAnnotatedValue[] | undefined } | undefined>;
  getMatches(
    searchString: string,
    wholeTermSearch?: boolean,
    withAnnotation?: AnnotationCategory[]
  ): Promise<IAnnotatedValue[] | undefined>;
  startLength: number;
}

export default class ContentIndex implements IContentIndex {
  private _processedPathsCache?: string[];
  private _hashCatalog: HashCatalog = {};

  // O(1) lookup map: item string → index in items[]. Replaces O(n) linear scans
  // in insert() and getTermMatch(). Rebuilt on setItems().
  private _itemIndexMap: Map<string, number> = new Map();

  #data: IContextIndexData = {
    items: [],
    trie: {},
  };

  public get hashCatalog(): HashCatalog {
    return this._hashCatalog;
  }

  #iteration: number = Math.floor(Math.random() * 1000000);

  get iteration() {
    return this.#iteration;
  }

  set iteration(newIteration: number) {
    this.#iteration = newIteration;
  }

  static getAnnotationCategoryKeys() {
    const keys: string[] = [];

    for (const key in AnnotationCategory) {
      keys.push(key.toLowerCase());
    }

    return keys;
  }

  static getAnnotationCategoryFromLongString(longStr: string) {
    longStr = longStr.toLowerCase();

    for (const key in AnnotationCategory) {
      if (key.toLowerCase() === longStr) {
        return (AnnotationCategory as { [keyName: string]: string })[key];
      }
    }

    return undefined;
  }

  get data() {
    return this.#data;
  }

  get startLength() {
    return 3;
  }

  get items() {
    return this.#data.items;
  }

  setItems(items: string[]) {
    this.#data.items = items;
    this._processedPathsCache = undefined; // reset processed paths cache

    // Rebuild the O(1) lookup map from the new items array
    this._itemIndexMap.clear();
    for (let i = 0; i < items.length; i++) {
      this._itemIndexMap.set(items[i], i);
    }
  }

  setTrie(trie: {}) {
    this.#data.trie = trie;
  }

  getAll(withAnnotation?: AnnotationCategory[]): { [fullKey: string]: IAnnotatedValue[] } {
    const results: { [fullKey: string]: IAnnotatedValue[] } = {};

    this._appendToResults("", this.#data.trie, results, withAnnotation);

    return results;
  }

  _appendToResults(
    prefix: string,
    node: any,
    results: { [fullKey: string]: IAnnotatedValue[] | undefined },
    withAnnotation?: AnnotationCategory[]
  ) {
    for (const token in node) {
      const subNode = node[token];

      if (subNode) {
        if (token === "±" || token === "$") {
          const arr = subNode;

          if (Array.isArray(arr)) {
            if (Utilities.isUsableAsObjectKey(prefix)) {
              let res = this.getValuesFromIndexArray(arr, withAnnotation);

              if (res) {
                results[prefix] = res;
              }
            }
          }
        } else if (Array.isArray(subNode)) {
          if (Utilities.isUsableAsObjectKey(prefix + token)) {
            let res = this.getValuesFromIndexArray(subNode, withAnnotation);

            if (res) {
              results[prefix + token] = res;
            }
          }
        } else {
          this._appendToResults(prefix + token, subNode, results, withAnnotation);
        }
      }
    }
  }

  mergeFrom(index: ContentIndex, newItem: string) {
    const all = index.getAll();

    for (const fullKey in all) {
      const annVals = all[fullKey];

      let annVal: string | undefined;

      for (const subVal of annVals) {
        if (subVal.annotation) {
          if (!annVal) {
            annVal = subVal.annotation;
          } else if (annVal.indexOf(subVal.annotation) < 0) {
            annVal += subVal.annotation;
          }
        }
      }

      this.insert(fullKey, newItem, annVal);
    }
  }

  static processResultValues(annotatedValues: IAnnotatedValue[] | undefined, withAnyAnnotation?: AnnotationCategory[]) {
    if (!annotatedValues) {
      return undefined;
    }

    if (withAnyAnnotation) {
      let newAnnotatedValues: IAnnotatedValue[] = [];

      for (const annV of annotatedValues) {
        if (annV.annotation && withAnyAnnotation.includes(annV.annotation as AnnotationCategory)) {
          newAnnotatedValues.push(annV);
        }
      }

      annotatedValues = newAnnotatedValues;
    }

    return annotatedValues;
  }

  getValuesFromIndexArray(
    indices: (IAnnotatedIndexData | number)[],
    withAnnotation?: AnnotationCategory[]
  ): IAnnotatedValue[] | undefined {
    let results: IAnnotatedValue[] = [];

    if (!indices) {
      return undefined;
    }

    if (Utilities.arrayHasNegativeAndIsNumeric(indices)) {
      indices = Utilities.decodeSequentialRunLengthUsingNegative(indices as number[]);
    }

    for (const index of indices) {
      if (typeof index === "object") {
        const indexN = (index as IAnnotatedIndexData).n;
        if (indexN >= 0 && indexN < this.#data.items.length) {
          const annotate = index.a;

          if (!withAnnotation || withAnnotation.includes(annotate as AnnotationCategory)) {
            results.push({ value: this.#data.items[indexN], annotation: (index as IAnnotatedIndexData).a });
          }
        }
      } else if (index >= 0 && index < this.#data.items.length && !withAnnotation) {
        results.push({ value: this.#data.items[index], annotation: undefined });
      }
    }

    if (results.length === 0) {
      return undefined;
    }

    return results;
  }

  loadFromData(data: IContextIndexData) {
    this.#data = data;
    this._processedPathsCache = undefined; // reset processed paths cache
  }

  private _getProcessedPaths() {
    if (this._processedPathsCache) return this._processedPathsCache;

    this._processedPathsCache = this.data.items
      .filter((item) => item.startsWith("/"))
      .map((item) => {
        const lastPeriod = item.lastIndexOf(".");
        return lastPeriod >= 0 ? item.substring(0, lastPeriod) : item;
      });

    return this._processedPathsCache;
  }

  hasPathMatches(pathEnd: string) {
    pathEnd = pathEnd.toLowerCase();

    pathEnd = StorageUtilities.stripExtension(pathEnd);

    return this._getProcessedPaths().some((path) => path.endsWith(pathEnd));
  }

  getPathMatches(pathEnd: string) {
    pathEnd = pathEnd.toLowerCase();

    let pathType = ProjectUtilities.inferJsonProjectItemTypeFromExtension(pathEnd);
    pathEnd = StorageUtilities.stripExtension(pathEnd);

    const results: string[] = [];

    for (const candPath of this.data.items) {
      const candType = ProjectUtilities.inferJsonProjectItemTypeFromExtension(candPath);
      const candPathStripped = StorageUtilities.stripExtension(candPath.toLowerCase());

      if (candPathStripped.endsWith(pathEnd) && pathType === candType) {
        results.push(StorageUtilities.stripExtension(candPath));
      }
    }

    return results;
  }

  async getMatches(searchString: string, wholeTermSearch?: boolean, withAnyAnnotation?: AnnotationCategory[]) {
    if (typeof searchString !== "string") {
      Log.unexpectedContentState("CIMGMS");
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
      if (term.length > 1) {
        const results = this.getTermMatch(term);
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

            andResults = newArr;
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

    let annotatedValues = ContentIndex.processResultValues(this.getValuesFromIndexArray(andResults), withAnyAnnotation);

    if (!annotatedValues) {
      return undefined;
    }

    return annotatedValues.sort((a: IAnnotatedValue, b: IAnnotatedValue) => {
      let aTermMatches = 0;
      let bTermMatches = 0;
      const aVal = a.value.toLowerCase();
      const bVal = b.value.toLowerCase();

      for (const term of terms) {
        if (aVal.startsWith(term)) {
          aTermMatches += 5;
        } else if (aVal.includes(term)) {
          aTermMatches++;
        }

        if (bVal.startsWith(term)) {
          bTermMatches += 5;
        } else if (bVal.includes(term)) {
          bTermMatches++;
        }
      }

      if (aTermMatches === bTermMatches) {
        return Utilities.staticCompare(a.value, b.value);
      }

      return bTermMatches - aTermMatches;
    });
  }

  getTermMatchStrings(term: string) {
    const results = this.getTermMatch(term);

    if (results === undefined) {
      return results;
    }

    return this.getValuesFromIndexArray(results);
  }

  async getDescendentStrings(term: string) {
    let termIndex = 0;
    let curNode: any = this.#data.trie;

    const results: { [fullKey: string]: IAnnotatedValue[] | undefined } = {};

    let hasAdvanced = true;
    let termSubstr = "";

    while (termIndex < term.length && hasAdvanced) {
      hasAdvanced = false;
      if (Array.isArray(curNode)) {
        return undefined;
      }

      let nextNode = curNode[term[termIndex]];
      if (nextNode) {
        curNode = nextNode;
        termIndex++;

        termSubstr = term.substring(0, termIndex);
        hasAdvanced = true;
      } else {
        let nextStart = term[termIndex];

        for (const item in curNode) {
          // we've found part of our string in this node

          if (item.startsWith(nextStart) && curNode[item] !== undefined) {
            let itemIndex = 0;
            hasAdvanced = true;
            curNode = curNode[item];
            termSubstr = term.substring(0, termIndex) + item;

            while (termIndex < term.length && itemIndex < item.length && item[itemIndex] === term[termIndex]) {
              itemIndex++;
              termIndex++;
            }

            break;
          }
        }
      }
    }

    if (termIndex < term.length) {
      const termStub = term.substring(termIndex);

      for (const childNodeName in curNode) {
        if (childNodeName.startsWith(termStub) && curNode[childNodeName]) {
          this._appendToResults(term.substring(0, termIndex) + childNodeName, curNode[childNodeName], results);
        }
      }
    } else {
      if (Array.isArray(curNode)) {
        results[termSubstr] = this.getValuesFromIndexArray(curNode);
      } else if (curNode["±"] !== undefined) {
        this._appendToResults(termSubstr, curNode, results);
      }
    }

    return results;
  }

  getTermMatch(term: string) {
    let termIndex = 0;
    let curNode: any = this.#data.trie;

    let hasAdvanced = true;

    let pathMatches: number[] | undefined = undefined;

    let i = 0;
    for (const item of this.#data.items) {
      if (item.indexOf(term) >= 0) {
        if (!pathMatches) {
          pathMatches = [];
        }
        pathMatches.push(i);
      }

      i++;
    }

    while (termIndex < term.length && hasAdvanced) {
      hasAdvanced = false;
      if (Array.isArray(curNode)) {
        return undefined;
      }

      let nextNode = curNode[term[termIndex]];
      if (nextNode) {
        curNode = nextNode;
        termIndex++;
        hasAdvanced = true;
      } else {
        let nextStart = term[termIndex];

        if (termIndex < term.length - 1) {
          nextStart += term[termIndex + 1];
        }

        for (const item in curNode) {
          // we've found part of our string in this node

          if (item.startsWith(nextStart) && curNode[item] !== undefined && !hasAdvanced) {
            let itemIndex = 0;
            hasAdvanced = true;
            curNode = curNode[item];

            while (termIndex < term.length && itemIndex < item.length && item[itemIndex] === term[termIndex]) {
              itemIndex++;
              termIndex++;
            }
          }
        }
      }
    }

    if (termIndex < term.length) {
      return undefined;
    }

    if (Array.isArray(curNode)) {
      if (pathMatches) {
        return ContentIndex.mergeResults(curNode, pathMatches);
      }
      return curNode;
    } else if (curNode["±"] !== undefined) {
      if (pathMatches) {
        return ContentIndex.mergeResults(curNode["±"], pathMatches);
      }
      return curNode["±"];
    } else {
      const arr: number[] = [];

      this.aggregateIndices(curNode, arr);

      if (pathMatches) {
        return ContentIndex.mergeResults(arr, pathMatches);
      }

      return arr;
    }
  }

  static mergeResults(resultsArrA: (IAnnotatedValue | number)[], resultsArrB: (IAnnotatedValue | number)[]) {
    const results: (IAnnotatedValue | number)[] = [];
    const seenNumbers = new Set<number>();
    const seenObjects = new Set<string>(); // "value|annotation" composite key

    for (const item of resultsArrA) {
      if (typeof item === "object") {
        const key = `${item.value}|${item.annotation}`;
        if (!seenObjects.has(key)) {
          seenObjects.add(key);
          results.push(item);
        }
      } else {
        if (!seenNumbers.has(item)) {
          seenNumbers.add(item);
          results.push(item);
        }
      }
    }

    for (const item of resultsArrB) {
      if (typeof item === "object") {
        const key = `${item.value}|${item.annotation}`;
        if (!seenObjects.has(key)) {
          seenObjects.add(key);
          results.push(item);
        }
      } else {
        if (!seenNumbers.has(item)) {
          seenNumbers.add(item);
          results.push(item);
        }
      }
    }

    return results;
  }

  aggregateIndices(curNode: any, arr: number[], seen?: Set<number>) {
    if (!seen) {
      seen = new Set<number>(arr);
    }

    for (const childNodeName in curNode) {
      const childNode = curNode[childNodeName];

      if (childNode) {
        if (Array.isArray(childNode)) {
          for (const num of childNode) {
            const n = typeof num === "object" ? num.n : num;
            if (!seen.has(n)) {
              seen.add(n);
              arr.push(num);
            }
          }
        } else if (childNode["±"] !== undefined) {
          for (const num of childNode["±"]) {
            const n = typeof num === "object" ? num.n : num;
            if (!seen.has(n)) {
              seen.add(n);
              arr.push(num);
            }
          }
        } else {
          this.aggregateIndices(childNode, arr, seen);
        }
      }
    }
  }

  insertArray(key: string, items: IAnnotatedValue[]) {
    for (const item of items) {
      this.insert(key, item.value, item.annotation);
    }
  }

  insert(key: string, item: string, annotationChar?: string) {
    if (Utilities.isNumericIsh(key) || key.length > 70) {
      return;
    }

    // since we treat ± as special, ban usage of ± in strings.
    key = key.replace(/±/gi, "").toLowerCase().trim();

    let keyIndex = 0;
    let curNode: any = this.#data.trie;
    let parentNode: any = curNode;
    let curNodeIndex: string | undefined;
    let dataIndex = -1;

    // O(1) item lookup via Map (replaces O(n) linear scan)
    const existingIndex = this._itemIndexMap.get(item);
    if (existingIndex !== undefined) {
      dataIndex = existingIndex;
    }

    if (dataIndex < 0) {
      dataIndex = this.#data.items.length;
      this.#data.items.push(item);
      this._itemIndexMap.set(item, dataIndex);
      this._processedPathsCache = undefined;
    }

    let hasAdvanced = true;
    while (keyIndex < key.length && hasAdvanced) {
      hasAdvanced = false;
      if (!Array.isArray(curNode)) {
        for (const item in curNode) {
          // we've found part of our string in this node
          if (item.startsWith(key[keyIndex]) && curNode[item] !== undefined) {
            // && curNode[item].constructor !== Array) {
            let itemIndex = 0;
            hasAdvanced = true;
            curNodeIndex = item;
            parentNode = curNode;
            curNode = curNode[item];

            while (keyIndex < key.length && itemIndex < item.length && item[itemIndex] === key[keyIndex]) {
              itemIndex++;
              keyIndex++;
            }

            // if we're in the middle of a string like "subset", and we're trying add the word "subpar",
            // create a new node called "sub" and place "set" underneath it.
            // also support the case where we're adding "sub" but "subset" already exists (keyIndex === key.length)
            if (item[itemIndex] !== key[keyIndex] && itemIndex < item.length && keyIndex <= key.length) {
              parentNode[curNodeIndex] = undefined;
              curNodeIndex = item.substring(0, itemIndex);

              let newNode: any = {};

              parentNode[curNodeIndex] = newNode;

              const term = item.substring(itemIndex);

              if (Utilities.isUsableAsObjectKey(term)) {
                newNode[term] = curNode;
              }

              curNode = newNode;
            }

            break;
          }
        }
      }
    }

    // we've reached the end of the trie; we need to add a new node
    if (keyIndex < key.length) {
      // if parent node was a leaf array, switch to an object
      if (Array.isArray(curNode) && curNodeIndex) {
        parentNode[curNodeIndex] = {};
        parentNode[curNodeIndex]["±"] = curNode;

        curNode = parentNode[curNodeIndex];
      }

      const substr = key.substring(keyIndex);

      if (substr !== "±") {
        if (Utilities.isUsableAsObjectKey(substr)) {
          // create a new leaf array
          curNode[substr] = this.ensureAnnotatedContentInArray([], dataIndex, annotationChar);
        }
      }
    } else {
      if (Array.isArray(curNode) && curNodeIndex) {
        if (Utilities.isUsableAsObjectKey(curNodeIndex)) {
          parentNode[curNodeIndex] = this.ensureAnnotatedContentInArray(curNode, dataIndex, annotationChar);
        }
      } else {
        if (curNode["±"] === undefined) {
          curNode["±"] = [];
        }

        curNode["±"] = this.ensureAnnotatedContentInArray(curNode["±"], dataIndex, annotationChar);
      }
    }
  }

  ensureAnnotatedContentInArray(arr: (IAnnotatedIndexData | number)[], dataIndex: number, annotationChar?: string) {
    try {
      for (const item of arr) {
        if (typeof item === "object") {
          if ((item as IAnnotatedIndexData).n === dataIndex) {
            if (annotationChar) {
              if (!(item as IAnnotatedIndexData).a) {
                (item as IAnnotatedIndexData).a = annotationChar;
              } else {
                if ((item as IAnnotatedIndexData).a.indexOf(annotationChar) < 0) {
                  (item as IAnnotatedIndexData).a += annotationChar;
                }
              }
            }

            return arr;
          }
        } else if (item === dataIndex) {
          if (!annotationChar) {
            return arr;
          }

          // convert simple number to annotated object
          const newArr = [];

          for (const existItem of arr) {
            if (existItem !== dataIndex) {
              newArr.push(existItem);
            }
          }

          newArr.push({ n: dataIndex, a: annotationChar });

          return newArr;
        }
      }

      if (annotationChar) {
        arr.push({ n: dataIndex, a: annotationChar });
      } else {
        arr.push(dataIndex);
      }
    } catch (e) {
      Log.verbose("Error ensuring annotated content: " + e + "|" + arr + "|" + JSON.stringify(arr));
    }

    return arr;
  }

  parseJsContent(sourcePath: string, content: string) {
    try {
      const results = esprima.tokenize(content);

      if (results) {
        for (const token of results) {
          if (token.type === "Identifier" && token.value && token.value.length > 3) {
            if (token.value !== "from") {
              this.insert(token.value.toLowerCase(), sourcePath, "S");
            }
          }
        }
      }
    } catch (e) {
      Log.debugAlert("JS parsing error:" + e);
    }
  }

  parseTextContent(sourcePath: string, content: string) {
    const dictionaryOfTerms: { [term: string]: boolean | undefined } = {};

    let curWord = "";

    content = content.toLowerCase();

    for (let i = 0; i < content.length; i++) {
      const curChar = content[i];

      if (
        curChar === "{" ||
        curChar === "}" ||
        curChar === " " ||
        curChar === "\r" ||
        curChar === "\n" ||
        curChar === "\t" ||
        curChar === "(" ||
        curChar === ")" ||
        curChar === "[" ||
        curChar === "]" ||
        curChar === ":" ||
        curChar === '"' ||
        curChar === "'"
      ) {
        if (curWord.length > 0) {
          if (curWord.length > 3 && !Utilities.isNumericIsh(curWord) && Utilities.isUsableAsObjectKey(curWord)) {
            dictionaryOfTerms[curWord] = true;
          }
          curWord = "";
        }
      } else {
        curWord += content[i];
      }
    }

    for (const term in dictionaryOfTerms) {
      this.insert(term, sourcePath);
    }
  }

  parseJsonContent(sourcePath: string, content: string) {
    const dictionaryOfTerms: { [term: string]: boolean | undefined } = {};

    let curWord = "";

    content = content.toLowerCase();

    for (let i = 0; i < content.length; i++) {
      const curChar = content[i];

      if (
        curChar === "{" ||
        curChar === "}" ||
        curChar === " " ||
        curChar === "\r" ||
        curChar === "\n" ||
        curChar === "\t" ||
        curChar === "(" ||
        curChar === ")" ||
        curChar === "[" ||
        curChar === "]" ||
        curChar === ":" ||
        curChar === '"' ||
        curChar === "'"
      ) {
        if (curWord.length > 0) {
          if (curWord.length > 3 && !Utilities.isNumericIsh(curWord) && Utilities.isUsableAsObjectKey(curWord)) {
            dictionaryOfTerms[curWord] = true;
          }
          curWord = "";
        }
      } else {
        curWord += content[i];
      }
    }

    for (const term in dictionaryOfTerms) {
      this.insert(term, sourcePath);
    }
  }

  /**
   * Extracts indexable tokens from a parsed JSON object by recursively walking keys and string values.
   * Much faster than parseJsonContent which does character-by-character text tokenization.
   * Only processes keys and string values (the same tokens that parseJsonContent would find).
   */
  indexJsonObject(sourcePath: string, data: object) {
    const terms = new Set<string>();

    const depthExceeded = ContentIndex._collectJsonTerms(data, terms, 0);

    if (depthExceeded) {
      Log.debug(
        "ContentIndex: JSON nesting depth exceeded " +
          ContentIndex.MAX_JSON_DEPTH +
          " in '" +
          sourcePath +
          "'; skipping deeper levels."
      );
    }

    for (const term of terms) {
      this.insert(term, sourcePath);
    }
  }

  /**
   * Recursively collects indexable terms (keys and string values) from a parsed JSON object.
   */
  /** Max nesting depth for JSON term collection. Most Minecraft JSON stays under 10 levels, but features can reach ~25. */
  private static readonly MAX_JSON_DEPTH = 30;

  private static _collectJsonTerms(obj: any, terms: Set<string>, depth: number): boolean {
    if (obj === null || obj === undefined) {
      return false;
    }

    if (depth > ContentIndex.MAX_JSON_DEPTH) {
      return true;
    }

    if (typeof obj === "string") {
      ContentIndex._addStringTerms(obj, terms);
      return false;
    }

    // Numbers, booleans, and other primitives are not indexable terms — skip them.
    if (typeof obj !== "object") {
      return false;
    }

    let exceeded = false;

    if (Array.isArray(obj)) {
      for (const item of obj) {
        if (ContentIndex._collectJsonTerms(item, terms, depth + 1)) {
          exceeded = true;
        }
      }
      return exceeded;
    }

    for (const key in obj) {
      // Index the key itself
      const lowerKey = key.toLowerCase();
      if (lowerKey.length > 3 && !Utilities.isNumericIsh(lowerKey) && Utilities.isUsableAsObjectKey(lowerKey)) {
        terms.add(lowerKey);
      }

      // Recurse into values
      const val = obj[key];
      if (val !== null && val !== undefined) {
        if (ContentIndex._collectJsonTerms(val, terms, depth + 1)) {
          exceeded = true;
        }
      }
    }

    return exceeded;
  }

  /**
   * Splits a string on common delimiters and adds qualifying terms.
   * Matches the same tokenization logic as parseJsonContent's character loop.
   */
  /** Characters that act as word boundaries when tokenizing strings for indexing. */
  private static readonly TERM_DELIMITERS = new Set([
    "{",
    "}",
    " ",
    "\r",
    "\n",
    "\t",
    "(",
    ")",
    "[",
    "]",
    ":",
    '"',
    "'",
  ]);

  private static _addStringTerms(str: string, terms: Set<string>) {
    const lower = str.toLowerCase();
    let curWord = "";

    for (let i = 0; i < lower.length; i++) {
      const c = lower[i];
      if (ContentIndex.TERM_DELIMITERS.has(c)) {
        if (curWord.length > 3 && !Utilities.isNumericIsh(curWord) && Utilities.isUsableAsObjectKey(curWord)) {
          terms.add(curWord);
        }
        curWord = "";
      } else {
        curWord += c;
      }
    }
    if (curWord.length > 3 && !Utilities.isNumericIsh(curWord) && Utilities.isUsableAsObjectKey(curWord)) {
      terms.add(curWord);
    }
  }
}
