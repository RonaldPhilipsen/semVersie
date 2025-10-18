import * as core from "@actions/core";
import * as github from "@actions/github";
import { SemanticVersion } from "./semver.js";

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
  [k: string]: any;
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
    [k: string]: any;
  };
  assets?: Array<{
    id?: number;
    name?: string;
    browser_download_url?: string;
    [k: string]: any;
  }>;
  [k: string]: any;
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
  [k: string]: any;
};

/**
 * Return the whole Pull Request object from the Actions context when available.
 */
export function getPrFromContext(): PullRequest | undefined {
  const ctx = github.context;
  const ev = ctx.payload as any;
  // event.pull_request wrapper
  if (ev && ev.event && ev.event.pull_request)
    return ev.event.pull_request as PullRequest;
  if (ev && ev.pull_request) return ev.pull_request as PullRequest;
  return undefined;
}

/**
 * Read a pull request title from the Actions context.
 * Checks common payload locations and returns undefined when not found.
 */
export function getPrTitleFromContext(): string | undefined {
  const ctx = github.context;
  // Common locations for PR payload differ between runners/events
  const ev = ctx.payload as any;
  // event.pull_request (when using octokit/event payload wrapper)
  if (ev && ev.event && ev.event.pull_request && ev.event.pull_request.title) {
    return ev.event.pull_request.title;
  }
  // payload.pull_request (typical for pull_request events)
  if (ev && ev.pull_request && ev.pull_request.title) {
    return ev.pull_request.title;
  }
  return undefined;
}

/**
 * List commits for the current pull request using the Actions context.
 * If token is provided it will be used to construct an Octokit instance.
 */
export async function getPrCommits(token: string): Promise<Commit[]> {
  try {
    const ctx = github.context;
    const pr = (ctx.payload as any)?.pull_request;
    const owner = ctx.repo.owner;
    const repo = ctx.repo.repo;
    let pull_number: number | undefined;

    if (pr && pr.number) pull_number = pr.number;
    // If event ref is refs/pull/:number/merge try to extract
    if (!pull_number && ctx.ref) {
      const m = ctx.ref.match(/^refs\/pull\/(\d+)\/(?:merge|head)$/);
      if (m) pull_number = Number(m[1]);
    }

    if (!pull_number) {
      core.debug(
        "No pull request number found in context; cannot list commits",
      );
      return [];
    }

    const octokit = github.getOctokit(token);
    const res = await octokit.rest.pulls.listCommits({
      owner,
      repo,
      pull_number,
    });
    const commits = res.data.map((c) => ({
      sha: c.sha!,
      title:
        c.commit && c.commit.message ? c.commit.message.split("\n")[0] : "",
      body:
        c.commit && c.commit.message
          ? c.commit.message.split("\n").slice(1).join("\n").trim()
          : undefined,
    }));
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
export async function getLatestTag(
  token: string,
): Promise<string | undefined> {
  try {
    const ctx = github.context;
    const owner = ctx.repo.owner;
    const repo = ctx.repo.repo;

    const octokit = github.getOctokit(token);
    // Request a single tag; GitHub's `listTags` returns tags ordered by commit-ish,
    // but requesting one page with per_page=1 should give the latest by Git reference order.
    const res = await octokit.rest.repos.listTags({ owner, repo, per_page: 1 });
    if (res && Array.isArray(res.data) && res.data.length > 0) {
      return res.data[0].name;
    }
    return undefined;
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
    const ctx = github.context;
    const owner = ctx.repo.owner;
    const repo = ctx.repo.repo;
    const octokit = github.getOctokit(token);
    const res = await octokit.rest.repos.getLatestRelease({ owner, repo });
    if (res && res.data) {
      return res.data as Release;
    }
    return undefined;
  } catch (err) {
    core.debug(`getLatestRelease failed: ${String(err)}`);
    return undefined;
  }
}

/**
 * Return all pull requests labelled as release-candidate that were merged since
 * the latest release. If no token is provided or an error occurs, returns an
 * empty array. This uses the `getLatestRelease` published_at timestamp to
 * filter PRs by their merged_at field.
 */
export async function getAllRCsSinceLatestRelease(
  token: string,
  baseline: SemanticVersion,
): Promise<Tag[]> {
  try {
    const ctx = github.context;
    const owner = ctx.repo.owner;
    const repo = ctx.repo.repo;
    const octokit = github.getOctokit(token);

    // List tags and collect RC tags newer than baseline
    const per_page = 100;
    let page = 1;
    const results: Tag[] = [];
    while (true) {
      const res = await octokit.rest.repos.listTags({
        owner,
        repo,
        per_page,
        page,
      });
      if (!res || !Array.isArray(res.data) || res.data.length === 0) break;

      for (const t of res.data as Tag[]) {
        const parsed = SemanticVersion.parse(t.name);
        if (!parsed) continue;
        // Require a prerelease component that indicates an RC
        if (!parsed.prerelease) continue;
        if (!parsed.prerelease.toLowerCase().includes("rc")) continue;

        const cmp = SemanticVersion.compare(parsed, baseline as any);
        if (cmp < 0) {
          // We've reached tags older than the baseline — tags are expected
          // to be returned newest-first, so we can stop paging further.
          core.debug(`Encountered older tag ${t.name}; stopping search.`);
          return results;
        }
        if (cmp === 0) continue; // equal to baseline, skip
        // cmp > 0 -> newer than baseline
        results.push(t);
      }

      if (res.data.length < per_page) break;
      page += 1;
    }

    core.info(
      `Found ${results.length} release-candidate tag(s) since latest release`,
    );
    return results;
  } catch (err) {
    core.debug(`getAllRCsSinceLatestRelease failed: ${String(err)}`);
    return [];
  }
}
