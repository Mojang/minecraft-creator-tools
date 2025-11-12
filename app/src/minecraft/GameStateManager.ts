// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import CreatorTools from "../app/CreatorTools";
import IPlayerTravelledEvent from "./IPlayerTravelledEvent";
import Location from "./Location";
import { EventDispatcher } from "ste-events";
import IItemInteractedEvent from "./IItemInteractedEvent";
import IBlockBrokenEvent from "./IBlockBrokenEvent";
import Log from "../core/Log";

export default class GameStateManager {
  _playerLocation: Location | undefined;
  _playerLocationHistory: Location[] = [];
  _playerLocationHistoryTimes: Date[] = [];

  _itemInteractedLocationHistory: Location[] = [];
  _itemInteractedLocationHistoryTimes: Date[] = [];

  _playerMajorLocationHistory: Location[] = [];
  _playerMajorLocationHistoryTimes: Date[] = [];
  curTick = 0;
  pendingLocationChangeProcess = -1;
  _lastPlayerTravelledMessage: IPlayerTravelledEvent | undefined;

  _eventsSeen: { [name: string]: boolean } = {};

  private _onPlayerTravelled = new EventDispatcher<GameStateManager, IPlayerTravelledEvent>();
  private _onItemInteracted = new EventDispatcher<GameStateManager, IItemInteractedEvent>();
  private _onBlockBroken = new EventDispatcher<GameStateManager, IBlockBrokenEvent>();
  private _onPlayerMajorTravelled = new EventDispatcher<GameStateManager, IPlayerTravelledEvent>();

  public get playerMajorLocationHistory() {
    return this._playerMajorLocationHistory;
  }

  public get playerLocationHistory() {
    return this._playerLocationHistory;
  }

  public get itemInteractedHistory() {
    return this._itemInteractedLocationHistory;
  }

  public get playerLocation() {
    return this._playerLocation;
  }

  public get onPlayerTravelled() {
    return this._onPlayerTravelled.asEvent();
  }

  public get onPlayerMajorTravelled() {
    return this._onPlayerMajorTravelled.asEvent();
  }

  public get onItemInteracted() {
    return this._onItemInteracted.asEvent();
  }

  public get onBlockBroken() {
    return this._onBlockBroken.asEvent();
  }

  constructor(creatorTools: CreatorTools) {
    this._tick = this._tick.bind(this);

    // @ts-ignore
    if (typeof window !== "undefined") {
      // @ts-ignore
      window.setInterval(this._tick, 50);
    }
  }

  _tick() {
    const thisTick = this.curTick++;

    // record the last stop if the player stops moving for 3 seconds.
    if (this.pendingLocationChangeProcess === thisTick && this._lastPlayerTravelledMessage) {
      this.pendingLocationChangeProcess = -1;

      const location = this._playerLocationHistory[this._playerLocationHistory.length - 1];
      const date = this._playerMajorLocationHistoryTimes[this._playerMajorLocationHistoryTimes.length - 1];

      this._playerMajorLocationHistory.push(location);
      this._playerMajorLocationHistoryTimes.push(date);

      this._onPlayerMajorTravelled.dispatch(this, this._lastPlayerTravelledMessage);
    }
  }

  handleEvent(message: any) {
    if (!message.header) {
      return;
    }

    const eventId = message.eventId;

    if (eventId) {
      if (this._eventsSeen[eventId] === true) {
        return;
      }

      this._eventsSeen[eventId] = true;
    }

    const eventName = message.header.eventName;

    if (!eventName) {
      return;
    }

    switch (eventName) {
      case "BlockBroken":
        const blockBrokenMessage = message as IBlockBrokenEvent;

        this._onBlockBroken.dispatch(this, blockBrokenMessage);
        break;
      case "ItemInteracted":
        const itemInteractedMessage = message as IItemInteractedEvent;

        const interactedEventTime = new Date();
        let itemInteractedLocation = new Location(0, 0, 0);

        if (this._lastPlayerTravelledMessage) {
          itemInteractedLocation = new Location(
            this._lastPlayerTravelledMessage.body.player.position.x,
            this._lastPlayerTravelledMessage.body.player.position.y,
            this._lastPlayerTravelledMessage.body.player.position.z
          );
        }

        this._itemInteractedLocationHistory.push(itemInteractedLocation);
        this._itemInteractedLocationHistoryTimes.push(interactedEventTime);

        this._onItemInteracted.dispatch(this, itemInteractedMessage);
        Log.verbose("Item was interacted");

        break;
      case "PlayerTravelled":
        const playerMessage = message as IPlayerTravelledEvent;

        const location = new Location(
          playerMessage.body.player.position.x,
          playerMessage.body.player.position.y,
          playerMessage.body.player.position.z
        );

        const eventTime = new Date();
        this._lastPlayerTravelledMessage = playerMessage;

        this._playerLocationHistory.push(location);
        this._playerLocationHistoryTimes.push(eventTime);

        this._playerLocation = location;

        this._onPlayerTravelled.dispatch(this, playerMessage);

        let pushMajorLocationChange = false;

        if (this._playerMajorLocationHistory.length === 0) {
          pushMajorLocationChange = true;
        } else {
          const lastMajorLocation = this._playerMajorLocationHistory[this._playerMajorLocationHistory.length - 1];

          if (location.distanceTo(lastMajorLocation) > 2) {
            pushMajorLocationChange = true;
          }
        }

        if (pushMajorLocationChange) {
          this._playerMajorLocationHistory.push(location);
          this._playerMajorLocationHistoryTimes.push(eventTime);

          this._onPlayerMajorTravelled.dispatch(this, playerMessage);
        } else {
          // record the last stop if the player stops moving for 3 seconds.
          this.pendingLocationChangeProcess = this.curTick + 60;
        }

        break;
    }
  }
}
