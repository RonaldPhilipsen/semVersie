import { jest } from '@jest/globals';
import { SemanticVersion } from '../src/semver';

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
});

describe('git module (local git interactions)', () => {
  let prevNodeEnv: string | undefined;
  let savedJestWorker: string | undefined;

  beforeEach(() => {
    prevNodeEnv = process.env.NODE_ENV;
    // Ensure execGitCommand does not early-return due to test env detection
    savedJestWorker = process.env.JEST_WORKER_ID;
    // delete worker id so isTestEnvironment returns false
    delete process.env.JEST_WORKER_ID;
    // Force non-test NODE_ENV so execGitCommand uses spawn
    process.env.NODE_ENV = 'production';
  });

  afterEach(() => {
    process.env.NODE_ENV = prevNodeEnv;
    if (typeof savedJestWorker !== 'undefined') {
      process.env.JEST_WORKER_ID = savedJestWorker;
    } else {
      delete process.env.JEST_WORKER_ID;
    }
  });

  test('getCommits parses git log output into commits', async () => {
    const outputs: Record<
      string,
      { stdout: string; stderr: string; code?: number }
    > = {};
    const key = [
      'log',
      '--pretty=format:%H|||%s|||%b',
      '--no-merges',
      'base..head',
    ].join(' ');
    outputs[key] = {
      stdout: 'sha1|||Fix bug|||Details of fix\n\nMore\nsha2|||Add feature|||',
      stderr: '',
      code: 0,
    } as any;

    // Mock child_process.spawn
    // @ts-ignore
    await (jest as any).unstable_mockModule('child_process', () => ({
      spawn: (cmd: string, args: string[]) => {
        import { jest } from '@jest/globals';

        beforeEach(() => {
          jest.resetModules();
          jest.clearAllMocks();
        });

        describe('git module (local git interactions)', () => {
          let prevNodeEnv: string | undefined;
          let savedJestWorker: string | undefined;

          beforeEach(() => {
            import { jest } from '@jest/globals';

            beforeEach(() => {
              jest.resetModules();
              jest.clearAllMocks();
            });

            describe('git module (local git interactions)', () => {
              let prevNodeEnv: string | undefined;
              let savedJestWorker: string | undefined;

              beforeEach(() => {
                import { jest } from '@jest/globals';

                beforeEach(() => {
                  jest.resetModules();
                  jest.clearAllMocks();
                });

                describe('git module (local git interactions)', () => {
                  let prevNodeEnv: string | undefined;
                  let savedJestWorker: string | undefined;

                  beforeEach(() => {
                    import { jest } from '@jest/globals';

                    beforeEach(() => {
                      jest.resetModules();
                      jest.clearAllMocks();
                    });

                    describe('git module (local git interactions)', () => {
                      let prevNodeEnv: string | undefined;
                      let savedJestWorker: string | undefined;

                      beforeEach(() => {
                        prevNodeEnv = process.env.NODE_ENV;
                        savedJestWorker = process.env.JEST_WORKER_ID;
                        // Remove JEST_WORKER_ID so the module won't treat this as a test env
                        delete process.env.JEST_WORKER_ID;
                        process.env.NODE_ENV = 'production';
                      });

                      afterEach(() => {
                        process.env.NODE_ENV = prevNodeEnv;
                        if (typeof savedJestWorker !== 'undefined') {
                          process.env.JEST_WORKER_ID = savedJestWorker;
                        } else {
                          delete process.env.JEST_WORKER_ID;
                        }
                      });

                      test('getCommits parses git log output into commits', async () => {
                        const outputs: Record<string, { stdout: string; stderr: string; code?: number }> = {};
                        const key = ['log', "--pretty=format:%H|||%s|||%b", '--no-merges', 'base..head'].join(' ');

                        outputs[key] = {
                          stdout: 'sha1|||Fix bug|||Details of fix\n\nMore\nsha2|||Add feature|||',
                          stderr: '',
                          code: 0,
                        } as any;

                        // Mock child_process.spawn
                        // @ts-ignore
                        await (jest as any).unstable_mockModule('child_process', () => ({
                          spawn: (cmd: string, args: string[]) => {
                            const k = args.join(' ');
                            import { jest } from '@jest/globals';

                            beforeEach(() => {
                              jest.resetModules();
                              jest.clearAllMocks();
                            });

                            describe('git module (local git interactions)', () => {
                              let prevNodeEnv: string | undefined;
                              let savedJestWorker: string | undefined;

                              beforeEach(() => {
                                prevNodeEnv = process.env.NODE_ENV;
                                savedJestWorker = process.env.JEST_WORKER_ID;
                                // Remove JEST_WORKER_ID so the module won't treat this as a test env
                                delete process.env.JEST_WORKER_ID;
                                process.env.NODE_ENV = 'production';
                              });

                              afterEach(() => {
                                process.env.NODE_ENV = prevNodeEnv;
                                if (typeof savedJestWorker !== 'undefined') {
                                  process.env.JEST_WORKER_ID = savedJestWorker;
                                } else {
                                  delete process.env.JEST_WORKER_ID;
                                }
                              });

                              test('getCommits parses git log output into commits', async () => {
                                const outputs: Record<string, { stdout: string; stderr: string; code?: number }> = {};
                                const key = ['log', "--pretty=format:%H|||%s|||%b", '--no-merges', 'base..head'].join(' ');

                                outputs[key] = {
                                  stdout: 'sha1|||Fix bug|||Details of fix\n\nMore\nsha2|||Add feature|||',
                                  stderr: '',
                                  code: 0,
                                } as any;

                                // Mock child_process.spawn
                                // @ts-ignore
                                await (jest as any).unstable_mockModule('child_process', () => ({
                                  spawn: (cmd: string, args: string[]) => {
                                    const k = args.join(' ');
                                    const out = outputs[k] || { stdout: '', stderr: '', code: 0 };
                                    return {
                                      stdout: { on: (ev: string, cb: (...a: any[]) => void) => ev === 'data' && setImmediate(() => cb(Buffer.from(out.stdout))) },
                                      stderr: { on: (ev: string, cb: (...a: any[]) => void) => ev === 'data' && setImmediate(() => cb(Buffer.from(out.stderr))) },
                                      on: (ev: string, cb: (...a: any[]) => void) => { if (ev === 'close') setImmediate(() => cb(out.code ?? 0)); },
                                    } as any;
                                  },
                                }));

                                // mock core to silence logs
                                // @ts-ignore
                                await (jest as any).unstable_mockModule('@actions/core', () => ({ info: () => {}, debug: () => {} }));

                                const mod = await import('../src/git');
                                const commits = await mod.getCommits('base', 'head');

                                expect(commits.length).toBe(2);
                                expect(commits[0].sha).toBe('sha1');
                                expect(commits[0].title).toBe('Fix bug');
                                expect(commits[0].body).toContain('Details of fix');
                                expect(commits[1].sha).toBe('sha2');
                              });

                              test('getTags and getLatestTag parse tag lines and return latest', async () => {
                                const outputs: Record<string, { stdout: string; stderr: string; code?: number }> = {};
                                const key = [
                                  'for-each-ref',
                                  '--sort=-version:refname',
                                  "--format=%(refname:short)|||%(objectname)|||%(authorname)|||%(authordate:iso)|||%(contents)",
                                  'refs/tags',
                                ].join(' ');

                                outputs[key] = {
                                  stdout: 'v2.0.0|||c2|||Alice|||2021-01-01T12:00:00Z|||release notes for v2\nv1.5.0|||c1|||Bob|||2020-06-01T12:00:00Z|||notes for v1',
                                  stderr: '',
                                  code: 0,
                                } as any;

                                // @ts-ignore
                                await (jest as any).unstable_mockModule('child_process', () => ({
                                  spawn: (cmd: string, args: string[]) => {
                                    const k = args.join(' ');
                                    const out = outputs[k] || { stdout: '', stderr: '', code: 0 };
                                    return {
                                      stdout: { on: (ev: string, cb: (...a: any[]) => void) => ev === 'data' && setImmediate(() => cb(Buffer.from(out.stdout))) },
                                      stderr: { on: (ev: string, cb: (...a: any[]) => void) => ev === 'data' && setImmediate(() => cb(Buffer.from(out.stderr))) },
                                      on: (ev: string, cb: (...a: any[]) => void) => { if (ev === 'close') setImmediate(() => cb(out.code ?? 0)); },
                                    } as any;
                                  },
                                }));

                                // @ts-ignore
                                await (jest as any).unstable_mockModule('@actions/core', () => ({ info: () => {}, debug: () => {} }));

                                const mod = await import('../src/git');
                                const latest = await mod.getLatestTag();
                                expect(latest).not.toBeNull();
                                expect((latest as any).name).toBe('v2.0.0');
                              });

                              test('getFileContent retrieves file at head and at ref', async () => {
                                const outputs: Record<string, { stdout: string; stderr: string; code?: number }> = {};
                                outputs['show HEAD:README.md'] = { stdout: 'local readme content', stderr: '', code: 0 } as any;
                                outputs['show abc123:package.json'] = { stdout: '{"name":"x"}', stderr: '', code: 0 } as any;

                                // @ts-ignore
                                await (jest as any).unstable_mockModule('child_process', () => ({
                                  spawn: (cmd: string, args: string[]) => {
                                    const k = args.join(' ');
                                    const out = outputs[k] || { stdout: '', stderr: '', code: 1 };
                                    return {
                                      stdout: { on: (ev: string, cb: (...a: any[]) => void) => ev === 'data' && setImmediate(() => cb(Buffer.from(out.stdout))) },
                                      stderr: { on: (ev: string, cb: (...a: any[]) => void) => ev === 'data' && setImmediate(() => cb(Buffer.from(out.stderr))) },
                                      on: (ev: string, cb: (...a: any[]) => void) => { if (ev === 'close') setImmediate(() => cb(out.code ?? 0)); },
                                    } as any;
                                  },
                                }));

                                // @ts-ignore
                                await (jest as any).unstable_mockModule('@actions/core', () => ({ info: () => {}, debug: () => {} }));

                                const mod = await import('../src/git');
                                const headContent = await mod.getFileContent('README.md');
                                expect(headContent).toBe('local readme content');
                                const refContent = await mod.getFileContent('package.json', 'abc123');
                                expect(refContent).toBe('{"name":"x"}');
                              });

                              test('getReleaseCandidates filters RC tags', async () => {
                                const outputs: Record<string, { stdout: string; stderr: string; code?: number }> = {};
                                const key = [
                                  'for-each-ref',
                                  '--sort=-version:refname',
                                  "--format=%(refname:short)|||%(objectname)|||%(authorname)|||%(authordate:iso)|||%(contents)",
                                  'refs/tags',
                                ].join(' ');

                                outputs[key] = {
                                  stdout: 'v1.1.0-rc.0|||c1|||Alice|||2021-01-01T12:00:00Z|||rc0\nv1.1.0-rc.1|||c2|||Bob|||2021-02-01T12:00:00Z|||rc1\nv1.0.0|||c0|||Z|||2020-01-01T12:00:00Z|||release',
                                  stderr: '',
                                  code: 0,
                                } as any;

                                // @ts-ignore
                                await (jest as any).unstable_mockModule('child_process', () => ({
                                  spawn: (cmd: string, args: string[]) => {
                                    const k = args.join(' ');
                                    const out = outputs[k] || { stdout: '', stderr: '', code: 0 };
                                    return {
                                      stdout: { on: (ev: string, cb: (...a: any[]) => void) => ev === 'data' && setImmediate(() => cb(Buffer.from(out.stdout))) },
                                      stderr: { on: (ev: string, cb: (...a: any[]) => void) => ev === 'data' && setImmediate(() => cb(Buffer.from(out.stderr))) },
                                      on: (ev: string, cb: (...a: any[]) => void) => { if (ev === 'close') setImmediate(() => cb(out.code ?? 0)); },
                                    } as any;
                                  },
                                }));

                                // @ts-ignore
                                await (jest as any).unstable_mockModule('@actions/core', () => ({ info: () => {}, debug: () => {} }));

                                const mod = await import('../src/git');
                                const baseline = new (await import('../src/semver')).SemanticVersion(1, 0, 0);
                                const rcs = await mod.getReleaseCandidates(baseline);
                                // Expect to find rc tags filtered relative to baseline
                                expect(rcs.length).toBeGreaterThan(0);
                              });
                            });
