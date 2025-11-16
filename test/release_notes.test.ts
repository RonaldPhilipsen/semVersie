import { generateReleaseNotes } from '../src/release_notes.js';
import type { Commit } from '../src/git.js';

describe('generateReleaseNotes', () => {
  test('groups commits into sections and formats entries', () => {
    const commits: Commit[] = [
      { sha: 'aaaaaaaaaaaaaaaa', title: 'feat: add feature', body: undefined },
      { sha: 'bbbbbbbbbbbbbbbb', title: 'fix: fix bug', body: undefined },
      { sha: 'cccccccccccccccc', title: 'docs: update', body: undefined },
      {
        sha: 'dddddddddddddddd',
        title: 'feat!: BREAKING change',
        body: 'BREAKING CHANGE: big change',
      },
    ];

    const notes = generateReleaseNotes(commits);
    expect(notes).toContain('# Release Notes');
    expect(notes).toMatch(/Breaking Changes/);
    expect(notes).toMatch(/New Features/);
    expect(notes).toMatch(/Bug Fixes/);
    // entries contain full titles and 7-char shas
    expect(notes).toMatch(/- feat: add feature \(aaaaaaa\)/);
    expect(notes).toMatch(/- fix: fix bug \(bbbbbbb\)/);
  });
});
