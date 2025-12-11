# Changesets

This repository uses [changesets](https://github.com/changesets/changesets) for version management and changelog generation.

## Adding a Changeset

When you make a change that should be released, run:

```bash
pnpm changeset
```

This will prompt you to:
1. Select which packages have changed
2. Choose the type of change (major, minor, patch)
3. Write a summary of the change

The changeset file will be created in this directory and should be committed with your PR.

## Release Process

1. Changesets accumulate in the `.changeset` directory
2. When ready to release, the Release workflow creates a "Version Packages" PR
3. Merging that PR:
   - Updates all package versions
   - Updates CHANGELOG.md files
   - Publishes to npm
   - Creates a GitHub release

## Versioning Guidelines

- **patch**: Bug fixes, documentation updates
- **minor**: New features, non-breaking changes
- **major**: Breaking changes

All `@saga-bus/*` packages are linked, so they release together with the same version.
