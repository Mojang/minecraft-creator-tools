// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Reads engine metadata files for the knowledge updater (app/scripts/knowledge/). The GitHub reader
 * reads every file from one commit, so a snapshot can't mix files from two commits while the branch
 * moves during a run. The commit is either passed in (the workflow passes the commit its accuracy corpus
 * was checked out at) or resolved from the ref once, before any read. If it can't be resolved, reading
 * fails unless the caller opts in to reading from the mutable ref.
 */

export interface IMetadataReader {
  readJson(relativePath: string, optional?: boolean): Promise<any>;
  describe(): { origin: string; ref: string; revision?: string };
  version(): Promise<string>;
}

/** Fetches JSON from a URL; returns undefined for a 404 when optional is true. */
export type JsonFetcher = (url: string, optional?: boolean) => Promise<any>;

export interface IGitHubMetadataReaderOptions {
  /** Commit to read from instead of resolving the ref. */
  revision?: string;
  /**
   * Read from the ref when it can't be resolved to a commit. Files may then come from different commits,
   * so no revision is recorded. For local, manual runs only.
   */
  allowUnpinned?: boolean;
}

export function createGitHubMetadataReader(
  repo: string,
  ref: string,
  fetchJson: JsonFetcher,
  options: IGitHubMetadataReaderOptions = {}
): IMetadataReader {
  let revision = options.revision;
  let pinned: Promise<string> | undefined = revision ? Promise.resolve(revision) : undefined;
  const resolveRef = () =>
    (pinned ??= fetchJson(`https://api.github.com/repos/${repo}/commits/${ref}`).then(
      (commit) => {
        if (typeof commit?.sha !== "string") {
          throw new Error(`${repo}@${ref} did not resolve to a commit`);
        }
        revision = commit.sha;
        return commit.sha;
      },
      (error) => {
        if (options.allowUnpinned) {
          return ref;
        }
        throw new Error(
          `Couldn't resolve ${repo}@${ref} to a commit (${error?.message ?? error}); pass --allow-unpinned to read from the ref.`
        );
      }
    ));
  return {
    async readJson(relativePath, optional) {
      const at = await resolveRef();
      return fetchJson(`https://raw.githubusercontent.com/${repo}/${at}/metadata/${relativePath}`, optional);
    },
    describe: () => ({ origin: repo, ref, revision }),
    async version() {
      const at = await resolveRef();
      const versions = await fetchJson(`https://raw.githubusercontent.com/${repo}/${at}/version.json`);
      return versions?.latest?.version ?? "unknown";
    },
  };
}
