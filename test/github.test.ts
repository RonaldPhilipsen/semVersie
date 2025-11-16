import { jest } from '@jest/globals';

// Consolidated GitHub-related tests (cache, edge cases, and helpers)

describe('github module', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env.GITHUB_TOKEN = 'tok';
  });

  // Basic shared mocks for @actions/core are provided in individual tests where needed.

  test('context helpers parse PR payload shapes', async () => {
    // reuse the original github.test setup style
    const mockGetOctokit = jest.fn();
    const mockContext: any = {
      repo: { owner: 'octocat', repo: 'hello-world' },
      ref: undefined,
      payload: {},
    };
    // @ts-ignore
    await (jest as any).unstable_mockModule('@actions/github', () => ({
      context: mockContext,
      getOctokit: (...args: any[]) => mockGetOctokit(...args),
    }));

    mockContext.payload = { pull_request: { number: 5, title: 'x' } };
    jest.resetModules();
    const mod = await import('../src/github.js');
    expect(mod.getPrFromContext()!.number).toBe(5);

    mockContext.payload = { event: { pull_request: { number: 7 } } };
    jest.resetModules();
    const mod2 = await import('../src/github.js');
    expect(mod2.getPrFromContext()!.number).toBe(7);

    mockContext.payload = { event: { pull_request: { title: 'T' } } };
    jest.resetModules();
    const mod3 = await import('../src/github.js');
    expect(mod3.getPrTitleFromContext()).toBe('T');
  });

  test('getLatestTag dedupes concurrent calls', async () => {
    const calls: string[] = [];
    const octokit = {
      rest: {
        repos: {
          listTags: async () => {
            calls.push('listTags');
            // simulate network latency
            await new Promise((r) => setTimeout(r, 10));
            return { data: [{ name: 'v1.2.3' }] };
          },
        },
      },
    };

    const ghMock = {
      context: { repo: { owner: 'o', repo: 'r' }, payload: {} },
      getOctokit: () => octokit,
    };
    // @ts-ignore
    await (jest as any).unstable_mockModule('@actions/github', () => ghMock);
    const mod = await import('../src/github.js');
    const p1 = mod.getLatestTag('tok');
    const p2 = mod.getLatestTag('tok');
    const [r1, r2] = await Promise.all([p1, p2]);
    expect((r1 as any).name).toBe('v1.2.3');
    expect((r2 as any).name).toBe('v1.2.3');
    // only a single underlying listTags call should have been made
    expect(calls.filter((c) => c === 'listTags').length).toBe(1);
  });

  // getLatestRelease removed: behavior tested indirectly via getLatestTag and other helpers

  test('getPrCommits dedupes concurrent calls and caches failures cleanup', async () => {
    const calls: string[] = [];
    const commits = [
      { sha: 'a', commit: { message: 'fix: x\nmore' } },
      { sha: 'b', commit: { message: 'docs: y' } },
    ];

    let failOnce = true;
    const octokit = {
      rest: {
        pulls: {
          listCommits: async () => {
            calls.push('listCommits');
            await new Promise((r) => setTimeout(r, 10));
            if (failOnce) {
              failOnce = false;
              throw new Error('transient');
            }
            return { data: commits };
          },
        },
      },
    };

    const ghMock = {
      context: {
        repo: { owner: 'o', repo: 'r' },
        payload: { pull_request: { number: 7 } },
        ref: undefined,
      },
      getOctokit: () => octokit,
    };

    // @ts-ignore
    await (jest as any).unstable_mockModule('@actions/github', () => ghMock);
    // @ts-ignore
    await (jest as any).unstable_mockModule('@actions/core', () => ({
      info: () => {},
      debug: () => {},
    }));

    const mod = await import('../src/github.js');
    // First concurrent calls: underlying call throws for both; wrapper should delete cache and return []
    const p1 = mod.getPrCommits('tok');
    const p2 = mod.getPrCommits('tok');
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toEqual([]);
    expect(r2).toEqual([]);
    // underlying call attempted once (both deduped)
    expect(calls.filter((c) => c === 'listCommits').length).toBe(1);

    // Now the next call should succeed (failOnce=false now)
    const r3 = await mod.getPrCommits('tok');
    expect(r3.length).toBe(2);
    expect(calls.filter((c) => c === 'listCommits').length).toBe(2);
  });

  // Edge cases
  test('getLatestTag returns undefined when listTags returns empty', async () => {
    const octokit = {
      rest: {
        repos: {
          listTags: async () => ({ data: [] }),
        },
      },
    };
    const ghMock = {
      context: { repo: { owner: 'o', repo: 'r' }, payload: {} },
      getOctokit: () => octokit,
    };
    // @ts-ignore
    await (jest as any).unstable_mockModule('@actions/github', () => ghMock);
    // @ts-ignore
    await (jest as any).unstable_mockModule('@actions/core', () => ({
      debug: () => {},
    }));
    const mod = await import('../src/github.js');
    const res = await mod.getLatestTag('tok');
    expect(res).toBeUndefined();
  });

  test('getPrCommits returns [] when no pull number in context and ref missing', async () => {
    const ghMock = {
      context: { repo: { owner: 'o', repo: 'r' }, payload: {}, ref: undefined },
      getOctokit: () => ({}),
    };
    // @ts-ignore
    await (jest as any).unstable_mockModule('@actions/github', () => ghMock);
    // @ts-ignore
    await (jest as any).unstable_mockModule('@actions/core', () => ({
      debug: () => {},
    }));
    const mod = await import('../src/github.js');
    const res = await mod.getPrCommits('');
    expect(res).toEqual([]);
  });

  test('getPrCommits extracts PR number from ref like refs/pull/123/merge', async () => {
    const calls: string[] = [];
    const octokit = {
      rest: {
        pulls: {
          listCommits: async () => {
            calls.push('listCommits');
            return { data: [] };
          },
        },
      },
    };
    const ghMock = {
      context: {
        repo: { owner: 'o', repo: 'r' },
        payload: {},
        ref: 'refs/pull/123/merge',
      },
      getOctokit: () => octokit,
    };
    // @ts-ignore
    await (jest as any).unstable_mockModule('@actions/github', () => ghMock);
    // @ts-ignore
    await (jest as any).unstable_mockModule('@actions/core', () => ({
      debug: () => {},
      info: () => {},
    }));
    const mod = await import('../src/github.js');
    const res = await mod.getPrCommits('tok');
    expect(calls.length).toBe(1);
    expect(res).toEqual([]);
  });

  test('synchronous exception in octokit call returns safe fallback', async () => {
    const octokit = {
      rest: {
        repos: {
          listTags: () => {
            throw new Error('sync');
          },
        },
      },
    };
    const ghMock = {
      context: { repo: { owner: 'o', repo: 'r' }, payload: {} },
      getOctokit: () => octokit,
    };
    // @ts-ignore
    await (jest as any).unstable_mockModule('@actions/github', () => ghMock);
    // @ts-ignore
    await (jest as any).unstable_mockModule('@actions/core', () => ({
      debug: () => {},
    }));
    const mod = await import('../src/github.js');
    const res = await mod.getLatestTag('tok');
    // since the call throws synchronously, wrapped promise resolves to undefined
    expect(await res).toBeUndefined();
  });

  test('getPrTitleFromContext extracts title from payload', async () => {
    const ghMock = {
      context: {
        repo: { owner: 'o', repo: 'r' },
        payload: { pull_request: { title: 'abc', number: 9 } },
      },
      getOctokit: () => ({}),
    };
    // @ts-ignore
    await (jest as any).unstable_mockModule('@actions/github', () => ghMock);
    const mod = await import('../src/github.js');
    const title = mod.getPrTitleFromContext();
    expect(title).toBe('abc');
  });

  // Helper-specific tests (merged from github_helpers.test.ts)
  test('getLatestAnnotatedTag resolves annotated tag object', async () => {
    const octokit = {
      rest: {
        git: {
          getRef: async () => ({
            data: { object: { sha: 'tagsha', type: 'tag' } },
          }),
          getTag: async () => ({
            data: {
              object: { sha: 'commitsha' },
              tagger: { name: 'Alice', date: '2020-01-01T00:00:00Z' },
              message: 'tag message',
            },
          }),
        },
      },
    };
    const ghMock = {
      context: { repo: { owner: 'o', repo: 'r' }, payload: {} },
      getOctokit: () => octokit,
    };
    // @ts-ignore
    await (jest as any).unstable_mockModule('@actions/github', () => ghMock);
    const mod = await import('../src/github.js');
    const t = await mod.getLatestAnnotatedTag('tok', 'v1.2.3');
    expect(t).toBeDefined();
    expect(t!.name).toBe('v1.2.3');
    expect(t!.commit).toBe('commitsha');
    expect(t!.author).toBe('Alice');
    expect(t!.content).toBe('tag message');
  });

  test('getLatestLightweightTag resolves lightweight tag to commit', async () => {
    const octokit = {
      rest: {
        git: {
          getRef: async () => ({
            data: { object: { sha: 'commitsha', type: 'commit' } },
          }),
        },
        repos: {
          getCommit: async () => ({
            data: {
              commit: {
                author: { name: 'Bob', date: '2021-02-02T00:00:00Z' },
                message: 'commit message',
              },
            },
          }),
        },
      },
    };
    const ghMock = {
      context: { repo: { owner: 'o', repo: 'r' }, payload: {} },
      getOctokit: () => octokit,
    };
    // @ts-ignore
    await (jest as any).unstable_mockModule('@actions/github', () => ghMock);
    const mod = await import('../src/github.js');
    const t = await mod.getLatestLightweightTag('tok', 'v1.2.3');
    expect(t).toBeDefined();
    expect(t!.name).toBe('v1.2.3');
    expect(t!.commit).toBe('commitsha');
    expect(t!.author).toBe('Bob');
    expect(t!.content).toBe('commit message');
  });
});
