// Tests for getImpactFromGithub in src/main.ts (ESM-compatible mocking)
import { jest } from '@jest/globals';
// Per-file mock for @actions/github to avoid needing a shared setup file.
const mockContext: any = {
  repo: { owner: 'o', repo: 'r' },
  ref: undefined,
  payload: {},
};
const mockGetOctokit = jest.fn();
// @ts-ignore - provide ESM mock for this test file only
await (jest as any).unstable_mockModule('@actions/github', () => ({
  context: mockContext,
  getOctokit: (...args: any[]) => mockGetOctokit(...args),
}));
import { SemanticVersion, Impact } from '../src/semver.js';

describe('getImpactFromGithub - concise scenarios', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('PR title impact can override higher commit impact and warns', async () => {
    const coreMock = {
      info: jest.fn(),
      debug: jest.fn(),
      warning: jest.fn(),
      error: jest.fn(),
      setFailed: jest.fn(),
    };
    const mockedGetConventionalImpact = jest
      .fn()
      .mockImplementationOnce(() => ({ type: 'chore', impact: Impact.PATCH }))
      .mockImplementationOnce(() => ({ type: 'feat', impact: Impact.MAJOR }));
    const mockedGetPrCommits = (jest.fn() as any).mockResolvedValue([
      { sha: 'x', title: 'feat!: break', body: undefined },
    ]);

    // @ts-ignore
    await (jest as any).unstable_mockModule('@actions/core', () => coreMock);
    // @ts-ignore
    await (jest as any).unstable_mockModule(
      '../src/conventional_commits.js',
      () => ({ getConventionalImpact: mockedGetConventionalImpact }),
    );
    // @ts-ignore
    await (jest as any).unstable_mockModule('../src/github.js', () => ({
      getLatestTag: async () => undefined,
      getPrCommits: mockedGetPrCommits,
      getPrFromContext: () => undefined,
      getEventName: () => 'pull_request',
      getReleaseCandidatesSinceLatestRelease: async () => [],
      getReleaseCandidates: async () => [],
      getFileContent: async () => undefined,
      getPushCommits: async () => [],
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
        info: jest.fn(),
        debug: jest.fn(),
        warning: jest.fn(),
        error: jest.fn(),
        setFailed: jest.fn(),
        getInput: jest.fn(),
        summary: {
          addHeading: jest.fn(() => ({
            addTable: jest.fn(() => ({ addRaw: jest.fn(), write: jest.fn() })),
          })),
          write: jest.fn(),
        },
      } as any;

      jest.resetModules();
      process.env.GITHUB_TOKEN = 'tok';

      // mock github.getLatestRelease to return unparsable name
      // mock github behavior via unstable_mockModule (module will be imported by main)
      // @ts-ignore
      await (jest as any).unstable_mockModule('../src/github.js', () => ({
        getLatestTag: async () => ({ name: 'not-a-version' }),
        getPrFromContext: () => undefined,
        getEventName: () => 'pull_request',
        getPrCommits: async () => [],
        getReleaseCandidatesSinceLatestRelease: async () => [],
        getReleaseCandidates: async () => [],
        getFileContent: async () => undefined,
        getPushCommits: async () => [],
      }));
      // mock core
      // @ts-ignore
      await (jest as any).unstable_mockModule('@actions/core', () => coreMock);
      const mod = await import('../src/main.js');
      await mod.run();
      expect(coreMock.setFailed).toHaveBeenCalledWith(
        'Failed to parse version from previous release tag',
      );
    });

    test('parsed release but no PR in context -> setFailed', async () => {
      const coreMock = {
        info: jest.fn(),
        debug: jest.fn(),
        warning: jest.fn(),
        error: jest.fn(),
        setFailed: jest.fn(),
        getInput: jest.fn(),
        summary: {
          addHeading: jest.fn(() => ({
            addTable: jest.fn(() => ({ addRaw: jest.fn(), write: jest.fn() })),
          })),
          write: jest.fn(),
        },
      } as any;

      jest.resetModules();
      process.env.GITHUB_TOKEN = 'tok';

      // mock github: latest release parsed, but PR missing
      // mock github and patch core
      // @ts-ignore
      await (jest as any).unstable_mockModule('../src/github.js', () => ({
        getLatestTag: async () => ({ name: 'v1.2.3' }),
        getPrFromContext: () => undefined,
        getEventName: () => 'pull_request',
        getPrCommits: async () => [],
        getReleaseCandidatesSinceLatestRelease: async () => [],
        getReleaseCandidates: async () => [],
        getFileContent: async () => undefined,
        getPushCommits: async () => [],
      }));
      // @ts-ignore
      await (jest as any).unstable_mockModule('@actions/core', () => coreMock);
      const mod = await import('../src/main.js');
      await mod.run();
      expect(coreMock.setFailed).toHaveBeenCalledWith(
        'Could not find pull request in context.',
      );
    });

    test('happy path -> outputs tag and version', async () => {
      const coreMock = {
        info: jest.fn(),
        debug: jest.fn(),
        warning: jest.fn(),
        error: jest.fn(),
        setFailed: jest.fn(),
        getInput: jest.fn(() => ''),
        setOutput: jest.fn(),
        summary: {
          addHeading: jest.fn(() => ({
            addTable: jest.fn(() => ({ addRaw: jest.fn(), write: jest.fn() })),
          })),
          write: jest.fn(),
        },
      } as any;

      jest.resetModules();
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
      // @ts-ignore
      await (jest as any).unstable_mockModule('../src/github.js', () => ({
        getLatestTag: async () => ({ name: 'v1.2.3' }),
        getPrFromContext: () => pr,
        getEventName: () => 'pull_request',
        getPrCommits: async () => [],
        getReleaseCandidatesSinceLatestRelease: async () => [],
        getReleaseCandidates: async () => [],
        getFileContent: async () => undefined,
        getPushCommits: async () => [],
      }));
      // @ts-ignore
      await (jest as any).unstable_mockModule(
        '../src/conventional_commits.js',
        () => ({
          getConventionalImpact: () => ({ type: 'fix', impact: Impact.PATCH }),
        }),
      );
      // @ts-ignore
      await (jest as any).unstable_mockModule('@actions/core', () => coreMock);
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
        info: jest.fn(),
        debug: jest.fn(),
        warning: jest.fn(),
        error: jest.fn(),
        setFailed: jest.fn(),
        getInput: jest.fn(() => ''),
        setOutput: jest.fn(),
        summary: {
          addHeading: jest.fn(() => ({
            addTable: jest.fn(() => ({ addRaw: jest.fn(), write: jest.fn() })),
          })),
          write: jest.fn(),
        },
      } as any;

      jest.resetModules();
      process.env.GITHUB_TOKEN = 'tok';

      const pr = {
        number: 42,
        title: 'feat: new',
        body: '',
        head: { ref: 'b', sha: 's' },
        labels: [{ name: 'release-candidate' }],
      };

      // mock github to provide baseline v1.0.0 and existing rc tags for 1.0.1
      // @ts-ignore
      await (jest as any).unstable_mockModule('../src/github.js', () => ({
        getLatestTag: async () => ({ name: 'v1.0.0' }),
        getPrFromContext: () => pr,
        getEventName: () => 'pull_request',
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
        getPushCommits: async () => [],
      }));

      // mock conventional_commits to give a PATCH impact (1)
      // @ts-ignore
      await (jest as any).unstable_mockModule(
        '../src/conventional_commits.js',
        () => ({
          getConventionalImpact: () => ({ type: 'fix', impact: Impact.PATCH }),
        }),
      );

      // @ts-ignore
      await (jest as any).unstable_mockModule('@actions/core', () => coreMock);

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

    test('push event: happy path -> outputs tag and version from commits', async () => {
      const coreMock = {
        info: jest.fn(),
        debug: jest.fn(),
        warning: jest.fn(),
        error: jest.fn(),
        setFailed: jest.fn(),
        getInput: jest.fn(() => ''),
        setOutput: jest.fn(),
        summary: {
          addHeading: jest.fn(() => ({
            addTable: jest.fn(() => ({ addRaw: jest.fn(), write: jest.fn() })),
          })),
          write: jest.fn(),
        },
      } as any;

      jest.resetModules();
      process.env.GITHUB_TOKEN = 'tok';

      // @ts-ignore
      await (jest as any).unstable_mockModule('../src/github.js', () => ({
        getLatestTag: async () => ({ name: 'v2.0.0' }),
        getPrFromContext: () => undefined,
        getEventName: () => 'push',
        getPrCommits: async () => [],
        getPushCommits: async () => [
          { sha: 'abc123', title: 'feat: add new feature', body: undefined },
          { sha: 'def456', title: 'fix: resolve bug', body: undefined },
        ],
        getReleaseCandidatesSinceLatestRelease: async () => [],
        getReleaseCandidates: async () => [],
        getFileContent: async () => undefined,
      }));
      // Reset conventional_commits mock so the real parser is used
      // @ts-ignore
      await (jest as any).unstable_mockModule(
        '../src/conventional_commits.js',
        () => ({
          getConventionalImpact: (obj: any) => {
            // Inline simplified conventional commit parser for test isolation
            const re =
              /^(?<type>\w+)(?:\([^)]+\))?(?<breaking>!)?:\s*(?<description>.*)$/;
            const m = obj.title.match(re);
            if (!m) return undefined;
            const typeMap: Record<string, number> = {
              feat: 2,
              fix: 1,
              chore: 0,
              docs: 0,
            };
            const type = m.groups?.type;
            if (!type || !(type in typeMap)) return undefined;
            let impact = typeMap[type];
            if (m.groups?.breaking) impact = 3;
            return { type, impact };
          },
        }),
      );
      // @ts-ignore
      await (jest as any).unstable_mockModule('@actions/core', () => coreMock);
      const mod = await import('../src/main.js');
      await mod.run();

      // feat is MINOR, so bump from 2.0.0 -> 2.1.0
      expect(coreMock.setOutput).toHaveBeenCalledWith('tag', 'v2.1.0');
      expect(coreMock.setOutput).toHaveBeenCalledWith('version', '2.1.0');
      expect(coreMock.setOutput).toHaveBeenCalledWith('release', true);
      expect(coreMock.setOutput).toHaveBeenCalledWith('prerelease', false);
      expect(coreMock.setFailed).not.toHaveBeenCalled();
    });

    test('push event: no conventional commits -> release false', async () => {
      const coreMock = {
        info: jest.fn(),
        debug: jest.fn(),
        warning: jest.fn(),
        error: jest.fn(),
        setFailed: jest.fn(),
        getInput: jest.fn(() => ''),
        setOutput: jest.fn(),
        summary: {
          addHeading: jest.fn(() => ({
            addTable: jest.fn(() => ({ addRaw: jest.fn(), write: jest.fn() })),
          })),
          write: jest.fn(),
        },
      } as any;

      jest.resetModules();
      process.env.GITHUB_TOKEN = 'tok';

      // @ts-ignore
      await (jest as any).unstable_mockModule('../src/github.js', () => ({
        getLatestTag: async () => ({ name: 'v1.0.0' }),
        getPrFromContext: () => undefined,
        getEventName: () => 'push',
        getPrCommits: async () => [],
        getPushCommits: async () => [
          {
            sha: 'abc123',
            title: 'update readme',
            body: undefined,
          },
        ],
        getReleaseCandidatesSinceLatestRelease: async () => [],
        getReleaseCandidates: async () => [],
        getFileContent: async () => undefined,
      }));
      // Mock conventional_commits to return undefined for non-conventional titles
      // @ts-ignore
      await (jest as any).unstable_mockModule(
        '../src/conventional_commits.js',
        () => ({
          getConventionalImpact: () => undefined,
        }),
      );
      // @ts-ignore
      await (jest as any).unstable_mockModule('@actions/core', () => coreMock);
      const mod = await import('../src/main.js');
      await mod.run();

      expect(coreMock.setOutput).toHaveBeenCalledWith('release', false);
      expect(coreMock.setFailed).not.toHaveBeenCalled();
    });

    test('push event: no commits in push -> skips version bump', async () => {
      const coreMock = {
        info: jest.fn(),
        debug: jest.fn(),
        warning: jest.fn(),
        error: jest.fn(),
        setFailed: jest.fn(),
        getInput: jest.fn(() => ''),
        setOutput: jest.fn(),
        summary: {
          addHeading: jest.fn(() => ({
            addTable: jest.fn(() => ({ addRaw: jest.fn(), write: jest.fn() })),
          })),
          write: jest.fn(),
        },
      } as any;

      jest.resetModules();
      process.env.GITHUB_TOKEN = 'tok';

      // @ts-ignore
      await (jest as any).unstable_mockModule('../src/github.js', () => ({
        getLatestTag: async () => ({ name: 'v1.0.0' }),
        getPrFromContext: () => undefined,
        getEventName: () => 'push',
        getPrCommits: async () => [],
        getPushCommits: async () => [],
        getReleaseCandidatesSinceLatestRelease: async () => [],
        getReleaseCandidates: async () => [],
        getFileContent: async () => undefined,
      }));
      // Reset conventional_commits mock
      // @ts-ignore
      await (jest as any).unstable_mockModule(
        '../src/conventional_commits.js',
        () => ({
          getConventionalImpact: () => undefined,
        }),
      );
      // @ts-ignore
      await (jest as any).unstable_mockModule('@actions/core', () => coreMock);
      const mod = await import('../src/main.js');
      await mod.run();

      // Should not set any version outputs when there are no commits
      expect(coreMock.setOutput).not.toHaveBeenCalledWith(
        'tag',
        expect.anything(),
      );
      expect(coreMock.setFailed).not.toHaveBeenCalled();
    });

    test('unknown event with no PR context falls back to push handler', async () => {
      const coreMock = {
        info: jest.fn(),
        debug: jest.fn(),
        warning: jest.fn(),
        error: jest.fn(),
        setFailed: jest.fn(),
        getInput: jest.fn(() => ''),
        setOutput: jest.fn(),
        summary: {
          addHeading: jest.fn(() => ({
            addTable: jest.fn(() => ({ addRaw: jest.fn(), write: jest.fn() })),
          })),
          write: jest.fn(),
        },
      } as any;

      jest.resetModules();
      process.env.GITHUB_TOKEN = 'tok';

      // @ts-ignore
      await (jest as any).unstable_mockModule('../src/github.js', () => ({
        getLatestTag: async () => ({ name: 'v1.0.0' }),
        getPrFromContext: () => undefined,
        getEventName: () => 'workflow_dispatch',
        getPrCommits: async () => [],
        getPushCommits: async () => [
          { sha: 'a1', title: 'fix: patch thing', body: undefined },
        ],
        getReleaseCandidatesSinceLatestRelease: async () => [],
        getReleaseCandidates: async () => [],
        getFileContent: async () => undefined,
      }));
      // @ts-ignore
      await (jest as any).unstable_mockModule(
        '../src/conventional_commits.js',
        () => ({
          getConventionalImpact: (obj: any) => {
            const re =
              /^(?<type>\w+)(?:\([^)]+\))?(?<breaking>!)?:\s*(?<description>.*)$/;
            const m = obj.title.match(re);
            if (!m) return undefined;
            const typeMap: Record<string, number> = {
              feat: 2,
              fix: 1,
              chore: 0,
              docs: 0,
            };
            const type = m.groups?.type;
            if (!type || !(type in typeMap)) return undefined;
            let impact = typeMap[type];
            if (m.groups?.breaking) impact = 3;
            return { type, impact };
          },
        }),
      );
      // @ts-ignore
      await (jest as any).unstable_mockModule('@actions/core', () => coreMock);
      const mod = await import('../src/main.js');
      await mod.run();

      // Should use push handler and produce a PATCH bump
      expect(coreMock.setOutput).toHaveBeenCalledWith('tag', 'v1.0.1');
      expect(coreMock.setOutput).toHaveBeenCalledWith('version', '1.0.1');
      expect(coreMock.setFailed).not.toHaveBeenCalled();
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
