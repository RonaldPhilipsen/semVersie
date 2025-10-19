import * as core from '@actions/core';
import * as github from '@actions/github';
import { LRUCache } from './utils.js';

export type Commit = { sha: string; title: string; body?: string };

/**
 * Minimal representation of a Git tag object from the GitHub REST API.
 * Extend as needed — the tests and helpers only require `name` and the
 * optional `commit.sha` field, but other properties are included for
 * convenience and future use.
 */
export type Tag = {
  name: string;
  commit?: {
    sha?: string;
    url?: string;
  };
  zipball_url?: string;
  tarball_url?: string;
  node_id?: string;
  [k: string]: unknown;
};

/**
 * Minimal representation of a GitHub Release object with its associated tag.
 * This mirrors the shape returned by the REST API and is intentionally
 * permissive — add fields as needed by your code.
 */
export type Release = {
  id?: number;
  tag_name: string;
  name?: string;
  body?: string | null;
  draft?: boolean;
  prerelease?: boolean;
  created_at?: string;
  published_at?: string | null;
  html_url?: string;
  url?: string;
  author?: {
    login?: string;
    id?: number;
    [k: string]: unknown;
  };
  assets?: Array<{
    id?: number;
    name?: string;
    browser_download_url?: string;
    [k: string]: unknown;
  }>;
  [k: string]: unknown;
};

/**
 * Minimal Pull Request interface capturing commonly-used fields.
 * This intentionally doesn't replicate the full GitHub API shape — add fields as needed.
 */
export type PullRequest = {
  number: number;
  title: string;
  body: string;
  head: {
    ref: string;
    sha: string;
    repo: { full_name?: string };
  };
  base?: {
    ref: string;
    sha: string;
    repo: { full_name?: string };
  };
  labels: Array<{ name: string }>;
  draft: boolean;
  merged: boolean;
  merge_commit_sha: string | null;
  [k: string]: unknown;
};

// Small helper to centralize payload->PR extraction logic.
// We keep the cast narrow and local to avoid wide `any` usage while
// keeping the extraction logic concise.
function extractPullRequestFromPayload(ev: unknown): PullRequest | undefined {
  const payload = ev as
    | { event?: { pull_request?: PullRequest }; pull_request?: PullRequest }
    | undefined;
  return payload?.event?.pull_request ?? payload?.pull_request;
}

/**
 * Return the whole Pull Request object from the Actions context when available.
 */
export function getPrFromContext(): PullRequest | undefined {
  const ctx = github.context;
  return extractPullRequestFromPayload(ctx.payload as unknown);
}

function getOctokitAndRepo(token: string) {
  const octokit = github.getOctokit(token);
  const ctx = github.context;
  const owner = ctx.repo.owner;
  const repo = ctx.repo.repo;
  return { octokit, owner, repo };
}

// Module-level cache keyed by owner/repo and operation. Tests can mock this by
// mocking the './utils' import.
const GH_CACHE = new LRUCache<Promise<unknown>>();

// Small helper to parse an Octokit commit entry into our Commit type.
function parseCommit(c: unknown): Commit {
  const cc = c as { sha?: string; commit?: { message?: string } };
  const msg = cc.commit?.message ?? '';
  const title = msg ? msg.split('\n')[0] : '';
  const body = msg ? msg.split('\n').slice(1).join('\n').trim() : undefined;
  return { sha: cc.sha!, title, body };
}

/**
 * Read a pull request title from the Actions context.
 * Checks common payload locations and returns undefined when not found.
 */
export function getPrTitleFromContext(): string | undefined {
  // Reuse getPrFromContext to avoid duplicating payload parsing logic
  const pr = getPrFromContext();
  return pr?.title;
}

/**
 * List commits for the current pull request using the Actions context.
 * If token is provided it will be used to construct an Octokit instance.
 */
