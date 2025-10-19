// Do not mock @actions/core here; tests assert parser return values only.
import {
  ParseConventionalTitle,
  ParseConventionalBody,
  getConventionalImpact,
} from '../src/conventional_commits';
import { Impact } from '../src/semver';

describe('ParseSemanticTitle', () => {
  test('feat with breaking-change footer => minor/major detection', () => {
    const msg = `feat: allow provided config object to extend other configs`;
    const impact = ParseConventionalTitle(msg);
    expect(impact).toBeDefined();
    // Parser returns an Impact enum value
    expect(impact).toBe(Impact.MINOR);
  });

  test('feat! (breaking) => major', () => {
    const msg = `feat!: send an email to the customer when a product is shipped`;
    const impact = ParseConventionalTitle(msg);
    expect(impact).toBeDefined();
    expect(impact).toBe(Impact.MAJOR);
  });

  test('feat(scope)! (breaking) => major', () => {
    const msg = `feat(api)!: send an email to the customer when a product is shipped`;
    const impact = ParseConventionalTitle(msg);
    expect(impact).toBeDefined();
    expect(impact).toBe(Impact.MAJOR);
  });

  test('chore! with breaking footer => major', () => {
    const msg = `chore!: drop support for old browsers`;
    const impact = ParseConventionalTitle(msg);
    expect(impact).toBeDefined();
    expect(impact).toBe(Impact.MAJOR);
  });
});

describe('conventional_commits.ts (parser) - concise coverage', () => {
  test.each([
    ['feat: add feature', Impact.MINOR],
    ['feat!: breaking change', Impact.MAJOR],
    ['feat(api)!: breaking', Impact.MAJOR],
    ['chore!: drop support', Impact.MAJOR],
    ['docs: update readme', Impact.NOIMPACT],
    ['fix: bugfix', Impact.PATCH],
  ])("ParseConventionalTitle('%s') => %p", (title, expected) => {
    expect(ParseConventionalTitle(title)).toBe(expected);
  });

  test('ParseConventionalBody recognizes BREAKING CHANGE', () => {
    expect(ParseConventionalBody('desc\n\nBREAKING CHANGE: removed')).toBe(
      Impact.MAJOR,
    );
  });

  test('getConventionalImpact prefers body over title', () => {
    expect(getConventionalImpact('feat: x', 'BREAKING CHANGE: y')).toBe(
      Impact.MAJOR,
    );
    expect(getConventionalImpact('fix: x', undefined)).toBe(Impact.PATCH);
  });

  test.each([
    ['unknown: x'],
    ['this is not conventional'],
    ['Feat: capitalized'],
    ['feat-prod: bad type'],
  ])('malformed titles return undefined: %s', (t) => {
    expect(ParseConventionalTitle(t)).toBeUndefined();
  });

  test('ParseConventionalBody returns undefined when no BREAKING CHANGE', () => {
    expect(ParseConventionalBody('normal body')).toBeUndefined();
  });
});
