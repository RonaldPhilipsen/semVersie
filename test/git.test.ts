vi.mock('../src/utils', () => ({
  filterRCTagsByBaseline: vi.fn(() => [{ name: 'v1.0.0-rc1' }]),
}));

import { parseCommitsOutput, parseTagsOutput } from '../src/git.js';

describe('git module', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  test('parseCommitsOutput parses git log output correctly', () => {
    const output =
      'abc123|||Fix bug|||Details of the bug\n' +
      'def456|||Add feature|||More details\n';

    const commits = parseCommitsOutput(output);

    expect(commits).toHaveLength(2);
    expect(commits[0]).toEqual({
      sha: 'abc123',
      title: 'Fix bug',
      body: 'Details of the bug',
    });
    expect(commits[1]).toEqual({
      sha: 'def456',
      title: 'Add feature',
      body: 'More details',
    });
  });

  test('parseTagsOutput parses git tag for-each-ref output correctly', () => {
    const isoDate = new Date().toISOString();
    const output =
      `v2.0.0|||commitsha2|||Alice|||${isoDate}|||Release 2.0\n` +
      `v1.5.0|||commitsha1|||Bob|||${isoDate}|||Release 1.5\n`;

    const tags = parseTagsOutput(output);

    expect(tags).toHaveLength(2);
    expect(tags[0].name).toBe('v2.0.0');
    expect(tags[0].commit).toBe('commitsha2');
    expect(tags[0].author).toBe('Alice');
  });
});
