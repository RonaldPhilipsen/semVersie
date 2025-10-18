import { assert } from "console";
import { SemanticVersion, Impact } from "../src/semver";

describe("SemanticVersion.bump", () => {
  test("major bump resets minor and patch", () => {
    const v = new SemanticVersion(1, 2, 3);
    const bumped = v.bump(Impact.MAJOR, undefined, undefined);
    expect(bumped.major).toBe(2);
    expect(bumped.minor).toBe(0);
    expect(bumped.patch).toBe(0);
    // original should be unchanged
    expect(v.major).toBe(1);
    expect(v.minor).toBe(2);
    expect(v.patch).toBe(3);
  });

  test("minor bump resets patch", () => {
    const v = new SemanticVersion(1, 2, 3);
    const bumped = v.bump(Impact.MINOR, undefined, undefined);
    expect(bumped.major).toBe(1);
    expect(bumped.minor).toBe(3);
    expect(bumped.patch).toBe(0);
    // original should be unchanged
    expect(v.major).toBe(1);
    expect(v.minor).toBe(2);
    expect(v.patch).toBe(3);
  });

  test("patch bump increments patch only", () => {
    const v = new SemanticVersion(1, 2, 3);
    const bumped = v.bump(Impact.PATCH, undefined, undefined);
    expect(bumped.major).toBe(1);
    expect(bumped.minor).toBe(2);
    expect(bumped.patch).toBe(4);
    // original should be unchanged
    expect(v.patch).toBe(3);
  });

  test("noimpact keeps numbers but accepts metadata", () => {
    const v = new SemanticVersion(1, 2, 3);
    const bumped = v.bump(Impact.NOIMPACT, "alpha.1", "exp.sha.5114f85");
    expect(bumped.major).toBe(1);
    expect(bumped.minor).toBe(2);
    expect(bumped.patch).toBe(3);
    expect(bumped.prerelease).toBe("alpha.1");
    expect(bumped.buildmetadata).toBe("exp.sha.5114f85");
    // original should not have metadata set
    expect(v.prerelease).toBeUndefined();
    expect(v.buildmetadata).toBeUndefined();
  });

  test("bump with metadata on major/minor/patch", () => {
    const v = new SemanticVersion(0, 9, 9);
    const b1 = v.bump(Impact.MAJOR, "rc.1", "build.1");
    expect(b1.toString()).toBe("1.0.0-rc.1+build.1");

    const b2 = v.bump(Impact.MINOR, "beta", "m1");
    expect(b2.toString()).toBe("0.10.0-beta+m1");

    const b3 = v.bump(Impact.PATCH, undefined, "m2");
    expect(b3.toString()).toBe("0.9.10+m2");
  });
});

test("parse simple version", () => {
  const v = SemanticVersion.parse("1.2.3")!;
  expect(v.major).toBe(1);
  expect(v.minor).toBe(2);
  expect(v.patch).toBe(3);
  expect(v.prerelease).toBeUndefined();
  expect(v.buildmetadata).toBeUndefined();
});

test("parse prerelease and buildmetadata", () => {
  const v = SemanticVersion.parse("1.2.3-alpha.1+exp.sha.5114f85")!;
  expect(v.major).toBe(1);
  expect(v.minor).toBe(2);
  expect(v.patch).toBe(3);
  expect(v.prerelease).toBe("alpha.1");
  expect(v.buildmetadata).toBe("exp.sha.5114f85");
});

test("parse v-prefixed version", () => {
  const v = SemanticVersion.parse("v1.2.3")!;
  expect(v.major).toBe(1);
  expect(v.minor).toBe(2);
  expect(v.patch).toBe(3);
});

test("parse v-prefixed prerelease and metadata", () => {
  const v = SemanticVersion.parse("v1.2.3-alpha.1+build123")!;
  expect(v.major).toBe(1);
  expect(v.minor).toBe(2);
  expect(v.patch).toBe(3);
  expect(v.prerelease).toBe("alpha.1");
  expect(v.buildmetadata).toBe("build123");
});

