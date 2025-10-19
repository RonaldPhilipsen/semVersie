import * as core from '@actions/core';
import { Impact } from './semver.js';

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
const TypeToImpactMapping = {
  docs: Impact.NOIMPACT,
  style: Impact.NOIMPACT,
  test: Impact.NOIMPACT,
  chore: Impact.NOIMPACT,
  build: Impact.NOIMPACT,
  ci: Impact.NOIMPACT,
  refactor: Impact.PATCH,
  fix: Impact.PATCH,
  perf: Impact.PATCH,
  feat: Impact.MINOR,
};

export function getConventionalImpact(
  title: string,
  body: string | undefined,
): Impact | undefined {
  let impact = undefined;
  if (body) {
    impact = ParseConventionalBody(body);
  }

  if (impact === undefined) {
    impact = ParseConventionalTitle(title);
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
export function ParseConventionalTitle(title: string) {
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
  const key = commit_type as keyof typeof TypeToImpactMapping;
  let impact = TypeToImpactMapping[key];
  if (breaking) {
    core.debug("Detected breaking change indicator '!' in title");
    impact = Impact.MAJOR;
  }
  return impact;
}
