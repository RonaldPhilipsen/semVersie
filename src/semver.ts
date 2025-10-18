import * as core from "@actions/core";

export enum Impact {
  NOIMPACT,
  PATCH,
  MINOR,
  MAJOR,
}

export class SemanticVersion {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
  buildmetadata?: string;

  constructor(
    major: number,
    minor: number,
    patch: number,
    prerelease: string | undefined = undefined,
    buildmetadata: string | undefined = undefined,
  ) {
    this.major = major;
    this.minor = minor;
    this.patch = patch;
    this.prerelease = prerelease;
    this.buildmetadata = buildmetadata;

    const prerelease_re =
      /^(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*$/;
    if (prerelease && !prerelease.match(prerelease_re)) {
      core.error(`Invalid prerelease format: ${prerelease}`);
      throw new Error(`Invalid prerelease format: ${prerelease}`);
    }
    const buildmetadata_re = /^[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*$/;
    if (buildmetadata && !buildmetadata.match(buildmetadata_re)) {
      core.error(`Invalid build metadata format: ${buildmetadata}`);
      throw new Error(`Invalid build metadata format: ${buildmetadata}`);
    }
  }

  toString(): string {
    let s = `${this.major}.${this.minor}.${this.patch}`;
    if (this.prerelease) s += `-${this.prerelease}`;
    if (this.buildmetadata) s += `+${this.buildmetadata}`;
    return s;
  }

  as_tag(): string {
    return `v${this.toString()}`;
  }

  as_pep_440(): string {
    let s = `${this.major}.${this.minor}.${this.patch}`;
    if (this.prerelease) {
      // Convert prerelease to PEP 440 format
      const pep440_prerelease = this.prerelease
        .replace(/-/g, ".")
        .replace(/([a-zA-Z]+)(\d*)/g, (_, p1, p2) => {
          const mapping: { [key: string]: string } = {
            alpha: "a",
            beta: "b",
            rc: "rc",
          };
          return mapping[p1] ? mapping[p1] + p2 : p1 + p2;
        });
      s += `${pep440_prerelease}`;
    }
    if (this.buildmetadata) {
      // PEP 440 uses .postN for build metadata
      core.info(
        `PEP 440 does not support build metadata; no build metadata will be provided.`,
      );
    }
    return s;
  }

  bump(
    impact: Impact,
    prerelease: string | undefined = undefined,
    buildmetadata: string | undefined = undefined,
  ): SemanticVersion {
    switch (impact) {
      case Impact.MAJOR:
        return new SemanticVersion(
          this.major + 1,
          0,
          0,
          prerelease,
          buildmetadata,
        );
      case Impact.MINOR:
        return new SemanticVersion(
          this.major,
          this.minor + 1,
          0,
          prerelease,
          buildmetadata,
        );
      case Impact.PATCH:
        return new SemanticVersion(
          this.major,
          this.minor,
          this.patch + 1,
          prerelease,
          buildmetadata,
        );
      case Impact.NOIMPACT:
      default:
        return new SemanticVersion(
          this.major,
          this.minor,
          this.patch,
          prerelease,
          buildmetadata,
        );
    }
  }

  /**
   * Compare two SemanticVersion instances.
   * Returns 1 if a > b, -1 if a < b, 0 if equal.
   * This follows semver precedence for major/minor/patch and treats
   * a version without prerelease as greater than one with a prerelease
   * for the same major.minor.patch.
   */
  static compare(a: SemanticVersion, b: SemanticVersion): number {
    if (a.major !== b.major) return a.major > b.major ? 1 : -1;
    if (a.minor !== b.minor) return a.minor > b.minor ? 1 : -1;
    if (a.patch !== b.patch) return a.patch > b.patch ? 1 : -1;

    // At this point major/minor/patch are equal — consider prerelease
    if (!a.prerelease && !b.prerelease) return 0;
    if (!a.prerelease && b.prerelease) return 1; // release > prerelease
    if (a.prerelease && !b.prerelease) return -1;

    // Both have prerelease strings — compare dot-separated identifiers
    const aParts = a.prerelease!.split(".");
    const bParts = b.prerelease!.split(".");
    const len = Math.max(aParts.length, bParts.length);
    for (let i = 0; i < len; i++) {
      const ap = aParts[i];
      const bp = bParts[i];
      if (ap === undefined) return -1;
      if (bp === undefined) return 1;
      // numeric identifiers have numeric precedence
      const an = /^[0-9]+$/.test(ap);
      const bn = /^[0-9]+$/.test(bp);
      if (an && bn) {
        const ai = Number(ap);
        const bi = Number(bp);
        if (ai !== bi) return ai > bi ? 1 : -1;
        continue;
      }
      if (an && !bn) return -1;
      if (!an && bn) return 1;
      if (ap !== bp) return ap > bp ? 1 : -1;
    }
    return 0;
  }

  compareTo(other: SemanticVersion): number {
    return SemanticVersion.compare(this, other);
  }

  static parse(version: string): SemanticVersion | undefined {
    const semver =
      /^v?(?<major>0|[1-9]\d*)\.(?<minor>0|[1-9]\d*)\.(?<patch>0|[1-9]\d*)(?:-(?<prerelease>(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+(?<buildmetadata>[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

    const match = version.match(semver);
    if (!match || !match.groups) {
      core.info(`Version string "${version}" is not valid SemVer format.`);
      return undefined;
    }
    const major = parseInt(match.groups.major, 10);
    const minor = parseInt(match.groups.minor ?? "0", 10);
    const patch = parseInt(match.groups.patch ?? "0", 10);
    const prerelease = match.groups.prerelease;
    const buildmetadata = match.groups.buildmetadata;
    const v = new SemanticVersion(major, minor, patch);
    if (prerelease) v.prerelease = prerelease;
    if (buildmetadata) v.buildmetadata = buildmetadata;
    return v;
  }

  /**
   * Given a target base version and an array of tag names (strings), find the
   * maximum 'rc' index present for tags that match the same major.minor.patch
   * and return the next index (max + 1). If none found, returns 0.
   *
   * Tags may include a leading 'v' and various prerelease separators (e.g.
   * 'rc0', 'rc.1', 'rc-2'). Only the first numeric component after 'rc' is
   * considered.
   */
  static nextRcIndex(base: SemanticVersion, tagNames: string[]): number {
    let maxRc = -1;
    for (const name of tagNames) {
      const parsed = SemanticVersion.parse(name);
      if (!parsed) continue;
      if (
        parsed.major === base.major &&
        parsed.minor === base.minor &&
        parsed.patch === base.patch &&
        parsed.prerelease
      ) {
        const m = parsed.prerelease.match(/rc(?:\.|-|_)?(\d+)/i);
        if (m) {
          const n = Number(m[1]);
          if (!isNaN(n) && n > maxRc) maxRc = n;
        }
      }
    }
    return maxRc + 1;
  }
}
