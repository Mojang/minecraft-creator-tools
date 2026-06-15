export type BrowserLocationLike = {
  href: string;
  pathname: string;
  origin: string;
  hash: string;
  search: string;
};

export type BrowserWindowLike = {
  location: BrowserLocationLike;
};

export type BrowserDocumentLike = {
  baseURI?: string;
};

/**
 * Returns a browser-like window object when available.
 * This is safe for TypeScript targets that do not include DOM lib types.
 */
export function getBrowserWindow(): BrowserWindowLike | undefined {
  return (globalThis as { window?: BrowserWindowLike }).window;
}

/**
 * Returns a browser-like document object when available.
 * This is safe for TypeScript targets that do not include DOM lib types.
 */
export function getBrowserDocument(): BrowserDocumentLike | undefined {
  return (globalThis as { document?: BrowserDocumentLike }).document;
}
