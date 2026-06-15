import Log from "../core/Log";
import { getBrowserDocument, getBrowserWindow } from "../core/BrowserEnvironment";
import { Page, type ParsedRoute } from "./RouteTypes";

const pageLookup: Record<string, Page> = {
  "": Page.home,
  home: Page.home,
  about: Page.about,
  docs: Page.docs,
};
/**
 * AppRouter
 *
 * Centralizes URL parsing and routing logic.
 *
 */
export class AppRouter {
  /**
   * Returns the root path of the app, accounting for subpath hosting.
   *
   * When a <base href> tag is present, document.baseURI differs from window.location.href
   * and reliably encodes the app root (e.g. "/app/" for a subpath-hosted deployment).
   * Without a <base> tag, document.baseURI === window.location.href, which gives no useful
   * information about the app root, so we skip it and return "/" directly.
   *
   * Returns a path suitable for use with history.replaceState / window.location.replace.
   */
  static getHomeNavigationPath(): string {
    const browserWindow = getBrowserWindow();
    if (!browserWindow) {
      return "/";
    }

    const browserDocument = getBrowserDocument();

    // document.baseURI only reliably indicates a subpath base when a <base href> tag is
    // present — in that case it differs from window.location.href. Without a base tag,
    // document.baseURI === window.location.href and tells us nothing useful about the app
    // root, so we skip it and fall through to the "/" default.
    if (browserDocument?.baseURI && browserDocument.baseURI !== browserWindow.location.href) {
      try {
        const resolved = this.resolveHomePathFromPathname(
          new URL(browserDocument.baseURI, browserWindow.location.href).pathname
        );
        if (resolved) {
          return resolved;
        }
      } catch {
        // Ignore invalid base URI.
      }
    }

    return "/";
  }

  /**
   * Safely resolves route path, accounting for edge cases like subpath hosting and invalid URLs.
   */
  static getSafeNavigationPath(targetPath: string): string {
    const homePath = this.getHomeNavigationPath();
    const trimmedTarget = (targetPath ?? "").trim();

    if (!trimmedTarget || trimmedTarget === "/" || trimmedTarget === ".") {
      return homePath;
    }

    if (trimmedTarget.startsWith("?") || trimmedTarget.startsWith("#")) {
      return `${homePath}${trimmedTarget}`;
    }

    const browserWindow = getBrowserWindow();
    if (!browserWindow) {
      const segments = trimmedTarget
        .replace(/^[./]+/, "")
        .split("/")
        .filter((s) => s && s !== "." && s !== "..");
      return segments.length > 0 ? `/${segments.join("/")}` : "/";
    }

    const basePath = homePath.endsWith("/") ? homePath : `${homePath}/`;

    try {
      const parsedTarget = new URL(trimmedTarget, "https://local.invalid/");

      // Keep navigation inside the app base by dropping traversal segments.
      const safePathSegments = parsedTarget.pathname
        .split("/")
        .filter((segment) => segment && segment !== "." && segment !== "..");
      const normalizedRelativePath = safePathSegments.join("/");

      const targetWithQueryHash = `${normalizedRelativePath}${parsedTarget.search}${parsedTarget.hash}`;
      const resolved = new URL(targetWithQueryHash, new URL(basePath, browserWindow.location.origin));

      return `${resolved.pathname}${resolved.search}${resolved.hash}`;
    } catch {
      return homePath;
    }
  }

  private static resolveHomePathFromPathname(pathname: string): string | undefined {
    if (!pathname) {
      return "/";
    }

    const normalizedLower = pathname.toLowerCase().replace(/\/+$/, "");

    // Known top-level routes (/, /home, /about) always navigate back to app root.
    if (this.getPageFromPathname(normalizedLower)) {
      return "/";
    }

    // Entry files should navigate to the containing folder (e.g., /app/index.html -> /app/).
    if (normalizedLower.endsWith(".html") || normalizedLower.endsWith(".htm")) {
      const lastSlash = pathname.lastIndexOf("/");
      if (lastSlash >= 0) {
        return pathname.slice(0, lastSlash + 1) || "/";
      }
      return "/";
    }

    const segments = pathname.split("/").filter(Boolean);
    if (segments.length === 0) {
      return "/";
    }

    // For subpath-hosted apps (e.g., <base href="/app/">), fall back to first segment as base.
    return `/${segments[0]}/`;
  }

  /**
   * Parse the current window URL and return routing information.
   * Early returns isValidPathname=false if the pathname can't be served.
   */
  static parseCurrentUrl(): ParsedRoute {
    const defaultResult: ParsedRoute = {
      isValidPathname: true,
      page: Page.home,
      params: {},
      query: {},
    };

    const browserWindow = getBrowserWindow();
    if (!browserWindow) {
      return defaultResult;
    }

    const pathnameRoute = this.parsePathname(browserWindow.location.pathname);
    if (!pathnameRoute.isValidPathname) {
      return {
        isValidPathname: false,
        params: {},
        query: {},
        debugInfo: pathnameRoute.debugInfo ?? `Invalid pathname: ${browserWindow.location.pathname}`,
      };
    }

    if (pathnameRoute.page) {
      return {
        isValidPathname: true,
        page: pathnameRoute.page,
        params: pathnameRoute.params ?? {},
        query: pathnameRoute.query ?? {},
        debugInfo: pathnameRoute.debugInfo,
      };
    }

    // Parse hash (#project/foo, #modelviewer, etc.) — highest priority
    const hashRoute = this.parseHash(browserWindow.location.hash);
    if (hashRoute) {
      return { isValidPathname: true, params: {}, query: {}, ...hashRoute };
    }

    // Parse query string (?mode=project&open=..., etc.)
    const queryRoute = this.parseQueryString(browserWindow.location.search);
    if (queryRoute) {
      return { isValidPathname: true, params: {}, query: {}, ...queryRoute };
    }

    // Default to home
    return defaultResult;
  }