test("invalid version returns undefined", () => {
  expect(SemanticVersion.parse("not-a-version")).toBe(undefined);
});

describe("SemanticVersion.output", () => {
  test("toString and as_tag with prerelease and buildmetadata", () => {
    const v = new SemanticVersion(1, 0, 0, "alpha.1", "build.1");
    expect(v.toString()).toBe("1.0.0-alpha.1+build.1");
    expect(v.as_tag()).toBe("v1.0.0-alpha.1+build.1");
  });

  test("as_pep_440 converts prerelease identifiers", () => {
    const v1 = new SemanticVersion(1, 2, 3, "alpha.1", undefined);
    // alpha -> a (implementation keeps a dot before the numeric part)
    expect(v1.as_pep_440()).toBe("1.2.3a.1");

    const v2 = new SemanticVersion(2, 0, 0, "beta.2", undefined);
    expect(v2.as_pep_440()).toBe("2.0.0b.2");

    const v3 = new SemanticVersion(0, 1, 0, "rc.1", undefined);
    expect(v3.as_pep_440()).toBe("0.1.0rc.1");

    // unknown identifier should be preserved (e.g., 'preview')
    const v4 = new SemanticVersion(0, 0, 1, "preview.5", undefined);
    expect(v4.as_pep_440()).toBe("0.0.1preview.5");
  });

  test("constructor rejects invalid prerelease and build metadata", () => {
    // invalid prerelease (contains invalid characters)
    expect(() => new SemanticVersion(1, 0, 0, "*bad*", undefined)).toThrow();
    // invalid build metadata (contains spaces)
    expect(() => new SemanticVersion(1, 0, 0, undefined, "bad meta")).toThrow();
  });

  test("parse rejects invalid versions and leading zeros", () => {
    expect(SemanticVersion.parse("not-a-version")).toBeUndefined();
    // leading zeros in major/minor/patch are invalid unless zero
    expect(SemanticVersion.parse("01.2.3")).toBeUndefined();
    expect(SemanticVersion.parse("1.02.3")).toBeUndefined();
    expect(SemanticVersion.parse("1.2.03")).toBeUndefined();
  });

  test("bump NOIMPACT preserves numbers and applies metadata", () => {
    const v = new SemanticVersion(3, 4, 5);
    const b = v.bump(Impact.NOIMPACT, "pre", "buildmeta");
    expect(b.major).toBe(3);
    expect(b.minor).toBe(4);
    expect(b.patch).toBe(5);
    expect(b.prerelease).toBe("pre");
    expect(b.buildmetadata).toBe("buildmeta");
  });
});

describe("SemanticVersion.nextRcIndex", () => {
  test("returns 0 when no tags provided", () => {
    const base = new SemanticVersion(1, 2, 3);
    expect(SemanticVersion.nextRcIndex(base, [])).toBe(0);
  });

  test("returns 1 when rc0 exists for same version", () => {
    const base = new SemanticVersion(1, 2, 3);
    const tags = ["v1.2.3-rc0", "v1.2.3"];
    expect(SemanticVersion.nextRcIndex(base, tags)).toBe(1);
  });

  test("ignores rc for other versions", () => {
    const base = new SemanticVersion(1, 2, 3);
    const tags = ["v1.2.2-rc3", "v1.3.0-rc1"];
    expect(SemanticVersion.nextRcIndex(base, tags)).toBe(0);
  });

  test("picks maximum rc index among multiple tags", () => {
    const base = new SemanticVersion(2, 0, 0);
    const tags = ["v2.0.0-rc0", "v2.0.0-rc2", "v2.0.0-rc1"];
    expect(SemanticVersion.nextRcIndex(base, tags)).toBe(3);
  });

  test("ignores malformed prereleases and non-numeric rc parts", () => {
    const base = new SemanticVersion(3, 1, 4);
    const tags = ["v3.1.4-rcX", "v3.1.4-preview", "v3.1.4-rc.0"];
    expect(SemanticVersion.nextRcIndex(base, tags)).toBe(1);
  });
});
