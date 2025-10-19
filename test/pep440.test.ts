import { parse_pep440 } from '../src/pep440';

describe('PEP 440 parsing and normalization', () => {
  test.each([
    ['1.2.3', '1.2.3', undefined, undefined],
    ['v1.2.3', '1.2.3', undefined, undefined],
    ['1.2.3a1', '1.2.3', 'alpha.1', undefined],
    ['1.2.3a.1', '1.2.3', 'alpha.1', undefined],
    ['1.2.3b2', '1.2.3', 'beta.2', undefined],
    ['1.2.3rc1', '1.2.3', 'rc.1', undefined],
    ['1.2.3-preview1', '1.2.3', 'pre.1', undefined],
    ['1.2.3.post2', '1.2.3', 'post.2', undefined],
    ['1.2.3+local.1', '1.2.3', undefined, 'local.1'],
    ['v0.1.0.dev3+meta', '0.1.0', 'dev.3', 'meta'],
  ])(
    '%s -> %s (prerelease=%s build=%s)',
    (input, expectedBase, expectedPre, expectedBuild) => {
      const v = parse_pep440(input);
      if (expectedBase === undefined) {
        expect(v).toBeUndefined();
        return;
      }
      expect(v).toBeDefined();
      expect(v!.major + '.' + v!.minor + '.' + v!.patch).toBe(expectedBase);
      if (expectedPre) expect(v!.prerelease).toBe(expectedPre);
      else expect(v!.prerelease).toBeUndefined();
      if (expectedBuild) expect(v!.buildmetadata).toBe(expectedBuild);
      else expect(v!.buildmetadata).toBeUndefined();
    },
  );

  test('parses epoch by ignoring it and returns version', () => {
    const v = parse_pep440('1!2.3.4rc1+local');
    expect(v).toBeDefined();
    expect(v!.major).toBe(2);
    expect(v!.prerelease).toBe('rc.1');
    expect(v!.buildmetadata).toBe('local');
  });

  test('returns undefined for invalid pep440 strings', () => {
    expect(parse_pep440('not-a-version')).toBeUndefined();
    expect(parse_pep440('1.2.x' as any)).toBeUndefined();
  });
});
