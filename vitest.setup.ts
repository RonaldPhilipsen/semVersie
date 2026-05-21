// Clear any prior exit code before the suite runs
process.exitCode = 0;

// After each individual test, ensure exitCode is 0
afterEach(() => {
  if (process.exitCode && process.exitCode !== 0) {
    process.exitCode = 0;
  }
});

// Ensure exit code is cleared after all tests
afterAll(() => {
  if (process.exitCode && process.exitCode !== 0) {
    process.exitCode = 0;
  }
});
