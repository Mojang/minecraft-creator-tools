// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Compact text encoding of a dense block volume, for showing an agent the
 * current contents of a structure so it can write an edit program.
 *
 * Format:
 * ```
 * palette:
 *   . = minecraft:air
 *   a = minecraft:stone
 *   b = minecraft:oak_log {pillar_axis:y}
 * contents (y-layers bottom→top, rows are z, columns are x, run-length encoded):
 * y0: 5a / a3.a / 5a
 * y1: ...
 * ```
 * Air (and void) is always `.`. Other tokens get symbols `a-zA-Z` by
 * descending frequency; with more than 52 tokens every symbol is two letters
 * wide (and air is `..`). Each row is run-length encoded as `<count><symbol>`.
 * Cells use clipboard order `(y*sizeZ + z)*sizeX + x`.
 */

export const STRUCTURE_AIR_TOKEN = "minecraft:air";

const SYMBOL_ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const SYMBOL_BASE = SYMBOL_ALPHABET.length;
const CONTENTS_HEADER = "contents (y-layers bottom→top, rows are z, columns are x, run-length encoded):";

/** Dense block-token volume in clipboard order `(y*sizeZ + z)*sizeX + x`. */
export interface IDenseBlockVolume {
  readonly sizeX: number;
  readonly sizeY: number;
  readonly sizeZ: number;
  readonly tokens: readonly string[];
}

export default class StructureVolumeCodec {
  /** Agent-facing token: `name` or `name {k:v,k:v}` with sorted state keys. */
  static displayToken(name: string, states: Record<string, unknown> | undefined): string {
    if (!states) {
      return name;
    }
    const keys = Object.keys(states).sort();
    if (keys.length === 0) {
      return name;
    }
    return `${name} {${keys.map((k) => `${k}:${String(states[k])}`).join(",")}}`;
  }

  static encode(volume: IDenseBlockVolume): string {
    StructureVolumeCodec._validate(volume);

    const frequencies = new Map<string, number>();
    for (const token of volume.tokens) {
      if (token !== STRUCTURE_AIR_TOKEN) {
        frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
      }
    }

    const tokensByFrequency = [...frequencies.entries()]
      .sort(([tokenA, countA], [tokenB, countB]) => {
        if (countA !== countB) {
          return countB - countA;
        }
        return tokenA < tokenB ? -1 : tokenA > tokenB ? 1 : 0;
      })
      .map(([token]) => token);

    if (tokensByFrequency.length > SYMBOL_BASE * SYMBOL_BASE) {
      throw new Error(`Volume has too many distinct non-air blocks: ${tokensByFrequency.length}`);
    }
    const symbolWidth = tokensByFrequency.length <= SYMBOL_BASE ? 1 : 2;

    const palette: { symbol: string; token: string }[] = [
      { symbol: ".".repeat(symbolWidth), token: STRUCTURE_AIR_TOKEN },
      ...tokensByFrequency.map((token, index) => ({
        symbol: StructureVolumeCodec._symbolForIndex(index, symbolWidth),
        token,
      })),
    ];
    const symbolsByToken = new Map(palette.map(({ symbol, token }) => [token, symbol]));

    const lines = ["palette:", ...palette.map(({ symbol, token }) => `  ${symbol} = ${token}`), CONTENTS_HEADER];

    for (let y = 0; y < volume.sizeY; y++) {
      const rows: string[] = [];
      for (let z = 0; z < volume.sizeZ; z++) {
        rows.push(StructureVolumeCodec._encodeRow(volume, symbolsByToken, y, z));
      }
      lines.push(`y${y}: ${rows.join(" / ")}`);
    }

    return lines.join("\n");
  }

