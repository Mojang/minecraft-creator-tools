// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ProjectInfoItem from "./ProjectInfoItem";
import ProjectItem from "../app/ProjectItem";
import IProjectInfoItemGenerator from "./IProjectItemInfoGenerator";
import CreatorToolsHost from "../app/CreatorToolsHost";

import axios from "axios";
import ProjectInfoSet from "./ProjectInfoSet";
import Utilities from "../core/Utilities";
import ContentIndex from "../core/ContentIndex";
import Database from "../minecraft/Database";
import { InfoItemType } from "./IInfoItemData";
import DataFormValidator, { IValidationContext } from "../dataform/DataFormValidator";
import StorageUtilities from "../storage/StorageUtilities";
import ProjectItemUtilities from "../app/ProjectItemUtilities";
import { ProjectItemType } from "../app/IProjectItemData";
import IFormDefinition from "../dataform/IFormDefinition";

export enum FormSchemaItemInfoGeneratorTest {
  couldNotParseJson = 401,
  couldNotFindForm = 402,
}

/**
 * Validates JSON files against Minecraft documentation-based form schemas.
 *
 * @see {@link ../../public/data/forms/mctoolsval/jsonf.form.json} for topic definitions
 */
export default class FormSchemaItemInfoGenerator implements IProjectInfoItemGenerator {
  id = "JSONF";
  title = "JSON Structure";
  canAlwaysProcess = true;

  _schemaContentByPath: { [id: string]: object } = {};

  /**
   * Cache of loaded form definitions keyed by formPath.
   * Avoids redundant Database.ensureFormLoadedByPath() calls for items sharing the same form.
   *
   * Lifecycle: This generator is instantiated once per validation run by GeneratorRegistrations.
   * Caches are valid for the duration of a single ProjectInfoSet.generate() call and are
   * naturally discarded when the generator instance is garbage-collected after the run.
   */
  _formCache: Map<string, IFormDefinition | null> = new Map();

  /**
   * Cache of validation contexts keyed by formPath.
   * Items with the same form share a subForm cache, avoiding repeated async subForm lookups.
   *
   * Lifecycle: Same as _formCache — scoped to a single validation run.
   */
  _contextCache: Map<string, IValidationContext> = new Map();

  uuidRegex = new RegExp("[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}");

  constructor() {
    this.testUuid = this.testUuid.bind(this);
    this.testUri = this.testUri.bind(this);
  }

  summarize(info: any, infoSet: ProjectInfoSet) {}

  async loadSchema(uri: string) {
    const res = await axios.get(Utilities.ensureEndsWithSlash(CreatorToolsHost.contentWebRoot) + uri);

    return res.data;
  }

  async generate(projectItem: ProjectItem, contentIndex: ContentIndex): Promise<ProjectInfoItem[]> {
    const items: ProjectInfoItem[] = [];

    // Fast path: skip items that can never have a form.
    // getFormPathForType returns undefined for most item types (textures, audio, etc.).
    // Only geometry items need special logic via getFormPath().
    if (
      projectItem.itemType !== ProjectItemType.modelGeometryJson &&
      ProjectItemUtilities.getFormPathForType(projectItem.itemType) === undefined
    ) {
      return items;
    }

    if (
      projectItem.primaryFile &&
      projectItem.primaryFile.content &&
      typeof projectItem.primaryFile.content === "string"
    ) {
      const formPath = projectItem.getFormPath();

      if (formPath) {
        // Use cached form definition to avoid repeated Database lookups
        let form: IFormDefinition | null | undefined = this._formCache.get(formPath);
        if (form === undefined) {
          const loaded = await Database.ensureFormLoadedByPath(formPath);
          form = loaded || null;
          this._formCache.set(formPath, form);
        }

        if (form) {
          const data = StorageUtilities.getJsonObject(projectItem.primaryFile);

          if (!data) {
            items.push(
              new ProjectInfoItem(
                InfoItemType.error,
                this.id,
                FormSchemaItemInfoGeneratorTest.couldNotParseJson,
                "Could not parse JSON. " +
                  (projectItem.primaryFile.errorStateMessage ? projectItem.primaryFile.errorStateMessage : ""),
                projectItem,
                formPath
              )
            );
          } else {
            // Share validation context (and its subForm cache) across items
            // with the same formPath for massive speedup on repeated forms.
            let context = this._contextCache.get(formPath);
            if (!context) {
              context = {
                depth: 0,
                subFormCache: new Map<string, IFormDefinition | null>(),
              };
              this._contextCache.set(formPath, context);
            }

            // Reset depth for each new item (subFormCache is intentionally preserved)
            const itemContext: IValidationContext = {
              depth: 0,
              subFormCache: context.subFormCache,
            };

            const results = await DataFormValidator.validate(data, form, undefined, undefined, itemContext);

            if (results) {
              for (const result of results) {
                items.push(
                  new ProjectInfoItem(InfoItemType.warning, this.id, result.type, result.message, projectItem)
                );
              }
            }
          }
        } else {
          items.push(
            new ProjectInfoItem(
              InfoItemType.internalProcessingError,
              this.id,
              FormSchemaItemInfoGeneratorTest.couldNotFindForm,
              "Could not find expected form",
              undefined,
              formPath
            )
          );
        }
      }
    }

    return items;
  }

  testUuid(uuidString: string) {
    return this.uuidRegex.test(uuidString);
  }

  testUnknownFormat(formatString: string) {
    return true;
  }

  testUri(uriString: string) {
    // could get much more sophisticated here...
    return uriString.indexOf("://") >= 0;
  }
}
