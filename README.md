# unnamed_versioning_tool

Simple semantic versioning for GitHub Actions and repositories that use
conventional commits.

What it does

This project calculates semantic-version bumps (major/minor/patch) from
conventional-commit style pull requests and can be used in a GitHub Actions
workflow to automatically determine the next release version.

Key features

- Infers semver bump from conventional commits
- Optional build metadata via workflow inputs
- Simple to integrate into CI workflows

## Usage (GitHub Actions)

Example workflow snippet that runs the action and exposes the computed version
as a job output:

```yaml
jobs:
  version:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    outputs:
      version: ${{ steps.version.outputs.version }}
    steps:
      - name: Calculate version
        id: version
        uses: RonaldPhilipsen/unnamed_versioning_tool@vX.Y.Z
        with:
          # Optional: pass build metadata (e.g. commit SHA)
          build-metadata: ${{ github.sha }}
```

Please note that running this action from a non-fixed version is _not_ supported

### Inputs
  

| Input             | Description                             | Required | Default               |
| ----------------- | --------------------------------------- | -------- | --------------------- |
| `github-token`    | GitHub token for API access             | Yes      | `${{ github.token }}` |
| `build-metadata`  | Build metadata to include in the semver | No       | ``               |

### outputs

| Output           | Description                             | Example                                                                                 |
| ---------------- | --------------------------------------- | --------------------------------------------------------------------------------------- |
| `release` | Boolean indicating whether a new release should be created | `true` |
| `release-notes`  | Generated release notes in markdown     | See [example](https://github.com/RonaldPhilipsen/unnamed_versioning_tool/releases/tag/v1.0.3) |
| `release-notes-file`  | Generated release notes in markdown, dumped to a file on disk, useful for large release notes    | |
| `prerelease` | Boolean indicating whether the created release is a prerelease | `false` |
| `tag` | The semantic version in `tag` format,  | `v1.2.3-rc.0` |
| `version` | The semantic version in `semver` format,  | `1.2.3-rc.0` |
| `version-pep-440` | The semantic version in `pep-440` format,  | `1.2.3rc0` |

## Development

The project uses Node.js for tests/build. Useful scripts (from `package.json`):

- npm run build — build the distribution (ncc)
- npm test — run tests
- npm run lint — run ESLint

## Contributing

Contributions are welcome. Please open issues or pull requests on the GitHub
repository. Follow the conventional commits format for PR titles so the tool can
infer versions correctly.
