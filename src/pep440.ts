import * as core from "@actions/core";
import { SemanticVersion } from "./semver.js";

export function parse_pep440(version: string): SemanticVersion | undefined {
  const pep440 =
    /v?(?:(?:(?<epoch>[0-9]+)!)?(?<release>[0-9]+(?:\.[0-9]+)*)(?<pre>[-_\.]?(?<pre_l>(a|b|c|rc|alpha|beta|pre|preview))[-_\.]?(?<pre_n>[0-9]+)?)?(?<post>(?:-(?<post_n1>[0-9]+))|(?:[-_\.]?(?<post_l>post|rev|r)[-_\.]?(?<post_n2>[0-9]+)?))?(?<dev>[-_\.]?(?<dev_l>dev)[-_\.]?(?<dev_n>[0-9]+)?)?)(?:\+(?<local>[a-z0-9]+(?:[-_\.][a-z0-9]+)*))?/g;
  core.info(`Attempting to parse version "${version}" as PEP 440 format.`);
  const match = version.match(pep440);
  if (!match || !match.groups) {
    core.info(`Version string "${version}" is not valid PEP 440 format.`);
    return undefined;
  }

  const epoch = match.groups.epoch;
  if (epoch) {
    core.info(
      `PEP 440 epoch "${epoch}" is not supported in SemVer; it will be ignored.`,
    );
  }
  const release = match.groups.release;
  const pre_l = match.groups.pre_l;
  const pre_n = match.groups.pre_n;
  const post_n1 = match.groups.post_n1;
  const post_l = match.groups.post_l;
  const post_n2 = match.groups.post_n2;
  const dev_l = match.groups.dev_l;
  const dev_n = match.groups.dev_n;
  const local = match.groups.local;
  if (local) {
    core.info(
      `PEP 440 local version "${local}" will be used as build metadata.`,
    );
  }

  const release_parts = release.split(".").map((x) => parseInt(x, 10));
  const major = release_parts[0] || 0;
  const minor = release_parts[1] || 0;
  const patch = release_parts[2] || 0;

  let prerelease: string | undefined = undefined;
  if (pre_l) {
    prerelease = `${pre_l}${pre_n ? `.${pre_n}` : ""}`;
  } else if (post_n1 || post_l) {
    const post_n = post_n1 || post_n2 || "";
    prerelease = `post${post_n ? `.${post_n}` : ""}`;
  } else if (dev_l) {
    prerelease = `dev${dev_n ? `.${dev_n}` : ""}`;
  }

  return new SemanticVersion(major, minor, patch, prerelease, local);
}
