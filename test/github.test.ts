import { jest } from "@jest/globals";

// Mock @actions/core for logging
jest.mock("@actions/core", () => ({
  debug: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
}));

// Provide a mutable context object and a mocked getOctokit
const mockGetOctokit = jest.fn();
const mockContext: any = {
  repo: { owner: "octocat", repo: "hello-world" },
  ref: undefined,
  payload: {},
};

jest.mock("@actions/github", () => ({
  context: mockContext,
  getOctokit: (...args: any[]) => mockGetOctokit(...args),
}));

describe("github helpers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // reset context payload and ref on the mocked module so the source module sees it
    const ghMock = jest.requireMock("@actions/github") as any;
    ghMock.context.payload = {};
    ghMock.context.ref = undefined;
  });

  test("getPrFromContext returns pull_request when at payload.pull_request", async () => {
    const ghMock = jest.requireMock("@actions/github") as any;
    ghMock.context.payload = { pull_request: { number: 5, title: "x" } };
    const mod = await import("../src/github");
    const pr = mod.getPrFromContext();
    expect(pr).toBeDefined();
    expect(pr!.number).toBe(5);
  });

  test("getPrFromContext returns pull_request when at event.pull_request wrapper", async () => {
    const ghMock = jest.requireMock("@actions/github") as any;
    ghMock.context.payload = {
      event: { pull_request: { number: 7, title: "y" } },
    };
    const mod = await import("../src/github");
    const pr2 = mod.getPrFromContext();
    expect(pr2).toBeDefined();
    expect(pr2!.number).toBe(7);
  });

  test("getPrTitleFromContext reads title from different payload shapes", async () => {
    const ghMock = jest.requireMock("@actions/github") as any;
    ghMock.context.payload = { event: { pull_request: { title: "A" } } };
    {
      const mod = await import("../src/github");
      expect(mod.getPrTitleFromContext()).toBe("A");
    }
    ghMock.context.payload = { pull_request: { title: "B" } };
    {
      const mod = await import("../src/github");
      expect(mod.getPrTitleFromContext()).toBe("B");
    }
  });

  test("getPrCommits returns [] when no PR number in context", async () => {
    const ghMock = jest.requireMock("@actions/github") as any;
    ghMock.context.payload = {};
    const mod = await import("../src/github");
    const commits1 = await mod.getPrCommits("fake-token");
    expect(commits1).toEqual([]);
  });

  test("getPrCommits returns [] when no token provided", async () => {
    const ghMock = jest.requireMock("@actions/github") as any;
    ghMock.context.payload = { pull_request: { number: 3 } };
    const mod = await import("../src/github");
    const commits2 = await mod.getPrCommits(undefined);
    expect(commits2).toEqual([]);
  });

  test("getPrCommits extracts PR number from refs/pull/:number/merge", async () => {
    const ghMock = jest.requireMock("@actions/github") as any;
    ghMock.context.ref = "refs/pull/42/merge";
    ghMock.context.repo = { owner: "o", repo: "r" };
    ghMock.context.payload = {};
    mockGetOctokit.mockReturnValueOnce({
      rest: {
        pulls: {
          listCommits: async () => ({
            data: [{ sha: "s1", commit: { message: "title1\nbody1" } }],
          }),
        },
      },
    } as any);

    const mod = await import("../src/github");
    const commits3 = await mod.getPrCommits("t");
    expect(commits3.length).toBe(1);
    expect(commits3[0].sha).toBe("s1");
    expect(commits3[0].title).toBe("title1");
    expect(commits3[0].body).toBe("body1");
  });

  test("getPrCommits handles octokit errors gracefully", async () => {
    const ghMock = jest.requireMock("@actions/github") as any;
    ghMock.context.payload = { pull_request: { number: 9 } };
    mockGetOctokit.mockImplementationOnce(
      () =>
        ({
          rest: {
            pulls: {
              listCommits: async () => {
                throw new Error("boom");
              },
            },
          },
        }) as any,
    );
    const mod = await import("../src/github");
    const commits4 = await mod.getPrCommits("tok");
    expect(commits4).toEqual([]);
  });

  test("getLatestTag returns undefined when no token provided", async () => {
    const ghMock = jest.requireMock("@actions/github") as any;
    ghMock.context.repo = { owner: "o", repo: "r" };
    const mod = await import("../src/github");
    const tag = await mod.getLatestTag(undefined);
    expect(tag).toBeUndefined();
  });

  test("getLatestTag returns tag name when octokit responds", async () => {
    const ghMock = jest.requireMock("@actions/github") as any;
    ghMock.context.repo = { owner: "o", repo: "r" };
    mockGetOctokit.mockReturnValueOnce({
      rest: {
        repos: {
          listTags: async () => ({ data: [{ name: "v1.2.3" }] }),
        },
      },
    } as any);
    const mod = await import("../src/github");
    const tag = await mod.getLatestTag("token");
    expect(tag).toBe("v1.2.3");
  });

  test("getLatestTag returns undefined when octokit returns empty list", async () => {
    const ghMock = jest.requireMock("@actions/github") as any;
    ghMock.context.repo = { owner: "o", repo: "r" };
    mockGetOctokit.mockReturnValueOnce({
      rest: {
        repos: {
          listTags: async () => ({ data: [] }),
        },
      },
    } as any);
    const mod = await import("../src/github");
    const tag = await mod.getLatestTag("token");
    expect(tag).toBeUndefined();
  });

  test("getLatestTag handles octokit errors and returns undefined", async () => {
    const ghMock = jest.requireMock("@actions/github") as any;
    ghMock.context.repo = { owner: "o", repo: "r" };
    mockGetOctokit.mockImplementationOnce(
      () =>
        ({
          rest: {
            repos: {
              listTags: async () => {
                throw new Error("boom");
              },
            },
          },
        }) as any,
    );
    const mod = await import("../src/github");
    const tag = await mod.getLatestTag("token");
    expect(tag).toBeUndefined();
  });

  test("getLatestRelease returns undefined when no token provided", async () => {
    const ghMock = jest.requireMock("@actions/github") as any;
    ghMock.context.repo = { owner: "o", repo: "r" };
    const mod = await import("../src/github");
    const rel = await mod.getLatestRelease(undefined);
    expect(rel).toBeUndefined();
  });

  test("getLatestRelease returns release when octokit responds", async () => {
    const ghMock = jest.requireMock("@actions/github") as any;
    ghMock.context.repo = { owner: "o", repo: "r" };
    mockGetOctokit.mockReturnValueOnce({
      rest: {
        repos: {
          getLatestRelease: async () => ({
            data: { id: 1, tag_name: "v9.9.9" },
          }),
        },
      },
    } as any);
    const mod = await import("../src/github");
    const rel = await mod.getLatestRelease("token");
    expect(rel).toBeDefined();
    expect(rel!.tag_name).toBe("v9.9.9");
  });

  test("getLatestRelease handles octokit errors and returns undefined", async () => {
    const ghMock = jest.requireMock("@actions/github") as any;
    ghMock.context.repo = { owner: "o", repo: "r" };
    mockGetOctokit.mockImplementationOnce(
      () =>
        ({
          rest: {
            repos: {
              getLatestRelease: async () => {
                throw new Error("boom");
              },
            },
          },
        }) as any,
    );
    const mod = await import("../src/github");
    const rel = await mod.getLatestRelease("token");
    expect(rel).toBeUndefined();
  });

  test("getAllRCsSinceLatestRelease returns [] when no token provided", async () => {
    const ghMock = jest.requireMock("@actions/github") as any;
    ghMock.context.repo = { owner: "o", repo: "r" };
    const { SemanticVersion } = await import("../src/semver");
    const mod = await import("../src/github");
    const baseline = new SemanticVersion(0, 0, 0);
    const rcs = await mod.getAllRCsSinceLatestRelease(
      undefined as any,
      baseline,
    );
    expect(rcs).toEqual([]);
  });

  test("getAllRCsSinceLatestRelease fetches RC tags since latest release", async () => {
    const ghMock = jest.requireMock("@actions/github") as any;
    ghMock.context.repo = { owner: "o", repo: "r" };
    const { SemanticVersion } = await import("../src/semver");
    const baseline = new SemanticVersion(1, 0, 0);
    mockGetOctokit.mockClear();
    mockGetOctokit.mockImplementation(
      () =>
        ({
          rest: {
            repos: {
              listTags: async () => ({
                data: [
                  { name: "v1.0.1-rc.1" },
                  { name: "v0.9.9-rc.2" },
                  { name: "v1.0.0" },
                  { name: "v1.1.0-rc.1" },
                ],
              }),
            },
          },
        }) as any,
    );

    const mod = await import("../src/github");
    const rcs = await mod.getAllRCsSinceLatestRelease("token", baseline);
    // Because an older tag (v0.9.9-rc.2) appears before v1.1.0-rc.1, the scan stops
    // and only v1.0.1-rc.1 is discovered.
    const names = rcs.map((t) => t.name);
    expect(names).toEqual(["v1.0.1-rc.1"]);
  });

  test("getAllRCsSinceLatestRelease stops scanning on older tag (early-exit)", async () => {
    const ghMock = jest.requireMock("@actions/github") as any;
    ghMock.context.repo = { owner: "o", repo: "r" };

    const { SemanticVersion } = await import("../src/semver");
    const baseline = new SemanticVersion(1, 0, 0);

    // Mock tags such that an older tag appears among the results and should cause early exit.
    // Order: newest-first. We include v1.2.0-rc.1 (new), v0.9.0-rc.1 (old -> should stop), v1.1.0-rc.1 (new but after stop, should not be seen)
    mockGetOctokit.mockClear();
    mockGetOctokit.mockImplementation(
      () =>
        ({
          rest: {
            repos: {
              listTags: async () => ({
                data: [
                  { name: "v1.2.0-rc.1" },
                  { name: "v0.9.0-rc.1" },
                  { name: "v1.1.0-rc.1" },
                ],
              }),
            },
          },
        }) as any,
    );

    const mod = await import("../src/github");
    const rcs = await mod.getAllRCsSinceLatestRelease("token", baseline);
    const names = rcs.map((t) => t.name);
    expect(names).toEqual(["v1.2.0-rc.1"]);
  });
});
