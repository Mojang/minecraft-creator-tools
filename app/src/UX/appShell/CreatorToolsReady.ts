import CreatorTools from "../../app/CreatorTools";
import CreatorToolsHost from "../../app/CreatorToolsHost";

let creatorToolsReadyPromise: Promise<CreatorTools> | undefined;
const INITIALIZATION_TIMEOUT_MS = 30000;

/**
 * Ensures CreatorTools exists and is loaded exactly once.
 *
 * This allows route-level components (like AppMain) to await readiness when
 * needed, while pages that don't depend on CreatorTools (like 404) can bypass
 * the await entirely.
 */
export async function ensureCreatorToolsReady(): Promise<CreatorTools> {
  if (creatorToolsReadyPromise) {
    return creatorToolsReadyPromise;
  }

  creatorToolsReadyPromise = initializeCreatorTools();

  try {
    return await creatorToolsReadyPromise;
  } catch (err) {
    // Do not memoize failures; allow a fresh attempt on the next call.
    creatorToolsReadyPromise = undefined;
    throw err;
  }
}

async function initializeCreatorTools(): Promise<CreatorTools> {
  const existing = CreatorToolsHost.getCreatorTools();

  if (existing) {
    if (!existing.isLoaded) {
      await existing.load();
    }

    return existing;
  }

  return waitForInitializedCreatorTools();
}

function waitForInitializedCreatorTools(): Promise<CreatorTools> {
  return new Promise<CreatorTools>((resolve, reject) => {
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

    const cleanup = () => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandle = undefined;
      }

      CreatorToolsHost.onInitialized.unsubscribe(onInitialized);
    };

    const onInitialized = async (_source: CreatorTools, initializedInstance: CreatorTools) => {
      try {
        cleanup();

        if (!initializedInstance.isLoaded) {
          await initializedInstance.load();
        }

        resolve(initializedInstance);
      } catch (err) {
        reject(err);
      }
    };

    CreatorToolsHost.onInitialized.subscribe(onInitialized);

    timeoutHandle = setTimeout(() => {
      cleanup();
      reject(
        new Error(
          `Timed out waiting for CreatorToolsHost.onInitialized after ${INITIALIZATION_TIMEOUT_MS}ms.`
        )
      );
    }, INITIALIZATION_TIMEOUT_MS);
  });
}
