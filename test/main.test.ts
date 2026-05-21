// Tests for getImpactFromGithub in src/main.ts (ESM-compatible mocking)
// Per-file mock for @actions/github to avoid needing a shared setup file.
const mockContext: any = {
  repo: { owner: 'o', repo: 'r' },
  ref: undefined,
  payload: {},
};
const mockGetOctokit = vi.fn();
vi.doMock('@actions/github', () => ({
  context: mockContext,
  getOctokit: (...args: any[]) => mockGetOctokit(...args),
}));
import { SemanticVersion, Impact } from '../src/semver.js';

describe('getImpactFromGithub - concise scenarios', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test('PR title impact can override higher commit impact and warns', async () => {
    const coreMock = {
      info: vi.fn(),
      debug: vi.fn(),
      warning: vi.fn(),
      error: vi.fn(),
      setFailed: vi.fn(),
    };
    const mockedGetConventionalImpact = vi
      .fn()
      .mockImplementationOnce(() => ({ type: 'chore', impact: Impact.PATCH }))
      .mockImplementationOnce(() => ({ type: 'feat', impact: Impact.MAJOR }));
    const mockedGetPrCommits = (vi.fn() as any).mockResolvedValue([
      { sha: 'x', title: 'feat!: break', body: undefined },
    ]);

    vi.doMock('@actions/core', () => coreMock);

    vi.doMock('../src/conventional_commits.js', () => ({
      getConventionalImpact: mockedGetConventionalImpact,
    }));

    vi.doMock('../src/github.js', () => ({
      getLatestTag: async () => undefined,
      getPrCommits: mockedGetPrCommits,
      getPrFromContext: () => undefined,
      getPrFromContextOrLatestCommit: () => undefined,
      getReleaseCandidatesSinceLatestRelease: async () => [],
      getReleaseCandidates: async () => [],
      getFileContent: async () => undefined,
    }));

    const mod = await import('../src/main.js');
    const { getImpactFromGithub } = mod;
    const pr = {
      number: 1,
      title: 'chore: trivial',
      body: '',
      head: { ref: 'x', sha: 's' },
      labels: [],
    } as any;
    const res = await getImpactFromGithub(pr, await mockedGetPrCommits());
    expect(res.finalImpact?.impact).toBe(Impact.PATCH);
    expect(res.warning).toBeDefined();
  });

  describe('run() behavior', () => {
    test('unparsable latest release -> setFailed', async () => {
      const coreMock = {
        info: vi.fn(),
        debug: vi.fn(),
        warning: vi.fn(),
        error: vi.fn(),
        setFailed: vi.fn(),
        getInput: vi.fn(),
        summary: {
          addHeading: vi.fn(() => ({
            addTable: vi.fn(() => ({ addRaw: vi.fn(), write: vi.fn() })),
          })),
          write: vi.fn(),
        },
      } as any;

      vi.resetModules();
      process.env.GITHUB_TOKEN = 'tok';

      // mock github.getLatestRelease to return unparsable name
      // mock github behavior via unstable_mockModule (module will be imported by main)

      vi.doMock('../src/github.js', () => ({
        getLatestTag: async () => ({ name: 'not-a-version' }),
        getPrFromContext: () => undefined,
        getPrFromContextOrLatestCommit: () => undefined,
        getPrCommits: async () => [],
        getReleaseCandidatesSinceLatestRelease: async () => [],
        getReleaseCandidates: async () => [],
        getFileContent: async () => undefined,
      }));
      // mock core

      vi.doMock('@actions/core', () => coreMock);
      const mod = await import('../src/main.js');
      await mod.run();
      expect(coreMock.setFailed).toHaveBeenCalledWith(
        'Failed to parse version from previous release tag',
      );
    });

    test('parsed release but no PR in context -> setFailed', async () => {
      const coreMock = {
        info: vi.fn(),
        debug: vi.fn(),
        warning: vi.fn(),
        error: vi.fn(),
        setFailed: vi.fn(),
        getInput: vi.fn(),
        summary: {
          addHeading: vi.fn(() => ({
            addTable: vi.fn(() => ({ addRaw: vi.fn(), write: vi.fn() })),
          })),
          write: vi.fn(),
        },
      } as any;

      vi.resetModules();
      process.env.GITHUB_TOKEN = 'tok';

      // mock github: latest release parsed, but PR missing
      // mock github and patch core

      vi.doMock('../src/github.js', () => ({
        getLatestTag: async () => ({ name: 'v1.2.3' }),
        getPrFromContext: () => undefined,
        getPrFromContextOrLatestCommit: () => undefined,
        getPrCommits: async () => [],
        getReleaseCandidatesSinceLatestRelease: async () => [],
        getReleaseCandidates: async () => [],
        getFileContent: async () => undefined,
      }));

      vi.doMock('@actions/core', () => coreMock);
      const mod = await import('../src/main.js');
      await mod.run();
      expect(coreMock.setFailed).toHaveBeenCalledWith(
        'Could not find pull request in context.',
      );
    });

    test('happy path -> outputs tag and version', async () => {
      const coreMock = {
        info: vi.fn(),
        debug: vi.fn(),
        warning: vi.fn(),
        error: vi.fn(),
        setFailed: vi.fn(),
        getInput: vi.fn(() => ''),
        getBooleanInput: vi.fn(() => false),
        setOutput: vi.fn(),
        summary: {
          addHeading: vi.fn(() => ({
            addTable: vi.fn(() => ({ addRaw: vi.fn(), write: vi.fn() })),
          })),
          write: vi.fn(),
        },
      } as any;

      vi.resetModules();
      process.env.GITHUB_TOKEN = 'tok';

      const pr = {
        number: 5,
        title: 'chore: x',
        body: '',
        head: { ref: 'b', sha: 's' },
        labels: [],
      };

      // mock github and conventional_commits
      // mock github and conventional_commits and patch core

      vi.doMock('../src/github.js', () => ({
        getLatestTag: async () => ({ name: 'v1.2.3' }),
        getPrFromContext: () => pr,
        getPrFromContextOrLatestCommit: () => pr,
        getPrCommits: async () => [],
        getReleaseCandidatesSinceLatestRelease: async () => [],
        getReleaseCandidates: async () => [],
        getFileContent: async () => undefined,
        ensureImpactLabels: async () => {},
        addImpactLabelToPr: async () => {},
      }));

      vi.doMock('../src/conventional_commits.js', () => ({
        getConventionalImpact: () => ({ type: 'fix', impact: Impact.PATCH }),
      }));

      vi.doMock('@actions/core', () => coreMock);
      const mod = await import('../src/main.js');
      await mod.run();

      // bumped from v1.2.3 with impact 1 (PATCH) => 1.2.4
      expect(coreMock.setOutput).toHaveBeenCalledWith('tag', 'v1.2.4');
      expect(coreMock.setOutput).toHaveBeenCalledWith('version', '1.2.4');
      expect(coreMock.setOutput).toHaveBeenCalledWith(
        'version-pep-440',
        '1.2.4',
      );
    });

    test('pr with release-candidate label sets prerelease and outputs rc index', async () => {
      const coreMock = {
        info: vi.fn(),
        debug: vi.fn(),
        warning: vi.fn(),
        error: vi.fn(),
        setFailed: vi.fn(),
        getInput: vi.fn(() => ''),
        getBooleanInput: vi.fn(() => false),
        setOutput: vi.fn(),
        summary: {
          addHeading: vi.fn(() => ({
            addTable: vi.fn(() => ({ addRaw: vi.fn(), write: vi.fn() })),
          })),
          write: vi.fn(),
        },
      } as any;

      vi.resetModules();
      process.env.GITHUB_TOKEN = 'tok';

      const pr = {
        number: 42,
        title: 'feat: new',
        body: '',
        head: { ref: 'b', sha: 's' },
        labels: [{ name: 'release-candidate' }],
      };

      // mock github to provide baseline v1.0.0 and existing rc tags for 1.0.1

      vi.doMock('../src/github.js', () => ({
        getLatestTag: async () => ({ name: 'v1.0.0' }),
        getPrFromContext: () => pr,
        getPrFromContextOrLatestCommit: () => pr,
        getPrCommits: async () => [],
        getReleaseCandidatesSinceLatestRelease: async () => [
          { name: 'v1.0.1-rc.0' },
          { name: 'v1.0.1-rc.1' },
        ],
        getReleaseCandidates: async () => [
          { name: 'v1.0.1-rc.0' },
          { name: 'v1.0.1-rc.1' },
        ],
        getFileContent: async () => undefined,
        ensureImpactLabels: async () => {},
        addImpactLabelToPr: async () => {},
      }));

      // mock conventional_commits to give a PATCH impact (1)

      vi.doMock('../src/conventional_commits.js', () => ({
        getConventionalImpact: () => ({ type: 'fix', impact: Impact.PATCH }),
      }));

      vi.doMock('@actions/core', () => coreMock);

      const mod = await import('../src/main.js');

      await mod.run();

      // Expect that the produced tag is a prerelease containing an rc index
      const calls = coreMock.setOutput.mock.calls.map((c: any[]) => c[1]);
      const tag = calls.find(
        (c: string) => typeof c === 'string' && c.startsWith('v'),
      );
      expect(tag).toMatch(/-rc[0-9]+$/);
    });

    test('SemanticVersion.nextRcIndex returns the next index for existing RCs', () => {
      const base = new SemanticVersion(1, 0, 1);
      const tags = ['v1.0.1-rc.0', 'v1.0.1-rc.1'];
      const next = SemanticVersion.nextRcIndex(base, tags);
      expect(next).toBe(2);
    });

    test('add-pr-label enabled calls ensureImpactLabels and addImpactLabelToPr', async () => {
      const ensureLabelsCalled = vi.fn();
      const addLabelCalled = vi.fn();

      const coreMock = {
        info: vi.fn(),
        debug: vi.fn(),
        warning: vi.fn(),
        error: vi.fn(),
        setFailed: vi.fn(),
        getInput: vi.fn(() => ''),
        getBooleanInput: vi.fn((name: string) => {
          if (name === 'add-pr-label') return true;
          if (name === 'label-prefix') return true;
          return false;
        }),
        setOutput: vi.fn(),
        summary: {
          addHeading: vi.fn(() => ({
            addTable: vi.fn(() => ({ addRaw: vi.fn(), write: vi.fn() })),
          })),
          write: vi.fn(),
        },
      } as any;

      vi.resetModules();
      process.env.GITHUB_TOKEN = 'tok';

      const pr = {
        number: 10,
        title: 'feat: new feature',
        body: '',
        head: { ref: 'b', sha: 's' },
        labels: [],
      };

      vi.doMock('../src/github.js', () => ({
        getLatestTag: async () => ({ name: 'v1.0.0' }),
        getPrFromContext: () => pr,
        getPrFromContextOrLatestCommit: () => pr,
        getPrCommits: async () => [],
        getReleaseCandidates: async () => [],
        getFileContent: async () => undefined,
        ensureImpactLabels: ensureLabelsCalled,
        addImpactLabelToPr: addLabelCalled,
      }));

      vi.doMock('../src/conventional_commits.js', () => ({
        getConventionalImpact: () => ({ type: 'feat', impact: Impact.MINOR }),
      }));

      vi.doMock('@actions/core', () => coreMock);
      const mod = await import('../src/main.js');
      await mod.run();

      // Verify that label functions were called
      expect(ensureLabelsCalled).toHaveBeenCalledWith('tok', 'semVersie:');
      expect(addLabelCalled).toHaveBeenCalledWith(
        'tok',
        10,
        'minor',
        'semVersie:',
      );
    });

    test('add-pr-label with NOIMPACT adds no-impact label', async () => {
      const ensureLabelsCalled = vi.fn();
      const addLabelCalled = vi.fn();

      const coreMock = {
        info: vi.fn(),
        debug: vi.fn(),
        warning: vi.fn(),
        error: vi.fn(),
        setFailed: vi.fn(),
        getInput: vi.fn(() => ''),
        getBooleanInput: vi.fn((name: string) => {
          if (name === 'add-pr-label') return true;
          return false;
        }),
        setOutput: vi.fn(),
        summary: {
          addHeading: vi.fn(() => ({
            addTable: vi.fn(() => ({ addRaw: vi.fn(), write: vi.fn() })),
          })),
          write: vi.fn(),
        },
      } as any;

      vi.resetModules();
      process.env.GITHUB_TOKEN = 'tok';

      const pr = {
        number: 42,
        title: 'docs: update readme',
        body: '',
        head: { ref: 'b', sha: 's' },
        labels: [],
      };

      vi.doMock('../src/github.js', () => ({
        getLatestTag: async () => ({ name: 'v1.0.0' }),
        getPrFromContext: () => pr,
        getPrFromContextOrLatestCommit: () => pr,
        getPrCommits: async () => [],
        getReleaseCandidates: async () => [],
        getFileContent: async () => undefined,
        ensureImpactLabels: ensureLabelsCalled,
        addImpactLabelToPr: addLabelCalled,
      }));

      vi.doMock('../src/conventional_commits.js', () => ({
        getConventionalImpact: () => ({
          type: 'docs',
          impact: Impact.NOIMPACT,
        }),
      }));

      vi.doMock('@actions/core', () => coreMock);
      const mod = await import('../src/main.js');
      await mod.run();

      // Verify that label functions were called with no-impact
      expect(ensureLabelsCalled).toHaveBeenCalledWith('tok', '');
      expect(addLabelCalled).toHaveBeenCalledWith('tok', 42, 'noimpact', '');
    });
  });
});

// Ensure any release notes file created by tests is cleaned up
import { access, unlink } from 'fs/promises';
import { constants } from 'fs';

afterEach(async () => {
  const path = './release-notes.md';
  try {
    await access(path, constants.F_OK);
    // If file exists, remove it
    await unlink(path);
  } catch {
    // ignore if file does not exist or cannot be removed
  }
});
