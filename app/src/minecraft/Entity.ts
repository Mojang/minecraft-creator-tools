// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import Location from "./Location";
import Log from "./../core/Log";
import ComponentizedBase from "./ComponentizedBase";
import NbtBinaryTag from "./NbtBinaryTag";
import Rotation from "./Rotation";
import IPropertyObject from "../dataform/IPropertyObject";
import IProperty from "./../dataform/IProperty";
import { EventDispatcher } from "ste-events";
import ComponentProperty from "./ComponentProperty";

export default class Entity extends ComponentizedBase implements IPropertyObject {
  _typeId: string = "";

  location: Location = new Location(null, null, null);
  rotation: Rotation = new Rotation(null, null);
  tags: string[] = [];
  definitions: string[] = [];

  private _onPropertyChanged = new EventDispatcher<Entity, IProperty>();

  public get onPropertyChanged() {
    return this._onPropertyChanged.asEvent();
  }

  get typeId() {
    return this._typeId;
  }

  set typeId(newTypeId: string) {
    this._typeId = newTypeId;
  }

  public getProperty(name: string) {
    return this.getComponentProperty(name);
  }

  public ensureProperty(name: string) {
    return this.addComponentProperty(name);
  }

  public addProperty(name: string) {
    return this.addComponentProperty(name);
  }

  notifyComponentPropertyChanged(property: ComponentProperty) {
    this._onPropertyChanged.dispatch(this, property);
  }

  loadDefinitionsFromNbtTag(tagsTag: NbtBinaryTag) {
    const entityDefinitionChildren = tagsTag.getTagChildren();

    const newDefinitions: string[] = [];

    for (let i = 0; i < entityDefinitionChildren.length; i++) {
      const definitionChild = entityDefinitionChildren[i];

      newDefinitions.push(definitionChild.valueAsString);
    }

    this.definitions = newDefinitions;
  }

  loadTagsFromNbtTag(tagsTag: NbtBinaryTag) {
    const entityTagChildren = tagsTag.getTagChildren();

    const newTags: string[] = [];

    for (let i = 0; i < entityTagChildren.length; i++) {
      const tagChild = entityTagChildren[i];

      newTags.push(tagChild.valueAsString);
    }

    this.tags = newTags;
  }

  loadRotationFromNbtTag(rotationTag: NbtBinaryTag) {
    const entityRotChildren = rotationTag.getTagChildren();

    if (entityRotChildren.length === 2) {
      this.rotation.yaw = entityRotChildren[0].valueAsFloat;
      this.rotation.pitch = entityRotChildren[1].valueAsFloat;
    } else {
      Log.debugAlert("Unexpected rotation");
    }
  }

  loadLocationFromNbtTag(locationTag: NbtBinaryTag) {
    const tagChildren = locationTag.getTagChildren();

    if (tagChildren.length === 3) {
      this.location.x = tagChildren[0].valueAsFloat;
      this.location.y = tagChildren[1].valueAsFloat;
      this.location.z = tagChildren[2].valueAsFloat;
    } else {
      Log.debugAlert("Unexpected pos");
    }
  }
}
