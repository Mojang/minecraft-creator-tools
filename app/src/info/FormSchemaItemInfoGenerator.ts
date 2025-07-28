// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ProjectInfoItem from "./ProjectInfoItem";
import ProjectItem from "../app/ProjectItem";
import IProjectInfoItemGenerator from "./IProjectItemInfoGenerator";
import CartoApp from "../app/CartoApp";

import axios from "axios";
import ProjectInfoSet from "./ProjectInfoSet";
import Utilities from "../core/Utilities";
import ContentIndex from "../core/ContentIndex";
import Database from "../minecraft/Database";
import { InfoItemType } from "./IInfoItemData";
import DataFormValidator from "../dataform/DataFormValidator";
import StorageUtilities from "../storage/StorageUtilities";

export enum FormSchemaItemInfoGeneratorTest {
  couldNotParseJson = 401,
  couldNotFindForm = 402,
}

export default class FormSchemaItemInfoGenerator implements IProjectInfoItemGenerator {
  id = "JSONF";
  title = "JSON Structure Validation (via Minecraft docs)";
  canAlwaysProcess = true;

  _schemaContentByPath: { [id: string]: object } = {};

  uuidRegex = new RegExp("[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}");

  constructor() {
    this.testUuid = this.testUuid.bind(this);
    this.testUri = this.testUri.bind(this);
  }

  getTopicData(topicId: number) {
    return {
      title: topicId.toString(),
    };
  }

  summarize(info: any, infoSet: ProjectInfoSet) {}

  async loadSchema(uri: string) {
    console.log("Retrieving " + uri);
    const res = await axios.get(Utilities.ensureEndsWithSlash(CartoApp.contentRoot) + uri);

    console.log("Loading error: " + JSON.stringify(res.data));
    return res.data;
  }

  async generate(projectItem: ProjectItem, contentIndex: ContentIndex): Promise<ProjectInfoItem[]> {
    const items: ProjectInfoItem[] = [];

    if (
      projectItem.primaryFile &&
      projectItem.primaryFile.content &&
      typeof projectItem.primaryFile.content === "string"
    ) {
      const formPath = projectItem.getFormPath();

      if (formPath) {
        const form = await Database.ensureFormLoadedByPath(formPath);

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
            const results = await DataFormValidator.validate(data, form);

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