export async function getPrCommits(token: string): Promise<Commit[]> {
  try {
    // Try to obtain a PullRequest object from context first; fall back to ref parsing
    const pr = getPrFromContext();
    let pull_number: number | undefined = pr?.number;
    const ctx = github.context;
    if (!pull_number && ctx.ref) {
      const m = ctx.ref.match(/^refs\/pull\/(\d+)\/(?:merge|head)$/);
      if (m) pull_number = Number(m[1]);
    }

    if (!pull_number) {
      core.debug(
        'No pull request number found in context; cannot list commits',
      );
      return [];
    }
    if (!token) {
      core.debug('No token provided; cannot list PR commits');
      return [];
    }
    const { octokit, owner, repo } = getOctokitAndRepo(token);
    const cacheKey = `prCommits:${owner}/${repo}:${pull_number}`;
    let p = GH_CACHE.get(cacheKey) as Promise<Commit[]> | undefined;
    if (!p) {
      let raw: Promise<Commit[]>;
      try {
        const call = octokit.rest.pulls.listCommits({
          owner,
          repo,
          pull_number,
        });
        raw = Promise.resolve(call).then((res) => {
          return res.data.map((c) => parseCommit(c));
        });
      } catch (err) {
        core.debug(
          `getPrCommits: synchronous listCommits threw: ${String(err)}`,
        );
        return [];
      }
      const wrapped = raw.catch((err) => {
        GH_CACHE.delete(cacheKey);
        core.debug(`getPrCommits: listCommits failed: ${String(err)}`);
        return [] as Commit[];
      });
      p = wrapped;
      GH_CACHE.set(cacheKey, p as unknown as Promise<unknown>);
      p.finally(() => GH_CACHE.delete(cacheKey));
    }
    const commits = await p;
    core.info(`Found ${commits.length} commits in PR`);
    return commits;
  } catch (err) {
    core.debug(`getPrCommits failed: ${String(err)}`);
    return [];
  }
}

/**
 * Return the most recent tag name for the repository in the Actions context.
 * If no token is provided or the call fails, returns undefined.
 */
export async function getLatestTag(token: string): Promise<string | undefined> {
  try {
    const { octokit, owner, repo } = getOctokitAndRepo(token);
    const cacheKey = `latestTag:${owner}/${repo}`;
    let p = GH_CACHE.get(cacheKey) as Promise<string | undefined> | undefined;
    if (!p) {
      const raw = Promise.resolve()
        .then(() => octokit.rest.repos.listTags({ owner, repo, per_page: 1 }))
        .then((res) => {
          return (res.data && res.data[0] && res.data[0].name) || undefined;
        });
      const wrapped = raw.catch((err) => {
        GH_CACHE.delete(cacheKey);
        core.debug(`getLatestTag: listTags failed: ${String(err)}`);
        return undefined as string | undefined;
      });
      p = wrapped;
      GH_CACHE.set(cacheKey, p as unknown as Promise<unknown>);
      p.finally(() => GH_CACHE.delete(cacheKey));
    }
    return p;
  } catch (err) {
    core.debug(`getLatestTag failed: ${String(err)}`);
    return undefined;
  }
}

/**
 * Return the latest release object for the repository in the Actions context.
 * If no token is provided or the call fails, returns undefined.
 */
export async function getLatestRelease(
  token: string,
): Promise<Release | undefined> {
  try {
    const { octokit, owner, repo } = getOctokitAndRepo(token);
    const cacheKey = `latestRelease:${owner}/${repo}`;
    let p = GH_CACHE.get(cacheKey) as Promise<Release | undefined> | undefined;
    if (!p) {
      const raw = Promise.resolve()
        .then(() => octokit.rest.repos.getLatestRelease({ owner, repo }))
        .then((res) => {
          return res && res.data ? (res.data as Release) : undefined;
        });
      const wrapped = raw.catch((err) => {
        GH_CACHE.delete(cacheKey);
        core.debug(`getLatestRelease: getLatestRelease failed: ${String(err)}`);
        return undefined as Release | undefined;
      });
      p = wrapped;
      GH_CACHE.set(cacheKey, p as unknown as Promise<unknown>);
      p.finally(() => GH_CACHE.delete(cacheKey));
    }
    return p;
  } catch (err) {
    core.debug(`getLatestRelease failed: ${String(err)}`);
    return undefined;
  }
}

export async function createRelease(
  token: string,
  tag_name: string,
  target_commitish: string,
  name: string,
  body: string,
  draft: boolean,
  prerelease: boolean,
  make_latest: boolean,
): Promise<Release | undefined> {
  try {
    const { octokit, owner, repo } = getOctokitAndRepo(token);
    const res = await octokit.rest.repos.createRelease({
      owner: owner,
      repo: repo,
      tag_name: tag_name,
      target_commitish: target_commitish,
      name: name,
      body: body,
      draft: draft,
      prerelease: prerelease,
      make_latest: make_latest ? 'true' : 'false',
    });
    if (res && res.data) {
      core.info(`Created release for tag ${tag_name}`);
      return res.data as Release;
    }
    throw Error('Failed to create release');
  } catch (err) {
    core.debug(`createRelease failed: ${String(err)}`);
    throw Error('Failed to create release');
  }
}
