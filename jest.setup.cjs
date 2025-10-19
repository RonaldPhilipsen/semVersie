// Jest setup file to reset process.exitCode so tests don't fail the runner
// when tested code writes to stderr and sets process.exitCode.

// Clear any prior exit code before the suite runs
process.exitCode = 0;

// After each individual test, ensure exitCode is 0
afterEach(() => {
  if (process.exitCode && process.exitCode !== 0) {
    // reset so Jest itself can determine pass/fail by assertions only
    process.exitCode = 0;
  }
});

// Ensure exit code is cleared after all tests
afterAll(() => {
  if (process.exitCode && process.exitCode !== 0) {
    process.exitCode = 0;
  }
});
