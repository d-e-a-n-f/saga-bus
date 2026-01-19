#!/usr/bin/env node

/**
 * Sequential publish script to avoid npm rate limiting (E429).
 * Publishes packages one at a time with a delay between each.
 * Creates git tags for successfully published packages.
 */

import { execSync, spawnSync } from "child_process";
import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";

const DELAY_MS = 2000; // 2 second delay between publishes
const PACKAGES_DIR = "packages";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function gitTagExists(tag) {
  const result = spawnSync("git", ["tag", "-l", tag], { encoding: "utf-8" });
  return result.stdout.trim() === tag;
}

function createGitTag(pkg) {
  const tag = `${pkg.name}@${pkg.version}`;
  if (gitTagExists(tag)) {
    console.log(`  Tag ${tag} already exists, skipping`);
    return;
  }
  try {
    execSync(`git tag ${tag}`, { stdio: "inherit" });
    console.log(`  Created git tag: ${tag}`);
  } catch (error) {
    console.warn(`  Warning: Failed to create git tag ${tag}`);
  }
}

function pushGitTags() {
  try {
    console.log("\nPushing git tags...");
    execSync("git push --tags", { stdio: "inherit" });
  } catch (error) {
    console.warn("Warning: Failed to push git tags");
  }
}

function getPublishablePackages() {
  const packages = [];
  const packagesPath = join(process.cwd(), PACKAGES_DIR);
  const dirs = readdirSync(packagesPath, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const dir of dirs) {
    const pkgPath = join(packagesPath, dir, "package.json");
    if (!existsSync(pkgPath)) continue;

    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));

    // Skip private packages
    if (pkg.private) continue;

    // Check if already published to npm
    try {
      const npmVersion = execSync(`npm view ${pkg.name} version 2>/dev/null`, {
        encoding: "utf-8",
      }).trim();
      if (npmVersion === pkg.version) {
        console.log(`  Skipping ${pkg.name}@${pkg.version} (already on npm)`);
        continue;
      }
    } catch {
      // Package doesn't exist on npm yet, needs publishing
    }

    packages.push({
      name: pkg.name,
      version: pkg.version,
      path: join(packagesPath, dir),
    });
  }

  return packages;
}

async function publishPackage(pkg) {
  console.log(`\nPublishing ${pkg.name}@${pkg.version}...`);
  try {
    execSync("pnpm publish --access public --no-git-checks", {
      cwd: pkg.path,
      stdio: "inherit",
    });
    console.log(`  Successfully published ${pkg.name}@${pkg.version}`);
    createGitTag(pkg);
    return true;
  } catch (error) {
    console.error(`  Failed to publish ${pkg.name}@${pkg.version}`);
    return false;
  }
}

async function main() {
  console.log("Finding packages to publish...\n");
  const packages = getPublishablePackages();

  if (packages.length === 0) {
    console.log("\nNo packages need publishing.");
    return;
  }

  console.log(`\nPublishing ${packages.length} packages sequentially...`);

  const results = { success: [], failed: [] };

  for (let i = 0; i < packages.length; i++) {
    const pkg = packages[i];

    if (i > 0) {
      console.log(`\nWaiting ${DELAY_MS}ms before next publish...`);
      await sleep(DELAY_MS);
    }

    const success = await publishPackage(pkg);
    if (success) {
      results.success.push(`${pkg.name}@${pkg.version}`);
    } else {
      results.failed.push(`${pkg.name}@${pkg.version}`);
    }
  }

  // Push all git tags at once
  if (results.success.length > 0) {
    pushGitTags();
  }

  console.log("\n========================================");
  console.log("Publishing Summary");
  console.log("========================================");
  console.log(`Success: ${results.success.length}`);
  if (results.success.length > 0) {
    results.success.forEach((name) => console.log(`  + ${name}`));
  }
  console.log(`Failed: ${results.failed.length}`);
  if (results.failed.length > 0) {
    results.failed.forEach((name) => console.log(`  - ${name}`));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
