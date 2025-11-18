import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import CreatorTools from "../../../app/CreatorTools";

const CreatorToolsContext = createContext<CreatorTools | undefined>(undefined);

/* provides a shared context where all child components can access the same instance of carto */
export function CreatorToolsProvider({
  children,
  creatorTools: carto,
}: {
  children: ReactNode;
  creatorTools: CreatorTools;
}) {
  return <CreatorToolsContext.Provider value={carto}>{children}</CreatorToolsContext.Provider>;
}

/* 
  used to access shared instance from children components 
*/
export function useCreatorTools(): [CreatorTools, boolean] {
  const creatorTools = useContext(CreatorToolsContext);
  const [loading, setLoading] = useState(true);

  //a valid instance should always be passed into CartoProvider
  if (!creatorTools) {
    throw new Error("[CartoContext:useCarto] Unexpected null value for carto");
  }

  useEffect(() => {
    // this isn't strictly necessary - the existing logic effectively blocks on initial load
    // however, this is provides a path forward for a more async approach and can otherwise be ignored
    async function onLoad() {
      if (creatorTools) {
        await creatorTools.load();
        setLoading(false);
      }
    }

    onLoad();
  }, [creatorTools]);

  return [creatorTools, loading];
}
