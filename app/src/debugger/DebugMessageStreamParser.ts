// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { EventDispatcher, IEvent } from "ste-events";
import Log from "../core/Log";

/**
 * Parses the Minecraft debug protocol message stream.
 *
 * The protocol uses length-prefixed messages:
 * - 8 hex digits for length + newline (9 bytes total)
 * - JSON message body + newline
 *
 * Example:
 * ```
 * 00000042\n
 * {"type":"event","event":{"type":"StatEvent2",...}}\n
 * ```
 */
export default class DebugMessageStreamParser {
  private _buffer: Buffer = Buffer.alloc(0);
  private _expectedLength: number = -1;

  private _onMessage = new EventDispatcher<DebugMessageStreamParser, unknown>();
  private _onError = new EventDispatcher<DebugMessageStreamParser, Error>();

  public get onMessage(): IEvent<DebugMessageStreamParser, unknown> {
    return this._onMessage.asEvent();
  }

  public get onError(): IEvent<DebugMessageStreamParser, Error> {
    return this._onError.asEvent();
  }

  /**
   * Feed data from the socket into the parser.
   */
  public write(data: Buffer): void {
    // Append new data to buffer
    this._buffer = Buffer.concat([this._buffer, data]);

    // Process as many complete messages as possible
    while (this._processBuffer()) {
      // Continue processing
    }
  }

  /**
   * Process the buffer and extract a complete message if available.
   * Returns true if a message was processed (and we should continue checking).
   */
  private _processBuffer(): boolean {
    // If we don't know the expected length yet, try to read it
    if (this._expectedLength < 0) {
      // Need at least 9 bytes for length header (8 hex + newline)
      if (this._buffer.length < 9) {
        return false;
      }

      // Read the length header
      const lengthStr = this._buffer.subarray(0, 8).toString("ascii");
      const newline = this._buffer[8];

      if (newline !== 0x0a) {
        // Not a valid length header, report error
        this._onError.dispatch(this, new Error(`Invalid length header: expected newline, got ${newline}`));
        // Try to recover by finding next valid-looking header
        this._buffer = this._buffer.subarray(1);
        return true;
      }

      this._expectedLength = parseInt(lengthStr, 16);

      if (isNaN(this._expectedLength) || this._expectedLength < 0) {
        this._onError.dispatch(this, new Error(`Invalid length value: ${lengthStr}`));
        this._expectedLength = -1;
        this._buffer = this._buffer.subarray(9);
        return true;
      }

      // Remove length header from buffer
      this._buffer = this._buffer.subarray(9);
    }

    // Check if we have enough data for the message
    if (this._buffer.length < this._expectedLength) {
      return false;
    }

    // Extract the message (length includes trailing newline)
    const messageBytes = this._buffer.subarray(0, this._expectedLength);
    this._buffer = this._buffer.subarray(this._expectedLength);

    // Parse the JSON (trim trailing newline)
    const jsonStr = messageBytes.toString("utf8").trim();

    try {
      const message = JSON.parse(jsonStr);
      // Log raw message receipt (truncate large messages) - use verbose since this fires frequently
      const msgType = (message as any)?.type || "unknown";
      const eventType = (message as any)?.event?.type || "";
      const preview = jsonStr.length > 200 ? jsonStr.substring(0, 200) + "..." : jsonStr;
      Log.verbose(
        `[DebugParser] Received ${msgType}${eventType ? "/" + eventType : ""} (${jsonStr.length} bytes): ${preview}`
      );
      this._onMessage.dispatch(this, message);
    } catch (e) {
      Log.message(`[DebugParser] JSON parse error: ${e}`);
      this._onError.dispatch(this, new Error(`Failed to parse JSON message: ${e}`));
    }

    // Reset for next message
    this._expectedLength = -1;

    return true;
  }

  /**
   * Reset the parser state.
   */
  public reset(): void {
    this._buffer = Buffer.alloc(0);
    this._expectedLength = -1;
  }
}
