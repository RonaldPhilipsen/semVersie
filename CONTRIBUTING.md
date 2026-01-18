# Contributing to SemVersie

Thank you for your interest in contributing to SemVersie! We appreciate your
effort to help improve this project.

## Contribution Guidelines

**All external contributions must be made to the `develop` branch.**

When submitting pull requests, please ensure that:

- Your branch is based on the `develop` branch
- Your pull request targets the `develop` branch as the base branch

This helps us maintain a stable `main` branch and allows for proper testing and
validation of changes before they are released.

## Getting Started

1. Fork the repository
2. Create a new branch from `develop`
3. Make your changes
4. Submit a pull request against the `develop` branch

Thank you for contributing!

## Setting Up Your Environment

To get started with development, you'll need:

- Node.js 24 or higher
- npm (comes with Node.js)

Once you have these installed, run:

```bash
npm install
npm run build
```

This will install all dependencies and build the distribution files.

## Running Tests

To run the test suite:

```bash
npm test
```

To check code formatting and linting:

```bash
npm run lint
npm run format
```

Make sure all tests pass and there are no linting errors before submitting your
pull request.
