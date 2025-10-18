import * as core from "@actions/core";
import {
  getLatestRelease,
  getPrCommits,
  getPrFromContext,
  PullRequest,
  getAllRCsSinceLatestRelease,
} from "./github.js";
import { Impact, SemanticVersion } from "./semver.js";
import { getConventionalImpact } from "./conventional_commits.js";

export async function getImpactFromGithub(pr: PullRequest, token: string): Promise<Impact | undefined> {
  const pr_impact = getConventionalImpact(pr.title, pr.body);
  core.info(`Determined impact from Pull request: ${String(pr_impact)}`);
  const commits = await getPrCommits(token);

  var commit_impacts: Impact[] = [];
  // Parse each commit title
  for (const commit of commits) {
    const commit_impact = getConventionalImpact(commit.title, commit.body);
    core.debug(`Commit ${commit.sha} title: ${commit.title}`);
    core.debug(`Determined impact from commit: ${String(commit_impact)}`);
    if (commit_impact) {
      commit_impacts.push(commit_impact);
    }
  }

  const max_commit_impact = Math.max(...commit_impacts) as Impact;
  core.info(`Maximum impact from commits: ${String(max_commit_impact)}`);

  let final_impact: Impact | undefined = undefined;
  if (
    pr_impact !== undefined &&
    max_commit_impact >= 0 &&
    pr_impact != max_commit_impact
  ) {
    core.warning(
      `Impact from PR title (${Impact[pr_impact]}) differs from maximum commit impact (${Impact[max_commit_impact]}).`,
    );
    core.warning(
      `Using PR commit impact (${Impact[pr_impact]}) for version bump.`,
    );
    final_impact = pr_impact;
  } else if (pr_impact) {
    core.info(`Using PR title impact (${pr_impact}) for version bump.`);
    final_impact = pr_impact;
  } else if (max_commit_impact) {
    core.info(
      `Using maximum commit impact (${max_commit_impact}) for version bump.`,
    );
    final_impact = max_commit_impact;
  } else {
    core.error(
      `No conventional commit impacts found in PR title or commits; no version bump will be performed.`,
    );
    core.setFailed("No Impact determined.");
  }
  return final_impact;
}

export async function run() {
  try {
    const token = process.env.GITHUB_TOKEN || process.env.INPUT_GITHUB_TOKEN;

    if (!token) {
      core.setFailed("No GITHUB_TOKEN available — cannot fetch releases");
      return 
    }

    const release = await getLatestRelease(token);

    let last_release_version: SemanticVersion | undefined;
    if (release != undefined) {
      core.info("Previous release found.");
      const releaseName = release.name ?? release.tag_name ?? "";
      last_release_version = SemanticVersion.parse(releaseName);
    } else {
      core.info("No Previous release found, assuming this is v0.0.0.");
      last_release_version = new SemanticVersion(0, 0, 0);
    }

    if (last_release_version === undefined) {
      core.setFailed("Could not parse latest release version.");
      return;
    }

    core.info("Resolving pull request title...");
    const pr = getPrFromContext();
    if (!pr) {
      core.setFailed("Could not find pull request in context.");
      return;
    }
    core.info(`Found PR #${pr.number} title: ${pr.title}`);

    const impact = await getImpactFromGithub(pr, token);
    if (impact === undefined) {
      return;
    }
    // Compute the bumped base version first so we can reason about prereleases
    const bumped_base_version = last_release_version.bump(impact);

    const build_metadata = core.getInput("build-metadata");
    const is_prerelease = pr.labels?.some(
      (label) => label.name.toLowerCase() === "release-candidate",
    );

    let prerelease = undefined;    

    if (is_prerelease) {
      core.info("PR is marked as a release candidate.");
      const previous_release_candidates = await getAllRCsSinceLatestRelease(
        token,
        last_release_version,
      );

      // Determine the bumped base version (without prerelease) according to impact
      const bumped_base = last_release_version.bump(impact);

      // Extract tag names and ask SemanticVersion to compute the next RC index
      const tagNames = previous_release_candidates.map((t) => t.name);
      const nextRc = SemanticVersion.nextRcIndex(bumped_base, tagNames);
      // create the prerelease string e.g. 'rc1' (if nextRc is 1) or 'rc0' if 0
      prerelease = `rc${nextRc}`;
    }

    // already set to bumped base with build metadata above; ensure prerelease cleared
    let new_version = new SemanticVersion(
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

    core.setOutput("tag", new_version.as_tag());
    core.setOutput("version", new_version.toString());
    core.setOutput("version-pep-440", new_version.as_pep_440());
  } catch (err) {
    core.setFailed(String(err));
  }
}

// Only auto-run when not executing under Jest. Tests should import the
// module and call `run()` explicitly to control execution.
if (!process.env.JEST_WORKER_ID) {
  run();
}
