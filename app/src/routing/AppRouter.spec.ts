import { expect } from "chai";
import { AppRouter } from "./AppRouter";

describe("AppRouter", () => {
  describe("parseCurrentUrl", () => {
    it("returns the default home route when window is unavailable", () => {
      const result = AppRouter.parseCurrentUrl();

      expect(result).to.deep.equal({
        isValidPathname: true,
        page: "home",
        params: {},
        query: {},
      });
    });
  });

  describe("getHomeNavigationPath", () => {
    it("returns root path when window is unavailable", () => {
      expect(AppRouter.getHomeNavigationPath()).to.equal("/");
    });
  });

  describe("isValidSpaPathname — 404 navigation guard", () => {
    // ensures paths correctly route back to home
    it("rejects single-segment and multi-segment unknown paths that triggered the 404 bug", () => {
      expect(AppRouter.isValidSpaPathname("/invalid"), "/invalid").to.equal(false);
      expect(AppRouter.isValidSpaPathname("/foo/docs"), "/foo/docs").to.equal(false);
      expect(AppRouter.isValidSpaPathname("/foo/bar"), "/foo/bar").to.equal(false);
    });
  });

  describe("getSafeNavigationPath", () => {
    it("returns home path for empty and root-like values", () => {
      expect(AppRouter.getSafeNavigationPath("")).to.equal("/");
      expect(AppRouter.getSafeNavigationPath("/")).to.equal("/");
      expect(AppRouter.getSafeNavigationPath(".")).to.equal("/");
    });

    it("normalizes relative and absolute paths in non-browser environments", () => {
      expect(AppRouter.getSafeNavigationPath("about")).to.equal("/about");
      expect(AppRouter.getSafeNavigationPath("./about")).to.equal("/about");
      expect(AppRouter.getSafeNavigationPath("///about")).to.equal("/about");
    });

    it("strips path traversal segments in non-browser environments", () => {
      expect(AppRouter.getSafeNavigationPath("../../etc/passwd")).to.equal("/etc/passwd");
      expect(AppRouter.getSafeNavigationPath("../foo")).to.equal("/foo");
      expect(AppRouter.getSafeNavigationPath("../../")).to.equal("/");
    });

    it("preserves query/hash navigation from home", () => {
      expect(AppRouter.getSafeNavigationPath("?mode=about")).to.equal("/?mode=about");
      expect(AppRouter.getSafeNavigationPath("#about")).to.equal("/#about");
    });
  });

  describe("isValidSpaPathname", () => {
    it("accepts known SPA-served paths", () => {
      const validPathnames = ["", "/", "/home", "/about", "/index.html", "/app/", "/app/index.html"];

      for (const pathname of validPathnames) {
        expect(AppRouter.isValidSpaPathname(pathname), pathname).to.equal(true);
      }
    });

    it("rejects unknown deep-link paths", () => {
      const invalidPathnames = ["/foo", "/foo/bar", "/foo/bar/"];

      for (const pathname of invalidPathnames) {
        expect(AppRouter.isValidSpaPathname(pathname), pathname).to.equal(false);
      }
    });
  });
});
