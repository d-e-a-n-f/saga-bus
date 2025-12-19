#!/usr/bin/env node

/**
 * Simple unified release script for saga-bus monorepo
 *
 * Usage:
 *   pnpm release patch   # 0.1.4 → 0.1.5
 *   pnpm release minor   # 0.1.5 → 0.2.0
 *   pnpm release major   # 0.2.0 → 1.0.0
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { globSync } from 'glob';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Packages to skip (internal tooling, not published)
const SKIP_PACKAGES = ['@repo/eslint-config', '@repo/typescript-config'];

function run(cmd, options = {}) {
  console.log(`$ ${cmd}`);
  return execSync(cmd, { stdio: 'inherit', cwd: ROOT, ...options });
}

function runOutput(cmd) {
  return execSync(cmd, { cwd: ROOT, encoding: 'utf-8' }).trim();
}

function bumpVersion(current, type) {
  const [major, minor, patch] = current.split('.').map(Number);
  switch (type) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    default:
      throw new Error(`Invalid bump type: ${type}. Use: patch, minor, or major`);
  }
}

function getCurrentVersion() {
  // Get version from core package as source of truth
  const corePkg = JSON.parse(readFileSync(join(ROOT, 'packages/core/package.json'), 'utf-8'));
  return corePkg.version;
}

function getAllPackageJsonPaths() {
  return globSync('packages/*/package.json', { cwd: ROOT })
    .map(p => join(ROOT, p));
}

function updatePackageVersion(pkgPath, newVersion) {
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

  // Skip internal packages
  if (SKIP_PACKAGES.includes(pkg.name)) {
    return false;
  }

  pkg.version = newVersion;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  return true;
}

async function main() {
  const bumpType = process.argv[2];

  if (!bumpType || !['patch', 'minor', 'major'].includes(bumpType)) {
    console.error('Usage: pnpm release [patch|minor|major]');
    process.exit(1);
  }

  // Check for uncommitted changes
  const status = runOutput('git status --porcelain');
  if (status) {
    console.error('Error: Working directory has uncommitted changes.');
    console.error('Please commit or stash your changes before releasing.');
    process.exit(1);
  }

  // Check we're on main branch
  const branch = runOutput('git branch --show-current');
  if (branch !== 'main') {
    console.error(`Error: Must be on main branch to release. Currently on: ${branch}`);
    process.exit(1);
  }

  // Pull latest
  console.log('\n📥 Pulling latest changes...');
  run('git pull origin main');

  // Calculate new version
  const currentVersion = getCurrentVersion();
  const newVersion = bumpVersion(currentVersion, bumpType);
  const tag = `v${newVersion}`;

  console.log(`\n📦 Bumping version: ${currentVersion} → ${newVersion}`);

  // Update all package.json files
  const pkgPaths = getAllPackageJsonPaths();
  let updatedCount = 0;

  for (const pkgPath of pkgPaths) {
    if (updatePackageVersion(pkgPath, newVersion)) {
      updatedCount++;
    }
  }

  console.log(`   Updated ${updatedCount} packages`);

  // Commit version bump
  console.log('\n📝 Committing version bump...');
  run('git add .');
  run(`git commit -m "chore(release): ${tag}"`);

  // Create tag
  console.log(`\n🏷️  Creating tag: ${tag}`);
  run(`git tag -a ${tag} -m "Release ${tag}"`);

  // Push commit and tag
  console.log('\n🚀 Pushing to GitHub...');
  run('git push origin main');
  run(`git push origin ${tag}`);

  console.log(`
✅ Release ${tag} initiated!

The GitHub Action will now:
1. Create a GitHub Release with auto-generated notes
2. Build all packages
3. Publish to npm

Monitor progress at: https://github.com/d-e-a-n-f/saga-bus/actions
`);
}

main().catch(err => {
  console.error('Release failed:', err.message);
  process.exit(1);
});
