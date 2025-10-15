// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import StorageUtilities from "../storage/StorageUtilities";
import Log from "./Log";
import * as md5 from "js-md5";
import * as JSONC from "jsonc-parser";

export interface IHashCatalogEntry {
  fileName: string;
  propertyName: string;
  filePath?: string;
}

export type HashCatalog = { [hash: string]: IHashCatalogEntry };

export default class HashUtilities {
  /**
   * Generates hash catalog entries for a file (both complete file hash and property hashes for JSON files)
   * @param file The file to generate hashes for
   * @param filePath The file path to store in the catalog entry
   * @param hashCatalog The hash catalog to populate
   * @param onError Optional error callback for handling errors
   */
  static async addHashesForFile(hashCatalog: HashCatalog, file: IFile, filePath: string): Promise<void> {
    try {
      // Complete file hash with filename included
      await file.loadContent();
      if (file.content !== null && file.content !== undefined) {
        const fileHash = await file.getHash();

        if (fileHash) {
          hashCatalog[fileHash] = {
            fileName: file.name,
            propertyName: "",
            filePath: filePath,
          };
        }
      }

      // Property hashes for JSON files
      if (file.name.endsWith(".json")) {
        await file.loadContent();
        if (file.isString && typeof file.content === "string") {
          try {
            // Check for BOM and handle it properly
            const bytes = StorageUtilities.getContentsAsBinary(file);
            const hasBOM = StorageUtilities.hasUTF8ByteOrderMark(bytes);

            let cleanContent = file.content;
            if (hasBOM && bytes) {
              // Convert back to string without BOM
              const withoutBOM = bytes.slice(3); // Remove the 3-byte UTF-8 BOM
              cleanContent = new TextDecoder("utf-8").decode(withoutBOM);
            }

            // Parse as JSONC (handles both JSON and JSON with comments)
            const jsonContent = JSONC.parse(cleanContent);

            // Process each top-level property
            for (const key in jsonContent) {
              const value = jsonContent[key];

              if (value !== null && !key.includes(":") && typeof value === "object") {
                const stringifiedObj = JSON.stringify(value);
                const stringifiedObjAndKey = stringifiedObj + key;

                const propertyHash = md5.md5(stringifiedObjAndKey).toLowerCase();

                hashCatalog[propertyHash] = {
                  fileName: file.name,
                  propertyName: key,
                  filePath: filePath,
                };
              }
            }
          } catch (error) {
            Log.verbose(`Skipping property hash generation for ${file.fullPath}: ${error}`);
          }
        }
      }
    } catch (error) {
      Log.verbose(`Skipping property hash generation for ${file.fullPath}: ${error}`);
    }
  }
}
