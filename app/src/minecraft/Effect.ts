/**
 * Represents an effect - like poison - that has been added to
 * an Entity.
 */
export default class Effect {
  /**
   * Gets an amplifier that may have been applied to this effect.
   * Sample values range typically from 0 to 4. Example: The
   * effect 'Jump Boost II' will have an amplifier value of 1.
   */
  readonly "amplifier": number;
  /**
   * Gets the player-friendly name of this effect.
   */
  readonly "displayName": string;
  /**
   * Gets the entire specified duration, in seconds, of this
   * effect.
   */
  readonly "duration": number;
}
