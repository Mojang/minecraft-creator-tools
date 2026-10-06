/**
 * CliLogo - The creeper-face logo at the top of `mct --help`
 *
 * GEOMETRY:
 * LOGO_FACE is a 10x10 logical grid: two-pixel eyes two pixels apart, a centered bridge, a stepped
 * mouth, and a notch at the bottom. The face spans 6 of 10 pixels (60%) with two pixels of green
 * padding on every side. LOGO_TEXTURE marks darker patches of the green background; the face is
 * always solid black with crisp edges. Both grids are fixed, so every render is identical.
 *
 * SQUARE PIXELS:
 * Terminal cells are about twice as tall as they are wide, so a logical pixel is either:
 * - "compact" (used by help): one column by half a row. `▀` puts the top pixel in the foreground
 *   color and the bottom pixel in the background color; a cell whose two pixels match is a
 *   colored space. 10x5 cells.
 * - "standard": two columns by one row, colored spaces only. 20x10 cells, pure ASCII.
 * Both fill every cell edge to edge, so there are no gaps and no outline.
 *
 * COLOR MODES (all share the same geometry):
 * - 24-bit: base green #52A535, texture #4A9530, face #000000.
 * - 256 colors: 71 (#5FAF5F) and 65 (#5F875F), one step apart in the same hue, with 16 (#000000)
 *   for the face; entry 0 is theme-controlled and often dark gray. The palette's green channel
 *   jumps 135 -> 175, so no pair is as subtle as the 24-bit texture. Of the candidates compared
 *   side by side, 71/65 was the most cohesive: 70/64 shifts to lime, 34/28 is too saturated, and
 *   pairing a base with 28 makes the texture too contrasty.
 * - 16 colors: normal ANSI green and normal ANSI black (not bright black, which many themes draw
 *   as dark gray). The only other green is bright green, which is lighter and far too harsh for
 *   texture, so the background is flat. Exact colors depend on the terminal theme.
 * - Below 16 colors (pipes, NO_COLOR): no logo; CommandHelpWriter prints a plain title instead.
 *
 * SAFETY:
 * - Every line ends with a reset, so color never bleeds past the logo.
 * - SGR codes are emitted only when a color changes, keeping each line short.
 * - `▀` (compact only) is East Asian "ambiguous width" and can render double-width in some CJK
 *   terminal configurations; the "standard" scale avoids it at twice the size.
 */

/** `#` = face, `.` = green background. Exactly the reference layout. */
// prettier-ignore
export const LOGO_FACE: readonly string[] = [
  "..........",
  "..........",
  "..##..##..",
  "..##..##..",
  "....##....",
  "...####...",
  "...####...",
  "...#..#...",
  "..........",
  "..........",
];

/** `d` = darker green patch, `.` = base green. Ignored under the face. Deterministic by design. */
// prettier-ignore
export const LOGO_TEXTURE: readonly string[] = [
  "d...dd....",
  "..d....d..",
  ".....d...d",
  "d.........",
  "d..d......",
  ".........d",
  ".d........",
  "........d.",
  "..d...dd..",
  "d...d.....",
];

export type LogoScale = "compact" | "standard";

/** A logical pixel's color role. */
type Tone = "base" | "texture" | "face";

const RGB: Record<Tone, readonly [number, number, number]> = {
  base: [0x52, 0xa5, 0x35],
  texture: [0x4a, 0x95, 0x30],
  face: [0, 0, 0],
};

/** xterm-256 entries; see COLOR MODES above for why these. */
const XTERM_256: Record<Tone, number> = { base: 71, texture: 65, face: 16 };

/** SGR foreground codes for the 16 basic colors (backgrounds add 10). Texture is flat here. */
const BASIC_16: Record<Tone, number> = { base: 32, texture: 32, face: 30 };

const ESC = "\x1b[";
const RESET = `${ESC}0m`;
const UPPER_HALF_BLOCK = "▀";

/** Terminal columns the logo occupies at `scale`. */
export function getLogoWidth(scale: LogoScale = "compact"): number {
  return LOGO_FACE[0].length * (scale === "compact" ? 1 : 2);
}

/** The color role of the logical pixel at (x, y). */
export function getLogoTone(x: number, y: number): Tone {
  if (LOGO_FACE[y][x] === "#") {
    return "face";
  }

  return LOGO_TEXTURE[y][x] === "d" ? "texture" : "base";
}

/**
 * Renders the logo as lines of ANSI-colored text.
 * @param colorDepth Terminal color depth in bits: 24 (truecolor), 8 (256 colors), 4 (16 colors),
 * or 1 (no color), which renders no lines.
 */
export function renderLogo(colorDepth: number, scale: LogoScale = "compact"): string[] {
  if (colorDepth < 4) {
    return [];
  }

  const lines: string[] = [];
  const size = LOGO_FACE.length;

  if (scale === "standard") {
    for (let y = 0; y < size; y++) {
      const line = new SgrLine(colorDepth);
      for (let x = 0; x < size; x++) {
        line.cell(undefined, getLogoTone(x, y), "  ");
      }
      lines.push(line.end());
    }

    return lines;
  }

  for (let y = 0; y < size; y += 2) {
    const line = new SgrLine(colorDepth);
    for (let x = 0; x < size; x++) {
      const top = getLogoTone(x, y);
      const bottom = getLogoTone(x, y + 1);

      if (tonesMatch(top, bottom, colorDepth)) {
        line.cell(undefined, bottom, " ");
      } else {
        line.cell(top, bottom, UPPER_HALF_BLOCK);
      }
    }
    lines.push(line.end());
  }

  return lines;
}

/** Whether two tones render as the same color at this depth (texture is flat in 16 colors). */
function tonesMatch(a: Tone, b: Tone, depth: number): boolean {
  return colorCode(a, depth) === colorCode(b, depth);
}

function colorCode(tone: Tone, depth: number): string {
  if (depth >= 24) {
    return `2;${RGB[tone].join(";")}`;
  }

  if (depth >= 8) {
    return `5;${XTERM_256[tone]}`;
  }

  return `${BASIC_16[tone]}`;
}

/** Builds one line of cells, emitting SGR codes only when the foreground or background changes. */
class SgrLine {
  private text = "";
  private fg?: string;
  private bg?: string;

  constructor(private readonly depth: number) {}

  cell(fg: Tone | undefined, bg: Tone, glyph: string): void {
    const bgCode = colorCode(bg, this.depth);
    if (bgCode !== this.bg) {
      this.text += this.depth >= 8 ? `${ESC}48;${bgCode}m` : `${ESC}${BASIC_16[bg] + 10}m`;
      this.bg = bgCode;
    }

    if (fg !== undefined) {
      const fgCode = colorCode(fg, this.depth);
      if (fgCode !== this.fg) {
        this.text += this.depth >= 8 ? `${ESC}38;${fgCode}m` : `${ESC}${BASIC_16[fg]}m`;
        this.fg = fgCode;
      }
    }

    this.text += glyph;
  }

  end(): string {
    return this.text + RESET;
  }
}
