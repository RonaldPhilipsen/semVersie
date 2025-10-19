import { jest } from '@jest/globals';

// Consolidated GitHub-related tests (cache, edge cases, and helpers)

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
  const mod = await import('../src/github');
  expect(mod.getPrFromContext()!.number).toBe(5);

  mockContext.payload = { event: { pull_request: { number: 7 } } };
  jest.resetModules();
  const mod2 = await import('../src/github');
  expect(mod2.getPrFromContext()!.number).toBe(7);

  mockContext.payload = { event: { pull_request: { title: 'T' } } };
  jest.resetModules();
  const mod3 = await import('../src/github');
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
  const mod = await import('../src/github');
  const p1 = mod.getLatestTag('tok');
  const p2 = mod.getLatestTag('tok');
  const [r1, r2] = await Promise.all([p1, p2]);
  expect(r1).toBe('v1.2.3');
  expect(r2).toBe('v1.2.3');
  // only a single underlying listTags call should have been made
  expect(calls.filter((c) => c === 'listTags').length).toBe(1);
});

test('getLatestRelease dedupes concurrent calls', async () => {
  const calls: string[] = [];
  const octokit = {
    rest: {
      repos: {
        getLatestRelease: async () => {
          calls.push('getLatestRelease');
          await new Promise((r) => setTimeout(r, 10));
          return { data: { tag_name: 'v2.0.0', name: 'v2.0.0' } };
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
  const mod = await import('../src/github');
  const p1 = mod.getLatestRelease('tok');
  const p2 = mod.getLatestRelease('tok');
  const [r1, r2] = await Promise.all([p1, p2]);
  expect(r1?.tag_name).toBe('v2.0.0');
  expect(r2?.tag_name).toBe('v2.0.0');
  expect(calls.filter((c) => c === 'getLatestRelease').length).toBe(1);
});

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

  const mod = await import('../src/github');
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
  const octokit = { rest: { repos: { listTags: async () => ({ data: [] }) } } };
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
  const mod = await import('../src/github');
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
  const mod = await import('../src/github');
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
  const mod = await import('../src/github');
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
  const mod = await import('../src/github');
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
  const mod = await import('../src/github');
  const title = mod.getPrTitleFromContext();
  expect(title).toBe('abc');
});
