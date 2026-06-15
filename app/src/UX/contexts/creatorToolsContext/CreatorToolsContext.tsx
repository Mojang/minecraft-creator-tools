import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import CreatorTools from "../../../app/CreatorTools";
import Log from "../../../core/Log";
import { ensureCreatorToolsReady } from "../../appShell/CreatorToolsReady";

interface CreatorToolsProviderProps {
  children: ReactNode;
  creatorTools?: CreatorTools;
}

interface CreatorToolsContextValue {
  creatorTools: CreatorTools | undefined;
  isReady: boolean;
}

const CreatorToolsContext = createContext<CreatorToolsContextValue>({ creatorTools: undefined, isReady: false });

/**
 * Provides the shared CreatorTools instance to the component tree.
 *
 * Non-blocking: children render immediately. Pages that don't need CreatorTools
 * (e.g. About, 404) are unaffected. Pages that do need it should check `isReady`
 * from `useCreatorTools()` before accessing the instance.
 *
 * - If a `creatorTools` prop is provided, it is used directly (and loaded if needed).
 * - Otherwise falls back to the shared `ensureCreatorToolsReady()` singleton path.
 */
export function CreatorToolsProvider({ children, creatorTools }: CreatorToolsProviderProps) {
  const [resolvedCreatorTools, setResolvedCreatorTools] = useState<CreatorTools | undefined>(creatorTools);
  const [isReady, setIsReady] = useState<boolean>(!!creatorTools);

  useEffect(() => {
    let isCancelled = false;

    async function resolveCreatorTools() {
      try {
        const tools = creatorTools ?? (await ensureCreatorToolsReady());

        if (!tools.isLoaded) {
          await tools.load();
        }

        if (!isCancelled) {
          setResolvedCreatorTools(tools);
          setIsReady(true);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        Log.error("CreatorToolsProvider failed to resolve creator tools: " + message);
      }
    }

    resolveCreatorTools();

    return () => {
      isCancelled = true;
    };
  }, [creatorTools]);

  return (
    <CreatorToolsContext.Provider value={{ creatorTools: resolvedCreatorTools, isReady }}>
      {children}
    </CreatorToolsContext.Provider>
  );
}

/**
 * Returns the CreatorTools instance and whether it has finished loading.
 *
 * Usage:
 *   const [creatorTools, isReady] = useCreatorTools();
 *   if (!isReady) return <Loading />;
 *   creatorTools.doSomething();
 *
 * Pages that don't need CreatorTools should simply not call this hook.
 * If called outside of a CreatorToolsProvider, this hook returns `[undefined, false]`;
 * callers should not rely on an exception for missing provider wiring.
 */
export function useCreatorTools(): [tools: CreatorTools, isReady: true] | [tools: undefined, isReady: false] {
  const { creatorTools, isReady } = useContext(CreatorToolsContext);
  return creatorTools && isReady ? [creatorTools, true] : [undefined, false];
}
