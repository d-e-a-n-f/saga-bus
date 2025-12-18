#!/usr/bin/env node

/**
 * Release script - bumps versions, commits, tags, and pushes.
 * Usage: pnpm release [patch|minor|major]
 *
 * This triggers the GitHub Actions release workflow which publishes to npm.
 */

import { execSync } from "child_process";
import { readFileSync, writeFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";

const PACKAGES_DIR = "packages";

function run(cmd, options = {}) {
  console.log(`$ ${cmd}`);
  return execSync(cmd, { stdio: "inherit", ...options });
}

function runCapture(cmd) {
  return execSync(cmd, { encoding: "utf-8" }).trim();
}

function getPackagesToUpdate() {
  const packages = [];
  const packagesPath = join(process.cwd(), PACKAGES_DIR);
  const dirs = readdirSync(packagesPath, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const dir of dirs) {
    const pkgPath = join(packagesPath, dir, "package.json");
    if (!existsSync(pkgPath)) continue;

    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    if (pkg.private) continue;

    packages.push({
      name: pkg.name,
      version: pkg.version,
      path: pkgPath,
    });
  }

  return packages;
}

function bumpVersion(version, type) {
  const [major, minor, patch] = version.split(".").map(Number);
  switch (type) {
    case "major":
      return `${major + 1}.0.0`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "patch":
    default:
      return `${major}.${minor}.${patch + 1}`;
  }
}

async function main() {
  const bumpType = process.argv[2] || "patch";

  if (!["patch", "minor", "major"].includes(bumpType)) {
    console.error("Usage: pnpm release [patch|minor|major]");
    process.exit(1);
  }

  // Check for clean working directory
  const status = runCapture("git status --porcelain");
  if (status) {
    console.error("Error: Working directory is not clean. Commit or stash changes first.");
    process.exit(1);
  }

  // Get packages and current version
  const packages = getPackagesToUpdate();
  if (packages.length === 0) {
    console.error("No packages found to release.");
    process.exit(1);
  }

  const currentVersion = packages[0].version;
  const newVersion = bumpVersion(currentVersion, bumpType);

  console.log(`\nReleasing: ${currentVersion} → ${newVersion} (${bumpType})\n`);

  // Update all package versions
  for (const pkg of packages) {
    const content = JSON.parse(readFileSync(pkg.path, "utf-8"));
    content.version = newVersion;
    writeFileSync(pkg.path, JSON.stringify(content, null, 2) + "\n");
    console.log(`  Updated ${pkg.name} to ${newVersion}`);
  }

  // Commit and tag
  console.log("\nCommitting version bump...");
  run("git add -A");
  run(`git commit -m "chore: release v${newVersion}"`);
  run(`git tag v${newVersion}`);

  // Push
  console.log("\nPushing to remote...");
  run("git push");
  run("git push --tags");

  console.log(`
========================================
Release v${newVersion} initiated!
========================================

GitHub Actions will now:
1. Build and test
2. Publish ${packages.length} packages to npm
3. Create GitHub Release

Watch progress: https://github.com/d-e-a-n-f/saga-bus/actions
`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
