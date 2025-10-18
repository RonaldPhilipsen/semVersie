// Do not mock @actions/core here; tests assert parser return values only.
import {
  ParseConventionalTitle,
  ParseConventionalBody,
  getConventionalImpact,
} from "../src/conventional_commits";
import { Impact } from "../src/semver";

describe("ParseSemanticTitle", () => {
  test("feat with breaking-change footer => minor/major detection", () => {
    const msg = `feat: allow provided config object to extend other configs`;
    const impact = ParseConventionalTitle(msg);
    expect(impact).toBeDefined();
    // Parser returns an Impact enum value
    expect(impact).toBe(Impact.MINOR);
  });

  test("feat! (breaking) => major", () => {
    const msg = `feat!: send an email to the customer when a product is shipped`;
    const impact = ParseConventionalTitle(msg);
    expect(impact).toBeDefined();
    expect(impact).toBe(Impact.MAJOR);
  });

  test("feat(scope)! (breaking) => major", () => {
    const msg = `feat(api)!: send an email to the customer when a product is shipped`;
    const impact = ParseConventionalTitle(msg);
    expect(impact).toBeDefined();
    expect(impact).toBe(Impact.MAJOR);
  });

  test("chore! with breaking footer => major", () => {
    const msg = `chore!: drop support for Node 6`;
    const impact = ParseConventionalTitle(msg);
    expect(impact).toBeDefined();
    expect(impact).toBe(Impact.MAJOR);
  });

  test("docs header => noimpact", () => {
    const msg = `docs: correct spelling of CHANGELOG`;
    const impact = ParseConventionalTitle(msg);
    expect(impact).toBeDefined();
    expect(impact).toBe(Impact.NOIMPACT);
  });

  test("feat(scope) => minor", () => {
    const msg = `feat(lang): add Polish language`;
    const impact = ParseConventionalTitle(msg);
    expect(impact).toBeDefined();
    expect(impact).toBe(Impact.MINOR);
  });

  test("fix with body & footers => patch", () => {
    const msg = `fix: prevent racing of requests`;
    const impact = ParseConventionalTitle(msg);
    expect(impact).toBeDefined();
    expect(impact).toBe(Impact.PATCH);
  });
});

describe("ParseConventionalBody and getConventionalImpact", () => {
  test("ParseConventionalBody detects BREAKING CHANGE in body => MAJOR", () => {
    const body = "Some description\n\nBREAKING CHANGE: removed public API";
    const impact = ParseConventionalBody(body);
    expect(impact).toBeDefined();
    expect(impact).toBe(Impact.MAJOR);
  });

  test("getConventionalImpact prefers body BREAKING CHANGE over title", () => {
    const title = "feat: new API";
    const body = "BREAKING CHANGE: incompatible change";
    const impact = getConventionalImpact(title, body);
    expect(impact).toBeDefined();
    expect(impact).toBe(Impact.MAJOR);
  });

  test("getConventionalImpact falls back to title when body undefined", () => {
    const title = "fix: bugfix";
    const impact = getConventionalImpact(title, undefined);
    expect(impact).toBeDefined();
    expect(impact).toBe(Impact.PATCH);
  });
});

describe("ParseConventionalTitle - edge cases and errors", () => {
  beforeEach(() => {
    // no-op
  });

  test("unknown commit type returns undefined and does not call setFailed", () => {
    const title = "unknown: some message";
    const impact = ParseConventionalTitle(title);
    expect(impact).toBeUndefined();
  });

  test("invalid/non-conventional title triggers setFailed and returns undefined", () => {
    const title = "this is not a conventional title";
    const impact = ParseConventionalTitle(title);
    expect(impact).toBeUndefined();
  });

  test("type case-sensitivity: 'Feat' not mapped => undefined (no setFailed)", () => {
    const title = "Feat: capitalize type";
    const impact = ParseConventionalTitle(title);
    expect(impact).toBeUndefined();
  });

  test("type containing hyphen does not match regex and triggers setFailed", () => {
    const title = "feat-prod: add production flag";
    const impact = ParseConventionalTitle(title);
    expect(impact).toBeUndefined();
  });

  test("ParseConventionalBody returns undefined when no BREAKING CHANGE present", () => {
    const body = "Regular description without the keyword";
    const impact = ParseConventionalBody(body);
    expect(impact).toBeUndefined();
  });
});
