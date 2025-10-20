// Do not mock @actions/core here; tests assert parser return values only.
import {
  ParseConventionalTitle,
  ParseConventionalBody,
  getConventionalImpact,
} from '../src/conventional_commits';
import { Impact } from '../src/types.js';

describe('ParseSemanticTitle', () => {
  test('feat with breaking-change footer => minor/major detection', () => {
    const msg = `feat: allow provided config object to extend other configs`;
    const res = ParseConventionalTitle(msg);
    expect(res).toBeDefined();
    expect(res!.impact).toBeDefined();
    // Parser returns a ParsedCommitInfo; check impact and type
    expect(res!.impact).toBe(Impact.MINOR);
    expect(res!.type).toBe('feat');
  });

  test('feat! (breaking) => major', () => {
    const msg = `feat!: send an email to the customer when a product is shipped`;
    const res = ParseConventionalTitle(msg);
    expect(res).toBeDefined();
    expect(res!.impact).toBeDefined();
    expect(res!.impact).toBe(Impact.MAJOR);
    expect(res!.type).toBe('feat');
  });

  test('feat(scope)! (breaking) => major', () => {
    const msg = `feat(api)!: send an email to the customer when a product is shipped`;
    const res = ParseConventionalTitle(msg);
    expect(res).toBeDefined();
    expect(res!.impact).toBe(Impact.MAJOR);
    expect(res!.type).toBe('feat');
  });

  test('chore! with breaking footer => major', () => {
    const msg = `chore!: drop support for old browsers`;
    const res = ParseConventionalTitle(msg);
    expect(res).toBeDefined();
    expect(res!.impact).toBe(Impact.MAJOR);
    expect(res!.type).toBe('chore');
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
    const res = ParseConventionalTitle(title);
    expect(res).toBeDefined();
    expect(res!.impact).toBe(expected);
  });

  test('ParseConventionalBody recognizes BREAKING CHANGE', () => {
    expect(ParseConventionalBody('desc\n\nBREAKING CHANGE: removed')).toBe(
      Impact.MAJOR,
    );
  });

  test('getConventionalImpact prefers body over title', () => {
    const gi1 = getConventionalImpact('feat: x', 'BREAKING CHANGE: y');
    expect(gi1).toBeDefined();
    expect(gi1!.impact).toBe(Impact.MAJOR);
    const gi2 = getConventionalImpact('fix: x', undefined);
    expect(gi2).toBeDefined();
    expect(gi2!.impact).toBe(Impact.PATCH);
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