  /**
   * Parse pathname-only routes such as /about.
   * These are the most direct routes, so they win before hash/query fallbacks.
   */
  private static parsePathname(
    pathname: string
  ): Partial<ParsedRoute> & { isValidPathname: boolean; debugInfo?: string } {
    if (!this.isValidSpaPathname(pathname)) {
      return {
        isValidPathname: false,
        params: {},
        query: {},
        debugInfo: `Invalid pathname: ${pathname}`,
      };
    }

    const normalizedPathname = pathname.toLowerCase().replace(/\/+$/, "");
    const pathnamePage = this.getPageFromPathname(normalizedPathname);
    if (pathnamePage) {
      return {
        isValidPathname: true,
        page: pathnamePage,
        params: {},
        query: {},
      };
    }

    return { isValidPathname: true, params: {}, query: {} };
  }

  /**
   * Validate pathname — return true if this SPA can serve it.
   *
   * Valid: "/", "/index.html", "/app/", "", "/app/index.html"
   * Invalid: "/foo", "/foo/bar", "/foo/bar/"
   */
  static isValidSpaPathname(pathname: string): boolean {
    if (!pathname || pathname === "/" || pathname === "") {
      return true;
    }

    const lower = pathname.toLowerCase();

    if (this.getPageFromPathname(lower)) {
      return true;
    }

    // HTML entry files are valid (index.html, devindex.html, *.html)
    if (lower.endsWith(".html") || lower.endsWith(".htm")) {
      return true;
    }

    // Trailing slash on a single base path is valid (e.g., /app/)
    // But /foo/bar/ with multiple segments is not
    if (lower.endsWith("/")) {
      const segments = lower.split("/").filter(Boolean);
      return segments.length <= 1;
    }

    // Anything else (like /foo or /foo/bar) is invalid
    return false;
  }

  /**
   * Parse hash-based routes: #project/MyProject, #modelviewer?geometryUrl=..., etc.
   * Returns null if hash doesn't match a known page.
   */
  private static parseHash(hash: string): Partial<ParsedRoute> | null {
    if (!hash || hash === "#") {
      return null;
    }

    const hashContent = hash.slice(1); // Remove leading #
    const [pathPart, queryPart] = hashContent.split("?");
    const [firstSegment, ...restSegments] = pathPart.split("/");

    const page = this.getPageFromString(firstSegment);
    if (page === undefined) {
      return null;
    }

    const params: Record<string, string> = {};
    if (restSegments[0]) {
      params.projectName = decodeURIComponent(restSegments[0]);
    }

    const query = this.parseQueryStringContent(queryPart || "");

    return { page, params, query };
  }

  /**
   * Parse query-string routes: ?mode=project&open=..., ?mode=modelviewer&geometryUrl=...
   * Returns null if no recognisable mode param found.
   */
  private static parseQueryString(search: string): Partial<ParsedRoute> | null {
    const urlParams = new URLSearchParams(search);
    const modeParam = urlParams.get("mode");

    if (!modeParam) {
      return null;
    }

    const page = this.getPageFromString(modeParam);
    if (page === undefined) {
      return null;
    }

    const query: Record<string, string> = {};
    urlParams.forEach((value, key) => {
      query[key] = value;
    });

    return { page, params: {}, query };
  }

  /**
   * Parse a query string fragment into key/value pairs.
   */
  private static parseQueryStringContent(queryString: string): Record<string, string> {
    const result: Record<string, string> = {};
    try {
      new URLSearchParams("?" + queryString).forEach((value, key) => {
        result[key] = value;
      });
    } catch {
      // Ignore malformed query strings
    }
    return result;
  }

  /**
   * Map a string to a Page. Only covers URL-navigable destinations.
   */
  private static getPageFromString(str: string | null | undefined): Page | undefined {
    if (!str) {
      return undefined;
    }

    // Unknown hash/query route segments (e.g. legacy `#project/...`, `#modelviewer`,
    // `?mode=worldviewer`) are handled by AppMain's own URL parser. Return undefined
    // so parseHash/parseQueryString fall through to the default home page (AppMain)
    // instead of routing to the 404 page.
    const page = pageLookup[str.toLowerCase()];
    if (page === undefined) {
      Log.debug("AppRouter: Unknown route string: " + str);
    }
    return page;
  }

  /**
   * Map a pathname to a top-level page route.
   */
  private static getPageFromPathname(pathname: string): Page | undefined {
    const normalizedPathname = pathname.toLowerCase().replace(/^\/+|\/+$/g, "");

    return pageLookup[normalizedPathname];
  }
}
