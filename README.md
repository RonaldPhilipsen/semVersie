# unnamed_versioning_tool

Generate releases based on conventional-commit style pull requests.

Features:

- calculates [semantic version](https://semver.org/) bumps from pull [conventional-commit](https://www.conventionalcommits.org/en/v1.0.0/) style pull requests.

The idea here is that it should be extremely simple and fast to setup semantic versioning.

The tool prescribes

This tool works well with [renovate](https://github.com/renovatebot/renovate) as long as you enable the `semanticCommits` prefix.

## Usage

```yaml
jobs:
  unnamed_versioning_tool:
    name: unnamed_versioning_tool
    runs-on: ubuntu-latest
    permissions:
      contents: write # to be able to push commits
    outputs:
      version: ${{ steps.unnamed_versioning_tool.outputs.version }}
    steps:
      name: unnamed_versioning_tool
      uses: RonaldPhilipsen/unnamed_versioning_tool@SHA256 # vX.Y.Z
```

### providing build metadata

If you want to provide build metadata to include in the versioning you can do that using the `build-metadata` input

```yaml
jobs:
  unnamed_versioning_tool:
    name: unnamed_versioning_tool
    runs-on: ubuntu-latest
    permissions:
      contents: write # to be able to push commits
    outputs:
      version: ${{ steps.unnamed_versioning_tool.outputs.version }}
    steps:
      name: unnamed_versioning_tool
      uses: RonaldPhilipsen/unnamed_versioning_tool@SHA256 # vX.Y.Z
      with: 
        build-metadata: ${{ github.sha }}
```
