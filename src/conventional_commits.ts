import * as core from '@actions/core';
import {
  Impact,
  ConventionalCommitType,
  ParsedCommitInfo,
  TypeToImpactMapping,
} from './types.js';

/**
 * Maps conventional commit types to the corresponding BumpType used by the versioning logic.
 *
 * Each property key is a conventional commit "type" (for example "feat", "fix", "chore") and each
 * value is a member of the BumpType enum that indicates how the package version should be
 * incremented when commits of that type are present:
 *
 * - BumpType.NOIMPACT: changes that should not affect the published version (e.g. docs, style, test, chore, build, ci)
 * - BumpType.PATCH: backward-compatible bug fixes or small refactors/performance improvements (e.g. refactor, fix, perf)
 * - BumpType.MINOR: new, backward-compatible features (e.g. feat)
 *
 * The mapping is consulted during release calculation to determine the highest-impact bump required
 * across a set of commits.
 *
 * @example
 * // Example usage:
 * // const impact = TypeToImpactMapping['feat']; // -> BumpType.MINOR
 *
 * @readonly
 */

export function getConventionalImpact(
  title: string,
  body: string | undefined,
): ParsedCommitInfo | undefined {
  const impact = ParseConventionalTitle(title);
  if (!impact) {
    core.info(
      'Title did not conform to Conventional Commits, no impact determined',
    );
    return undefined;
  }
  if (body) {
    const body_impact = ParseConventionalBody(body);
    if (body_impact && body_impact > impact.impact) {
      core.info(
        `Body indicates higher impact (${Impact[body_impact]}) than title (${Impact[impact.impact]}), using body impact`,
      );
      impact.impact = body_impact;
    }
  }
  return impact;
}

/**
 *
 * @param body PR body string
 * @returns BumpType.MAJOR if "BREAKING CHANGE" is found, otherwise undefined
 */
export function ParseConventionalBody(body: string) {
  if (body.includes('BREAKING CHANGE')) {
    return Impact.MAJOR;
  }
  return undefined;
}

/**
 * Function to parse a PR title according to Conventional Commits specification
 * <type>[optional scope]: <description>
 * @param title PR title string
 */
export function ParseConventionalTitle(
  title: string,
): ParsedCommitInfo | undefined {
  // Use a real RegExp so named capture groups work
  const re =
    /^(?<type>\w+)(?:\((?<scope>[^)]+)\))?(?<breaking>!)?:\s*(?<description>.*)$/;
  const match = title.match(re);
  if (!match) {
    core.setFailed(
      `PR title does not conform to Conventional Commits format: ${title}`,
    );
    return undefined;
  }
  const commit_type = match.groups?.['type'];

  if (!commit_type) {
    core.setFailed(`Could not extract commit type from PR title: ${title}`);
    return undefined;
  }
  const breaking = match.groups?.['breaking'];
  core.debug(`Extracted commit type: ${commit_type}`);
  const type = commit_type as ConventionalCommitType;
  if (!(type in TypeToImpactMapping)) {
    core.error(
      `Commit type '${type}' not recognized in Conventional Commits mapping`,
    );
    return undefined;
  }
  let impact = TypeToImpactMapping[type];
  if (breaking) {
    core.debug("Detected breaking change indicator '!' in title");
    impact = Impact.MAJOR;
  }
  return { type, impact };
}
