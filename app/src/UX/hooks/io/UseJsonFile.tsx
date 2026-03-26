import { useEffect, useState } from "react";

/**
 * React hook for loading and managing JSON file data from a URL.
 *
 * This hook fetches a JSON file from the provided path and manages the loading state,
 * data, and any errors that occur during the fetch process.
 *
 * @param {string | URL} [path] - The URL or path to the JSON file to load.
 *                                If not provided, the hook returns a no-op state.
 *                                When the path changes, the hook automatically refetches the data.
 *
 * @returns {[boolean, unknown, unknown]} A readonly tuple containing:
 *          - [0] isLoading: boolean - True while data is being fetched, false otherwise
 *          - [1] data: unknown - The parsed JSON data if successful, null if loading or error occurred
 *          - [2] error: unknown - Error object with { path, message } if fetch failed, null otherwise
 *
 * @example
 * // Load a JSON configuration file
 * const [isLoading, data, error] = useJsonFile('/api/config.json');
 *
 * if (isLoading) return <div>Loading...</div>;
 * if (error) return <div>Error: {error.message}</div>;
 * return <div>Config: {JSON.stringify(data)}</div>;
 *
 */
export default function useJsonFile(path?: string | URL) {
  const [data, setData] = useState<unknown>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    async function loadData(path: string | URL) {
      try {
        const response = await fetch(path);
        const jsonData = await response.json();

        setData(jsonData);
      } catch (error: any) {
        setError({ path, message: error?.message || "Unknown error" });
        setData(null);
      }
    }

    if (!!path) {
      loadData(path);
    }
  }, [path]);

  // if no path is provided then no-op (likely the path is not yet loaded)
  if (!path) {
    return [false, null, null] as const;
  }
  //if we havent got data yet, assume loading, but also pass errors if they exist
  if (!data) {
    return [true, null, error] as const;
  }

  //happy path, pass data, assert loading as false
  return [false, data, null] as const;
}
