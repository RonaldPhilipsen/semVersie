import * as core from '@actions/core';
import * as github from '@actions/github';
import * as gh from './github.js';
import type { Commit, PullRequest, Tag } from './github.js';
import { Impact, SemanticVersion } from './semver.js';
import { getConventionalImpact } from './conventional_commits.js';
import { generateReleaseNotes } from './release_notes.js';
import { writeFile } from 'fs/promises';

export type ImpactResult = {
  prImpact?: Impact;
  commitImpacts: Impact[];
  maxCommitImpact?: Impact;
  finalImpact?: Impact;
  warning?: string;
};

export async function getImpactFromGithub(
  pr: PullRequest,
  commits: Commit[],
): Promise<ImpactResult> {
  const pr_impact = getConventionalImpact(pr.title, pr.body);
  core.info(`Determined impact from Pull request: ${String(pr_impact)}`);

  const commit_impacts: Impact[] = [];
  // Parse each commit title
  for (const commit of commits) {
    const commit_impact = getConventionalImpact(commit.title, commit.body);
    core.debug(`Commit ${commit.sha} title: ${commit.title}`);
    core.debug(`Determined impact from commit: ${String(commit_impact)}`);
    if (commit_impact !== undefined) {
      commit_impacts.push(commit_impact);
    }
  }

  const max_commit_impact =
    commit_impacts.length > 0
      ? (Math.max(...commit_impacts) as Impact)
      : undefined;
  core.info(`Maximum impact from commits: ${String(max_commit_impact)}`);

  let final_impact: Impact | undefined = undefined;
  let warning: string | undefined = undefined;
  if (
    pr_impact !== undefined &&
    max_commit_impact !== undefined &&
    pr_impact != max_commit_impact
  ) {
    warning = `Impact from PR title (${Impact[pr_impact]}) differs from maximum commit impact (${Impact[max_commit_impact]}). Using PR title impact (${Impact[pr_impact]}) for version bump.`;
    core.warning(
      `Impact from PR title (${Impact[pr_impact]}) differs from maximum commit impact (${Impact[max_commit_impact]}).`,
    );
    core.warning(
      `Using PR commit impact (${Impact[pr_impact]}) for version bump.`,
    );
    final_impact = pr_impact;
  } else if (pr_impact !== undefined) {
    core.info(`Using PR title impact (${pr_impact}) for version bump.`);
    final_impact = pr_impact;
  } else if (max_commit_impact !== undefined) {
    core.info(
      `Using maximum commit impact (${max_commit_impact}) for version bump.`,
    );
    final_impact = max_commit_impact;
  } else {
    core.error(
      `No conventional commit impacts found in PR title or commits; no version bump will be performed.`,
    );
    core.setFailed('No Impact determined.');
  }

  return {
    prImpact: pr_impact,
    commitImpacts: commit_impacts,
    maxCommitImpact: max_commit_impact,
    finalImpact: final_impact,
    warning,
  };
}

