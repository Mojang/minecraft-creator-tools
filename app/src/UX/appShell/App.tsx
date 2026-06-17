import { useCallback, useEffect, useState } from "react";
import IProjectTheme from "../types/IProjectTheme";
import { AppRouter } from "../../routing/AppRouter";
import { Page, type ParsedRoute } from "../../routing/RouteTypes";
import { CreatorToolsProvider } from "../contexts/creatorToolsContext/CreatorToolsContext";
import AppMain from "./AppMain";
import DocsPage from "../pages/Docs/DocsPage";
import AboutPage from "../pages/About/AboutPage";
import NotFound404Page from "../pages/NotFound/NotFound404Page";

interface AppProps {
  darkTheme: IProjectTheme;
  lightTheme: IProjectTheme;
  fileContentRetriever?: (func: () => Promise<any>) => void;
  saveAllRetriever?: (func: () => Promise<void>) => void;
}

function renderRouteContent(route: ParsedRoute, props: AppProps) {
  if (!route.isValidPathname) {
    return <NotFound404Page />;
  }

  switch (route.page) {
    case Page.about:
      return <AboutPage />;
    case Page.docs:
      return <DocsPage />;
    case Page.notFound:
      return <NotFound404Page />;
    case Page.home:
    default:
      return <AppMain {...props} />;
  }
}

export default function App(props: AppProps) {
  const [currentRoute, setCurrentRoute] = useState<ParsedRoute>(() => AppRouter.parseCurrentUrl());

  const syncRouteState = useCallback(() => {
    setCurrentRoute(AppRouter.parseCurrentUrl());
  }, []);

  useEffect(() => {
    // Keep the parsed route in sync when browser navigation or hash changes update the URL.
    window.addEventListener("popstate", syncRouteState);
    window.addEventListener("hashchange", syncRouteState);
    return () => {
      window.removeEventListener("popstate", syncRouteState);
      window.removeEventListener("hashchange", syncRouteState);
    };
  }, [syncRouteState]);

  // Provide the same instance of CreatorTools to any page that calls the useCreatorTools hook, without forcing all pages to load it.
  return <CreatorToolsProvider>{renderRouteContent(currentRoute, props)}</CreatorToolsProvider>;
}