  static decode(encoded: string): IDenseBlockVolume {
    const lines = encoded.replace(/\r\n/g, "\n").split("\n");
    while (lines.length > 0 && lines[lines.length - 1] === "") {
      lines.pop();
    }

    if (lines[0] !== "palette:") {
      throw new Error("Encoded volume must start with 'palette:'");
    }

    let lineIndex = 1;
    const palette = new Map<string, string>();
    let symbolWidth = 0;

    for (; lineIndex < lines.length && lines[lineIndex] !== CONTENTS_HEADER; lineIndex++) {
      const match = /^ {2}([.A-Za-z]+) = (.*)$/.exec(lines[lineIndex]);
      if (!match) {
        throw new Error(`Invalid palette line: ${lines[lineIndex]}`);
      }
      const symbol = match[1];
      if (symbolWidth === 0) {
        symbolWidth = symbol.length;
      } else if (symbol.length !== symbolWidth) {
        throw new Error("Palette symbols must use one fixed width");
      }
      if (palette.has(symbol)) {
        throw new Error(`Duplicate palette symbol: ${symbol}`);
      }
      palette.set(symbol, match[2]);
    }

    if (lineIndex >= lines.length) {
      throw new Error("Encoded volume is missing the contents header");
    }
    if (symbolWidth !== 1 && symbolWidth !== 2) {
      throw new Error("Palette symbol width must be 1 or 2");
    }
    if (palette.get(".".repeat(symbolWidth)) !== STRUCTURE_AIR_TOKEN) {
      throw new Error("Palette is missing the required air symbol");
    }

    const tokens: string[] = [];
    let sizeX = 0;
    let sizeY = 0;
    let sizeZ = 0;

    for (lineIndex++; lineIndex < lines.length; lineIndex++) {
      const match = /^y(\d+): (.*)$/.exec(lines[lineIndex]);
      if (!match) {
        throw new Error(`Invalid layer line: ${lines[lineIndex]}`);
      }
      const y = parseInt(match[1], 10);
      if (y !== sizeY) {
        throw new Error(`Expected layer y${sizeY}, found y${y}`);
      }

      const rows = match[2].split(" / ");
      if (sizeZ === 0) {
        sizeZ = rows.length;
      } else if (rows.length !== sizeZ) {
        throw new Error("All layers must have the same row count");
      }

      for (const row of rows) {
        const rowTokens = StructureVolumeCodec._decodeRow(row, symbolWidth, palette);
        if (sizeX === 0) {
          sizeX = rowTokens.length;
        } else if (rowTokens.length !== sizeX) {
          throw new Error("All rows must have the same decoded length");
        }
        for (const token of rowTokens) {
          tokens.push(token);
        }
      }

      sizeY++;
    }

    if (sizeX === 0 || sizeY === 0 || sizeZ === 0) {
      throw new Error("Encoded volume must contain at least one non-empty layer");
    }

    return { sizeX, sizeY, sizeZ, tokens };
  }

  private static _validate(volume: IDenseBlockVolume): void {
    const dims: [string, number][] = [
      ["sizeX", volume.sizeX],
      ["sizeY", volume.sizeY],
      ["sizeZ", volume.sizeZ],
    ];
    for (const [name, value] of dims) {
      if (!Number.isInteger(value) || value <= 0) {
        throw new Error(`${name} must be a positive integer`);
      }
    }
    const expectedLength = volume.sizeX * volume.sizeY * volume.sizeZ;
    if (volume.tokens.length !== expectedLength) {
      throw new Error(`Volume token count ${volume.tokens.length} does not match size ${expectedLength}`);
    }
  }

  private static _symbolForIndex(index: number, width: number): string {
    if (width === 1) {
      return SYMBOL_ALPHABET[index];
    }
    return SYMBOL_ALPHABET[Math.floor(index / SYMBOL_BASE)] + SYMBOL_ALPHABET[index % SYMBOL_BASE];
  }

  private static _encodeRow(
    volume: IDenseBlockVolume,
    symbolsByToken: ReadonlyMap<string, string>,
    y: number,
    z: number
  ): string {
    const symbolAt = (x: number) => {
      const token = volume.tokens[(y * volume.sizeZ + z) * volume.sizeX + x];
      const symbol = symbolsByToken.get(token);
      if (symbol === undefined) {
        throw new Error(`Token is missing from palette: ${token}`);
      }
      return symbol;
    };
    const run = (count: number, symbol: string) => (count === 1 ? symbol : `${count}${symbol}`);

    let row = "";
    let runSymbol = symbolAt(0);
    let runLength = 1;
    for (let x = 1; x < volume.sizeX; x++) {
      const symbol = symbolAt(x);
      if (symbol === runSymbol) {
        runLength++;
      } else {
        row += run(runLength, runSymbol);
        runSymbol = symbol;
        runLength = 1;
      }
    }
    return row + run(runLength, runSymbol);
  }

  private static _decodeRow(row: string, symbolWidth: number, palette: ReadonlyMap<string, string>): string[] {
    const tokens: string[] = [];
    let cursor = 0;

    while (cursor < row.length) {
      const countStart = cursor;
      while (cursor < row.length && row[cursor] >= "0" && row[cursor] <= "9") {
        cursor++;
      }
      const count = countStart === cursor ? 1 : parseInt(row.slice(countStart, cursor), 10);
      if (!Number.isInteger(count) || count <= 0) {
        throw new Error(`Invalid run-length count in row: ${row}`);
      }

      const symbol = row.slice(cursor, cursor + symbolWidth);
      if (symbol.length !== symbolWidth) {
        throw new Error(`Truncated symbol in row: ${row}`);
      }
      cursor += symbolWidth;

      const token = palette.get(symbol);
      if (token === undefined) {
        throw new Error(`Unknown symbol: ${symbol}`);
      }
      for (let i = 0; i < count; i++) {
        tokens.push(token);
      }
    }

    return tokens;
  }
}
