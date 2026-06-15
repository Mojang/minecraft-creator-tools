/**
 * RouteTypes
 *
 * Shared route contracts used by the router and route-consuming UI.
 */

/**
 * Pages are URL-navigable destinations — things a user can bookmark, share,
 * or arrive at via a link.
 */
export const Page = {
  home: "home",
  about: "about",
  docs: "docs",
  notFound: "notfound",
} as const;

export type Page = (typeof Page)[keyof typeof Page];

/**
 * Result of parsing a browser URL into a route.
 */
export type ParsedRoute = {
  isValidPathname: boolean;
  page?: Page;
  params: Record<string, string>;
  query: Record<string, string>;
  debugInfo?: string;
}
