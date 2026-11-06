// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Finds absolute file system paths in free text so they can be redacted before
 * the text leaves the machine (copied diagnostics, MCP tool results).
 *
 * After a path root, everything is consumed up to a hard terminator (quote, |,
 * comma, semicolon, newline) or a sentence-ending period, so folder names that
 * contain spaces never leak as a partial segment. Over-consuming trailing words
 * is the accepted cost. Callers choose the replacement: `redactAbsolutePaths`
 * passes each complete path (without its surrounding quotes or delimiter
 * prefix) to `replacePath`.
 */

/** Path text after a root: up to a hard terminator or a sentence-ending period. */
export const ABSOLUTE_PATH_TAIL = "(?:[^\"'|,;\\r\\n.]|\\.(?![\\s\"'|,;\\r\\n]|$))*";

const DOUBLE_QUOTED_PATH = /"(?:[A-Za-z]:[\\/]|\\\\|\/[^/"\r\n]+\/)[^"\r\n]*"/g;
const SINGLE_QUOTED_PATH = /'(?:[A-Za-z]:[\\/]|\\\\|\/[^/'\r\n]+\/)[^'\r\n]*'/g;

// file:// URIs carry a filesystem path by definition, and their third slash
// defeats the prefix anchoring of the Unix rule, so they're consumed first.
const FILE_URI = new RegExp("file:\\/\\/" + ABSOLUTE_PATH_TAIL, "gi");

// The drive letter must stand alone so URL text like "https://..." is never a drive.
const WINDOWS_DRIVE_PATH = new RegExp("(^|[^A-Za-z0-9])([A-Za-z]:[\\\\/]" + ABSOLUTE_PATH_TAIL + ")", "g");

const UNC_PATH = new RegExp("\\\\\\\\(?=\\S)" + ABSOLUTE_PATH_TAIL, "g");

// Unix paths with ANY root and two or more segments, anchored at start,
// whitespace, a quote, or a delimiter commonly adjacent to paths ( = , : [ { >.
// URL slashes stay safe because every slash in "https://host/seg" follows "/" or
// an alphanumeric; word pairs ("and/or") stay safe because "/" follows a letter.
const UNIX_PATH = new RegExp("(^|[\\s\"'(=,:[{>])(\\/[^\\s/\"'|,;\\r\\n]+\\/" + ABSOLUTE_PATH_TAIL + ")", "g");

export function redactAbsolutePaths(text: string, replacePath: (path: string) => string = () => "<path>"): string {
  let result = text;

  result = result.replace(DOUBLE_QUOTED_PATH, (match) => '"' + replacePath(match.substring(1, match.length - 1)) + '"');
  result = result.replace(SINGLE_QUOTED_PATH, (match) => "'" + replacePath(match.substring(1, match.length - 1)) + "'");
  result = result.replace(FILE_URI, (match) => replacePath(match));
  result = result.replace(WINDOWS_DRIVE_PATH, (_match, prefix: string, path: string) => prefix + replacePath(path));
  result = result.replace(UNC_PATH, (match) => replacePath(match));
  result = result.replace(UNIX_PATH, (_match, prefix: string, path: string) => prefix + replacePath(path));

  return result;
}