export async function handle_release_candidates(
  token: string,
  pr: PullRequest,
  impact: Impact,
  last_release_version: SemanticVersion,
  // optional fetcher to allow tests to inject previous RCs
  fetchRCs?: (
    token: string,
    baseline: SemanticVersion,
  ) => Promise<{ name: string }[]>,
) {
  let prerelease = undefined;
  const is_prerelease = pr.labels?.some(
    (label) => label.name.toLowerCase() === 'release-candidate',
  );

  if (is_prerelease) {
    core.info('PR is marked as a release candidate.');
    const previous_release_candidates = await (fetchRCs
      ? fetchRCs(token, last_release_version)
      : getAllRCsSinceLatestRelease(token, last_release_version));
    // Determine the bumped base version (without prerelease) according to impact
    const bumped_base = last_release_version.bump(impact);
    // Extract tag names and ask SemanticVersion to compute the next RC index
    const tagNames = previous_release_candidates.map((t) => t.name);
    const nextRc = SemanticVersion.nextRcIndex(bumped_base, tagNames);
    // create the prerelease string e.g. 'rc1' (if nextRc is 1) or 'rc0' if 0
    prerelease = `rc${nextRc}`;
  }
  return prerelease;
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
        if (!parsed.prerelease.toLowerCase().includes('rc')) continue;

        const cmp = SemanticVersion.compare(parsed, baseline);
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

export async function write_job_summary(
  impactRes: ImpactResult,
  impact: Impact,
  last_release_version: SemanticVersion,
  new_version: SemanticVersion,
  release_notes: string,
) {
  try {
    const prImpactStr =
      impactRes.prImpact !== undefined ? Impact[impactRes.prImpact] : 'none';
    const commitImpactsStr =
      impactRes.commitImpacts && impactRes.commitImpacts.length > 0
        ? impactRes.commitImpacts.map((i) => Impact[i]).join(', ')
        : 'none';
    const finalImpactStr = impact !== undefined ? Impact[impact] : 'none';

    core.summary.addHeading('unnamed_versioning_tool summary', 2).addTable([
      ['Item', 'Value'],
      ['Previous', last_release_version.toString()],
      ['New', `${new_version.toString()} (${new_version.as_tag()})`],
      ['PEP 440', new_version.as_pep_440()],
      ['PR impact', prImpactStr],
      ['Commit impacts', commitImpactsStr],
      ['Final impact', finalImpactStr],
    ]);

    if (impactRes.warning) {
      core.summary.addRaw(`\n⚠️ **Warning:** ${impactRes.warning}`);
    }

    core.summary
      .addHeading('Release Notes', 3)
      .addCodeBlock(release_notes, 'markdown');

    await core.summary.write();
    core.info('Wrote job summary via core.summary');
  } catch (err) {
    core.debug(`Failed to write job summary via core.summary: ${String(err)}`);
  }
}

export async function run() {
  try {
    const token = process.env.GITHUB_TOKEN || process.env.INPUT_GITHUB_TOKEN;

    if (!token) {
      core.setFailed('No GITHUB_TOKEN available — cannot fetch releases');
      return;
    }

    const release = await gh.getLatestRelease(token);

    let last_release_version: SemanticVersion | undefined;
    if (release != undefined) {
      core.info('Previous release found.');
      const releaseName = release.name ?? release.tag_name ?? '';
      last_release_version = SemanticVersion.parse(releaseName);
    } else {
      core.info('No Previous release found, assuming this is v0.0.0.');
      last_release_version = new SemanticVersion(0, 0, 0);
    }

    if (last_release_version === undefined) {
      core.setFailed('Could not parse latest release version.');
      return;
    }

    core.info('Resolving pull request title...');
    const pr = gh.getPrFromContext();
    if (!pr) {
      core.setFailed('Could not find pull request in context.');
      return;
    }
    core.info(`Found PR #${pr.number} title: ${pr.title}`);

    const commits = await gh.getPrCommits(token);
    const impactRes = await getImpactFromGithub(pr, commits);
    if (!impactRes || impactRes.finalImpact === undefined) {
      return;
    }
    const impact = impactRes.finalImpact;
    // Compute the bumped base version first so we can reason about prereleases
    const bumped_base_version = last_release_version.bump(impact);

    const prerelease = await handle_release_candidates(
      token,
      pr,
      impact,
      last_release_version,
    );
    const build_metadata = core.getInput('build-metadata');

    const new_version = new SemanticVersion(
      bumped_base_version.major,
      bumped_base_version.minor,
      bumped_base_version.patch,
      prerelease,
      build_metadata,
    );

    core.info(
      `Bumping version from ${last_release_version.toString()} to ${new_version.toString()}`,
    );

    core.info(`Final determined impact: ${String(impact)}`);
    const release_notes = generateReleaseNotes(commits);
    const filePath = './release-notes.md';
    await writeFile(filePath, release_notes, 'utf8');
    core.info(`Wrote release notes to ${filePath}`);

    core.setOutput('release', pr.merged && impact !== Impact.NOIMPACT);
    core.setOutput('release-notes-file', filePath);
    core.setOutput('prerelease', prerelease !== undefined);
    core.setOutput('tag', new_version.as_tag());
    core.setOutput('version', new_version.toString());
    core.setOutput('version-pep-440', new_version.as_pep_440());

    await write_job_summary(
      impactRes,
      impact,
      last_release_version,
      new_version,
      release_notes,
    );
  } catch (err) {
    core.setFailed(String(err));
  }
}
